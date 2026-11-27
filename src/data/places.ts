import { useSyncExternalStore } from "react";

/** Every place is somewhere you go outside. No cities, no built monuments. */
export type PlaceType = "peak" | "park" | "landmark";

export interface Place {
  slug: string;
  name: string;
  type: PlaceType;
  /** State, province or range — the line under the name. */
  region?: string;
  country: string;
  lat: number;
  lon: number;
  /** Metres. Present for anything with a summit or a known high point. */
  elevation?: number;
  /** Metres of topographic prominence, where Wikidata records it. */
  prominence?: number;
  /** Drives the gradient art on cards and the place hero. */
  hue: number;
  /** Reveal band (0 world … 5 tail), assigned by `rankPlaces`. */
  band?: number;
  /** Wikidata item, for atlas records. */
  wd?: string;
  /** Every other row that described this same place, so a merge keeps its sources. */
  also?: { src?: "atlas" | "wikidata"; id?: string; name?: string }[];
}

/* ── Atlas ──────────────────────────────────────────────────
   National parks, peaks and natural landmarks pulled from Wikidata (CC0) by
   the atlas build. Structured records only: real coordinates and facts,
   no invented prose. Peaks are ranked by topographic prominence, so the set is
   major summits rather than every high shoulder on the map. */

interface AtlasRow {
  wd: string;
  slug: string;
  name: string;
  type: "peak" | "park" | "landmark";
  country: string;
  lat: number;
  lon: number;
  elevation: number | null;
  prominence?: number | null;
  also?: { src?: "atlas" | "wikidata"; id?: string; name?: string }[];
}

const COUNTRY_FIX: Record<string, string> = {
  "United States of America": "United States",
  "Russian Federation": "Russia",
  "People's Republic of China": "China",
  "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
  "Czech Republic": "Czechia",
  "Republic of Ireland": "Ireland",
  "Kingdom of the Netherlands": "Netherlands",
  "Republic of South Africa": "South Africa",
  "Türkiye": "Turkey",
};

const HUE_BY_TYPE: Record<PlaceType, number> = {
  peak: 206,
  park: 143,
  landmark: 34,
};

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const HUE_BY_CAT: Record<string, number> = {
  peak: 206,
  volcano: 206,
  range: 206,
  park: 143,
  reserve: 143,
  island: 143,
  waterfall: 190,
  lake: 190,
  glacier: 190,
  spring: 190,
  beach: 34,
  desert: 34,
  cave: 220,
  canyon: 220,
  valley: 220,
  landmark: 34,
};

/** Stable hue for a category, varied by slug so neighbouring places differ. */
export function hueFor(cat: string, slug: string): number {
  const base = HUE_BY_CAT[cat] ?? HUE_BY_TYPE.landmark;
  return (base + (hash(slug) % 34) - 17 + 360) % 360;
}

function toPlace(row: AtlasRow): Place {
  const country = COUNTRY_FIX[row.country] ?? row.country;
  return {
    slug: row.slug,
    name: row.name,
    type: row.type,
    country,
    lat: row.lat,
    lon: row.lon,
    elevation: row.elevation ?? undefined,
    prominence: row.prominence ?? undefined,
    hue: hueFor(row.type, row.slug),
    wd: row.wd,
    also: row.also,
  };
}

/* ── the deferred atlas ────────────────────────────────────
   The rows are 200 kB and nothing on the first screen needs them: at world zoom
   the globe paints before any atlas point is legible. Kept as their own chunk,
   fetched once the shell is up, they stop delaying first paint and the map's
   own chunk on a slow connection.

   `PLACES` and `bySlug` are filled in place rather than replaced, so every
   synchronous reader keeps its shape. A reader that renders a list subscribes
   with `useAtlas()` and re-renders once, when the rows arrive. */
export const PLACES: Place[] = [];
export const bySlug = new Map<string, Place>();

let atlasVersion = 0;
let atlasLoad: Promise<Place[]> | null = null;
const atlasListeners = new Set<() => void>();

/** Load the atlas once. Called after the first screen, never at import time. */
export function loadAtlas(): Promise<Place[]> {
  if (atlasLoad) return atlasLoad;
  atlasLoad = import("./atlas.json").then((mod) => {
    const rows = (mod.default as AtlasRow[]).map(toPlace);
    PLACES.length = 0;
    PLACES.push(...rows);
    bySlug.clear();
    for (const place of rows) bySlug.set(place.slug, place);
    atlasVersion += 1;
    for (const listener of [...atlasListeners]) listener();
    return rows;
  });
  return atlasLoad;
}

export function subscribeAtlas(listener: () => void): () => void {
  atlasListeners.add(listener);
  return () => {
    atlasListeners.delete(listener);
  };
}

/** 0 until the atlas arrives, then 1. Use it as a memo dependency. */
export function useAtlas(): number {
  return useSyncExternalStore(
    subscribeAtlas,
    () => atlasVersion,
    () => atlasVersion,
  );
}
