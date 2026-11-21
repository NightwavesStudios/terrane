import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MlMap,
} from "maplibre-gl";
import type { LayerState } from "../components/LayerControl";
import {
  GUIDE_KINDS,
  guideKind,
  type GuideCatalogRow,
  type GuideExperience,
} from "../data/guide";
import { loadGuide, loadGuideCatalog } from "../lib/guide";
import { flyPadding } from "./camera";

/**
 * Curated Experiences on the globe.
 *
 * These are the destinations in the editorial catalogue, not collections and not
 * every destination in the database. One beacon per Experience, in its kind's
 * colour, added above the pins. Selecting one draws the destination and its
 * recorded neighbours as neutral markers and frames their bounds; there is no
 * line between them and no order, because an Experience is a place, not a route.
 *
 * The catalogue is ~180 rows and arrives once. The full record is a per-slug
 * shard, so clicking one downloads only that page's data.
 */

const SOURCE = "experiences";
const PLACE_SOURCE = "experience-places";

export const EXPERIENCE_LAYERS = [
  "experiences-halo",
  "experiences-ring",
  "experiences-dot",
  "experiences-label",
];

const PLACE_LAYERS = ["experience-places", "experience-places-label"];
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function experienceWhere(row: Pick<GuideCatalogRow, "region" | "country">): string {
  if (row.region && row.country && row.region !== row.country) {
    return `${row.region}, ${row.country}`;
  }
  return row.region || row.country || "";
}

export function experienceFeatures(rows: GuideCatalogRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => {
      const kind = guideKind(row.kind);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [row.lon, row.lat] },
        properties: {
          cat: "experience",
          n: row.name,
          slug: row.slug,
          kind: row.kind,
          colour: kind.colour,
          where: experienceWhere(row),
          country: row.country ?? "",
          region: row.region ?? "",
          places: row.placeCount,
          trails: row.trailCount,
          hue: row.hue,
        },
      } as GeoJSON.Feature;
    }),
  };
}

/** The selected Experience and its recorded neighbours, with no connecting line. */
export function placeFeatures(guide: GuideExperience): GeoJSON.FeatureCollection {
  const colour = guideKind(guide.kind).colour;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [guide.center.lon, guide.center.lat] },
        properties: { name: guide.name, colour, main: true },
      },
      ...guide.associated.map((place) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [place.lon, place.lat],
        },
        properties: { name: place.name, colour, main: false },
      })),
    ],
  };
}

let rows: GuideCatalogRow[] = [];
let catalog: Promise<GuideCatalogRow[]> | null = null;
let mapRef: MlMap | null = null;
let current: string | null = null;
let placeData: GeoJSON.FeatureCollection | null = null;

const catFilter = (ids: string[]): ExpressionSpecification =>
  (ids.length
    ? ["in", ["get", "kind"], ["literal", ids]]
    : ["==", ["get", "kind"], "__none__"]) as unknown as ExpressionSpecification;

function push(map: MlMap) {
  try {
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(experienceFeatures(rows));
  } catch {
    /* The map was removed while the catalogue was in flight. */
  }
}

function pushPlaces(map: MlMap) {
  try {
    (map.getSource(PLACE_SOURCE) as GeoJSONSource | undefined)?.setData(placeData ?? EMPTY);
  } catch {
    /* Same. */
  }
}

function refreshPlaceVisibility(map: MlMap) {
  const on = Boolean(mapRef && current && placeData);
  for (const id of PLACE_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }
}

function ensureCatalog(map: MlMap) {
  if (rows.length) return;
  if (!catalog) catalog = loadGuideCatalog().catch(() => []);
  void catalog.then((items) => {
    rows = items;
    if (mapRef) push(mapRef);
  });
  push(map);
}

/**
 * The layers, as data, so a test can validate them without a WebGL context.
 * `addExperiences` installs exactly this list, last, above every pin.
 */
