import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";

/**
 * World POIs, one JSON file per z6 cell, fetched as you look at them.
 *
 * `scripts/harvest-poi-bulk.py` streams 437 Geofabrik country extracts through
 * pyosmium and writes the cells — campsites, caravan sites, mountain huts,
 * shelters, drinking water and springs, parking, viewpoints, picnic sites, passes,
 * toilets, showers, information boards and trailheads, everywhere, with no seed list
 * and no Overpass queue. A cell is ~600 km across, so the map fetches one file the
 * first time you zoom into a region and never refetches it: global coverage without
 * a global download.
 *
 * The radius harvest near the written-up places (`kit.json`) is still there and
 * these rows deliberately exclude anything within ~60 m of it, so a campsite
 * beside a written-up summit is drawn once, not twice.
 *
 * **Priority by kind, not by fame.** Water taps and picnic tables are worthless at
 * regional scale and useful at street scale, so they simply start later:
 *
 *   camp · hut  z10.6    pass  z11.4    caravan  z12.2    shelter  z12.4
 *   trailhead   z12.8    viewpoint z13.0    picnic    z13.4    water z13.8
 *   toilets     z13.6    info   z13.6    shower    z14.0    parking z14.4
 */

export const POI_LAYERS = [
  "poi-camp",
  "poi-hut",
  "poi-shelter",
  "poi-water",
  "poi-parking",
  "poi-view",
  "poi-picnic",
  "poi-pass",
  "poi-caravan",
  "poi-toilets",
  "poi-shower",
  "poi-info",
  "poi-trailhead",
  "poi-names",
];

export const POI_KIND_LABEL = [
  "Camp site",
  "Mountain hut",
  "Shelter",
  "Water",
  "Parking",
  "Viewpoint",
  "Picnic table",
  "Mountain pass",
  "Caravan site",
  "Toilets",
  "Shower",
  "Information board",
  "Trailhead",
];

const ICONS = [
  "camp-tent",
  "camp-hut",
  "camp-shelter",
  "water-drop",
  "parking",
  "viewpoint",
  "picnic-table",
  "camp-hut",
  "caravan",
  "toilets",
  "shower",
  "info",
  "trailhead",
];

export const poiIconForKind = (kind: number) => ICONS[kind] ?? "camp-tent";

/** Zoom each kind starts at. Dense, low-value kinds wait until you are close. */
const MINZOOM = [10.6, 10.6, 12.4, 13.8, 14.4, 13, 13.4, 11.4, 12.2, 13.6, 14, 13.6, 12.8];

/** These collide with each other: a city has hundreds, and the pins would become a
 *  wall of droplets. Camps, huts, caravans and passes never hide for collision. */
const DENSE = new Set([3, 4, 5, 6, 9, 10, 11]);

/** Only these have a name worth reading early. */
const NAMED_KINDS = [0, 1, 7, 8];

/* The feature budget for the main source. It has to be generous: a z6 cell over the
   Alps holds 276,000 rows on its own (Germany and Austria between them map 155,000
   information boards), and a budget smaller than that cell would evict it on the
   next `moveend` and fetch its 11 MB again. At this size the biggest cell stays put
   and its neighbours join it. */
const MAX_FEATURES = 320_000;
const MAX_CELLS_PER_PASS = 6;

/* Parking lives in its own file per cell and its own source. There are millions of
   car parks in OSM — often two thirds of the rows in a country — and they are only
   worth drawing at street zoom, so they travel separately: a cell's main file stays
   small, and parking is fetched only when the layer that draws it is on screen. */
const PARKING_KIND = 4;
const PARKING_MINZOOM = 14.4;
/** At z14.4 a z6 cell is much wider than the screen; four is a border straddle. */
const PARKING_MAX_CELLS = 4;
const PARKING_MAX_FEATURES = 120_000;

/** How long a cell that was not there waits before the map asks again. Nothing
 *  about a missing cell is permanent: the harvest writes new files every night, so
 *  remembering a 404 forever means a region stays blank until the tab is reloaded. */
const MISS_RETRY_MS = 5 * 60_000;
/** A cell whose request failed for any other reason retries sooner, but not on
 *  every single move — a dead network would otherwise be one request per cell per
 *  pan. */
const ERROR_RETRY_MS = 20_000;

export const POI_CELL_ZOOM = 6;

/**
 * Where the cells are served from.
 *
 * The world harvest is 370 MB across 1,869 files. That is far too much to keep in
 * the repo (one commit of it is 370 MB, and a push of that fails more often than it
 * works) and too much for a static build to copy around, so the cells live in an
 * R2 bucket behind a small Worker: same paths, a long cache header and an open
 * CORS header, read exactly as if they were in `public/`. `VITE_POI_BASE` points
 * the loader somewhere else — a local mirror of `public/poi`, a fork's bucket —
 * without touching this file.
 */
