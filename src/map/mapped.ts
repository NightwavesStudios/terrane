import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  PRACTICAL_CATS,
  PRACTICAL_ICON,
  category,
  getDestinationRows,
  registerMappedSearch,
  type FeatureRow,
} from "../data/features";
import type { LayerState } from "../components/LayerControl";
import { cellUrl } from "../lib/cells";
import { cellMayExist } from "../lib/cellIndex";

/**
 * Mapped places: campsites, huts, shelters, water, parking and the rest of the
 * practical categories, one JSON file per z6 cell, fetched as you look at them.
 *
 * The same record shape as a destination, with `cat` in place of a kind index, so
 * the layer panel, the card and the search do not care which harvest a pin came
 * from. `scripts/harvest-poi-bulk.py` streams 437 Geofabrik country extracts
 * through pyosmium and writes the cells; nothing here is seeded by the atlas.
 *
 * ## Bands, not floors
 *
 * Every category used to have one hard zoom floor (camps at 10.6, water at
 * 13.8), so between the country view and the trail view the map showed
 * destinations only. A cell is ~600 km across and holds thousands of camps; all
 * of them cannot appear at once, but the five best-known can.
 *
 * Each cell's rows are therefore ranked once, per category, by usefulness (a
 * name, a facility summary, an agency record) and dealt into pin bands with a
 * per-cell quota. Band 0 is camps at 6.9, band 1 huts at 8.2, band 2 passes and
 * caravan sites at 9.5, band 3 everything else at 10.8. Overflow rows step up one
 * band each time the quota fills, so the best five camps in a cell arrive at
 * country scale and the rest are there by z11. `categories.json` still records
 * each category's own floor; it is the base the band is derived from.
 *
 * ## One push per frame
 *
 * A cell can hold 276,000 rows. Loading six cells on one `moveend` used to
 * rebuild and `setData` the whole collection six times, and at z8 only a
 * fraction of that ground is on screen. Pushes are now coalesced into one rAF
 * and carry only:
 *
 *   - rows whose pin band is visible at this zoom, and
 *   - at z8 and deeper, rows inside the viewport plus a 50% margin.
 *
 * The rest stay cached; panning back is a re-push, not a re-fetch.
 *
 * ## Duplicates
 *
 * A campground that is also a park or landmark is one place in two harvests, and
 * used to draw twice. Named practical pins within 200 m of a compatible
 * destination are marked and held back to z13.5. The data-side fix belongs in the
 * merge; this is the draw-time guard, and the debug readout counts what it hides.
 */

/** Row order in a cell. The index is the wire format; `cat` is the model. */
const MAPPED_CATS = [
  "camp",
  "hut",
  "shelter",
  "water",
  "parking",
  "view",
  "picnic",
  "pass",
  "caravan",
  "toilets",
  "shower",
  "info",
  "trailhead",
] as const;

const SOURCE = "mapped";
const PARKING_SOURCE = "mapped-parking";
const PARKING_CAT = "parking";

/**
 * Pin bands: the zoom each band of pins appears at. The last entry holds the
 * cross-source duplicates, which are real pins but should not double a park dot
 * at walking zoom.
 */
const BAND_ZOOMS = [6.8, 7.8, 8.8, 10.2, 13.5] as const;
const DUP_BAND = BAND_ZOOMS.length - 1;

/**
 * Per-cell quota at a category's first band. A cell over the Alps holds 50,000
 * camps; five named, facility-bearing ones are the country view, the rest step up
 * a band each time this fills.
 */
const PER_CELL: Record<string, number> = {
  camp: 8,
  hut: 6,
  pass: 10,
  caravan: 4,
  trailhead: 10,
  view: 12,
  shelter: 14,
  picnic: 14,
  water: 16,
  toilets: 16,
  shower: 10,
  info: 20,
};

/**
 * Which destination categories make a practical pin a duplicate of the same
 * place. Deliberately narrow: a hut 150 m from a summit is still a hut, while a
 * campground inside a national park is the park's own pin twice.
 */
const DUP_WITH: Record<string, string[]> = {
  camp: ["park", "landmark", "island", "beach"],
  caravan: ["park", "landmark", "island", "beach"],
  hut: ["landmark", "park"],
  view: ["peak", "volcano", "landmark", "lake", "waterfall", "canyon"],
  pass: ["peak", "landmark"],
  info: ["landmark", "park"],
  trailhead: ["park", "landmark"],
  picnic: ["park", "landmark"],
  shelter: ["landmark", "park"],
};

