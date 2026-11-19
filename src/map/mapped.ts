import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  PRACTICAL_CATS,
  PRACTICAL_ICON,
  category,
  registerMappedSearch,
  type FeatureRow,
} from "../data/features";
import type { LayerState } from "../components/LayerControl";

/**
 * Mapped places: campsites, huts, shelters, water, parking and the rest of the
 * practical categories, one JSON file per z6 cell, fetched as you look at them.
 *
 * The same record shape as a destination, with `cat` in place of a kind index, so
 * the layer panel, the card and the search do not care which harvest a pin came
 * from. `scripts/harvest-poi-bulk.py` streams 437 Geofabrik country extracts
 * through pyosmium and writes the cells; nothing here is seeded by the atlas.
 *
 * A cell is ~600 km across: global coverage without a global download.
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

const DENSE = new Set(["water", "parking", "view", "picnic", "toilets", "shower", "info"]);

/** Names that earn their space early; everything else waits for street zoom. */
const EARLY_NAMES = new Set(["camp", "hut", "pass", "caravan"]);

export const MAPPED_LAYERS = [
  ...MAPPED_CATS.map((cat) => `mapped-${cat}`),
  "mapped-camp-flagship",
  "mapped-camp-established",
  "mapped-label-flagship",
  "mapped-label-early",
  "mapped-label-late",
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
const PARKING_MINZOOM = 14.4;
const PARKING_MAX_CELLS = 4;
const PARKING_MAX_FEATURES = 120_000;

const MISS_RETRY_MS = 5 * 60_000;
const ERROR_RETRY_MS = 20_000;
export const MAPPED_CELL_ZOOM = 6;

const POI_BASE = (
  (import.meta.env.VITE_POI_BASE as string | undefined) ??
  "https://terrane-poi-cells-mqa53q-preview.freebuff.site"
).replace(/\/+$/, "");

const loaded = new Map<string, Feature<Point>[]>();
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

const cellKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

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
  properties.band = Number(meta?.band ?? 2);
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties,
  };
}

/* Copy with a loop, never `push(...cell)`: a cell over the Alps holds 276,000
   features, and spreading that into a call is a "Maximum call stack size
   exceeded" the first time somebody pans to Innsbruck. */
function collection(): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const cell of loaded.values()) {
    for (let i = 0; i < cell.length; i += 1) features.push(cell[i]);
  }
  return { type: "FeatureCollection", features };
}

function parkingCollection(): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const cell of parkingLoaded.values()) {
    for (let i = 0; i < cell.length; i += 1) features.push(cell[i]);
  }
  return { type: "FeatureCollection", features };
}

function pushToMap(map: MlMap) {
  const src = map.getSource(SOURCE) as { setData?: (d: unknown) => void } | undefined;
  src?.setData?.(collection());
  const park = map.getSource(PARKING_SOURCE) as
    | { setData?: (d: unknown) => void }
    | undefined;
  park?.setData?.(parkingCollection());
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

function labelFilter(ids: string[]): ExpressionSpecification {
  return ["all", ["!=", ["get", "n"], ""], catFilter(ids)] as unknown as ExpressionSpecification;
}

/** Adds the empty sources and their 13 category layers. Idempotent. */
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

  for (const cat of MAPPED_CATS) {
    const c = category(cat);
    const dense = DENSE.has(cat);
    map.addLayer({
      id: `mapped-${cat}`,
      type: "symbol",
      source: cat === PARKING_CAT ? PARKING_SOURCE : SOURCE,
      minzoom: c.minzoom ?? 12,
      filter: ["==", ["get", "cat"], cat] as unknown as ExpressionSpecification,
      layout: {
        "icon-image": PRACTICAL_ICON,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          c.minzoom ?? 12,
          0.42,
          16,
          0.78,
        ],
        "icon-allow-overlap": !dense,
        "icon-ignore-placement": !dense,
      },
    });
  }

  /* Campsites arrive in three waves: a flagship campground is worth seeing at
     country scale, an established one at regional scale, and the rest only when
     you are close enough to read the clearing. The band comes from the merge, not
     from a hand-written list. */
  const campBand = (band: number): ExpressionSpecification =>
    ["all", ["==", ["get", "cat"], "camp"], ["==", ["get", "band"], band]] as unknown as ExpressionSpecification;
  for (const [id, minzoom, band] of [
    ["mapped-camp-flagship", 5.5, 0],
    ["mapped-camp-established", 8, 1],
  ] as const) {
    map.addLayer({
      id,
      type: "symbol",
      source: SOURCE,
      minzoom,
      maxzoom: 10.6,
      filter: campBand(band),
      layout: {
        "icon-image": PRACTICAL_ICON,
        "icon-size": ["interpolate", ["linear"], ["zoom"], minzoom, 0.34, 10.6, 0.52],
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
      },
    });
  }

  map.addLayer({
    id: "mapped-label-flagship",
    type: "symbol",
    source: SOURCE,
    minzoom: 7.2,
    maxzoom: 10.6,
    filter: [
      "all",
      ["==", ["get", "cat"], "camp"],
      ["==", ["get", "band"], 0],
      ["!=", ["get", "n"], ""],
    ] as unknown as ExpressionSpecification,
    layout: {
      "text-field": ["get", "n"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 7.2, 10, 10.6, 12],
      "text-anchor": "top",
      "text-offset": [0, 0.9],
      "text-max-width": 9,
      "text-padding": 4,
      "text-optional": true,
    },
    paint: {
      "text-color": "#f3e6cd",
      "text-halo-color": "#05090f",
      "text-halo-width": 1.5,
    },
  });

  map.addLayer({
    id: "mapped-label-early",
    type: "symbol",
    source: SOURCE,
    minzoom: 12.6,
    filter: labelFilter([...EARLY_NAMES]),
    layout: {
      "text-field": ["get", "n"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 12.6, 9.5, 16, 12],
      "text-anchor": "top",
      "text-offset": [0, 0.9],
      "text-max-width": 9,
      "text-padding": 4,
      "text-optional": true,
    },
    paint: {
      "text-color": "#f3e6cd",
      "text-halo-color": "#05090f",
      "text-halo-width": 1.6,
    },
  });

  map.addLayer({
    id: "mapped-label-late",
    type: "symbol",
    source: SOURCE,
    minzoom: 13.4,
    filter: labelFilter(PRACTICAL_CATS.filter((c) => !EARLY_NAMES.has(c))),
    layout: {
      "text-field": ["get", "n"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 13.4, 9.5, 16, 12],
      "text-anchor": "top",
      "text-offset": [0, 0.9],
      "text-max-width": 9,
      "text-padding": 4,
      "text-optional": true,
    },
    paint: {
      "text-color": "#e9dcc4",
      "text-halo-color": "#05090f",
      "text-halo-width": 1.5,
    },
  });

  setMappedCats(map, layers);

  /* A rebuilt style comes back with no features in the new source, but every cell
     this session already downloaded is still in `loaded`. */
  if (loaded.size || parkingLoaded.size) pushToMap(map);
}