const POI_BASE = (
  (import.meta.env.VITE_POI_BASE as string | undefined) ??
  "https://terrane-poi-cells-mqa53q-preview.freebuff.site"
).replace(/\/+$/, "");

type Row = [number, number, number, string?];
/** The camping tags the harvest kept, keyed by item index in the same cell. */
type Detail = [number, Record<string, string>][];
type Cell = { z: number; kinds: string[]; items: Row[]; detail?: Detail };

/* Kept outside React: the map wants the cumulative collection, and a re-render
   must not throw it away. Insertion order is the eviction order. */
const loaded = new Map<string, Feature<Point>[]>();
let total = 0;
const pending = new Set<string>();
/** Cell key → the earliest time it is worth asking for again. */
const misses = new Map<string, number>();
/** The maps that already have a `moveend` hook, so a style rebuild cannot add a
 *  second one. A rebuild replaces the source and the layers; the map, and this
 *  listener, live on. */
const bound = new WeakSet<MlMap>();

/* Parking: the same bookkeeping, separate budget, separate source. */
const parkingLoaded = new Map<string, Feature<Point>[]>();
const parkingPending = new Set<string>();
const parkingMisses = new Map<string, number>();
let parkingTotal = 0;

const cellKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

/**
 * "Free · 40 pitches · water, toilets · Sola Camping" — the mapped facts a camper
 * actually picks between sites by, from the tags the harvester preserved. Three
 * facts at most: a card is not a table.
 */
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
  const [lat, lon, kind, name] = row;
  const note = meta ? summary(meta) : "";
  const properties: { k: number; n?: string; d?: string } = { k: kind };
  if (name) properties.n = name;
  if (note) properties.d = note;
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
  const src = map.getSource("poi") as { setData?: (d: unknown) => void } | undefined;
  src?.setData?.(collection());
  const park = map.getSource("poi-parking") as
    | { setData?: (d: unknown) => void }
    | undefined;
  park?.setData?.(parkingCollection());
}

/* A hard ceiling, only reached when every cell on screen is a giant: past it the
   budget wins and a refetch is the lesser evil. */
const HARD_FEATURES = 900_000;
const PARKING_HARD_FEATURES = 400_000;

/**
 * Drop whole cells until the source fits its budget — but never a cell that is on
 * screen. Evicting a visible cell is self-defeating: the next `moveend` sees it is
 * missing, asks for the same 11 MB again, and the map spends the afternoon
 * downloading the Alps. Off-screen cells are the ones nobody is looking at.
 */
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

/* "match" wants label/icon pairs and then a fallback, so every kind but the last
   is listed and the last one covers anything unknown. */
const iconExpression = [
  "match",
  ["get", "k"],
  ...ICONS.slice(0, -1).flatMap((icon, kind) => [kind, icon]),
  ICONS[ICONS.length - 1],
] as unknown as ExpressionSpecification;

/* One layer per kind, and one kind per layer: naming them here is what keeps the
   legend, the pins and the picker in step. Every entry needs a layer — a kind that
   is listed but never added is downloaded, counted and invisible. */
const LAYER_FOR_KIND = [
  "poi-camp",
  "poi-hut",
  "poi-shelter",
  "poi-water",
  "poi-parking",
  "poi-view",
  "poi-picnic",
  "poi-pass",
  "poi-caravan",
  "poi-toilets",
  "poi-shower",
  "poi-info",
  "poi-trailhead",
];

