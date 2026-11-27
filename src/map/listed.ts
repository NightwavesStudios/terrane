import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MlMap,
} from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { FIRST_SYMBOL_LAYER } from "./style";

/**
 * Peaks that belong to a sourced list and have a real place page.
 *
 * The ring never invents a point: a list peak without a place record simply has
 * no coordinate and stays in the list. What is drawn is a fact we can trace.
 */

export type ListedPoint = {
  lat: number;
  lon: number;
  listId: string;
  listName: string;
  peakName: string;
  place: string;
  elev?: number;
};

const SOURCE = "listed-peaks";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const GOLD = "#e6c382";

export const LISTED_LAYERS = ["listed-halo", "listed-ring"];

export function listedFeatures(points: ListedPoint[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lon, point.lat] },
      properties: {
        cat: "peak",
        n: point.peakName,
        slug: point.place,
        listId: point.listId,
        listName: point.listName,
        peakName: point.peakName,
        where: point.listName,
        ...(typeof point.elev === "number" ? { elev: point.elev } : {}),
      },
    })),
  };
}

const RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  2.6,
  5,
  6,
  7,
  10,
  10,
  14,
  14,
] as unknown as ExpressionSpecification;

function layerSpecs(): LayerSpecification[] {
  return [
    {
      id: "listed-halo",
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": GOLD,
        "circle-radius": ["*", RADIUS, 1.5] as unknown as ExpressionSpecification,
        "circle-blur": 1,
        "circle-opacity": 0.16,
      },
    } as unknown as LayerSpecification,
    {
      id: "listed-ring",
      type: "circle",
      source: SOURCE,
      minzoom: 2.6,
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": RADIUS,
        "circle-stroke-color": GOLD,
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.9,
      },
    } as unknown as LayerSpecification,
  ];
}

export function addListed(map: MlMap, visible: boolean): void {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    const before = map.getLayer(FIRST_SYMBOL_LAYER) ? FIRST_SYMBOL_LAYER : undefined;
    for (const spec of layerSpecs()) map.addLayer(spec, before);
  }
  setListedVisibility(map, visible);
}

export function setListedPoints(map: MlMap, points: ListedPoint[]): void {
  try {
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(listedFeatures(points));
  } catch {
    /* The map was removed while the data changed. */
  }
}

export function setListedVisibility(map: MlMap, on: boolean): void {
  for (const id of LISTED_LAYERS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    }
  }
}