/** Duplicate radius: 200 m, checked on a 0.002° grid. */
const DUP_RADIUS_KM = 0.2;
const DUP_CELL = 0.002;

export const MAPPED_LAYERS = [
  ...BAND_ZOOMS.map((_, band) => `mapped-pin-${band}`),
  "mapped-parking",
  "mapped-label-0",
  "mapped-label-1",
  "mapped-label-2",
  "mapped-label-3",
  "mapped-label-4",
];

type Row = [number, number, number, string?, string?];
type Detail = [number, Record<string, string>][];
type Cell = { z: number; kinds: string[]; items: Row[]; detail?: Detail };

/* The feature budget for the main source. It has to be generous: a z6 cell over
   the Alps holds 276,000 rows on its own (Germany and Austria between them map
   155,000 information boards), and a budget smaller than that cell would evict it
   on the next `moveend` and fetch its 11 MB again. */
const MAX_FEATURES = 320_000;
const MAX_CELLS_PER_PASS = 6;

/* Parking is often two thirds of a country's rows and only matters at street
   zoom, so it travels in its own file and its own source. */
const PARKING_MINZOOM = 13.5;
const PARKING_MAX_CELLS = 4;
const PARKING_MAX_FEATURES = 120_000;

const MISS_RETRY_MS = 5 * 60_000;
const ERROR_RETRY_MS = 20_000;
const MAPPED_CELL_ZOOM = 6;

const loaded = new Map<string, Feature<Point>[]>();
/** Per cell, features split by pin band: a push at z8 walks band 0–1, not 300k rows. */
const banded = new Map<string, Feature<Point>[][]>();
let total = 0;
const pending = new Set<string>();
const misses = new Map<string, number>();
const bound = new WeakSet<MlMap>();

const parkingLoaded = new Map<string, Feature<Point>[]>();
const parkingPending = new Set<string>();
const parkingMisses = new Map<string, number>();
let parkingTotal = 0;

const namedRows: FeatureRow[] = [];
const NAMED_SEARCH_CAP = 20_000;

const dupCounts = new Map<string, number>();
let duplicates = 0;

let drawn = 0;
let parkingDrawn = 0;
let lastSetDataMs = 0;
let pushToken = 0;

type Destination = { cat: string; lat: number; lon: number };
type DestinationIndex = { version: number; cells: Map<string, Destination[]> };
let destinations: DestinationIndex | null = null;

const cellKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

/** A 404 is "not harvested yet"; anything else is a transient failure. */
function retryAt(err: unknown): number {
  const status = Number(String((err as Error)?.message ?? err));
  return Date.now() + (status === 404 ? MISS_RETRY_MS : ERROR_RETRY_MS);
}

function summary(d: Record<string, string>): string {
  const out: string[] = [];
  if (d.fee === "no") out.push("Free");
  else if (d.charge) out.push(d.charge);
  else if (d.fee === "yes") out.push("Fee charged");
  if (d.capacity) out.push(`${d.capacity} pitches`);
  const facilities = [
    d.drinking_water === "yes" ? "water" : "",
    d.toilets === "yes" ? "toilets" : "",
    d.shower === "yes" ? "shower" : "",
    d.power_supply === "yes" ? "power" : "",
  ].filter(Boolean);
  if (facilities.length) out.push(facilities.join(", "));
  if (d.backcountry === "yes" || d.informal === "yes") out.push("informal");
  else if (d.access && d.access !== "yes") out.push(d.access);
  if (d.operator) out.push(d.operator);
  return out.slice(0, 3).join(" · ").slice(0, 90);
}

function toFeature(row: Row, meta?: Record<string, string>): Feature<Point> {
  const [lat, lon, kind, name, src] = row;
  const cat = MAPPED_CATS[kind] ?? "camp";
  const note = meta ? summary(meta) : "";
  const properties: Record<string, string | number> = { cat };
  if (name) properties.n = name;
  if (note) properties.d = note;
  properties.src = src || meta?.src || "osm";
  if (meta?.src_id || meta?.srcId) properties.srcid = meta.src_id || meta.srcId;
  if (meta?.url || meta?.website) properties.url = meta.url || meta.website;
  if (meta?.booking || meta?.reservation) properties.book = meta.booking || meta.reservation;
  if (meta?.where) properties.where = meta.where;
  else if (meta?.operator) properties.where = meta.operator;
  properties.b0 = 0;
  properties.pb = 0;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties,
  };
}

