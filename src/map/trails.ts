import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import type { LayerState } from "../components/LayerControl";

/**
 * Trail routes, from our own cells: OSM hiking relations plus the US agency trail
 * inventories. The basemap still draws every OSM path/footway at z11.4+; this layer
 * exists for the lower zooms and for route identity (name, class, distance, source).
 *
 * Cells are z7, split at cell boundaries by `scripts/merge-sources.py`, so a
 * long-distance route is several local segments rather than one 500 km blob and
 * an alpine cell stays under the wire limit.
 */
const CELL = 7;
const SOURCE = "trail-routes";
const BASE = import.meta.env.DEV
  ? ""
  : (
      (import.meta.env.VITE_POI_BASE as string | undefined) ??
      "https://terrane-poi-cells-mqa53q-preview.freebuff.site"
    ).replace(/\/+$/, "");

export const TRAIL_LAYERS = ["trail-route-casing", "trail-route-line", "trail-route-label"];

type Row = [number, string, string, number, string, [number, number][], string?];
type Cell = { z: number; sources: string[]; items: Row[] };

const loaded = new Map<string, Feature<LineString>[]>();
const pending = new Set<string>();
const misses = new Map<string, number>();
let total = 0;
let bound = false;

const keyOf = (x: number, y: number) => `${CELL}/${x}/${y}`;

function toFeature(row: Row, sources: string[]): Feature<LineString> | null {
  const [srcIndex, name, difficulty, distance, url, coords, where] = row;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const props: Record<string, string | number> = {
    cat: "trail",
    src: sources[srcIndex] ?? "osm",
    dist: Number(distance) || 0,
  };
  if (name) props.n = name;
  if (difficulty) props.diff = difficulty;
  if (url) props.url = url;
  if (where) props.where = where;
  const bits = [
    distance ? `${Math.round(distance / 100) / 10} km` : "",
    difficulty,
    where,
  ].filter(Boolean);
  if (bits.length) props.d = bits.join(" · ");
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: props,
  };
}

function collection(): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (const cell of loaded.values()) {
    for (const feature of cell) features.push(feature);
  }
  return { type: "FeatureCollection", features };
}

function push(map: MlMap) {
  const src = map.getSource(SOURCE) as { setData?: (d: unknown) => void } | undefined;
  src?.setData?.(collection());
}

export function addTrails(map: MlMap, layers: LayerState): void {
  if (!bound) {
    bound = true;
    map.on("moveend", () => refreshTrails(map));
  }
  if (map.getSource(SOURCE)) {
    setTrailLayers(map, layers);
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
      minzoom: 8.5,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#05090e",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8.5, 1.2, 14, 4.2],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 8.5, 0.25, 10, 0.7],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "trail-route-line",
      type: "line",
      source: SOURCE,
      minzoom: 8.5,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#d8b477",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8.5, 0.6, 14, 2.2],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 8.5, 0.55, 10, 0.95],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "trail-route-label",
      type: "symbol",
      source: SOURCE,
      minzoom: 10.5,
      filter: ["!=", ["get", "n"], ""] as unknown as ExpressionSpecification,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "n"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10.5, 9.5, 16, 12.5],
        "text-letter-spacing": 0.04,
        "text-padding": 4,
        "symbol-spacing": 280,
        "text-max-angle": 40,
        "text-keep-upright": true,
        "text-optional": true,
      },
      paint: {
        "text-color": "#eddbb8",
        "text-halo-color": "#040906",
        "text-halo-width": 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 10.5, 0, 11.3, 1],
      },
    },
    before,
  );

  setTrailLayers(map, layers);
  if (loaded.size) push(map);
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
  if (map.getZoom() < 8.5) return;

  const n = 2 ** CELL;
  const bounds = map.getBounds();
  const lon2x = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const lat2y = (lat: number) => {
    const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const x0 = lon2x(bounds.getWest()) - 1;
  const x1 = lon2x(bounds.getEast()) + 1;
  const y0 = lat2y(bounds.getNorth()) - 1;
  const y1 = lat2y(bounds.getSouth()) + 1;

  const visible: [number, number][] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      visible.push([((x % n) + n) % n, Math.max(0, Math.min(n - 1, y))]);
    }
  }

  const wanted = visible.filter(([x, y]) => {
    const key = keyOf(x, y);
    if (loaded.has(key) || pending.has(key)) return false;
    const until = misses.get(key);
    return !(until && until > Date.now());
  });

  for (const [x, y] of wanted.slice(0, 8)) {
    const key = keyOf(x, y);
    pending.add(key);
    void fetch(`${BASE}/trails/${CELL}/${x}/${y}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Cell>;
      })
      .then((cell) => {
        const features = cell.items
          .map((row) => toFeature(row, cell.sources ?? []))
          .filter((f): f is Feature<LineString> => Boolean(f));
        misses.delete(key);
        loaded.set(key, features);
        total += features.length;
        push(map);
      })
      .catch((err: unknown) => {
        const status = Number(String((err as Error)?.message ?? err));
        misses.set(key, Date.now() + (status === 404 ? 5 * 60_000 : 20_000));
      })
      .finally(() => pending.delete(key));
  }
}

export function resetTrails(): void {
  loaded.clear();
  pending.clear();
  misses.clear();
  total = 0;
}

export const trailStats = () => ({ cells: loaded.size, features: total });
