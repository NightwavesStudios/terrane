import atlasRaw from "./atlas.json";
import { kmBetween } from "../lib/geo";

/** Every place is somewhere you go outside. No cities, no built monuments. */
export type PlaceType = "peak" | "park" | "landmark";

export const TYPE_LABEL: Record<PlaceType, string> = {
  peak: "Peak",
  park: "Park",
  landmark: "Landmark",
};

export const TYPE_LABEL_PLURAL: Record<PlaceType, string> = {
  peak: "Peaks",
  park: "Parks",
  landmark: "Landmarks",
};

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
   scripts/build-atlas.py. Structured records only: real coordinates and facts,
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

const ATLAS: Place[] = (atlasRaw as AtlasRow[]).map((row) => {
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
    hue: (HUE_BY_TYPE[row.type] + (hash(row.slug) % 34) - 17 + 360) % 360,
    wd: row.wd,
    also: row.also,
  };
});

export const PLACES: Place[] = ATLAS;

export const bySlug = new Map(PLACES.map((p) => [p.slug, p]));

/** How far it is to each activity, in plain words. */
const ACTIVITY: Record<PlaceType, string> = {
  peak: "Hiking · scrambling",
  park: "Walking · wildlife",
  landmark: "Sightseeing",
};

export type Around = {
  radiusKm: number;
  /** Nearest atlas entries, closest first. */
  nearest: { place: Place; km: number }[];
  /** Counts per activity, largest first, empty types dropped. */
  activities: { type: PlaceType; label: string; count: number }[];
};

/**
 * What is around a place, computed from the atlas rather than from a trail or POI
 * dataset: one pass over the destination rows, keep what falls inside the radius, group
 * by the activity its type implies, and take the closest few for the list.
 *
 * Deliberately a proxy. There is no route database behind this, so the honest
 * thing to show is "what kinds of place are near, and how near" — not invented
 * trail names or a difficulty for a walk nobody has surveyed here.
 */
export function aroundPlace(place: Place, radiusKm = 30): Around {
  const inside: { place: Place; km: number }[] = [];
  for (const other of PLACES) {
    if (other.slug === place.slug) continue;
    const km = kmBetween(place.lat, place.lon, other.lat, other.lon);
    if (km <= radiusKm) inside.push({ place: other, km });
  }
  inside.sort((a, b) => a.km - b.km);

  const counts = new Map<PlaceType, number>();
  for (const { place: p } of inside) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  const activities = [...counts.entries()]
    .map(([type, count]) => ({ type, label: ACTIVITY[type], count }))
    .sort((a, b) => b.count - a.count);

  return { radiusKm, nearest: inside.slice(0, 6), activities };
}