/** Higher is better: named, with facilities, from an agency inventory. */
function usefulness(f: Feature<Point>): number {
  const p = f.properties as Record<string, unknown>;
  let score = 0;
  if (p.n) score += 4;
  if (p.d) score += 2;
  if (p.url || p.book) score += 1;
  if (typeof p.src === "string" && p.src !== "osm") score += 2;
  return score;
}

/** The pin band a category starts in, derived from its own zoom floor. */
function baseBand(cat: string): number {
  const floor = category(cat).minzoom ?? 10;
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < DUP_BAND; i += 1) {
    const gap = Math.abs(BAND_ZOOMS[i] - floor);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

/**
 * Deal one cell's rows into bands, per category. Sorted once, at load: a cell is
 * 276,000 rows and this is the only pass that has to look at all of them.
 */
function assignBands(features: Feature<Point>[]) {
  const groups = new Map<string, Feature<Point>[]>();
  for (const f of features) {
    const cat = String((f.properties as Record<string, unknown>).cat);
    const group = groups.get(cat);
    if (group) group.push(f);
    else groups.set(cat, [f]);
  }

  for (const [cat, group] of groups) {
    if (!PRACTICAL_CATS.includes(cat)) continue;
    const base = baseBand(cat);
    const per = PER_CELL[cat] ?? 12;
    group.sort(
      (a, b) =>
        usefulness(b) - usefulness(a) ||
        String((a.properties as Record<string, unknown>).n ?? "").localeCompare(
          String((b.properties as Record<string, unknown>).n ?? ""),
        ),
    );
    for (let i = 0; i < group.length; i += 1) {
      const p = group[i].properties as Record<string, unknown>;
      const tier = Math.min(3, Math.floor(i / per));
      const band = Math.min(DUP_BAND - 1, base + tier);
      p.b0 = band;
      p.pb = band;
    }
  }
}

function splitBands(features: Feature<Point>[]): Feature<Point>[][] {
  const bands: Feature<Point>[][] = Array.from({ length: BAND_ZOOMS.length }, () => []);
  for (const f of features) {
    const pb = Number((f.properties as Record<string, unknown>).pb ?? 0);
    bands[Math.max(0, Math.min(DUP_BAND, pb))].push(f);
  }
  return bands;
}

function destKey(lat: number, lon: number): string {
  return `${Math.round(lon / DUP_CELL)}:${Math.round(lat / DUP_CELL)}`;
}

function destinationIndex(): DestinationIndex {
  const rows = getDestinationRows();
  if (destinations && destinations.version === rows.length) return destinations;

  const cells = new Map<string, Destination[]>();
  for (const row of rows) {
    if (!row.lat || !row.lon) continue;
    const d: Destination = { cat: row.cat, lat: row.lat, lon: row.lon };
    const key = destKey(d.lat, d.lon);
    const bucket = cells.get(key);
    if (bucket) bucket.push(d);
    else cells.set(key, [d]);
  }
  destinations = { version: rows.length, cells };

  /* Destinations arrive in two lazy chunks, after the first cells may already be
     on screen. Re-mark what is cached so the guard does not depend on timing. */
  for (const [key, features] of loaded) markCell(key, features, destinations);
  for (const [key, features] of parkingLoaded) markCell(key, features, destinations);
  for (const [key, features] of loaded) banded.set(key, splitBands(features));
  return destinations;
}

function nearDestination(
  index: DestinationIndex,
  lat: number,
  lon: number,
  compat: string[],
): boolean {
  const x = Math.round(lon / DUP_CELL);
  const y = Math.round(lat / DUP_CELL);
  const cos = Math.cos((lat * Math.PI) / 180);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const bucket = index.cells.get(`${x + dx}:${y + dy}`);
      if (!bucket) continue;
      for (const d of bucket) {
        if (!compat.includes(d.cat)) continue;
        const northKm = (d.lat - lat) * 111.32;
        const eastKm = (d.lon - lon) * 111.32 * cos;
        if (northKm * northKm + eastKm * eastKm <= DUP_RADIUS_KM * DUP_RADIUS_KM) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Mark (or unmark) duplicates in one cell. Only named or annotated pins are
 * checked: they are the ones that read as two labels on one place, and a cell
 * can hold a quarter of a million unnamed rows.
 */
function markCell(key: string, features: Feature<Point>[], index: DestinationIndex) {
  let found = 0;
  for (const f of features) {
    const p = f.properties as Record<string, unknown>;
    const compat = DUP_WITH[String(p.cat)];
    if (!compat) continue;
    const base = typeof p.b0 === "number" ? p.b0 : 0;
    if (p.n === undefined && p.d === undefined) {
      p.pb = base;
      continue;
    }
    const coordinates = (f.geometry as Point).coordinates;
    if (nearDestination(index, coordinates[1], coordinates[0], compat)) {
      p.pb = DUP_BAND;
      p.dup = 1;
      found += 1;
    } else {
      p.pb = base;
      delete p.dup;
    }
  }
  duplicates += found - (dupCounts.get(key) ?? 0);
  dupCounts.set(key, found);
}

/** The pin band visible at a zoom, or -1 when no practical pin should draw. */
function bandAt(zoom: number): number {
  let band = -1;
  for (let i = 0; i < BAND_ZOOMS.length; i += 1) {
    if (zoom >= BAND_ZOOMS[i]) band = i;
  }
  return band;
}

type Window = { w: number; e: number; s: number; n: number };

/** Viewport plus a 50% margin, applied from z8. Below that the whole globe is close. */
function viewport(map: MlMap): Window | null {
  if (map.getZoom() < 8) return null;
  const b = map.getBounds();
  const lonPad = (b.getEast() - b.getWest()) * 0.5;
  const latPad = (b.getNorth() - b.getSouth()) * 0.5;
  return {
    w: b.getWest() - lonPad,
    e: b.getEast() + lonPad,
    s: Math.max(-85, b.getSouth() - latPad),
    n: Math.min(85, b.getNorth() + latPad),
  };
}

function collection(band: number, win: Window | null): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  if (band < 0) return { type: "FeatureCollection", features };
  for (const cell of banded.values()) {
    for (let b = 0; b <= band; b += 1) {
      const list = cell[b];
      for (let i = 0; i < list.length; i += 1) {
        const f = list[i];
      if (win) {
        const [lon, lat] = (f.geometry as Point).coordinates;
        if (lat < win.s || lat > win.n || lon < win.w || lon > win.e) continue;
      }
      features.push(f);
      }
    }
  }
  return { type: "FeatureCollection", features };
}

function parkingCollection(win: Window | null): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const cell of parkingLoaded.values()) {
    for (let i = 0; i < cell.length; i += 1) {
      const f = cell[i];
      if (win) {
        const [lon, lat] = (f.geometry as Point).coordinates;
        if (lat < win.s || lat > win.n || lon < win.w || lon > win.e) continue;
      }
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features };
}

function pushToMap(map: MlMap) {
  const started = performance.now();
  const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
  const park = map.getSource(PARKING_SOURCE) as GeoJSONSource | undefined;
  const band = bandAt(map.getZoom());
  const win = viewport(map);
  let payload = 0;

  if (src) {
    const data = collection(band, win);
    src.setData(data);
    drawn = data.features.length;
    payload += drawn;
  }
  if (park) {
    const data =
      map.getZoom() >= PARKING_MINZOOM
        ? parkingCollection(win)
        : ({ type: "FeatureCollection", features: [] } as FeatureCollection<Point>);
    park.setData(data);
    parkingDrawn = data.features.length;
    payload += parkingDrawn;
  }

  lastSetDataMs = performance.now() - started;
  if (import.meta.env.DEV) {
    const scope = window as unknown as {
      __terranePush?: { source: string; payload: number; ms: number }[];
    };
    (scope.__terranePush ??= []).push({
      source: "mapped",
      payload,
      ms: Math.round(lastSetDataMs * 10) / 10,
    });
    if (scope.__terranePush.length > 120) scope.__terranePush.shift();
  }
}

/**
 * One push per animation frame, whatever arrives. Six cells landing in the same
 * tick, a pan and a band change all collapse into one `setData`.
 */
function schedulePush(map: MlMap) {
  const token = pushToken;
  window.requestAnimationFrame(() => {
    if (token !== pushToken) return;
    if (!map.getSource(SOURCE)) return;
    pushToMap(map);
  });
}

const HARD_FEATURES = 900_000;
const PARKING_HARD_FEATURES = 400_000;

function evictIfNeeded(visibleKeys: Set<string>) {
  while (total > MAX_FEATURES && loaded.size > 1) {
    let victim: string | undefined;
    for (const key of loaded.keys()) {
      if (!visibleKeys.has(key)) {
        victim = key;
        break;
      }
    }
    if (!victim) {
      if (total <= HARD_FEATURES) return;
      victim = loaded.keys().next().value as string;
    }
    const features = loaded.get(victim) as Feature<Point>[];
    loaded.delete(victim);
    banded.delete(victim);
    dupCounts.delete(victim);
    total -= features.length;
  }
}

function evictParkingIfNeeded(visibleKeys: Set<string>) {
  while (parkingTotal > PARKING_MAX_FEATURES && parkingLoaded.size > 1) {
    let victim: string | undefined;
    for (const key of parkingLoaded.keys()) {
      if (!visibleKeys.has(key)) {
        victim = key;
        break;
      }
    }
    if (!victim) {
      if (parkingTotal <= PARKING_HARD_FEATURES) return;
      victim = parkingLoaded.keys().next().value as string;
    }
    const features = parkingLoaded.get(victim) as Feature<Point>[];
    parkingLoaded.delete(victim);
    parkingTotal -= features.length;
  }
}

const catFilter = (ids: string[]): ExpressionSpecification =>
  (ids.length
    ? ["in", ["get", "cat"], ["literal", ids]]
    : ["==", ["get", "cat"], "__none__"]) as unknown as ExpressionSpecification;

function labelFilter(ids: string[], bands: number[]): ExpressionSpecification {
  return [
    "all",
    ["!=", ["get", "n"], ""],
    ["in", ["get", "pb"], ["literal", bands]],
    catFilter(ids),
  ] as unknown as ExpressionSpecification;
}

function pinFilter(band: number, ids: string[]): ExpressionSpecification {
  return [
    "all",
    ["==", ["get", "pb"], band],
    catFilter(ids),
  ] as unknown as ExpressionSpecification;
}

/** Adds the empty sources and the pin, label and parking layers. Idempotent. */
export function addMapped(map: MlMap, layers: LayerState): void {
  if (!bound.has(map)) {
    bound.add(map);
    map.on("moveend", () => refreshMapped(map));
  }
  if (map.getSource(SOURCE)) {
    setMappedCats(map, layers);
    return;
  }

  map.addSource(SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource(PARKING_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const before = map.getLayer("label-country") ? "label-country" : undefined;

  for (let band = 0; band < BAND_ZOOMS.length; band += 1) {
    map.addLayer(
      {
        id: `mapped-pin-${band}`,
        type: "symbol",
        source: SOURCE,
        minzoom: BAND_ZOOMS[band],
        filter: pinFilter(band, PRACTICAL_CATS),
        layout: {
          "icon-image": PRACTICAL_ICON,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            Math.max(7, BAND_ZOOMS[band]),
            0.42,
            16,
            0.78,
          ],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
          "icon-padding": 2,
        },
      },
      before,
    );
  }

  /* Parking is dense and late; its own source and file keep it out of the pin
     payload until the street zooms, where it is the point of the view. */
  map.addLayer(
    {
      id: "mapped-parking",
      type: "symbol",
      source: PARKING_SOURCE,
      minzoom: PARKING_MINZOOM,
      filter: ["==", ["get", "cat"], PARKING_CAT] as unknown as ExpressionSpecification,
      layout: {
        "icon-image": "parking",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13.5, 0.34, 16, 0.6],
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
        "icon-padding": 2,
      },
    },
    before,
  );

  /* Names lag their pin by one zoom: the dot says a place exists, the name is
     what you search for on a signpost. One label layer per pin band, so the
     duplicate band's names arrive with its pins at 13.5 rather than at 10. */
  const labelBands = BAND_ZOOMS.map((zoom, band) => ({
    zooms: [band],
    minzoom: zoom + 1.3,
  }));
  labelBands.forEach((spec, i) => {
    map.addLayer(
      {
        id: `mapped-label-${i}`,
        type: "symbol",
        source: SOURCE,
        minzoom: spec.minzoom,
        filter: labelFilter(PRACTICAL_CATS, spec.zooms),
        layout: {
          "text-field": ["get", "n"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], spec.minzoom, 9.5, 16, 12],
          "text-anchor": "top",
          "text-offset": [0, 0.9],
          "text-max-width": 9,
          "text-padding": 4,
          "text-optional": true,
        },
        paint: {
          "text-color": i >= 3 ? "#e9dcc4" : "#f3e6cd",
          "text-halo-color": "#05090f",
          "text-halo-width": 1.5,
        },
      },
      before,
    );
  });

  setMappedCats(map, layers);

  /* A rebuilt style comes back with no features in the new source, but every cell
     this session already downloaded is still in `loaded`. */
  if (loaded.size || parkingLoaded.size) schedulePush(map);
}

