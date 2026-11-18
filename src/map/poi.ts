import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";

/**
 * World POIs, one JSON file per z6 cell, fetched as you look at them.
 *
 * `scripts/harvest-poi.py` walks the whole planet through Overpass and writes
 * `public/poi/6/{x}/{y}.json` — campsites, mountain huts, shelters, water points,
 * springs, viewpoints, picnic sites and passes, everywhere, with no seed list. A
 * cell is ~600 km across, so the map fetches one file the first time you zoom into
 * a region and never refetches it: global coverage without a global download.
 *
 * The radius harvest near the written-up places (`kit.json`) is still there and
 * these rows deliberately exclude anything within ~60 m of it, so a campsite
 * beside a written-up summit is drawn once, not twice.
 *
 * **Priority by kind, not by fame.** Water taps and picnic tables are worthless at
 * regional scale and useful at street scale, so they simply start later:
 *
 *   camp · hut  z10.6    pass  z11.4    shelter  z12.4
 *   viewpoint   z13.0    picnic z13.4   water    z13.8
 */

export const POI_LAYERS = [
  "poi-camp",
  "poi-hut",
  "poi-shelter",
  "poi-water",
  "poi-view",
  "poi-picnic",
  "poi-pass",
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
];

export const poiIconForKind = (kind: number) => ICONS[kind] ?? "camp-tent";

/** Zoom each kind starts at. Dense, low-value kinds wait until you are close. */
const MINZOOM = [10.6, 10.6, 12.4, 13.8, 14.4, 13, 13.4, 11.4];

/** Only these have a name worth reading early. */
const NAMED_KINDS = [0, 1, 7];

const MAX_FEATURES = 60_000;
const MAX_CELLS_PER_PASS = 6;

export const POI_CELL_ZOOM = 6;

type Row = [number, number, number, string?];
type Cell = { z: number; kinds: string[]; items: Row[] };

/* Kept outside React: the map wants the cumulative collection, and a re-render
   must not throw it away. Insertion order is the eviction order. */
const loaded = new Map<string, Feature<Point>[]>();
let total = 0;
const pending = new Set<string>();
let emptyCells = new Set<string>();

const cellKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

function toFeature(row: Row): Feature<Point> {
  const [lat, lon, kind, name] = row;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: name ? { k: kind, n: name } : { k: kind },
  };
}

function collection(): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const cell of loaded.values()) features.push(...cell);
  return { type: "FeatureCollection", features };
}

function pushToMap(map: MlMap) {
  const src = map.getSource("poi") as { setData?: (d: unknown) => void } | undefined;
  src?.setData?.(collection());
}

function evictIfNeeded() {
  while (total > MAX_FEATURES && loaded.size > 1) {
    const [key, features] = loaded.entries().next().value as [string, Feature<Point>[]];
    loaded.delete(key);
    total -= features.length;
  }
}

const iconExpression = [
  "match",
  ["get", "k"],
  0, ICONS[0],
  1, ICONS[1],
  2, ICONS[2],
  3, ICONS[3],
  4, ICONS[4],
  5, ICONS[5],
  6, ICONS[6],
  ICONS[7],
] as unknown as ExpressionSpecification;

const LAYER_FOR_KIND = [
  "poi-camp",
  "poi-hut",
  "poi-shelter",
  "poi-water",
  "poi-parking",
  "poi-view",
  "poi-picnic",
  "poi-pass",
];

/** Adds the (empty) POI source and its layers. Data arrives per cell. */
export function addPoi(map: MlMap, before?: string) {
  if (map.getSource("poi")) return;
  map.addSource("poi", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  for (let kind = 0; kind < LAYER_FOR_KIND.length; kind += 1) {
    if (kind === 4) continue; // parking is not in the global harvest
    const dense = kind === 3 || kind === 5 || kind === 6;
    map.addLayer(
      {
        id: LAYER_FOR_KIND[kind],
        type: "symbol",
        source: "poi",
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

  const wanted: [number, number][] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const cx = ((x % n) + n) % n;
      const cy = Math.max(0, Math.min(n - 1, y));
      const key = cellKey(POI_CELL_ZOOM, cx, cy);
      if (loaded.has(key) || pending.has(key) || emptyCells.has(key)) continue;
      wanted.push([cx, cy]);
    }
  }

  for (const [x, y] of wanted.slice(0, MAX_CELLS_PER_PASS)) {
    const key = cellKey(POI_CELL_ZOOM, x, y);
    pending.add(key);
    void fetch(`/poi/${POI_CELL_ZOOM}/${x}/${y}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Cell>;
      })
      .then((cell) => {
        const features = cell.items.map(toFeature);
        loaded.set(key, features);
        total += features.length;
        evictIfNeeded();
        pushToMap(map);
      })
      .catch(() => {
        /* A cell with nothing in it is a 404 and stays a 404 — remember it so
           panning back and forth does not re-ask. */
        emptyCells.add(key);
      })
      .finally(() => pending.delete(key));
  }
}

/** Clear the cache — used when the style is rebuilt and sources are recreated. */
export function resetPoi() {
  loaded.clear();
  pending.clear();
  emptyCells = new Set();
  total = 0;
}

export const poiCellKey = cellKey;