/** Category switches for the practical half: one layer per category. */
export function setMappedCats(map: MlMap, layers: LayerState): void {
  const master = layers.features;
  for (const cat of MAPPED_CATS) {
    const id = `mapped-${cat}`;
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(
      id,
      "visibility",
      master && layers.cats[cat] ? "visible" : "none",
    );
  }

  const campOn = master && layers.cats.camp;
  for (const id of ["mapped-camp-flagship", "mapped-camp-established"]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", campOn ? "visible" : "none");
    }
  }
  if (map.getLayer("mapped-label-flagship")) {
    map.setLayoutProperty("mapped-label-flagship", "visibility", campOn ? "visible" : "none");
  }

  const on = (ids: string[]) => (master ? ids.filter((id) => layers.cats[id]) : []);
  if (map.getLayer("mapped-label-early")) {
    map.setFilter("mapped-label-early", labelFilter(on([...EARLY_NAMES])));
  }
  if (map.getLayer("mapped-label-late")) {
    map.setFilter(
      "mapped-label-late",
      labelFilter(on(PRACTICAL_CATS.filter((c) => !EARLY_NAMES.has(c)))),
    );
  }
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
    pending.add(key);
    void fetch(`${POI_BASE}/poi/${MAPPED_CELL_ZOOM}/${x}/${y}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Cell>;
      })
      .then((cell) => {
        const meta = new Map<number, Record<string, string>>();
        for (const [index, tags] of cell.detail ?? []) meta.set(index, tags);
        const features = cell.items.map((row, index) => toFeature(row, meta.get(index)));
        misses.delete(key);
        loaded.set(key, features);
        total += features.length;
        indexNamed(cell);
        evictIfNeeded(visibleKeys);
        pushToMap(map);
      })
      .catch((err: unknown) => {
        const status = Number(String((err as Error)?.message ?? err));
        misses.set(key, Date.now() + (status === 404 ? MISS_RETRY_MS : ERROR_RETRY_MS));
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
      parkingPending.add(key);
      void fetch(`${POI_BASE}/poi/${MAPPED_CELL_ZOOM}/${x}/${y}.parking.json`)
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<Cell>;
        })
        .then((cell) => {
          const features = cell.items.map((row) => toFeature(row));
          parkingMisses.delete(key);
          parkingLoaded.set(key, features);
          parkingTotal += features.length;
          indexNamed(cell, true);
          evictParkingIfNeeded(visibleKeys);
          pushToMap(map);
        })
        .catch((err: unknown) => {
          const status = Number(String((err as Error)?.message ?? err));
          parkingMisses.set(
            key,
            Date.now() + (status === 404 ? MISS_RETRY_MS : ERROR_RETRY_MS),
          );
        })
        .finally(() => parkingPending.delete(key));
    }
  }
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

/** Clear the cache — used when the style is rebuilt and sources are recreated. */
export function resetMapped() {
  loaded.clear();
  pending.clear();
  misses.clear();
  parkingLoaded.clear();
  parkingPending.clear();
  parkingMisses.clear();
  namedRows.length = 0;
  total = 0;
  parkingTotal = 0;
}

registerMappedSearch(() => namedRows);

export const mappedCellKey = cellKey;

/** Exposed for tests and the audit: what the budget currently holds. */
export const mappedStats = () => ({
  cells: loaded.size,
  features: total,
  parkingCells: parkingLoaded.size,
  parkingFeatures: parkingTotal,
  named: namedRows.length,
});