/** Category switches for the practical half: filters on the pin bands. */
export function setMappedCats(map: MlMap, layers: LayerState): void {
  const master = layers.features;
  const on = (ids: string[]) => (master ? ids.filter((id) => layers.cats[id]) : []);
  const enabled = on([...PRACTICAL_CATS]);

  for (let band = 0; band < BAND_ZOOMS.length; band += 1) {
    const id = `mapped-pin-${band}`;
    if (map.getLayer(id)) {
      map.setFilter(id, pinFilter(band, enabled) as unknown as import("maplibre-gl").FilterSpecification);
    }
  }

  if (map.getLayer("mapped-parking")) {
    map.setLayoutProperty(
      "mapped-parking",
      "visibility",
      master && layers.cats[PARKING_CAT] ? "visible" : "none",
    );
  }

  const labelBands = BAND_ZOOMS.map((_, band) => ({ bands: [band] }));
  labelBands.forEach((spec, i) => {
    const id = `mapped-label-${i}`;
    if (map.getLayer(id)) {
      map.setFilter(
        id,
        labelFilter(enabled, spec.bands) as unknown as import("maplibre-gl").FilterSpecification,
      );
    }
  });
}

/** Fetches whatever cells the camera is looking at. Called on `moveend`. */
export function refreshMapped(map: MlMap) {
  if (!map.getSource(SOURCE)) return;
  const zoom = map.getZoom();
  if (zoom < 5.5) return;

  const n = 2 ** MAPPED_CELL_ZOOM;
  const bounds = map.getBounds();
  const lon2x = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const lat2y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    );
  };

  const x0 = lon2x(bounds.getWest());
  const x1 = lon2x(bounds.getEast());
  const y0 = lat2y(Math.min(85, bounds.getNorth()));
  const y1 = lat2y(Math.max(-85, bounds.getSouth()));

  const visible: [number, number][] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      visible.push([((x % n) + n) % n, Math.max(0, Math.min(n - 1, y))]);
    }
  }

  const visibleKeys = new Set(visible.map(([x, y]) => cellKey(MAPPED_CELL_ZOOM, x, y)));

  const wanted = visible.filter(([x, y]) => {
    const key = cellKey(MAPPED_CELL_ZOOM, x, y);
    if (loaded.has(key) || pending.has(key)) return false;
    const until = misses.get(key);
    return !(until && until > Date.now());
  });

  // At country zoom one z6 cell is a large part of the view, and six cells left
  // most of Europe blank until the next pan. Fetch a wider first ring there.
  const pass = zoom < 7 ? 24 : MAX_CELLS_PER_PASS;
  for (const [x, y] of wanted.slice(0, pass)) {
    const key = cellKey(MAPPED_CELL_ZOOM, x, y);
    const path = `poi/${MAPPED_CELL_ZOOM}/${x}/${y}.json`;
    pending.add(key);
    void cellMayExist(path)
      .then((present) => {
        if (!present) {
          /* Not in the store's index: an empty cell, not a failed request. */
          misses.set(key, Date.now() + MISS_RETRY_MS);
          return null;
        }
        return fetch(cellUrl(path))
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            return res.json() as Promise<Cell>;
          })
          .then((cell) => {
        const meta = new Map<number, Record<string, string>>();
        for (const [index, tags] of cell.detail ?? []) meta.set(index, tags);
        const features = cell.items.map((row, index) => toFeature(row, meta.get(index)));
        assignBands(features);
        markCell(key, features, destinationIndex());
            misses.delete(key);
            loaded.set(key, features);
            banded.set(key, splitBands(features));
            total += features.length;
            indexNamed(cell);
            evictIfNeeded(visibleKeys);
            schedulePush(map);
          });
      })
      .catch((err: unknown) => {
        if (err instanceof SyntaxError) console.error(`terrane: ${path} did not parse`, err);
        misses.set(key, retryAt(err));
      })
      .finally(() => pending.delete(key));
  }

  if (zoom >= PARKING_MINZOOM) {
    const parkWanted = visible.filter(([x, y]) => {
      const key = cellKey(MAPPED_CELL_ZOOM, x, y);
      if (parkingLoaded.has(key) || parkingPending.has(key)) return false;
      const until = parkingMisses.get(key);
      return !(until && until > Date.now());
    });

    for (const [x, y] of parkWanted.slice(0, PARKING_MAX_CELLS)) {
      const key = cellKey(MAPPED_CELL_ZOOM, x, y);
      const path = `poi/${MAPPED_CELL_ZOOM}/${x}/${y}.parking.json`;
      parkingPending.add(key);
      void cellMayExist(path)
        .then((present) => {
          if (!present) {
            parkingMisses.set(key, Date.now() + MISS_RETRY_MS);
            return null;
          }
          return fetch(cellUrl(path))
            .then((res) => {
              if (!res.ok) throw new Error(String(res.status));
              return res.json() as Promise<Cell>;
            })
            .then((cell) => {
              const features = cell.items.map((row) => toFeature(row));
              markCell(key, features, destinationIndex());
              parkingMisses.delete(key);
              parkingLoaded.set(key, features);
              parkingTotal += features.length;
              indexNamed(cell, true);
              evictParkingIfNeeded(visibleKeys);
              schedulePush(map);
            });
        })
        .catch((err: unknown) => {
          if (err instanceof SyntaxError) console.error(`terrane: ${path} did not parse`, err);
          parkingMisses.set(key, retryAt(err));
        })
        .finally(() => parkingPending.delete(key));
    }
  }

  /* The band or the viewport may have changed even when no cell was fetched. */
  schedulePush(map);
}