/** Adds the (empty) POI source and its layers. Data arrives per cell. */
export function addPoi(map: MlMap, before?: string) {
  if (!bound.has(map)) {
    bound.add(map);
    map.on("moveend", () => refreshPoi(map));
  }
  if (map.getSource("poi")) return;
  map.addSource("poi", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("poi-parking", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  for (let kind = 0; kind < LAYER_FOR_KIND.length; kind += 1) {
    const dense = DENSE.has(kind);
    map.addLayer(
      {
        id: LAYER_FOR_KIND[kind],
        type: "symbol",
        source: kind === PARKING_KIND ? "poi-parking" : "poi",
        minzoom: MINZOOM[kind],
        filter: ["==", ["get", "k"], kind] as unknown as ExpressionSpecification,
        layout: {
          "icon-image": iconExpression,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            MINZOOM[kind],
            0.42,
            16,
            0.78,
          ],
          /* Camps and huts are sparse enough that hiding one to make room for
             another is a loss; taps and picnic tables are not, and collision is
             what keeps a city from turning into a wall of droplets. */
          "icon-allow-overlap": !dense,
          "icon-ignore-placement": !dense,
        },
      },
      before,
    );
  }

  map.addLayer(
    {
      id: "poi-names",
      type: "symbol",
      source: "poi",
      minzoom: 12.6,
      filter: [
        "all",
        ["in", ["get", "k"], ["literal", NAMED_KINDS]],
        ["has", "n"],
      ] as unknown as ExpressionSpecification,
      layout: {
        "text-field": ["get", "n"] as ExpressionSpecification,
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
    },
    before,
  );

  /* A rebuilt style comes back with no features in the new source, but every cell
     this session already downloaded is still in `loaded`. Without this line the
     pins vanish on the first rebuild and stay gone: `refreshPoi` skips cells it has
     already got, so nothing ever puts them back. Re-pushing costs one setData. */
  if (loaded.size) pushToMap(map);
}

/**
 * Fetches whatever cells the camera is looking at. Called on `moveend`; cheap
 * when nothing new is in view, because the visible cell set is two numbers.
 */
export function refreshPoi(map: MlMap) {
  if (!map.getSource("poi")) return;
  const zoom = map.getZoom();
  /* Below this the pins do not exist yet, so there is nothing to fetch — and a
     world view would ask for a hundred files to draw nothing. */
  if (zoom < 9.2) return;

  const n = 2 ** POI_CELL_ZOOM;
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

  const visibleKeys = new Set(visible.map(([x, y]) => cellKey(POI_CELL_ZOOM, x, y)));

  const wanted = visible.filter(([x, y]) => {
    const key = cellKey(POI_CELL_ZOOM, x, y);
    if (loaded.has(key) || pending.has(key)) return false;
    const until = misses.get(key);
    return !(until && until > Date.now());
  });

  for (const [x, y] of wanted.slice(0, MAX_CELLS_PER_PASS)) {
    const key = cellKey(POI_CELL_ZOOM, x, y);
    pending.add(key);
    void fetch(`${POI_BASE}/poi/${POI_CELL_ZOOM}/${x}/${y}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Cell>;
      })
      .then((cell) => {
        /* Camping rows carry the tags the harvester kept, index-aligned with the
           items; the card reads them, the map ignores them. */
        const meta = new Map<number, Record<string, string>>();
        for (const [index, tags] of cell.detail ?? []) meta.set(index, tags);
        const features = cell.items.map((row, index) => toFeature(row, meta.get(index)));
        misses.delete(key);
        loaded.set(key, features);
        total += features.length;
        evictIfNeeded(visibleKeys);
        pushToMap(map);
      })
      .catch((err: unknown) => {
        /* 404 is the normal answer for a cell with nothing in it, and for a cell
           the harvest has not reached yet — so it is remembered, with an expiry,
           rather than either retried in a loop or written off for good. Anything
           else (offline, a 500, a cancelled request) gets a shorter pause. */
        const status = Number(String((err as Error)?.message ?? err));
        misses.set(key, Date.now() + (status === 404 ? MISS_RETRY_MS : ERROR_RETRY_MS));
      })
      .finally(() => pending.delete(key));
  }

  /* The same cells, a different file: parking is only worth the request once the
     parking layer itself is on screen. */
  if (zoom >= PARKING_MINZOOM) {
    const parkWanted = visible.filter(([x, y]) => {
      const key = cellKey(POI_CELL_ZOOM, x, y);
      if (parkingLoaded.has(key) || parkingPending.has(key)) return false;
      const until = parkingMisses.get(key);
      return !(until && until > Date.now());
    });

    for (const [x, y] of parkWanted.slice(0, PARKING_MAX_CELLS)) {
      const key = cellKey(POI_CELL_ZOOM, x, y);
      parkingPending.add(key);
      void fetch(`${POI_BASE}/poi/${POI_CELL_ZOOM}/${x}/${y}.parking.json`)
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json() as Promise<Cell>;
        })
        .then((cell) => {
          const features = cell.items.map((row) => toFeature(row));
          parkingMisses.delete(key);
          parkingLoaded.set(key, features);
          parkingTotal += features.length;
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

/** Clear the cache — used when the style is rebuilt and sources are recreated. */
export function resetPoi() {
  loaded.clear();
  pending.clear();
  misses.clear();
  parkingLoaded.clear();
  parkingPending.clear();
  parkingMisses.clear();
  total = 0;
  parkingTotal = 0;
}

export const poiCellKey = cellKey;
