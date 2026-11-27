import type { HillshadeLayerSpecification } from "maplibre-gl";

/**
 * One visual language for every map in the app.
 *
 * The globe and the Experience map are the same product at
 * different crops, so they read from one palette instead of three sets of
 * literals. Values here are the "blue-hour survey" palette: deep water with a
 * luminous coast, hypsometric land, quiet borders, warm trail ink, cool type.
 * Nothing in this file fetches, computes or depends on React — it is data, and
 * `style.ts` is the only consumer that turns it into layers.
 */
export const PALETTE = {
  space: "#05070c",

  /* Water: ocean deepest, lakes one step up, rivers lightest. Teal rather than
     navy, because every other colour on this map is warm and a blue-black sea
     read as a hole in the planet. */
  ocean: "#0d4b64",
  lake: "#14a9bf",
  river: "#2b9fb4",
  /* The drawn shelf: a broad bloom just outside the shore, then the surf line. */
  shelf: "#5ad2de",
  coastGlow: "#8fe6ee",
  coastLine: "#5cc2d2",
  surf: "#cfeeee",

  /* Land cover: distinct hues, not one green family. Kept translucent in the
     style so the relief reads through, but opaque enough at detail zooms to tell
     a forest from a meadow from a harvested field. */
  wood: "#1c6339",
  grass: "#4f7d24",
  farmland: "#9c8b3a",
  wetland: "#2a5a5e",
  residential: "#3a4757",
  quarry: "#5d5646",
  rock: "#b08a63",
  sand: "#cbaa7c",
  ice: "#c9ecf7",
  snow: "#eef6f8",
  building: "#6a6153",

  parkFill: "#2f5f3f",
  parkLine: "#93d6a8",

  /* Ink. Borders are cartographic linework, not a UI accent. */
  boundary: "#6f8fa3",
  boundaryGlow: "#9ec4d6",
  boundaryState: "#5a7a8c",
  boundaryDisputed: "#8f7a58",

  roadCasing: "#071018",
  road: "#50616e",
  roadHighway: "#63758a",
  roadGlow: "#a9c3d4",
  trail: "#c79a5f",
  trailStep: "#e0c08a",

  label: "#dbe9f3",
  labelTown: "#e8ddc6",
  labelVillage: "#cfdfe9",
  labelCountry: "#a8c1d1",
  labelState: "#7f9aab",
  labelWater: "#7fb0c6",
  labelPoi: "#f0e2c8",
  labelTrail: "#eddbb8",
  labelPeak: "#d7e5ee",
  halo: "#04070c",
  white: "#f4fbff",
  /* Beacon cores: warm cream, so a screen of pins reads as lit stations rather
     than white noise over a dark relief. */
  dot: "#f7eeda",
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
  [0, "#1b4030"], // equatorial rain forest
  [8, "#314a29"], // savanna
  [15, "#3d4728"],
  [22, "#635733"], // the arid belt
  [30, "#4d4a2d"],
  [38, "#334827"], // temperate
  [45, "#2a3c26"],
  [55, "#243526"], // boreal
  [62, "#2b3a2c"],
  [72, "#3b443e"], // tundra
  [90, "#48514c"],
];

/**
 * Hypsometric tint: elevation as colour, from the DEM, at every zoom.
 *
 * It starts in the low foothills — 150 m, barely a wash — so mid-altitude
 * country stops reading as "green until it is white", and thickens through warm
 * ochre and stone into snow. At planet scale this is most of the land colour;
 * close in, landcover keeps the valleys and the tint owns bare high ground.
 *
 * It sits above the latitude bands and below landcover, so forests still keep
 * their green where OSM maps them and only bare high ground is tinted.
 */
export const HYPSOMETRY: [number, string][] = [
  [0, "rgba(90, 105, 80, 0)"],
  [150, "rgba(96, 108, 74, 0.06)"],
  [400, "rgba(118, 120, 76, 0.14)"],
  [800, "rgba(96, 102, 66, 0.26)"],
  [1400, "rgba(96, 110, 72, 0.34)"],
  [2000, "rgba(140, 124, 96, 0.5)"],
  [2600, "rgba(158, 140, 116, 0.52)"],
  [3000, "rgba(150, 140, 128, 0.36)"],
  [3400, "rgba(146, 160, 176, 0.32)"],
  [4000, "rgba(160, 178, 196, 0.3)"],
  [4700, "rgba(178, 196, 214, 0.28)"],
  [5600, "rgba(196, 212, 228, 0.26)"],
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
  [3300, "rgba(232, 242, 246, 0)"],
  [3600, "rgba(216, 232, 244, 0.2)"],
  [4000, "rgba(222, 236, 246, 0.32)"],
  [4500, "rgba(230, 241, 249, 0.42)"],
  [5000, "rgba(237, 246, 251, 0.5)"],
  [5800, "rgba(242, 249, 253, 0.56)"],
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
  "hillshade-highlight-color": ["#d3c6a6", "#9aa07f", "#8b9376", "#9aa07f"],
  "hillshade-shadow-color": ["#04101a", "#06161b", "#051319", "#06161b"],
  "hillshade-accent-color": "#0a2a24",
  "hillshade-exaggeration": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    1.15,
    4,
    1.35,
    8,
    1.2,
  ],
} as unknown as NonNullable<HillshadeLayerSpecification["paint"]>;

/**
 * The close light.
 *
 * Seen range-wide, the four-light pass above is right: no face is left black and
 * the whole range reads as one body. Close in it is the wrong tool — four lights
 * each lay their highlight over the ground, and four washes of pale stone turned
 * every hillside into the same sage felt, which is the flat look this map kept
 * falling into. So the near field is lit by one sun, northwest at 45°, using the
 * `combined` method: intensity grows with slope, so valley floors and meadows
 * keep their own colour and only the faces that catch the light are lit. Steep
 * ground still gets a strong light/shadow split — the thing that makes close
 * terrain read as terrain rather than as a tint.
 */
export const HILLSHADE_NEAR = {
  "hillshade-method": "standard",
  "hillshade-illumination-anchor": "map",
  "hillshade-illumination-direction": 315,
  "hillshade-illumination-altitude": 45,
  "hillshade-highlight-color": "rgba(255, 232, 186, 0.52)",
  "hillshade-shadow-color": "rgba(8, 28, 62, 0.74)",
  "hillshade-accent-color": "rgba(8, 26, 40, 0.55)",
  "hillshade-exaggeration": [
    "interpolate",
    ["linear"],
    ["zoom"],
    8.5,
    0.5,
    12,
    0.7,
    16,
    0.8,
  ],
} as unknown as NonNullable<HillshadeLayerSpecification["paint"]>;