function indexNamed(cell: Cell, parking = false) {
  if (namedRows.length >= NAMED_SEARCH_CAP) return;
  for (const row of cell.items) {
    if (!row[3]) continue;
    const cat = parking ? PARKING_CAT : (MAPPED_CATS[row[2]] ?? "camp");
    namedRows.push({ cat, name: row[3], lat: row[0], lon: row[1], src: row[4] || "osm" });
    if (namedRows.length >= NAMED_SEARCH_CAP) return;
  }
}

export type MappedStats = {
  cells: number;
  cached: number;
  drawn: number;
  duplicates: number;
  parkingCells: number;
  parkingDrawn: number;
  lastSetDataMs: number;
};

/** What the debug readout shows. Counts, not estimates. */
export function mappedStats(): MappedStats {
  return {
    cells: loaded.size,
    cached: total,
    drawn,
    duplicates,
    parkingCells: parkingLoaded.size,
    parkingDrawn,
    lastSetDataMs,
  };
}

/** Re-run the duplicate guard after a lazy destination chunk arrives, then push. */
export function refreshDuplicates(map: MlMap) {
  if (!map.getSource(SOURCE)) return;
  destinationIndex();
  schedulePush(map);
}

/** Clear the cache — used when the style is rebuilt and sources are recreated. */
export function resetMapped() {
  pushToken += 1;
  loaded.clear();
  banded.clear();
  pending.clear();
  misses.clear();
  parkingLoaded.clear();
  parkingPending.clear();
  parkingMisses.clear();
  dupCounts.clear();
  namedRows.length = 0;
  destinations = null;
  duplicates = 0;
  drawn = 0;
  parkingDrawn = 0;
  lastSetDataMs = 0;
  total = 0;
  parkingTotal = 0;
}

registerMappedSearch(() => namedRows);
