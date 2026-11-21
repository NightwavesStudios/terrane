import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import type { LayerState } from "../components/LayerControl";
import { cellUrl } from "../lib/cells";
import { cellMayExist } from "../lib/cellIndex";
import { kmBetween } from "../lib/geo";
import { firstPinCell } from "./pins";

/**
 * Trail routes, from our own cells: OSM hiking relations plus the US agency trail
 * inventories. The basemap still draws every OSM path/footway at z11.4+; this layer
 * exists for the lower zooms and for route identity (name, class, distance, source).
 *
 * Cells are z7 and truly clipped to their tile by `scripts/merge-sources.py`, so a
 * long-distance route is several local pieces rather than one 500 km chord, and
 * every tile a route crosses contains it. Payloads are viewport-bounded and the
 * cache is evicted, like the practical pins; a long pan no longer keeps every
 * route ever loaded in the GeoJSON source.
 *
 * At deep zoom the basemap's own paths are the trail detail. The route line fades
 * out by z13.2 and only its labels remain, so the same trail is not drawn twice.
 */
const CELL = 7;
const SOURCE = "trail-routes";
const MISS_RETRY_MS = 5 * 60_000;
const ERROR_RETRY_MS = 20_000;
const MAX_CELLS = 24;
const NAMED_ZOOM = 10.5;
const ROUTE_MAX_ZOOM = 12.6;
const GAP_KM = 5;
const CHORD_KM = 2;
const CHORD_RATIO = 6;

export const TRAIL_LAYERS = ["trail-route-casing", "trail-route-line", "trail-route-label"];

type Row = [
  number,
  string,
  string,
  number,
  string,
  [number, number][],
  string?,
  string?,
];
type Cell = { z: number; sources: string[]; items: Row[] };
type Loaded = {
  f: Feature<LineString>;
  w: number;
  e: number;
  s: number;
  n: number;
};

const loaded = new Map<string, Loaded[]>();
const pending = new Set<string>();
const misses = new Map<string, number>();
const bound = new WeakSet<MlMap>();
let pushToken = 0;
let drawn = 0;
let lastSetDataMs = 0;

const keyOf = (x: number, y: number) => `${CELL}/${x}/${y}`;

/** A 404 is "not harvested yet"; anything else is a transient failure. */
function retryAt(err: unknown): number {
  const status = Number(String((err as Error)?.message ?? err));
  return Date.now() + (status === 404 ? MISS_RETRY_MS : ERROR_RETRY_MS);
}

/**
 * Split a line where consecutive vertices jump more than GAP_KM. New cells are
 * clipped, but an old cached cell may still carry a stitch chord; never draw it.
 */
function splitAtGaps(coords: [number, number][]): [number, number][][] {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const lengths: number[] = [];
  for (let i = 1; i < coords.length; i += 1) {
    lengths.push(kmBetween(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]));
  }
  const median = [...lengths].sort((a, b) => a - b)[Math.floor(lengths.length / 2)] ?? 0;
  const parts: [number, number][][] = [];
  let current: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i += 1) {
    const b = coords[i];
    const gap = lengths[i - 1] > GAP_KM || (lengths[i - 1] > CHORD_KM && lengths[i - 1] > median * CHORD_RATIO);
    if (gap) {
      if (current.length >= 2) parts.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length >= 2) parts.push(current);
  return parts;
}

function bboxOf(coords: [number, number][]): Omit<Loaded, "f"> {
  let w = Infinity;
  let e = -Infinity;
  let s = Infinity;
  let n = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return { w, e, s, n };
}

function toFeatures(row: Row, sources: string[]): Feature<LineString>[] {
  const [srcIndex, name, difficulty, distance, url, coords, where, country] = row;
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const props: Record<string, string | number> = {
    cat: "trail",
    src: sources[srcIndex] ?? "osm",
    dist: Number(distance) || 0,
  };
  if (name) props.n = name;
  if (difficulty) props.diff = difficulty;
  if (url) props.url = url;
  const place = where || country;
  if (place) props.where = place;
  const bits = [
    distance ? `${Math.round(distance / 100) / 10} km` : "",
    difficulty,
    place,
  ].filter(Boolean);
  if (bits.length) props.d = bits.join(" · ");

  return splitAtGaps(coords).map((part) => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: part },
    properties: props,
  }));
}

function viewport(map: MlMap) {
  const b = map.getBounds();
  const lonPad = (b.getEast() - b.getWest()) * 0.5;
  const latPad = (b.getNorth() - b.getSouth()) * 0.5;
  return {
    w: b.getWest() - lonPad,
    e: b.getEast() + lonPad,
    s: Math.max(-85, b.getSouth() - latPad),
    n: Math.min(85, b.getNorth() + latPad),
    crosses: b.getEast() < b.getWest(),
  };
}

