import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import {
  DEST_COLOUR,
  DESTINATION_CATS,
  placesToRows,
  registerDestinationPoints,
  type FeatureRow,
} from "../data/features";
import type { Place } from "../data/places";
import type { LayerState } from "../components/LayerControl";
import { cellOf } from "../data/rank";
import { FIRST_SYMBOL_LAYER } from "./style";
import { FONTS, PALETTE } from "./theme";
import bandsFile from "../data/bands.json";

/**
 * Destinations: the atlas rows and the Wikidata long tail, in one source.
 *
 * Both used to be their own source, their own layers and their own card. They are
 * the same thing — a point with a category and a name — so they share one source,
 * one dot/label system and one pick. Two files still feed it, because the long
 * tail is 23,000 rows and should not be paid for by a visit that never leaves the
 * world view; that is transport, not a distinction the map makes.
 *
 * Dot and label bands come from `bands.json`. A band is a zoom, not a class: a
 * continent's highest summit and a 2,400 m shoulder are both peaks and arrive at
 * different times. The band also sets the dot's size, so the earlier (more
 * important) dots are visibly the larger ones at every zoom.
 */

type BandDef = {
  band: number;
  dot: number;
  label: number;
  scale: number;
  opacity: number;
  labelSize: number;
};

type BandsFile = { radiusBase: [number, number][]; bands: BandDef[] };

const BANDS_FILE = bandsFile as unknown as BandsFile;
const BANDS = BANDS_FILE.bands;
const BASE_RADIUS = BANDS_FILE.radiusBase;

const SOURCE = "features";
const DOT_BANDS = BANDS.map((b) => b.dot);
const LABEL_BANDS = BANDS.map((b) => b.label);

export const DEST_LAYERS = [
  ...DOT_BANDS.map((b) => `features-dot-${b}`),
  ...LABEL_BANDS.map((b) => `features-label-${b}`),
];

const bandOf = (b: number): BandDef => BANDS[Math.max(0, Math.min(BANDS.length - 1, b))];

function radius(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    ...BASE_RADIUS.flatMap(([z, r]) => [z, Number((r * scale).toFixed(2))]),
  ] as unknown as ExpressionSpecification;
}

type ReachFile = { kinds: string[]; near: string[]; items: (number | string | null)[][] };

let atlasRows: FeatureRow[] = [];
let coreRows: FeatureRow[] = [];
let moreRows: FeatureRow[] = [];
let enabled: string[] = [...DESTINATION_CATS];
let corePromise: Promise<void> | null = null;
let morePromise: Promise<void> | null = null;
/* The map this module is currently drawn on, so a catalog load started from the
   Discover panel also reaches the globe. Cleared on teardown. */
let activeMap: MlMap | null = null;

const allRows = (): FeatureRow[] => [...atlasRows, ...coreRows, ...moreRows];

function collection(rows: FeatureRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        cat: r.cat,
        n: r.name ?? "",
        dot: r.dot ?? 2,
        lz: r.lz ?? 8.6,
        ...(r.slug ? { slug: r.slug } : {}),
        ...(r.near ? { near: r.near } : {}),
        ...(r.elev ? { elev: r.elev } : {}),
        ...(typeof r.hue === "number" ? { hue: r.hue } : {}),
        ...(r.where ? { where: r.where } : {}),
        ...(r.region ? { region: r.region } : {}),
        ...(r.country ? { country: r.country } : {}),
        ...(typeof r.tier === "number" ? { tier: r.tier } : {}),
        ...(r.src ? { src: r.src } : {}),
        ...(r.srcId ? { srcid: r.srcId } : {}),
        ...(r.url ? { url: r.url } : {}),
      },
    })),
  };
}

function push(map: MlMap | null) {
  if (!map) return;
  try {
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    src?.setData(collection(allRows()));
  } catch {
    /* The map was removed while a lazy chunk was in flight. */
  }
}

const catFilter = (ids: string[]): ExpressionSpecification =>
  ["in", ["get", "cat"], ["literal", ids]] as unknown as ExpressionSpecification;

function applyFilters(map: MlMap) {
  for (const band of DOT_BANDS) {
    if (!map.getLayer(`features-dot-${band}`)) continue;
    map.setFilter(`features-dot-${band}`, [
      "all",
      ["==", ["get", "dot"], band],
      catFilter(enabled),
    ] as unknown as ExpressionSpecification);
  }
  for (const band of LABEL_BANDS) {
    if (!map.getLayer(`features-label-${band}`)) continue;
    map.setFilter(`features-label-${band}`, [
      "all",
      ["==", ["get", "lz"], band],
      ["!=", ["get", "n"], ""],
      catFilter(enabled),
    ] as unknown as ExpressionSpecification);
  }
}

