import type { ExpressionSpecification, Map as MlMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import raw from "../data/kit.json";

/**
 * The harvested camping kit: campsites, huts, shelters, water, parking and
 * picnic tables within ~8 km of every place in the atlas.
 *
 * `scripts/harvest-kit.mjs` writes the rows as columns — `[lat, lon, kindIndex,
 * tier, name?, nearIndex?]` — because six thousand rows with named keys is mostly
 * keys. This module turns them back into GeoJSON once, at import time.
 *
 * **Priority is the point.** A tier is a zoom band, not a category: tier 0 is the
 * handful of named camps beside a written-up summit and is the only thing drawn
 * at z9.6; every later tier arrives at its own minzoom. The map is sparse at
 * country scale and dense only where someone has zoomed in to look at a valley.
 *
 * The dataset ships in two files: tiers 0–2 (`kit.json`, camps and shelters you
 * plan around) load with the globe, and tier 3 (`kit-detail.json`, water taps, car
 * parks, picnic tables — 2,781 features) is fetched the first time the camera goes
 * past z13.8. Together they were a 107 kB gzipped chunk; apart, neither is.
 */
export const KIT_LAYERS = [
  "kit-pins-0",
  "kit-pins-1",
  "kit-pins-2",
  "kit-names-0",
  "kit-names-1",
];

export const KIT_DETAIL_LAYERS = ["kit-pins-3"];

/** kind index → pictogram. Order matches `kinds` in kit.json. */
const ICONS = [
  "camp-tent", // camp
  "camp-hut", // hut
  "camp-shelter", // shelter
  "water-drop", // water
  "parking", // parking
  "water-drop", // view (rare; a drop reads better than nothing)
  "picnic-table", // picnic
  "camp-hut", // pass
];

type Row = [number, number, number, number, string?, number?];
type KitFile = { z: number; kinds: string[]; near: string[]; items: Row[] };

function featuresOf(file: KitFile): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: file.items.map((row) => {
      const [lat, lon, kind, tier, name, near] = row;
      const feature: Feature<Point> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { k: kind, t: tier, n: name ?? "", near: near ?? -1 },
      };
      return feature;
    }),
  };
}

const iconExpression = [
  "match",
  ["get", "k"],
  0,
  ICONS[0],
  1,
  ICONS[1],
  2,
  ICONS[2],
  3,
  ICONS[3],
  4,
  ICONS[4],
  6,
  ICONS[6],
  ICONS[1],
] as unknown as ExpressionSpecification;

const TIERS = [
  { id: "kit-pins-0", tier: 0, minzoom: 9.6, size: [0.78, 1.15] },
  { id: "kit-pins-1", tier: 1, minzoom: 11.4, size: [0.58, 0.92] },
  { id: "kit-pins-2", tier: 2, minzoom: 12.9, size: [0.52, 0.86] },
] as const;

const core = featuresOf(raw as unknown as KitFile);

/** Adds the core kit (tiers 0–2) under the map labels. Idempotent. */
export function addKit(map: MlMap, before?: string) {
  if (map.getSource("kit")) return;

  map.addSource("kit", { type: "geojson", data: core });

  for (const tier of TIERS) {
    map.addLayer(
      {
        id: tier.id,
        type: "symbol",
        source: "kit",
        minzoom: tier.minzoom,
        filter: ["==", ["get", "t"], tier.tier],
        layout: {
          "icon-image": iconExpression,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            tier.minzoom,
            tier.size[0],
            16,
            tier.size[1],
          ],
          /* Pins never disappear to collision: a camp that exists but was not
             drawn is worse than two camps overlapping at z15. The tiers are what
             keep the screen readable; placement would silently hide data. */
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      },
      before,
    );
  }

  /* Names only where they earn their space: the anchors from z10.3, everything
     named from z13.4. Tier 0 is excluded from the second layer so a name never
     draws twice. */
  map.addLayer(
    {
      id: "kit-names-0",
      type: "symbol",
      source: "kit",
      minzoom: 10.3,
      filter: ["all", ["==", ["get", "t"], 0], ["!=", ["get", "n"], ""]],
      layout: {
        "text-field": ["get", "n"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10.3, 10, 16, 12.5],
        "text-anchor": "top",
        "text-offset": [0, 1.05],
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

  map.addLayer(
    {
      id: "kit-names-1",
      type: "symbol",
      source: "kit",
      minzoom: 13.4,
      filter: [
        "all",
        [">=", ["get", "t"], 1],
        ["<=", ["get", "t"], 2],
        ["!=", ["get", "n"], ""],
      ],
      layout: {
        "text-field": ["get", "n"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13.4, 10, 16, 12],
        "text-anchor": "top",
        "text-offset": [0, 0.95],
        "text-max-width": 9,
        "text-padding": 4,
        "text-optional": true,
      },
      paint: {
        "text-color": "#e9dcc4",
        "text-halo-color": "#05090f",
        "text-halo-width": 1.5,
      },
    },
    before,
  );
}

/**
 * Adds the fine-detail tier (water, parking, picnic tables). Loads its own JSON,
 * so the request happens the first time someone is close enough to need it —
 * not on the first frame, and not for anyone who never zooms in.
 */
export async function addKitDetail(map: MlMap, before?: string) {
  if (map.getSource("kit-detail")) return;
  const mod = await import("../data/kit-detail.json");
  map.addSource("kit-detail", {
    type: "geojson",
    data: featuresOf(mod.default as unknown as KitFile),
  });
  map.addLayer(
    {
      id: "kit-pins-3",
      type: "symbol",
      source: "kit-detail",
      minzoom: 14.2,
      layout: {
        "icon-image": iconExpression,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 14.2, 0.42, 16, 0.72],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    before,
  );
}
