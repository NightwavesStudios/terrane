import categoriesFile from "./experience-categories.json";

/**
 * Experiences: routes the map suggests, generated from geography.
 *
 * An experience is a small group of destinations that belong together on the
 * ground — peaks above one valley, a park and its lakes, a compact weekend. It is
 * not a hand-written itinerary: `scripts/build-experiences.mjs` builds every
 * record from the same destination, detail and trail-link files the rest of the
 * app uses, and writes committed shards under `experience-index/`.
 *
 * `source` is `"generated"` for every record today. The field exists so a later
 * hand-curated route can join the same list without a schema change; nothing in
 * the UI assumes it is generated.
 *
 * Facts only: a title names recorded geography, a description counts the stops
 * and the trails around them, and the distance is labelled as a straight line.
 * Practical POIs are never baked in — they are fetched from the cell store on the
 * page, where their source can be credited and their coverage caveated.
 */

export type ExperienceCategoryId =
  | "weekend"
  | "mountain"
  | "hiking"
  | "camping"
  | "park";

export interface ExperienceCategory {
  id: ExperienceCategoryId;
  label: string;
  one: string;
  colour: string;
  blurb: string;
}

export const EXPERIENCE_CATEGORIES = categoriesFile.categories as ExperienceCategory[];

const BY_ID = new Map(
  EXPERIENCE_CATEGORIES.map((category) => [category.id, category]),
);

export function experienceCategory(id: string): ExperienceCategory {
  return BY_ID.get(id as ExperienceCategoryId) ?? EXPERIENCE_CATEGORIES[0];
}

/** A credited Wikimedia Commons photograph, as the detail harvest records it. */
export interface ExperiencePhoto {
  url: string;
  w?: number;
  h?: number;
  /** Widest thumbnail the original file can serve. */
  max?: number;
  credit: string;
  licence: string;
  licenceUrl?: string;
  page?: string;
}

export interface ExperienceTrail {
  name: string;
  km: number;
  difficulty?: string;
  src?: string;
}

export interface ExperienceStop {
  slug: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  /** Position in the route, starting at 1. */
  index: number;
  /** Straight-line distance from the previous stop; 0 for the first. */
  legKm: number;
  elevation?: number;
  country?: string;
  region?: string;
  photo?: ExperiencePhoto;
  /** Up to three named trails within 10 km. */
  trails: ExperienceTrail[];
}

export interface ExperienceStats {
  stops: number;
  peaks: number;
  parks: number;
  trails: number;
  photos: number;
  elevationMin?: number;
  elevationMax?: number;
}

export interface Experience {
  slug: string;
  title: string;
  category: ExperienceCategoryId;
  /** One sentence, used for cards, search results and the page description. */
  summary: string;
  /** Two factual paragraphs. */
  description: string[];
  country?: string;
  region?: string;
  center: { lat: number; lon: number };
  /** [west, south, east, north]. */
  bounds: [number, number, number, number];
  /** Ridge-art hue, derived from the category and the slug. */
  hue: number;
  /** Straight-line sum of the legs between stops. */
  distanceKm: number;
  durationHours: number;
  /** The model behind the estimate, printed beside it. */
  durationBasis: string;
  days: number;
  stops: ExperienceStop[];
  photos: ExperiencePhoto[];
  stats: ExperienceStats;
  source: "generated" | "curated";
  generated: string;
}

/** The compact row the list, search and cards read without loading a shard. */
export interface ExperienceCatalogRow {
  slug: string;
  title: string;
  category: ExperienceCategoryId;
  country?: string;
  region?: string;
  lat: number;
  lon: number;
  stopCount: number;
  distanceKm: number;
  durationHours: number;
  days: number;
  hue: number;
  photo?: Pick<ExperiencePhoto, "url" | "credit" | "licence" | "max">;
  stopNames: string[];
}

const BASE_HUE: Record<ExperienceCategoryId, number> = {
  weekend: 34,
  mountain: 206,
  hiking: 118,
  camping: 26,
  park: 148,
};

/**
 * Stable ridge-art hue for a category and slug. The generator writes the value
 * into each record; this is the fallback for a hand-written record.
 */
export function experienceHue(category: string, slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  const base = BASE_HUE[category as ExperienceCategoryId] ?? 206;
  return (base + (Math.abs(hash) % 34) - 17 + 360) % 360;
}
