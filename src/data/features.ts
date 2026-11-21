import categoriesFile from "./categories.json";
import bandsFile from "./bands.json";
import sourcesFile from "./sources.json";
import type { Place } from "./places";
import type { GuideKindId } from "./guide";

const BANDS = (bandsFile as unknown as { bands: { dot: number; label: number }[] }).bands;

/**
 * One feature model for everything the map draws.
 *
 * A peak, a national park, a campsite and a car park are the same kind of thing:
 * a point with a category. What used to be four separate products — "named
 * places", "famous places", "everything mapped", "camps nearby" — is one record
 * with a `cat`, a source and a zoom at which it becomes worth showing.
 *
 * `src` and `quality` still exist, because provenance and confidence matter when
 * you are deciding what to trust; they never decide which switch a pin belongs
 * under, which card it opens, or what it is called on screen.
 *
 * `dot` is the zoom its dot appears at and `lz` the zoom its name does. They are
 * per-feature because fame is uneven: Everest and a 2,400 m shoulder are both
 * peaks, and the map has no business drawing them at the same time.
 */

export type Family = "destination" | "practical" | "route";

export interface Category {
  id: string;
  label: string;
  /** Singular, for a card eyebrow: "Peak", "Camp site". */
  one: string;
  family: Family;
  colour?: string;
  icon?: string;
  minzoom?: number;
}

export const CATEGORIES = categoriesFile.categories as Category[];
export const FAMILIES = categoriesFile.families as { id: Family; label: string }[];
const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const DESTINATION_CATS = CATEGORIES.filter((c) => c.family === "destination").map((c) => c.id);
export const PRACTICAL_CATS = CATEGORIES.filter((c) => c.family === "practical").map((c) => c.id);

export function category(id: string): Category {
  return CATEGORY_BY_ID.get(id) ?? (CATEGORY_BY_ID.get("landmark") as Category);
}


/** A point as the map stores it. Coordinates are decimal degrees. */
export interface FeatureRow {
  cat: string;
  name?: string;
  lat: number;
  lon: number;
  /** Zoom its dot appears at. */
  dot?: number;
  /** Zoom its name appears at. */
  lz?: number;
  /** Page slug, when there is something to read. */
  slug?: string;
  /** Slug of the nearest destination, when the source recorded one. */
  near?: string;
  /** Mapped facts a pin card can print (fee, capacity, facilities). */
  note?: string;
  elev?: number;
  hue?: number;
  /** Region or country, for a card eyebrow. */
  where?: string;
  /** Structured location, when the source recorded it. */
  region?: string;
  country?: string;
  /** Fame cohort from the reach harvest: 1 famous … 4 local. Atlas rows are 0. */
  tier?: number;
  src?: string;
  srcId?: string;
  url?: string;
  book?: string;
  difficulty?: string;
  distance?: number;
  /** The curated destination behind an Experience marker. */
  experience?: {
    kind: GuideKindId;
    places: number;
    trails: number;
  };
}

/** What a click hands back. One shape for every category. */
export interface Pick {
  cat: string;
  name: string;
  lat: number;
  lon: number;
  slug?: string;
  near?: string;
  note?: string;
  elev?: number;
  hue?: number;
  where?: string;
  region?: string;
  country?: string;
  src?: string;
  srcId?: string;
  url?: string;
  book?: string;
  difficulty?: string;
  distance?: number;
  /** Set only for a curated Experience marker on the map. */
  experience?: {
    kind: GuideKindId;
    places: number;
    trails: number;
  };
}

