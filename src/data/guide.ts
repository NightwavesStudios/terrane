/**
 * Curated Experiences.
 *
 * An Experience is one significant destination with an editorial page, not a
 * group of places and not a POI. The selection is committed in
 * `guide-selection.json`; the page record is generated from the same detail,
 * photograph and trail data the rest of Terrane uses, so every sentence can be
 * traced to a record. A destination that is merely present in the geographic
 * database never becomes an Experience by itself.
 *
 * Collections are a separate domain (`data/collections.ts`), a separate index
 * (`collection-index/`) and a separate route. Collections gather Experiences at
 * country, range, area or recorded-trail scale; Experiences stay destinations.
 */

export type GuideKindId =
  | "park"
  | "peak"
  | "waterfall"
  | "lake"
  | "coast"
  | "landmark";

export interface GuideKind {
  id: GuideKindId;
  label: string;
  one: string;
  colour: string;
  blurb: string;
}

export const GUIDE_KINDS: GuideKind[] = [
  {
    id: "park",
    label: "Parks",
    one: "Park",
    colour: "#8fc79a",
    blurb: "National, state and provincial parks, reserves and protected areas.",
  },
  {
    id: "peak",
    label: "Peaks",
    one: "Peak",
    colour: "#8ab4d8",
    blurb: "Summits, volcanoes, glaciers and mountain ranges.",
  },
  {
    id: "waterfall",
    label: "Waterfalls",
    one: "Waterfall",
    colour: "#7cc7d8",
    blurb: "Named falls and cascades with a recorded location.",
  },
  {
    id: "lake",
    label: "Lakes",
    one: "Lake",
    colour: "#6fb9c9",
    blurb: "Lakes and lochs that anchor a landscape.",
  },
  {
    id: "coast",
    label: "Coast",
    one: "Coastal place",
    colour: "#d8b47c",
    blurb: "Islands, beaches and coastal features.",
  },
  {
    id: "landmark",
    label: "Landmarks",
    one: "Landmark",
    colour: "#c6a1d8",
    blurb: "Canyons, valleys, deserts and other singular natural features.",
  },
];

const KIND_BY_ID = new Map(GUIDE_KINDS.map((kind) => [kind.id, kind]));

export function guideKind(id: string): GuideKind {
  return KIND_BY_ID.get(id as GuideKindId) ?? GUIDE_KINDS[5];
}

export interface GuidePhoto {
  url: string;
  w?: number;
  h?: number;
  max?: number;
  credit: string;
  licence: string;
  licenceUrl?: string;
  page: string;
}

export interface GuideTrail {
  name: string;
  km: number;
  difficulty?: string;
  src?: string;
}

export interface GuideSource {
  label: string;
  url: string;
}

/** Another destination recorded near the Experience, with its own page. */
export interface GuideAssociated {
  slug: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  km: number;
}

export interface GuideStats {
  places: number;
  trails: number;
  photos: number;
  elevation?: number;
}

export interface GuideExperience {
  slug: string;
  name: string;
  kind: GuideKindId;
  country?: string;
  region?: string;
  center: { lat: number; lon: number };
  bounds: [number, number, number, number];
  hue: number;
  /** One sentence for cards, search and the page description. */
  summary: string;
  /** Grounded paragraphs: what the record says, and what surrounds it. */
  overview: string[];
  /** Why this destination is in the curated catalogue, one fact per line. */
  reasons: string[];
  associated: GuideAssociated[];
  trails: GuideTrail[];
  photo?: GuidePhoto;
  photos: GuidePhoto[];
  source: GuideSource;
  commons?: string;
  official?: string;
  stats: GuideStats;
  /** Position in the committed editorial selection, 1-based. */
  rank: number;
  sourceType: "curated";
  generated: string;
}

/** The compact row the catalogue and map read without loading a shard. */
export interface GuideCatalogRow {
  slug: string;
  name: string;
  kind: GuideKindId;
  country?: string;
  region?: string;
  lat: number;
  lon: number;
  hue: number;
  summary: string;
  placeCount: number;
  trailCount: number;
  photo?: Pick<GuidePhoto, "url" | "credit" | "licence" | "max">;
  associatedNames: string[];
}

const BASE_HUE: Record<GuideKindId, number> = {
  park: 143,
  peak: 206,
  waterfall: 190,
  lake: 184,
  coast: 34,
  landmark: 220,
};

/** Stable ridge-art hue for a kind and slug; the generator writes the value. */
export function guideHue(kind: string, slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  const base = BASE_HUE[kind as GuideKindId] ?? 206;
  return (base + (Math.abs(hash) % 30) - 15 + 360) % 360;
}
