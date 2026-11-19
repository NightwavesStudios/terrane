import categoriesFile from "./categories.json";
import bandsFile from "./bands.json";
import { PLACES, type Place } from "./places";

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
export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const DESTINATION_CATS = CATEGORIES.filter((c) => c.family === "destination").map((c) => c.id);
export const PRACTICAL_CATS = CATEGORIES.filter((c) => c.family === "practical").map((c) => c.id);

export function category(id: string): Category {
  return CATEGORY_BY_ID.get(id) ?? (CATEGORY_BY_ID.get("landmark") as Category);
}

export function categoryLabel(id: string): string {
  return category(id).one;
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
  src?: string;
  srcId?: string;
  url?: string;
  book?: string;
  difficulty?: string;
  distance?: number;
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
  src?: string;
  srcId?: string;
  url?: string;
  book?: string;
  difficulty?: string;
  distance?: number;
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
    src: typeof props.src === "string" ? props.src : undefined,
    srcId: typeof props.srcid === "string" ? props.srcid : undefined,
    url: typeof props.url === "string" ? props.url : undefined,
    book: typeof props.book === "string" ? props.book : undefined,
    difficulty: typeof props.diff === "string" ? props.diff : undefined,
    distance: typeof props.dist === "number" ? props.dist : undefined,
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
    cat: PLACE_CAT[p.type] ?? "landmark",
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    slug: p.slug,
    elev: p.elevation,
    hue: p.hue,
    where: p.region ?? p.country,
    src: p.editorial ? "editorial" : "atlas",
    srcId: p.wd ?? p.slug,
  };
}

const PLACE_CAT: Record<string, string> = {
  peak: "peak",
  park: "park",
  landmark: "landmark",
  gem: "landmark",
};

/**
 * Atlas rows as features. Rank decides the band, not the file it came from: the
 * world band arrives at the planet view, the regional bands as you close in.
 */
export function placesToRows(places: Place[]): FeatureRow[] {
  return places.map((p) => {
    const band = BANDS[Math.max(0, Math.min(BANDS.length - 1, p.band ?? 2))];
    return {
      cat: PLACE_CAT[p.type] ?? "landmark",
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      dot: band.dot,
      lz: band.label,
      slug: p.slug,
      elev: p.elevation,
      hue: p.hue,
      where: p.region ?? p.country,
      src: p.editorial ? "editorial" : "atlas",
      srcId: p.wd ?? p.slug,
      url: p.editorial ? undefined : `https://www.wikidata.org/wiki/${p.wd ?? ""}`,
    };
  });
}

/** Human names for provenance, used on the card and the coverage page. */
export const SOURCE_LABEL: Record<string, string> = {
  osm: "OpenStreetMap",
  osm_routes: "OpenStreetMap",
  wikidata: "Wikidata",
  atlas: "Wikidata",
  editorial: "Hand-written",
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

/* ── search across every category ─────────────────────────────────────────
   The atlas is in the bundle; the Wikidata long tail and the OSM cells arrive
   as the map loads, so they register the rows worth searching here. A pin that
   has not been fetched cannot be found, and the empty state says so. */

let destinationRows: () => FeatureRow[] = () => [];
let mappedRows: () => FeatureRow[] = () => [];

export function registerDestinationSearch(fn: () => FeatureRow[]): void {
  destinationRows = fn;
}

export function registerMappedSearch(fn: () => FeatureRow[]): void {
  mappedRows = fn;
}

function score(name: string, term: string): number {
  const n = name.toLowerCase();
  if (n === term) return 0;
  if (n.startsWith(term)) return 1;
  if (n.includes(term)) return 2;
  return 9;
}

export function searchAll(term: string, limit = 8): Pick[] {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: { row: FeatureRow; s: number; order: number }[] = [];
  for (const p of PLACES) {
    // A merged place answers to every name that used to be its own row.
    let s = score(p.name, q);
    for (const alias of p.also ?? []) {
      if (alias.name) s = Math.min(s, score(alias.name, q));
    }
    if (s === 9) continue;
    out.push({
      row: {
        cat: PLACE_CAT[p.type] ?? "landmark",
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        slug: p.slug,
        elev: p.elevation,
        hue: p.hue,
        src: p.editorial ? "editorial" : "atlas",
      },
      s,
      order: 0,
    });
  }
  for (const row of destinationRows()) {
    if (!row.name) continue;
    const s = score(row.name, q);
    if (s === 9) continue;
    out.push({ row, s, order: row.slug ? 1 : 2 });
  }
  for (const row of mappedRows()) {
    if (!row.name) continue;
    const s = score(row.name, q);
    if (s === 9) continue;
    out.push({ row, s, order: 3 });
  }

  out.sort((a, b) => a.s - b.s || a.order - b.order || (a.row.name ?? "").localeCompare(b.row.name ?? ""));
  return out.slice(0, limit).map((r) => pickOfRow(r.row));
}
