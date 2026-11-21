import scopesFile from "./collection-scopes.json";
import type { GuideCatalogRow, GuideKindId, GuidePhoto } from "./guide";

/**
 * Collections: wide groups of curated Experiences.
 *
 * An Experience is one destination. A Collection gathers Experiences at the
 * scale where a trip is actually planned — a country, a great mountain range, a
 * large area inside a big country, or the route of a recorded long-distance
 * trail. Membership is committed in `collection-groups.json`; every other field
 * is generated from `guide-index/` by `scripts/build-collections.mjs`.
 *
 * Collections are not itineraries and not a second destination model. They are
 * a browse layer over the curated catalogue: every member links to its own
 * Experience page, and every Experience has a Wikipedia source there.
 */

export type CollectionScopeId = "country" | "range" | "area" | "trail";

export interface CollectionScope {
  id: CollectionScopeId;
  label: string;
  one: string;
  colour: string;
  blurb: string;
}

export const COLLECTION_SCOPES = scopesFile.scopes as CollectionScope[];

const BY_ID = new Map(COLLECTION_SCOPES.map((scope) => [scope.id, scope]));

export function collectionScope(id: string): CollectionScope {
  return BY_ID.get(id as CollectionScopeId) ?? COLLECTION_SCOPES[0];
}

export interface CollectionStats {
  experiences: number;
  /** Sum of the member Experiences' recorded nearby places. */
  places: number;
  /** Sum of the member Experiences' recorded nearby named trails. */
  trails: number;
  /** Member Experiences with at least one credited photograph. */
  photos: number;
  /** Countries named by the committed group definition. */
  countries: number;
  /** Experiences with a Wikipedia source; equals `experiences` today. */
  sourced: number;
}

export interface CollectionRecord {
  slug: string;
  title: string;
  scope: CollectionScopeId;
  /** Human-readable geography, e.g. "Central Europe" or "The American Southwest". */
  where: string;
  countries: string[];
  /** One sentence for cards, search results and the page description. */
  summary: string;
  /** Two factual paragraphs: what the group holds, and how it is sourced. */
  description: string[];
  center: { lat: number; lon: number };
  /** [west, south, east, north]. */
  bounds: [number, number, number, number];
  /** Ridge-art hue, derived from the scope and slug. */
  hue: number;
  /** Bounding-box diagonal of the member Experiences, in kilometres. */
  spanKm: number;
  experiences: GuideCatalogRow[];
  photos: GuidePhoto[];
  /** Trails named as the thread of a `trail` collection. */
  basisTrails?: string[];
  stats: CollectionStats;
  source: "generated";
  generated: string;
}

/** The compact row the list, search and cards read without loading a shard. */
export interface CollectionCatalogRow {
  slug: string;
  title: string;
  scope: CollectionScopeId;
  where: string;
  countries: string[];
  lat: number;
  lon: number;
  experienceCount: number;
  countryCount: number;
  placeCount: number;
  trailCount: number;
  /** Counts by Experience kind, for a compact factual line. */
  kinds: Partial<Record<GuideKindId, number>>;
  hue: number;
  photo?: Pick<GuidePhoto, "url" | "credit" | "licence" | "max">;
  experienceNames: string[];
  /** Member slugs, so an Experience page can find its Collection without a shard. */
  experienceSlugs: string[];
}

const BASE_HUE: Record<CollectionScopeId, number> = {
  country: 206,
  range: 148,
  area: 34,
  trail: 26,
};

/** Stable ridge-art hue for a scope and slug. The generator writes the value. */
export function collectionHue(scope: string, slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  const base = BASE_HUE[scope as CollectionScopeId] ?? 206;
  return (base + (Math.abs(hash) % 34) - 17 + 360) % 360;
}
