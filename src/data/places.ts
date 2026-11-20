import atlasRaw from "./atlas.json";

/** Every place is somewhere you go outside. No cities, no built monuments. */
export type PlaceType = "peak" | "park" | "landmark";

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
    hue: hueFor(row.type, row.slug),
    wd: row.wd,
    also: row.also,
  };
});

export const PLACES: Place[] = ATLAS;

export const bySlug = new Map(PLACES.map((p) => [p.slug, p]));
