import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MlMap,
} from "maplibre-gl";
import { FIRST_SYMBOL_LAYER } from "./style";

/**
 * The reader's own points on the globe.
 *
 * A bagged point is a warm ring; a wanted point is a cool one. They are drawn
 * above the destination dots and below the labels, so the personal layer reads
 * without hiding the landscape. Only entries with a real coordinate are drawn.
 */

export type LogMapPoint = {
  key: string;
  name: string;
  cat: string;
  state: "want" | "done";
  lat: number;
  lon: number;
  slug?: string;
  elev?: number;
  where?: string;
  listId?: string;
  listName?: string;
  peakName?: string;
};

const SOURCE = "reader-log";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const LOG_LAYERS = [
  "log-want-halo",
  "log-want-ring",
  "log-done-halo",
  "log-done-ring",
  "log-done-dot",
];

const DONE = "#e8c17a";
const WANT = "#9fc4e8";

export function logFeatures(points: LogMapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: {
        cat: point.cat,
        n: point.name,
        state: point.state,
        key: point.key,
        ...(point.slug ? { slug: point.slug } : {}),
        ...(typeof point.elev === "number" ? { elev: point.elev } : {}),
        ...(point.where ? { where: point.where } : {}),
        ...(point.listId ? { listId: point.listId } : {}),
        ...(point.listName ? { listName: point.listName } : {}),
        ...(point.peakName ? { peakName: point.peakName } : {}),
      },
    })),
  };
}

const stateFilter = (state: "want" | "done"): ExpressionSpecification =>
  ["==", ["get", "state"], state] as unknown as ExpressionSpecification;

const RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  0,
  5,
  6,
  8,
  10,
  12,
  14,
  16,
] as unknown as ExpressionSpecification;

function layerSpecs(): LayerSpecification[] {
  return [
    {
      id: "log-done-halo",
      type: "circle",
      source: SOURCE,
      filter: stateFilter("done"),
      paint: {
        "circle-color": DONE,
        "circle-radius": ["*", RADIUS, 1.7] as unknown as ExpressionSpecification,
        "circle-blur": 1,
        "circle-opacity": 0.22,
      },
    } as unknown as LayerSpecification,
    {
      id: "log-want-ring",
      type: "circle",
      source: SOURCE,
      filter: stateFilter("want"),
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": RADIUS,
        "circle-stroke-color": WANT,
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.9,
      },
    } as unknown as LayerSpecification,
    {
      id: "log-done-ring",
      type: "circle",
      source: SOURCE,
      filter: stateFilter("done"),
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": RADIUS,
        "circle-stroke-color": DONE,
        "circle-stroke-width": 2.2,
        "circle-stroke-opacity": 1,
      },
    } as unknown as LayerSpecification,
    {
      id: "log-want-halo",
      type: "circle",
      source: SOURCE,
      filter: stateFilter("want"),
      paint: {
        "circle-color": WANT,
        "circle-radius": ["*", RADIUS, 1.5] as unknown as ExpressionSpecification,
        "circle-blur": 1,
        "circle-opacity": 0.14,
      },
    } as unknown as LayerSpecification,
    {
      id: "log-done-dot",
      type: "circle",
      source: SOURCE,
      filter: stateFilter("done"),
      paint: {
        "circle-color": "#fff6df",
        "circle-radius": ["*", RADIUS, 0.4] as unknown as ExpressionSpecification,
        "circle-stroke-color": DONE,
        "circle-stroke-width": 1,
      },
    } as unknown as LayerSpecification,
  ];
}

export function addLog(map: MlMap, visible: boolean): void {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    const before = map.getLayer(FIRST_SYMBOL_LAYER) ? FIRST_SYMBOL_LAYER : undefined;
    for (const spec of layerSpecs()) map.addLayer(spec, before);
  }
  setLogVisibility(map, visible);
}

export function setLogPoints(map: MlMap, points: LogMapPoint[]): void {
  try {
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(logFeatures(points));
  } catch {
    /* The map was removed while the data changed. */
  }
}

export function setLogVisibility(map: MlMap, on: boolean): void {
  for (const id of LOG_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    }
  }
}