/** Adds the source and every dot and label band. Idempotent. */
export function addDestinations(map: MlMap): void {
  activeMap = map;
  if (map.getSource(SOURCE)) {
    applyFilters(map);
    return;
  }

  map.addSource(SOURCE, { type: "geojson", data: collection([]) });

  /* A soft halo under the first band only: the handful of places that carry
     the world view get a glow, so the planet has a few lights on it instead of
     an even speckle of dots. */
  map.addLayer({
    id: "features-halo-0",
    type: "circle",
    source: SOURCE,
    filter: [
      "all",
      ["==", ["get", "dot"], 0],
      catFilter(enabled),
    ] as unknown as ExpressionSpecification,
    paint: {
      "circle-color": DEST_COLOUR,
      "circle-radius": radius(2.2),
      "circle-blur": 1,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.14, 3, 0.17, 6, 0.1],
    },
  });

  for (const b of BANDS) {
    /* The beacon: a white core inside a ring of the category's colour. It reads
       as a survey station rather than a paint dot, and the category survives at
       three pixels because the ring is the outside, where the eye looks. */
    const early = b.band <= 2;
    const dotOpacity = Number((b.opacity * (b.band >= 4 ? 0.62 : 1)).toFixed(2));
    const isFirst = b.band === 0;
    const rampStart = isFirst ? 0 : b.dot;
    map.addLayer({
      id: `features-dot-${b.dot}`,
      type: "circle",
      source: SOURCE,
      minzoom: isFirst ? 0 : b.dot,
      filter: ["all", ["==", ["get", "dot"], b.dot], catFilter(enabled)],
      paint: {
        "circle-color": PALETTE.dot,
        "circle-radius": radius(b.scale * 0.85),
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          rampStart,
          isFirst ? 0.55 : 0,
          isFirst ? 2.6 : b.dot + 1.2,
          dotOpacity,
        ],
        "circle-stroke-color": DEST_COLOUR,
        // Heavier, brighter rings on the early bands; the tail is nearly a speck.
        "circle-stroke-width": Number(Math.max(0.8, 1.45 - b.band * 0.1).toFixed(2)),
        // Fade the ring with the fill: a constant ring drew hollow ghosts for
        // the first zoom of every new band.
        "circle-stroke-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          rampStart,
          isFirst ? 0.2 : 0,
          isFirst ? 2.6 : b.dot + 1.2,
          Number(((early ? 0.95 : 0.7) * dotOpacity).toFixed(2)),
        ],
      },
    });
  }

  for (const b of BANDS) {
    const isFirst = b.band === 0;
    // Planet scale is deliberately quiet: the globe is the subject there, and a
    // 10.5 px label repeated over every continent competes with it.
    const labelSize = isFirst ? 9.5 : b.labelSize;
    map.addLayer({
      id: `features-label-${b.label}`,
      type: "symbol",
      source: SOURCE,
      minzoom: isFirst ? 0 : b.label,
      filter: [
        "all",
        ["==", ["get", "lz"], b.label],
        ["!=", ["get", "n"], ""],
        catFilter(enabled),
      ],
      layout: {
        /* Two lines where the record carries an elevation: the name, then the
           height in a smaller size. It is the alpine convention, and it turns a
           label into a fact without a second symbol layer. */
        "text-field": [
          "format",
          ["get", "n"],
          {},
          "\n",
          {},
          ["case", ["has", "elev"], ["concat", ["to-string", ["get", "elev"]], " m"], ""],
          { "font-scale": 0.72 },
        ],
        "text-font": FONTS.regular,
        // Size follows the band: a world major reads larger than a tail name.
        // The stops ascend by construction, which the earlier band stops above
        // z8 did not — MapLibre dropped those layers without saying so.
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          b.label,
          labelSize,
          b.label + 2,
          Number((labelSize + 1.5).toFixed(2)),
          16,
          Number((labelSize + 3).toFixed(2)),
        ],
        "text-anchor": "top",
        "text-offset": [0, 0.95],
        "text-max-width": 9,
        "text-padding": 8,
        "text-optional": true,
        // Earlier bands (smaller `lz`) win a collision, then the shorter name:
        // "Everest" should beat a six-word ridge label for the same pixel.
        "symbol-sort-key": ["+", ["get", "lz"], ["length", ["get", "n"]]],
      },
      paint: {
        "text-color": PALETTE.label,
        "text-halo-color": PALETTE.halo,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.6,
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          b.label,
          isFirst ? 0.45 : 0,
          isFirst ? 2.2 : b.label + 0.9,
          isFirst ? 0.78 : 0.88,
        ],
      },
    });
  }

  // Symbols are placed in layer order, and the basemap's country/state/city
  // labels are placed after these by default — which silently culled peak names
  // wherever a village shared the tile. Moving the bands just under the basemap
  // labels gives them placement priority while keeping normal collision, so the
  // six bands still avoid each other instead of stacking.
  if (map.getLayer(FIRST_SYMBOL_LAYER)) {
    for (const band of LABEL_BANDS) map.moveLayer(`features-label-${band}`, FIRST_SYMBOL_LAYER);
  }

  applyFilters(map);
  push(map);
}

