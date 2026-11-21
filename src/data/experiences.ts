import categoriesFile from "./experience-categories.json";

/**
 * Experiences: collections of remarkable places, not itineraries.
 *
 * An experience gathers a few destinations that belong together on the ground —
 * peaks above one valley, a park and its lakes, a compact group for a short trip
 * — and presents them as things worth exploring. It deliberately makes no claim
 * about how to travel between them: no walking days, no legs, no distance or
 * duration estimates. The committed data records where each place is and what it
 * is, not a route.
 *
 * `scripts/build-experiences.mjs` builds every record from the same destination,
 * detail and trail-link files the rest of the app uses, and writes committed
 * shards under `experience-index/`. A place is only eligible when its detail
 * record carries a Wikipedia URL, so every stop on every page has a Terrane page
 * and an external reference. `source` stays `"generated"` for every record today;
 * a later hand-curated collection can join the same list unchanged.
 *
 * Practical places (campsites, huts, trailheads) are never baked in — they are
 * read from the cell store on the page, where their source is credited and their
 * coverage caveated.
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

/** The external reference that verifies a place. */
export interface ExperienceSource {
  label: string;
  url: string;
}

export interface ExperienceStop {
  slug: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  elevation?: number;
  country?: string;
  region?: string;
  /** The recorded Wikidata description, one factual line. */
  note?: string;
  /** Wikipedia article for this place. Required by the generator. */
  source: ExperienceSource;
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
  /** Places with an external reference. Equals `stops` by construction. */
  sourced: number;
  elevationMin?: number;
  elevationMax?: number;
}

export interface Experience {
  slug: string;
  title: string;
  category: ExperienceCategoryId;
  /** One sentence, used for cards, search results and the page description. */
  summary: string;
  /** Two factual paragraphs: what the collection holds, and how it is sourced. */
  description: string[];
  country?: string;
  region?: string;
  center: { lat: number; lon: number };
  /** [west, south, east, north]. */
  bounds: [number, number, number, number];
  /** Ridge-art hue, derived from the category and the slug. */
  hue: number;
  /** Bounding-box diagonal, the collection's extent in kilometres. */
  spanKm: number;
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
  spanKm: number;
  hue: number;
  /** Places with a Wikipedia reference; equals `stopCount` today. */
  sourceCount: number;
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
