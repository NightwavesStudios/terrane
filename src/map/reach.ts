import type {
  ExpressionSpecification,
  Map as MlMap,
  SymbolLayerSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import raw from "../data/reach.json";

/**
 * The long tail of the atlas: summits, lakes, waterfalls, parks, glaciers,
 * caves, canyons, islands, beaches, hot springs and deserts pulled from Wikidata
 * by `scripts/harvest-reach.py`.
 *
 * These are places, not campsites: they belong to the same family as the 1,288 the
 * globe already draws, but there are roughly twenty times as many of them and each
 * has no page of its own. They get their own smaller dots and a card that says what
 * the thing is and which named place it is near.
 *
 * **Fame is the priority.** Rows are ranked by how many Wikipedia language
 * editions carry an article about them, which is the cheapest free stand-in for
 * "have I heard of this". Tier 1 is Fuji and Victoria Falls; tier 4 is a 2,400 m
 * shoulder with an article in four languages. Tiers are zoom bands:
 *
 *   tier 1  z2.8   tier 2  z4.4   tier 3  z6.2   tier 4  z7.6
 *
 * The famous half (1–2) loads with the globe and covers the planet from the first
 * frame — at z4.4 it used to leave whole countries blank. The tail (3–4) loads the
 * first time the camera passes a region it can read.
 */
export const REACH_LAYERS = ["reach-dots-1", "reach-dots-2", "reach-names"];

export const REACH_MORE_LAYERS = ["reach-dots-3", "reach-dots-4", "reach-names-more"];

/** Card titles. Order matches `kinds` in reach.json. */
export const REACH_KIND_LABEL = [
  "Peak",
  "Volcano",
  "Mountain range",
  "Lake",
  "Waterfall",
  "National park",
  "Nature reserve",
  "Beach",
  "Glacier",
  "Cave",
  "Canyon",
  "Island",
  "Desert",
  "Hot spring",
  "Valley",
];

export type Row = [number, number, number, number, string, number?];
export type ReachFile = { kinds: string[]; near: string[]; items: Row[] };

export function featuresOf(file: ReachFile, offset = 0): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: file.items.map((row, index) => {
      const [lat, lon, kind, tier, name, near] = row;
      const feature: Feature<Point> = {
        id: index + offset,
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: { k: kind, t: tier, n: name, near: near ?? -1 },
      };
      return feature;
    }),
  };
}

/* Four colours, not fourteen. A dot has to say "rock, water, green or sand" at a
   glance from four pixels across; anything finer is invisible at the zoom these
   first appear. */
const ROCK = "#8ab4d8";
const WATER = "#5fc9d4";
const GREEN = "#79cf9b";
const SAND = "#d9bd85";

const colourExpression = [
  "match",
  ["get", "k"],
  [3, 4, 8, 13],
  WATER,
  [5, 6, 11, 14],
  GREEN,
  [7, 12],
  SAND,
  ROCK,
] as unknown as ExpressionSpecification;

const TIERS = [
  /* These arrive at world scale on purpose. A 2,664-dot famous set that only appears
     at z4.4 leaves continents with visible holes: whole countries with no mark on
     them read as "nothing here" rather than "nothing famous enough". The dots are
     2–4 px and the tiers stay ordered, so filling in earlier costs nothing but a
     busier planet view. */
  { id: "reach-dots-1", tier: 1, minzoom: 2.8, radius: [2.6, 4.4], more: false },
  { id: "reach-dots-2", tier: 2, minzoom: 4.4, radius: [2.2, 3.8], more: false },
  { id: "reach-dots-3", tier: 3, minzoom: 6.2, radius: [1.9, 3.2], more: true },
  { id: "reach-dots-4", tier: 4, minzoom: 7.6, radius: [1.7, 2.8], more: true },
] as const;

function dotLayer(source: string, tier: (typeof TIERS)[number]) {
  return {
    id: tier.id,
    type: "circle" as const,
    source,
    minzoom: tier.minzoom,
    filter: ["==", ["get", "t"], tier.tier] as unknown as ExpressionSpecification,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        tier.minzoom,
        tier.radius[0],
        16,
        tier.radius[1],
      ] as unknown as ExpressionSpecification,
      "circle-color": colourExpression,
      "circle-opacity": 0.85,
      "circle-stroke-color": "#05090f",
      "circle-stroke-width": 0.6,
      "circle-stroke-opacity": 0.5,
    },
  };
}

function nameLayer(
  id: string,
  source: string,
  minzoom: number,
  tiers: number[],
): SymbolLayerSpecification {
  return {
    id,
    type: "symbol" as const,
    source,
    minzoom,
    filter: [
      "all",
      ["in", ["get", "t"], ["literal", tiers]],
      ["!=", ["get", "n"], ""],
    ] as unknown as ExpressionSpecification,
    layout: {
      "text-field": ["get", "n"] as ExpressionSpecification,
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], minzoom, 9.5, 16, 12.5],
      "text-anchor": "top",
      "text-offset": [0, 0.6],
      "text-max-width": 9,
      "text-padding": 5,
      "text-optional": true,
    },
    paint: {
      "text-color": "#cfdceb",
      "text-halo-color": "#05090f",
      "text-halo-width": 1.5,
    },
  };
}

/* Each file carries its own `near` array, so an index only means something
   alongside the file it came from. The second one is kept here once it loads. */
let moreFile: ReachFile | null = null;

/** The nearest atlas place for a row, by index into that file's `near` array. */
export function nearSlug(index: number | undefined, fromMore = false): string | undefined {
  if (typeof index !== "number" || index < 0) return undefined;
  const file = fromMore ? moreFile : (raw as unknown as ReachFile);
  return file?.near[index];
}

let core: FeatureCollection<Point> | null = null;

/** Adds the famous half (tiers 1–2). Idempotent. */
export function addReach(map: MlMap, before?: string) {
  if (map.getSource("reach")) return;
  core = featuresOf(raw as unknown as ReachFile);
  map.addSource("reach", { type: "geojson", data: core });
  map.addSource("reach-pick", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  for (const tier of TIERS.filter((t) => !t.more)) {
    map.addLayer(dotLayer("reach", tier), before);
  }
  map.addLayer(nameLayer("reach-names", "reach", 5.8, [1, 2]), before);

  /* The pick ring is shared by both halves: one feature, whichever file the
     clicked dot came from. */
  map.addLayer(
    {
      id: "reach-pick-ring",
      type: "circle",
      source: "reach-pick",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 16, 18],
        "circle-color": "rgba(124, 224, 192, 0.12)",
        "circle-stroke-color": "#7ce0c0",
        "circle-stroke-width": 1.8,
      },
    },
    before,
  );
}

/**
 * The other twenty thousand. Loads its own file the first time the camera passes
 * z7.2, so nobody pays for the tail before they have looked at a region.
 */
export async function addReachMore(map: MlMap, before?: string) {
  if (map.getSource("reach-more")) return;
  const mod = await import("../data/reach-more.json");
  const file = mod.default as unknown as ReachFile;
  moreFile = file;
  map.addSource("reach-more", {
    type: "geojson",
    /* offset so an id from this file cannot be mistaken for one from the other */
    data: featuresOf(file, 1_000_000),
  });
  for (const tier of TIERS.filter((t) => t.more)) {
    map.addLayer(dotLayer("reach-more", tier), before);
  }
  map.addLayer(nameLayer("reach-names-more", "reach-more", 10.4, [3, 4]), before);
}