function collection(map: MlMap): FeatureCollection<LineString> {
  const win = viewport(map);
  const namedOnly = map.getZoom() < NAMED_ZOOM;
  const features: Feature<LineString>[] = [];
  const seen = new Set<string>();
  for (const cell of loaded.values()) {
    for (const entry of cell) {
      if (namedOnly && !entry.f.properties?.n) continue;
      if (entry.n < win.s || entry.s > win.n) continue;
      if (win.crosses ? entry.e < win.w && entry.w > win.e : entry.e < win.w || entry.w > win.e) {
        continue;
      }
      const key = `${entry.f.properties?.n ?? ""}|${JSON.stringify(entry.f.geometry.coordinates)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push(entry.f);
    }
  }
  return { type: "FeatureCollection", features };
}

function push(map: MlMap) {
  const started = performance.now();
  const src = map.getSource(SOURCE) as { setData?: (d: unknown) => void } | undefined;
  const data = map.getZoom() < 8.5 ? { type: "FeatureCollection", features: [] } : collection(map);
  src?.setData?.(data);
  drawn = data.features.length;
  lastSetDataMs = performance.now() - started;
}

/* Eight cells can land in one `moveend`; each used to rebuild and re-index every
   loaded route. One push per frame, like the practical pins. */
function schedulePush(map: MlMap) {
  const token = pushToken;
  window.requestAnimationFrame(() => {
    if (token !== pushToken) return;
    if (!map.getSource(SOURCE)) return;
    push(map);
  });
}

function applyTrailZoom(map: MlMap): void {
  const namedOnly = map.getZoom() < NAMED_ZOOM;
  const filter = namedOnly
    ? (["!=", ["get", "n"], ""] as unknown as ExpressionSpecification)
    : null;
  for (const id of ["trail-route-casing", "trail-route-line"]) {
    if (map.getLayer(id)) {
      map.setFilter(id, filter as unknown as import("maplibre-gl").FilterSpecification);
    }
  }
}

export function addTrails(map: MlMap, layers: LayerState): void {
  if (!bound.has(map)) {
    bound.add(map);
    map.on("moveend", () => refreshTrails(map));
  }
  if (map.getSource(SOURCE)) {
    setTrailLayers(map, layers);
    applyTrailZoom(map);
    return;
  }

  map.addSource(SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const before = map.getLayer("label-country") ? "label-country" : undefined;
  map.addLayer(
    {
      id: "trail-route-casing",
      type: "line",
      source: SOURCE,
      minzoom: 10.2,
      maxzoom: ROUTE_MAX_ZOOM,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#05090e",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8.5, 0.9, 12, 2, 13.2, 2.8],
        // A whole range's route network at full strength is a gold web, not a
        // map. The casing and the line both build from a hint at z8.5 to the
        // real thing by z12, then step back so the basemap's paths take over.
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8.5,
          0.08,
          10,
          0.18,
          12,
          0.32,
          12.8,
          0.2,
          13.2,
          0,
        ],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "trail-route-line",
      type: "line",
      source: SOURCE,
      minzoom: 10.2,
      maxzoom: ROUTE_MAX_ZOOM,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#d8b477",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8.5, 0.35, 12, 1.1, 13.2, 1.5],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8.5,
          0.22,
          10,
          0.38,
          12,
          0.55,
          12.8,
          0.3,
          13.2,
          0,
        ],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "trail-route-label",
      type: "symbol",
      source: SOURCE,
      minzoom: 11.5,
      filter: ["!=", ["get", "n"], ""] as unknown as ExpressionSpecification,
      layout: {
        // One label per named route piece (and therefore per cell), not a label
        // every 280 px along a long trail.
        "symbol-placement": "line-center",
        "text-field": ["get", "n"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11.5, 9.5, 16, 12.5],
        "text-letter-spacing": 0.04,
        "text-padding": 4,
        "text-max-angle": 40,
        "text-keep-upright": true,
        "text-optional": true,
      },
      paint: {
        "text-color": "#eddbb8",
        "text-halo-color": "#040906",
        "text-halo-width": 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.2, 1],
      },
    },
    before,
  );

  setTrailLayers(map, layers);
  applyTrailZoom(map);
  if (loaded.size) schedulePush(map);
}

export function setTrailLayers(map: MlMap, layers: LayerState): void {
  const on = layers.trails && layers.features && layers.cats.trail;
  for (const id of TRAIL_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    }
  }
}

export function refreshTrails(map: MlMap): void {
  if (!map.getSource(SOURCE)) return;
  const zoom = map.getZoom();
  applyTrailZoom(map);
  /* Route cells are 2–4 MB each, and the basemap already carries the paths
     below this: the named routes can wait until the reader is close enough for
     them to be the subject rather than a texture. Past ROUTE_MAX_ZOOM the line has
     faded out (ROUTE_MAX_ZOOM) and the basemap's own paths are the detail, so a
     cell there would be four megabytes of routes drawn at their faintest. */
  if (zoom < 10.2 || zoom > ROUTE_MAX_ZOOM + 0.3) {
    schedulePush(map);
    return;
  }

  const n = 2 ** CELL;
  const bounds = map.getBounds();
  const lon2x = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const lat2y = (lat: number) => {
    const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  /* A one-cell ring was affordable per request and ruinous per second: at z9.6
     it turned a two-cell viewport into nine cells of 2–4 MB each. Only widen
     once the cells are small enough that the ring is cheap. */
  const ring = zoom >= 10.5 ? 1 : 0;
  const x0 = lon2x(bounds.getWest()) - ring;
  const x1 = lon2x(bounds.getEast()) + ring;
  const y0 = lat2y(bounds.getNorth()) - ring;
  const y1 = lat2y(bounds.getSouth()) + ring;

  const visible: [number, number][] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      visible.push([((x % n) + n) % n, Math.max(0, Math.min(n - 1, y))]);
    }
  }
  const visibleKeys = new Set(visible.map(([x, y]) => keyOf(x, y)));

  /* The cache is bounded. A cell panned out of is a re-fetch later, not a
     permanent resident of the GeoJSON source. */
  if (loaded.size > MAX_CELLS) {
    for (const key of loaded.keys()) {
      if (loaded.size <= MAX_CELLS) break;
      if (!visibleKeys.has(key)) loaded.delete(key);
    }
  }

  const wanted = visible.filter(([x, y]) => {
    const key = keyOf(x, y);
    if (loaded.has(key) || pending.has(key)) return false;
    const until = misses.get(key);
    return !(until && until > Date.now());
  });

  const centre = map.getCenter();
  const cx = lon2x(centre.lng);
  const cy = lat2y(centre.lat);
  const distance = ([x, y]: [number, number]) =>
    Math.min(Math.abs(x - cx), n - Math.abs(x - cx)) + Math.abs(y - cy);
  wanted.sort((a, b) => distance(a) - distance(b));

  const fetchCells = () => {
    for (const [x, y] of wanted.slice(0, 2)) {
      const key = keyOf(x, y);
      if (loaded.has(key) || pending.has(key)) continue;
      const path = `trails/${CELL}/${x}/${y}.json`;
      pending.add(key);
      void cellMayExist(path)
        .then((present) => {
          if (!present) {
            /* The store's index does not list this cell: no routes there, no request,
               no failed-response noise. Re-checked with the other misses, not sooner. */
            misses.set(key, Date.now() + MISS_RETRY_MS);
            return null;
          }
          return fetch(cellUrl(path))
            .then((res) => {
              if (!res.ok) throw new Error(String(res.status));
              return res.json() as Promise<Cell>;
            })
            .then((cell) => {
              const features: Loaded[] = [];
              const seen = new Set<string>();
              for (const row of cell.items) {
                for (const f of toFeatures(row, cell.sources ?? [])) {
                  const key = JSON.stringify(f.geometry.coordinates);
                  if (seen.has(key)) continue;
                  seen.add(key);
                  features.push({ f, ...bboxOf(f.geometry.coordinates as [number, number][]) });
                }
              }
              misses.delete(key);
              loaded.set(key, features);
              schedulePush(map);
            });
        })
        .catch((err: unknown) => {
          /* A cell that exists but cannot be read is a real fault, not absence: the
             store said it is there, so say so once and retry soon. */
          if (err instanceof SyntaxError) console.error(`terrane: ${path} did not parse`, err);
          misses.set(key, retryAt(err));
        })
        .finally(() => pending.delete(key));
    }

    schedulePush(map);
  };

  /* Pins are what a reader is looking for; the route lines are what they read
     once the pins are there. Wait for the first pin cell, then take the idle
     frame — with a cap, so a view with no pin cell in it still gets its routes. */
  const pinsOrTimeout = Promise.race([
    firstPinCell,
    new Promise<void>((resolve) => window.setTimeout(resolve, 3000)),
  ]);
  void pinsOrTimeout.then(() => {
    const idle = window.requestIdleCallback?.(fetchCells, { timeout: 1800 });
    if (!idle) window.setTimeout(fetchCells, 700);
  });
}

export function resetTrails(): void {
  pushToken += 1;
  loaded.clear();
  pending.clear();
  misses.clear();
  drawn = 0;
  lastSetDataMs = 0;
}

export type TrailStats = {
  cells: number;
  cached: number;
  drawn: number;
  lastSetDataMs: number;
};

export function trailStats(): TrailStats {
  let cached = 0;
  for (const cell of loaded.values()) cached += cell.length;
  return { cells: loaded.size, cached, drawn, lastSetDataMs };
}