/** Category switches. Destinations share their layers, so this is a filter. */
export function setDestinationCats(map: MlMap, layers: LayerState): void {
  enabled = layers.features ? DESTINATION_CATS.filter((id) => layers.cats[id]) : [];
  applyFilters(map);
}

/** Replace the atlas half (filters and ranking change it). */
function setAtlasRows(map: MlMap, rows: FeatureRow[]): void {
  atlasRows = rows;
  push(map);
}

export function setAtlasPlaces(map: MlMap, places: Place[]): void {
  setAtlasRows(map, placesToRows(places));
}

/** The famous half of the long tail: one chunk, fetched once, after first paint. */
function loadCoreRows(): Promise<void> {
  corePromise ??= import("../data/reach.json")
    .then((mod) => {
      coreRows = rowsFromReach(mod.default as unknown as ReachFile);
      push(activeMap);
    })
    .catch(() => undefined);
  return corePromise;
}

/** The tail: fetched once the camera approaches the local bands. */
function loadMoreRows(): Promise<void> {
  morePromise ??= import("../data/reach-more.json")
    .then((mod) => {
      moreRows = rowsFromReach(mod.default as unknown as ReachFile);
      push(activeMap);
    })
    .catch(() => undefined);
  return morePromise;
}

export function loadDestinations(): Promise<void> {
  return loadCoreRows();
}

export function loadMoreDestinations(): Promise<void> {
  return loadMoreRows();
}

/**
 * Every destination row, whether or not a map is mounted.
 *
 * Discover and search need the whole 24,474-row set the first time they open,
 * not the slice a particular camera has happened to load. Both chunks are
 * already cached modules, so asking here costs one download and the map's
 * loader re-uses it.
 */
export async function ensureDestinationRows(): Promise<FeatureRow[]> {
  await Promise.all([loadCoreRows(), loadMoreRows()]);
  return allRows();
}

/** The map is gone; keep the rows, drop the reference that would push to it. */
export function resetDestinations(): void {
  activeMap = null;
}

/**
 * Reach cohorts: fame tier → the band it first appears in, plus a density cap.
 *
 * A tier is not a zoom. One Alpine z6 cell holds 1,415 tier-3 rows, and a whole
 * tier revealed at once put a thousand dots on one screen. Each cohort shows up
 * to `per` rows per cell at its band; the rest wait for the overflow band, which
 * is the way a place gets its name when you are actually there rather than in
 * the first frame of a continent.
 */
type ReachCohort = { band: number; overflow: number; cell: number; per: number };

const REACH_COHORT: Record<number, ReachCohort> = {
  1: { band: 3, overflow: 4, cell: 6, per: 3 },
  2: { band: 3, overflow: 4, cell: 6, per: 3 },
  3: { band: 4, overflow: 6, cell: 7, per: 16 },
  4: { band: 5, overflow: 6, cell: 9, per: 10 },
};

function rowsFromReach(file: ReachFile): FeatureRow[] {
  const used = new Map<string, number>();
  return file.items.map((row) => {
    const [lat, lon, kind, tier, name, near, wd, slug] = row as [
      number,
      number,
      number,
      number,
      string,
      number | null,
      string,
      string,
    ];
    const cohort = REACH_COHORT[tier] ?? REACH_COHORT[3];
    const key = `${cohort.band}:${cellOf(lat, lon, cohort.cell)}`;
    const seen = (used.get(key) ?? 0) + 1;
    used.set(key, seen);
    const band = bandOf(seen <= cohort.per ? cohort.band : cohort.overflow);
    return {
      cat: file.kinds[kind] ?? "landmark",
      name: String(name),
      lat,
      lon,
      dot: band.dot,
      lz: band.label,
      near: typeof near === "number" ? file.near[near] : undefined,
      tier,
      src: "wikidata" as const,
      srcId: typeof wd === "string" ? wd : undefined,
      url: typeof wd === "string" ? `https://www.wikidata.org/wiki/${wd}` : undefined,
      slug: typeof slug === "string" ? slug : undefined,
    };
  });
}

/* Discovery reads the same row store the map draws, so the two cannot drift. */
registerDestinationPoints(allRows);