export function experienceLayerSpecs(): LayerSpecification[] {
  return [
    {
      id: "experiences-halo",
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": ["get", "colour"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 10, 5, 13, 9, 17, 14, 23],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 1.5, 0.18, 5, 0.24, 14, 0.3],
        "circle-blur": 0.9,
      },
    } as unknown as LayerSpecification,
    {
      id: "experiences-ring",
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": "rgba(0, 0, 0, 0)",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 6, 5, 7.5, 9, 9.5, 14, 12],
        "circle-stroke-color": ["get", "colour"],
        "circle-stroke-width": 1.6,
        "circle-stroke-opacity": 0.95,
      },
    } as unknown as LayerSpecification,
    {
      id: "experiences-dot",
      type: "circle",
      source: SOURCE,
      paint: {
        "circle-color": "#f8fdff",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1.5, 2.2, 5, 2.8, 9, 3.6, 14, 4.6],
        "circle-stroke-color": ["get", "colour"],
        "circle-stroke-width": 1.4,
      },
    } as unknown as LayerSpecification,
    {
      id: "experiences-label",
      type: "symbol",
      source: SOURCE,
      minzoom: 2.6,
      layout: {
        "text-field": ["get", "n"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2.6, 11, 6, 12.5, 12, 14],
        "text-anchor": "top",
        "text-offset": [0, 1.5],
        "text-max-width": 10,
        "text-padding": 5,
        "text-optional": true,
        "symbol-sort-key": ["*", -1, ["get", "places"]],
      },
      paint: {
        "text-color": ["get", "colour"],
        "text-halo-color": "#03060b",
        "text-halo-width": 2.2,
        "text-opacity": 0.96,
      },
    } as unknown as LayerSpecification,
    {
      id: "experience-places",
      type: "circle",
      source: PLACE_SOURCE,
      layout: { visibility: "none" },
      paint: {
        "circle-color": "#f8fdff",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 10, 6],
        "circle-stroke-color": ["get", "colour"],
        "circle-stroke-width": 2,
      },
    } as unknown as LayerSpecification,
    {
      id: "experience-places-label",
      type: "symbol",
      source: PLACE_SOURCE,
      layout: {
        visibility: "none",
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-anchor": "top",
        "text-offset": [0, 0.85],
        "text-padding": 3,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f4fbff",
        "text-halo-color": "#04070c",
        "text-halo-width": 1.8,
      },
    } as unknown as LayerSpecification,
  ];
}

export function addExperiences(map: MlMap, layers: LayerState): void {
  mapRef = map;
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    map.addSource(PLACE_SOURCE, { type: "geojson", data: EMPTY });
    for (const spec of experienceLayerSpecs()) map.addLayer(spec);
  }
  ensureCatalog(map);
  setExperienceLayers(map, layers);
  push(map);
  pushPlaces(map);
  refreshPlaceVisibility(map);
}

/** Kind switches for curated Experiences. `experience` owns the whole group. */
export function setExperienceLayers(map: MlMap, layers: LayerState): void {
  const ids = layers.experience
    ? GUIDE_KINDS.filter((kindItem) => layers.expCats[kindItem.id]).map(
        (kindItem) => kindItem.id,
      )
    : [];
  const filter = catFilter(ids);
  for (const id of EXPERIENCE_LAYERS) {
    if (!map.getLayer(id)) continue;
    if (id === "experiences-label") {
      map.setFilter(id, ["all", ["!=", ["get", "n"], ""], filter] as unknown as ExpressionSpecification);
    } else {
      map.setFilter(id, filter);
    }
  }
  refreshPlaceVisibility(map);
}

export function showExperience(map: MlMap, slug: string | null): void {
  if (slug === current) return;
  current = slug;
  placeData = null;
  pushPlaces(map);
  refreshPlaceVisibility(map);
  if (!slug) return;

  void loadGuide(slug)
    .then((guide) => {
      if (!guide || current !== slug) return;
      placeData = placeFeatures(guide);
      pushPlaces(map);
      refreshPlaceVisibility(map);

      const [west, south, east, north] = guide.bounds;
      if ([west, south, east, north].every(Number.isFinite) && east > west && north > south) {
        map.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          {
            padding: flyPadding(typeof window === "undefined" ? 1280 : window.innerWidth),
            maxZoom: 10,
            duration: 900,
          },
        );
      }
    })
    .catch(() => undefined);
}

export function resetExperiences(): void {
  current = null;
  placeData = null;
  mapRef = null;
}