export function pickOf(
  props: Record<string, unknown>,
  lon: number,
  lat: number,
): Pick {
  const name = String(props.n ?? props.name ?? "");
  return {
    cat: String(props.cat ?? "landmark"),
    name,
    lat,
    lon,
    slug: typeof props.slug === "string" ? props.slug : undefined,
    near: typeof props.near === "string" ? props.near : undefined,
    note: typeof props.d === "string" ? props.d : undefined,
    elev: typeof props.elev === "number" ? props.elev : undefined,
    hue: typeof props.hue === "number" ? props.hue : undefined,
    where: typeof props.where === "string" ? props.where : undefined,
    region: typeof props.region === "string" ? props.region : undefined,
    country: typeof props.country === "string" ? props.country : undefined,
    src: typeof props.src === "string" ? props.src : undefined,
    srcId: typeof props.srcid === "string" ? props.srcid : undefined,
    url: typeof props.url === "string" ? props.url : undefined,
    book: typeof props.book === "string" ? props.book : undefined,
    difficulty: typeof props.diff === "string" ? props.diff : undefined,
    distance: typeof props.dist === "number" ? props.dist : undefined,
    experience:
      props.cat === "experience"
        ? {
            kind: String(props.kind ?? "landmark") as GuideKindId,
            places: typeof props.places === "number" ? props.places : 0,
            trails: typeof props.trails === "number" ? props.trails : 0,
          }
        : undefined,
  };
}

export function pickOfRow(row: FeatureRow): Pick {
  return {
    cat: row.cat,
    name: row.name ?? "",
    lat: row.lat,
    lon: row.lon,
    slug: row.slug,
    near: row.near,
    note: row.note,
    elev: row.elev,
    hue: row.hue,
    where: row.where,
    region: row.region,
    country: row.country,
    src: row.src,
    srcId: row.srcId,
    url: row.url,
    book: row.book,
    difficulty: row.difficulty,
    distance: row.distance,
  };
}

/** A place from the atlas as the one card's input shape. */
export function pickOfPlace(p: Place): Pick {
  return {
    cat: destinationCategory(p),
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    slug: p.slug,
    elev: p.elevation,
    hue: p.hue,
    where: p.region ?? p.country,
    region: p.region,
    country: p.country,
    src: "atlas",
    srcId: p.wd ?? p.slug,
  };
}

const PLACE_CAT: Record<string, string> = {
  peak: "peak",
  park: "park",
  landmark: "landmark",
};

/**
 * The specific category behind an atlas row.
 *
 * Atlas rows carry four types, not thirty: every waterfall, cave and glacier is
 * typed `landmark`. That made a category filter for waterfalls skip the 47
 * atlas falls and label them all "Landmark". The name is the evidence the row
 * already carries, so a row whose name ends in a feature word joins that
 * category. Deliberately conservative: only a trailing feature word counts, so
 * "Falls Creek" does not become a waterfall, and `type` is never rewritten.
 */
const NAME_CATEGORY: [RegExp, string][] = [
  [/(?:^|\s)(?:water)?falls?$/i, "waterfall"],
  /* The same feature in the languages the atlas actually carries: Icelandic
     "foss" and "jökull" are why half of Iceland was filed as a landmark. */
  [/foss$/i, "waterfall"],
  [/cascades?$/i, "waterfall"],
  [/wasserfall$/i, "waterfall"],
  [/(?:^|\s)glaciers?$/i, "glacier"],
  [/j(?:ö|o)kull$/i, "glacier"],
  [/(?:^|\s)caves?$/i, "cave"],
  [/(?:^|\s)volcan(?:o|oes)$/i, "volcano"],
  [/(?:^|\s)islands?$/i, "island"],
  [/(?:^|\s)canyons?$/i, "canyon"],
  [/(?:^|\s)deserts?$/i, "desert"],
  [/(?:^|\s)beach(?:es)?$/i, "beach"],
  [/(?:^|\s)valleys?$/i, "valley"],
  [/(?:^|\s)(?:ranges?|mountains?)$/i, "range"],
  [/(?:^|\s)lakes?$/i, "lake"],
  [/(?:^|\s)springs?$/i, "spring"],
  [/(?:^|\s)parks?$/i, "park"],
  [/(?:^|\s)(?:mountains?|peaks?|mount)$/i, "peak"],
];

