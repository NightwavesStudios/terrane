import type { HillshadeLayerSpecification } from "maplibre-gl";

/**
 * One visual language for every map in the app.
 *
 * The globe, the Experience map and the Collection map are the same product at
 * different crops, so they read from one palette instead of three sets of
 * literals. Values here are the "blue-hour survey" palette: deep water with a
 * luminous coast, hypsometric land, quiet borders, warm trail ink, cool type.
 * Nothing in this file fetches, computes or depends on React — it is data, and
 * `style.ts` is the only consumer that turns it into layers.
 */
export const PALETTE = {
  space: "#05070c",

  /* Water: ocean deepest, lakes one step up, rivers lightest. */
  ocean: "#06202f",
  lake: "#082a3b",
  river: "#0d3b4d",
  coastGlow: "#57a9bd",
  coastLine: "#4f93a8",

  /* Land cover. Kept translucent in the style so the relief reads through. */
  wood: "#14352a",
  grass: "#5b6531",
  farmland: "#4e5730",
  wetland: "#1f4a46",
  residential: "#2b3a4e",
  quarry: "#4a453c",
  rock: "#5a4c3a",
  sand: "#c6a474",
  ice: "#e6eef0",
  snow: "#eef4f6",

  parkFill: "#2f5a3c",
  parkLine: "#7fbf93",

  /* Ink. Borders are cartographic linework, not a UI accent. */
  boundary: "#6f8fa3",
  boundaryGlow: "#9ec4d6",
  boundaryState: "#5a7a8c",
  boundaryDisputed: "#8f7a58",

  roadCasing: "#060b11",
  road: "#44525e",
  roadHighway: "#4d5c69",
  trail: "#c79a5f",
  trailStep: "#e0c08a",

  label: "#dbe9f3",
  labelCountry: "#a8c1d1",
  labelState: "#7f9aab",
  labelWater: "#7fb0c6",
  labelPoi: "#f0e2c8",
  labelTrail: "#eddbb8",
  labelPeak: "#d7e5ee",
  halo: "#04070c",
  white: "#f4fbff",
  contour: "#dcefe6",
} as const;

/**
 * The world backdrop, banded by latitude.
 *
 * The vector tiles carry water but not land, so at planet scale the continents
 * are painted by a backdrop fill. Latitude is a crude climate proxy and a cheap
 * one: these stops put a dry belt either side of 30°, keep the equatorial and
 * temperate belts green, and cool the boreal and tundra edges. Landcover paints
 * over it wherever OSM has polygons, so this only decides where nothing is
 * mapped. The steps are wider apart than the earlier pass on purpose: at world
 * zoom the Sahara must read as a different place from the Congo, not as the same
 * olive under two names.
 */
export const CLIMATE: [number, string][] = [
  [0, "#1f3a2c"], // equatorial rain forest
  [8, "#2c4229"], // savanna
  [15, "#3d4728"],
  [22, "#5a5133"], // the arid belt
  [30, "#4d4a2d"],
  [38, "#2f4128"], // temperate
  [45, "#2a3c26"],
  [55, "#243526"], // boreal
  [62, "#2b3a2c"],
  [72, "#3b443e"], // tundra
  [90, "#48514c"],
];

/**
 * Hypsometric tint: elevation as colour, from the DEM, at every zoom.
 *
 * Below 700 m this is fully transparent, so the climate bands stay the lowland
 * colour — a warm band there would paint the Netherlands as a desert. From the
 * foothills it thickens into warm stone and then snow, which is what makes the
 * Himalaya, the Andes and the Alps read as high ground at the zooms where
 * contour lines are still too dense to draw, and at planet scale where there is
 * no landcover at all.
 *
 * It sits above the latitude bands and below landcover, so forests still keep
 * their green where OSM maps them and only bare high ground is tinted.
 */
export const HYPSOMETRY: [number, string][] = [
  [0, "rgba(90, 105, 80, 0)"],
  [700, "rgba(120, 120, 80, 0)"],
  [1200, "rgba(150, 138, 108, 0.14)"],
  [1800, "rgba(156, 144, 116, 0.3)"],
  [2500, "rgba(168, 158, 138, 0.46)"],
  [3200, "rgba(184, 178, 164, 0.62)"],
  [3800, "rgba(206, 204, 196, 0.74)"],
  [4500, "rgba(230, 235, 235, 0.85)"],
  [5600, "rgba(248, 252, 253, 0.92)"],
];

/**
 * Elevation snow, close in.
 *
 * Above the tint: a summit cap that follows real elevation rather than the
 * basemap's ice polygons, with no polygon edges to give it away. It starts at
 * z9 so a range is frosted at the zoom where its shape is legible.
 *
 * The snowline is not latitude-aware (there is no cheap way to vary a
 * color-relief ramp by latitude); glacier polygons and the tint carry the polar
 * cases, and 2 400 m is a deliberate compromise that keeps the Alps white
 * without painting the Norwegian fjords at sea level.
 */
export const SNOW_TINT: [number, string][] = [
  [2600, "rgba(228, 238, 241, 0)"],
  [3200, "rgba(231, 240, 243, 0.12)"],
  [3800, "rgba(236, 244, 247, 0.28)"],
  [4400, "rgba(244, 249, 251, 0.45)"],
  [5000, "rgba(250, 253, 254, 0.58)"],
  [5800, "rgba(253, 254, 255, 0.66)"],
];

/**
 * Font stacks the glyph server actually serves.
 *
 * Probed against OpenFreeMap: Noto Sans Regular, Bold and Italic answer 200;
 * Noto Serif and Metropolis answer 404. The cartographic character therefore
 * comes from case, tracking, scale and italic — never from a face we cannot
 * fetch.
 */
export const FONTS = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};

/** The halo under every map label: a shadow, not a sticker outline. */
export const HALO = { color: PALETTE.halo, width: 1.2, blur: 0.6 };

/**
 * The single hillshade.
 *
 * Four lights in one pass, anchored to the map so pitching does not swing the
 * shadows across the ridges. The key light is the northwest sun the eye expects;
 * the other three fill the faces it misses, lower and dimmer, because four
 * equally weighted lights turn relief into grey noise.
 *
 * The exaggeration ramp is what the earlier pass lacked: at planet scale the
 * sun was technically applied but the slopes were a few degrees, so continents
 * read flat. Stronger at the wide zooms, eased back where the DEM itself
 * carries detail and the snow layer takes over.
 */
export const HILLSHADE_PAINT = {
  "hillshade-method": "multidirectional",
  "hillshade-illumination-anchor": "map",
  "hillshade-illumination-direction": [315, 45, 225, 135],
  "hillshade-illumination-altitude": [45, 30, 45, 30],
  "hillshade-highlight-color": ["#a6b184", "#8f9c74", "#87946d", "#8f9c74"],
  "hillshade-shadow-color": ["#030c0a", "#06140f", "#05100c", "#06140f"],
  "hillshade-exaggeration": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.7,
    4,
    0.95,
    8,
    0.9,
    12,
    0.9,
    16,
    0.85,
  ],
} as unknown as NonNullable<HillshadeLayerSpecification["paint"]>;