export function destinationCategoryFor(type: Place["type"], name: string): string {
  if (type === "peak") return "peak";
  if (type === "park") return "park";
  const clean = name.trim().replace(/[.!?]+$/, "");
  for (const [pattern, cat] of NAME_CATEGORY) {
    if (pattern.test(clean)) return cat;
  }
  return PLACE_CAT[type] ?? "landmark";
}

export function destinationCategory(place: Place): string {
  return destinationCategoryFor(place.type, place.name);
}

/**
 * Atlas rows as features. Rank decides the band, not the file it came from: the
 * world band arrives at the planet view, the regional bands as you close in.
 */
export function placesToRows(places: Place[]): FeatureRow[] {
  return places.map((p) => {
    const band = BANDS[Math.max(0, Math.min(BANDS.length - 1, p.band ?? 2))];
    return {
      cat: destinationCategory(p),
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      dot: band.dot,
      lz: band.label,
      slug: p.slug,
      elev: p.elevation,
      hue: p.hue,
      where: p.region ?? p.country,
      region: p.region,
      country: p.country,
      src: "atlas",
      srcId: p.wd ?? p.slug,
      url: p.wd ? `https://www.wikidata.org/wiki/${p.wd}` : undefined,
    };
  });
}

/** Human names for provenance, used on the card and the coverage page. */
type SourceMeta = {
  id: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
};
const SOURCE_META = new Map(
  (sourcesFile as unknown as { sources: SourceMeta[] }).sources.map((source) => [source.id, source]),
);

/** The licence behind a card's "Data:" line, linked where the source has a URL. */
export function sourceLicence(src: string): { licence: string; url: string } | null {
  const meta = SOURCE_META.get(src);
  return meta ? { licence: meta.licence, url: meta.licenceUrl } : null;
}

export const SOURCE_LABEL: Record<string, string> = {
  osm: "OpenStreetMap",
  osm_routes: "OpenStreetMap",
  wikidata: "Wikidata",
  atlas: "Wikidata",
  ridb: "Recreation.gov (RIDB)",
  usfs_sites: "US Forest Service",
  blm_sites: "Bureau of Land Management",
  nps_trails: "National Park Service",
  usfs_trails: "US Forest Service",
  blm_trails: "Bureau of Land Management",
  doc_nz: "NZ Department of Conservation",
  parks_canada: "Parks Canada",
};

/* ── style expressions, generated from the one category list ─────────────── */

/** Dot colour by category. Four families of tone, so a dot reads at 4 px. */
export const DEST_COLOUR = [
  "match",
  ["get", "cat"],
  ...CATEGORIES.filter((c) => c.family === "destination").flatMap((c) => [
    c.id,
    c.colour ?? "#8ab4d8",
  ]),
  "#8ab4d8",
] as unknown as import("maplibre-gl").ExpressionSpecification;

/** Pictogram by category, for the practical pins. */
export const PRACTICAL_ICON = [
  "match",
  ["get", "cat"],
  ...CATEGORIES.filter((c) => c.family === "practical").flatMap((c) => [
    c.id,
    c.icon ?? "camp-tent",
  ]),
  "camp-tent",
] as unknown as import("maplibre-gl").ExpressionSpecification;

/* ── row registries ───────────────────────────────────────────────────────
   The atlas is in the bundle; the Wikidata long tail and the OSM cells arrive
   as the map loads. `lib/catalog.ts` reads both to build the one discovery
   index, so the rows the map already holds are the rows search can see. */

let mappedRows: () => FeatureRow[] = () => [];
let destinationPoints: () => FeatureRow[] = () => [];

export function registerMappedSearch(fn: () => FeatureRow[]): void {
  mappedRows = fn;
}

/** Every destination row loaded so far, for cross-source duplicate checks. */
export function registerDestinationPoints(fn: () => FeatureRow[]): void {
  destinationPoints = fn;
}

export function getDestinationRows(): FeatureRow[] {
  return destinationPoints();
}

/** Named practical pins indexed from the map cells that have arrived. */
export function getMappedRows(): FeatureRow[] {
  return mappedRows();
}
