import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import { DEM_ATTRIBUTION, DEM_MAX_ZOOM, DEM_SCHEME, DEM_TILE_SIZE } from "./dem";
import {
  CLIMATE,
  FONTS,
  HILLSHADE_NEAR,
  HILLSHADE_PAINT,
  HYPSOMETRY,
  PALETTE,
  SNOW_TINT,
} from "./theme";

/**
 * Terrane's basemap — the "blue-hour survey globe".
 *
 * One style for the globe and both 2D maps. It is built from the same two free
 * sources as before: OpenFreeMap vector tiles (no key) and Mapterhorn / Copernicus
 * elevation through the `terranedem` protocol (see `demPipeline.ts`).
 *
 * The visual system, in paint order:
 *
 *   1. a graticule and a latitude-banded land backdrop — the planet's bones
 *   2. a hypsometric tint from the DEM at every zoom — elevation as colour
 *   3. landcover, parks, then one multidirectional hillshade — the surface
 *   4. water with a luminous coast, quiet borders, warm path ink
 *   5. one label ladder, from continents down to hamlets and summits
 *
 * Everything cross-fades across the zoom ladder (0–3.4 global, 3.4–8 regional,
 * 8–12 local, 12–16 detail) so no layer snaps on at a stop.
 */
export const FIRST_SYMBOL_LAYER = "label-country";

const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Colour for an absolute latitude, interpolated between the climate stops. */
function bandColor(latAbs: number) {
  for (let i = 1; i < CLIMATE.length; i++) {
    const [to, toHex] = CLIMATE[i];
    if (latAbs <= to) {
      const [from, fromHex] = CLIMATE[i - 1];
      const t = (latAbs - from) / (to - from);
      const a = rgb(fromHex);
      const b = rgb(toHex);
      const mix = a.map((v, j) => Math.round(v + (b[j] - v) * t));
      return `rgb(${mix.join(",")})`;
    }
  }
  return CLIMATE[CLIMATE.length - 1][1];
}

/* Two-degree bands rather than the eight-degree anchors: the same trick, but a
   step you cannot see as a horizontal seam across the Sahara. */
const BAND_STEP = 2;
/* Stop at the Mercator limit, not at the pole. A band whose top edge sits at 90°
   collapses every vertex onto the pole: the globe then draws that band as a
   triangle fan, and the ±180° edges of all 45 bands splay out across the arctic
   as dark spokes. Beyond ±85 what belongs there covers it anyway — the ice sheet
   over Antarctica, water over the Arctic Ocean. */
const BAND_LIMIT = 85;
const LAND_BANDS: [number, number, string][] = [];
for (let lat = 0; lat < BAND_LIMIT; lat += BAND_STEP) {
  LAND_BANDS.push([
    lat,
    Math.min(BAND_LIMIT, lat + BAND_STEP),
    bandColor(lat + BAND_STEP / 2),
  ]);
}

const WORLD_BANDS = {
  type: "FeatureCollection" as const,
  features: LAND_BANDS.flatMap(([from, to, col]) =>
    [
      [from, to],
      [-to, -from],
    ].map(([a, b]) => ({
      type: "Feature" as const,
      properties: { col },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-180, a],
            [180, a],
            [180, b],
            [-180, b],
            [-180, a],
          ],
        ],
      },
    })),
  ),
};

/**
 * The graticule.
 *
 * Fifteen-degree meridians and parallels: the instrument a survey globe is drawn
 * on. It is a static GeoJSON source, a handful of lines, and it fades out before
 * the regional view — a grid over a hiking map is furniture from another room.
 * The equator and the prime meridian are the two index lines and carry a little
 * more weight than the rest.
 */
const GRATICULE_STEP = 15;
const GRATICULE_LIMIT = 85;
const GRATICULE = {
  type: "FeatureCollection" as const,
  features: [
    ...Array.from({ length: 360 / GRATICULE_STEP + 1 }, (_, i) => -180 + i * GRATICULE_STEP)
      .filter((lon) => lon >= -180 && lon <= 180)
      .map((lon) => ({
        type: "Feature" as const,
        properties: { major: lon === 0 || lon === 180 ? 1 : 0 },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [lon, -GRATICULE_LIMIT],
            [lon, GRATICULE_LIMIT],
          ],
        },
      })),
    ...Array.from({ length: (2 * GRATICULE_LIMIT) / GRATICULE_STEP + 1 }, (_, i) => -GRATICULE_LIMIT + i * GRATICULE_STEP)
      .filter((lat) => Math.abs(lat) <= GRATICULE_LIMIT)
      .map((lat) => ({
        type: "Feature" as const,
        properties: { major: lat === 0 ? 1 : 0 },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [-180, lat],
            [180, lat],
          ],
        },
      })),
  ],
};

const elevationRamp = [
  "interpolate",
  ["linear"],
  ["elevation"],
  ...HYPSOMETRY.flat(),
] as unknown as ExpressionSpecification;

const snowRamp = [
  "interpolate",
  ["linear"],
  ["elevation"],
  ...SNOW_TINT.flat(),
] as unknown as ExpressionSpecification;

/** MapLibre mutates the style spec it is given, so each map needs a copy. */
const TERRAIN_SOURCE = {
  type: "raster-dem" as const,
  /* Every tile comes through the `terranedem` protocol (see ./dem.ts), which
     answers with a real 512 px tile at whatever zoom MapLibre asks for — the
     national LiDAR DEM where one exists, the 30 m global parent cropped and
     scaled where it does not. */
  tiles: [`${DEM_SCHEME}://{z}/{x}/{y}`],
  encoding: "terrarium" as const,
  tileSize: DEM_TILE_SIZE,
  maxzoom: DEM_MAX_ZOOM,
  attribution: DEM_ATTRIBUTION,
};

/**
 * A copy of the style.
 *
 * `globe` has to be declared here rather than switched on with
 * `setProjection` after the style loads: the first frames then render in
 * Mercator and the map reprojects, which is a visible snap and a full re-render
 * for nothing. The two small detail maps keep the default, because they are
 * crops, not planets.
 */
export function createStyle({ globe = false }: { globe?: boolean } = {}): StyleSpecification {
  const style = structuredClone(MAP_STYLE);
  if (globe) style.projection = { type: "globe" };
  return style;
}

const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Terrane Blue Hour",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    world: {
      type: "geojson",
      data: WORLD_BANDS,
    },
    graticule: {
      type: "geojson",
      data: GRATICULE,
    },
    /* The DEM belongs in the style, not in a runtime addSource. Every relief
       layer below references this source, and both are declared here — the
       earlier "blank map" failure was a layer referencing a source that only
       arrived later, at runtime. */
    relief: { ...TERRAIN_SOURCE, tiles: [...TERRAIN_SOURCE.tiles] },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '© <a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": PALETTE.space } },

    /* ── the planet's bones ─────────────────────────────────────────────── */

    {
      id: "graticule-index",
      type: "line",
      source: "graticule",
      filter: ["==", ["get", "major"], 1],
      paint: {
        "line-color": PALETTE.boundaryGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 3, 0.9],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.16, 2.5, 0.11, 4.2, 0],
      },
    },
    {
      id: "graticule",
      type: "line",
      source: "graticule",
      filter: ["==", ["get", "major"], 0],
      paint: {
        "line-color": PALETTE.boundaryGlow,
        "line-width": 0.5,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.1, 2.5, 0.07, 4.2, 0],
      },
    },
    {
      id: "land-base",
      type: "fill",
      source: "world",
      /* The colour comes from the band polygon, so this is one draw call over
         static features. Antialiasing off on purpose — adjacent bands share an
         edge and per-pixel AA along those shared edges drew a hairline across
         the map at the antimeridian. */
      paint: { "fill-color": ["get", "col"], "fill-antialias": false },
    },

    /* ── elevation as colour, at every zoom ───────────────────────────────

       Under the landcover, over the latitude bands. Placing it above the
       landcover was tried and reverted: a 0.5-alpha stone wash over every
       forest polygon at 1 800 m turned the Alps into a uniform pale field and
       buried the hillshade that makes the range legible. Under it, the tint
       decides the colour of bare high ground and lets landcover keep the
       valleys. Transparent below 700 m, so lowlands stay climate bands. */
    {
      id: "elevation-tint",
      type: "color-relief",
      source: "relief",
      paint: {
        "color-relief-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.9,
          4,
          0.84,
          8,
          0.6,
          12,
          0.52,
          16,
          0.5,
        ],
        resampling: "linear",
        "color-relief-color": elevationRamp,
      },
    },

    /* ── land cover ────────────────────────────────────────────────────── */

    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: {
        "fill-color": PALETTE.wood,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.3, 8, 0.46, 11, 0.6, 14, 0.58],
      },
    },
    {
      id: "landcover-grass",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "scrub"]]],
      paint: {
        "fill-color": PALETTE.grass,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.26, 8, 0.36, 11, 0.32, 14, 0.26],
      },
    },
    {
      id: "landcover-farmland",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "farmland"],
      minzoom: 4,
      paint: {
        "fill-color": PALETTE.farmland,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.18, 9, 0.36, 14, 0.3],
      },
    },
    {
      id: "landcover-wetland",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wetland"],
      minzoom: 5,
      paint: {
        "fill-color": PALETTE.wetland,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.18, 10, 0.3, 14, 0.34],
      },
    },
    {
      id: "landcover-rock",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "rock"],
      minzoom: 6,
      paint: {
        "fill-color": PALETTE.rock,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 11, 0.4, 14, 0.5, 16, 0.54],
      },
    },
    {
      id: "landcover-sand",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "sand"],
      paint: {
        "fill-color": PALETTE.sand,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 6, 0.68, 12, 0.76],
      },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      /* Snow and ice from the basemap: at the polar scales this is the only ice
         there is, and it fades by z13.6 because `relief-snow` has taken over —
         two snow layers would double the white and show both edges. */
      paint: {
        "fill-color": PALETTE.ice,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.72, 8, 0.42, 11, 0.34, 12.5, 0.26, 14, 0],
        "fill-outline-color": "rgba(228, 237, 239, 0)",
      },
    },
    {
      id: "landuse-residential",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", ["get", "class"], "residential"],
      paint: {
        "fill-color": PALETTE.residential,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.46, 9, 0.3, 12, 0.2],
      },
    },
    {
      id: "landuse-quarry",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", ["get", "class"], "quarry"],
      minzoom: 9,
      paint: {
        "fill-color": PALETTE.quarry,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.16, 14, 0.3],
      },
    },
    {
      id: "park-area",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      filter: ["in", ["get", "class"], ["literal", ["national_park", "nature_reserve"]]],
      minzoom: 4,
      paint: {
        "fill-color": PALETTE.parkFill,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.06, 9, 0.11, 14, 0.15],
      },
    },

    /* ── light ─────────────────────────────────────────────────────────── */

    /* Declared here, not added at runtime: the style owns the source, so this is
       safe, and every 2D map gets the same relief without its own plumbing. */
    {
      id: "relief-hillshade",
      type: "hillshade",
      source: "relief",
      /* Four lights for the wide view; one sun once the ground is near enough
         that each face is its own subject (see HILLSHADE_NEAR). */
      maxzoom: 8.5,
      paint: HILLSHADE_PAINT,
    },
    {
      id: "relief-hillshade-near",
      type: "hillshade",
      source: "relief",
      minzoom: 8.5,
      paint: HILLSHADE_NEAR,
    },
    {
      id: "relief-snow",
      type: "color-relief",
      source: "relief",
      minzoom: 9,
      paint: {
        "color-relief-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.14, 12, 0.34, 15, 0.55],
        resampling: "linear",
        "color-relief-color": snowRamp,
      },
    },

    /* ── water, and the coast as a lit edge ────────────────────────────── */

    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      /* Depth by body, not by bathymetry: these tiles carry no depth field, and a
         bathymetry raster would be a whole extra pyramid for one gradient.
         Ocean deepest, lakes one step up, rivers the lightest. No fill outline:
         it drew a hard keyline around every river. */
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "ocean",
          PALETTE.ocean,
          "lake",
          PALETTE.lake,
          "river",
          PALETTE.river,
          PALETTE.lake,
        ],
      },
    },
    /* The shelf a paper chart paints with a graduated blue. It is drawn, not
       measured: the DEM clamps sea level to 0 m, so there is no bathymetry to
       ramp. Two symmetric blooms are used rather than a line offset out to sea —
       a polygon's ring winding decides which side an offset lands on, and half
       the world's coasts would have had their shelf painted inland. A bloom
       bleeds both ways, which is also what makes the shore read as shallow water
       rather than as a knife edge. */
    {
      id: "coast-shelf",
      type: "line",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["==", ["get", "class"], "ocean"],
      maxzoom: 12,
      paint: {
        "line-color": PALETTE.shelf,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 6, 4, 12, 8, 24, 12, 40],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 0, 4, 6, 10, 12, 18],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.3, 4, 0.22, 8, 0.13, 12, 0],
      },
    },
    {
      id: "coast-glow",
      type: "line",
      source: "openmaptiles",
      "source-layer": "water",
      maxzoom: 11,
      /* The bright inner shelf, kept past the regional zooms: a lake or a fjord
         at z10 still needs its edges lit. */
      filter: ["in", ["get", "class"], ["literal", ["ocean", "lake"]]],
      paint: {
        "line-color": PALETTE.coastGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 3, 4, 7, 8, 11, 11, 15],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 0, 3, 6, 5, 11, 8],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.3, 4, 0.2, 8, 0.1, 11, 0],
      },
    },
    {
      id: "coast-line",
      type: "line",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["in", ["get", "class"], ["literal", ["ocean", "lake"]]],
      paint: {
        "line-color": PALETTE.coastLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 1, 12, 1.3, 16, 1.6],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 6, 0.5, 10, 0.42, 14, 0.38],
      },
    },
    {
      id: "coast-surf",
      type: "line",
      source: "openmaptiles",
      "source-layer": "water",
      /* The waterline itself: one bright hairline that says "this is the edge"
         at every zoom, against a much wider, softer shelf behind it. */
      filter: ["==", ["get", "class"], "ocean"],
      paint: {
        "line-color": PALETTE.surf,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 8, 0.7, 16, 1.1],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.32, 6, 0.26, 12, 0.2, 16, 0.16],
      },
    },
    {
      id: "waterway-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 7.5,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.halo,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7.5, 0.8, 14, 2.6, 16, 3.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, 0, 8.6, 0.4, 12, 0.24, 16, 0],
      },
    },
    {
      id: "waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 7.5,
      layout: { "line-cap": "round", "line-join": "round" },
      /* Flowing ink: a lighter core over the casing, widening with the zoom and
         with the stream's own class, so a river reads as water and a brook as a
         thread rather than both as the same 1 px line. It starts late enough
         that the alpine network is not a blue web over the relief. */
      paint: {
        "line-color": [
          "match",
          ["get", "class"],
          "river",
          PALETTE.river,
          "canal",
          PALETTE.river,
          PALETTE.lake,
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7.5,
          ["match", ["get", "class"], "river", 0.35, 0.15],
          12,
          ["match", ["get", "class"], "river", 1, 0.5],
          16,
          ["match", ["get", "class"], "river", 2, 1],
        ],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7.5, 0, 8.5, 0.42, 12, 0.5, 16, 0.68],
      },
    },

    /* ── quiet linework ────────────────────────────────────────────────── */

    {
      id: "park-outline",
      type: "line",
      source: "openmaptiles",
      "source-layer": "park",
      filter: ["in", ["get", "class"], ["literal", ["national_park", "nature_reserve"]]],
      minzoom: 5,
      /* A hairline, not a dashed fence: the fill already says "park", the line
         only closes the shape. */
      paint: {
        "line-color": PALETTE.parkLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 12, 0.9, 16, 1.3],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.12, 9, 0.26, 14, 0.34],
      },
    },
    {
      id: "boundary-country-glow",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["all", ["<=", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      /* A soft presence under the crisp line: borders over terrain need a little
         air around them or every ridge cuts them into a dashed mess. */
      paint: {
        "line-color": PALETTE.boundaryGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 2.5, 6, 4, 12, 5.5],
        "line-blur": 2.5,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.09, 6, 0.13, 12, 0.09],
      },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["all", ["<=", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: {
        "line-color": PALETTE.boundary,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 0.9, 12, 1.1],
        "line-opacity": 0.6,
        "line-dasharray": [2.4, 2],
      },
    },
    {
      id: "boundary-state",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      minzoom: 3,
      paint: {
        "line-color": PALETTE.boundaryState,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 10, 0.8],
        "line-opacity": 0.35,
        "line-dasharray": [1.6, 2.4],
      },
    },
    {
      id: "boundary-disputed",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: [
        "all",
        ["==", ["get", "disputed"], 1],
        ["<=", ["get", "admin_level"], 2],
        ["!=", ["get", "maritime"], 1],
      ],
      minzoom: 2,
      /* Disputed lines are not the same claim as a settled border: warmer,
         tighter, and never the primary colour. */
      paint: {
        "line-color": PALETTE.boundaryDisputed,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 8, 1, 12, 1.2],
        "line-opacity": 0.5,
        "line-dasharray": [1.5, 2.5],
      },
    },

    /* Buildings and the working townscape: texture at detail zooms, gone at the
       scales where a settlement is a dot. */
    {
      id: "landuse-commercial",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      minzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["commercial", "industrial", "retail"]]],
      paint: {
        "fill-color": PALETTE.residential,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0, 13, 0.28, 16, 0.38],
      },
    },
    {
      id: "building",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13.4,
      paint: {
        "fill-color": PALETTE.building,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.4, 0, 14, 0.3, 16, 0.44],
        "fill-outline-color": "rgba(9, 14, 18, 0.35)",
      },
    },

    /* ── roads: built, cased, neutral ──────────────────────────────────── */

    {
      id: "road-glow",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 7,
      /* A soft halo on the fast network only: structure over a dark relief
         without turning every lane into a light source. */
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2, 12, 6, 16, 10],
        "line-blur": ["interpolate", ["linear"], ["zoom"], 7, 2, 16, 5],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8.5, 0.14, 13, 0.1, 16, 0.06],
      },
    },
    {
      id: "road-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.3, 12, 3.4, 14, 4.6, 16, 6.2],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 6.9, 0.85],
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 10,
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        /* Thin and dark, and narrower than the marked roads: the minor network
           was the layer that read as a footpath and made routes ambiguous. */
        "line-color": PALETTE.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 2.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 10.9, 0.9],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 14, 2.2, 16, 3.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 6.9, 1],
      },
    },
    {
      id: "road-highway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 4,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PALETTE.roadHighway,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 2.6, 16, 4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 4.9, 1],
      },
    },

    /* ── the label ladder ──────────────────────────────────────────────── */

    {
      id: "water-label-ocean",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 0,
      maxzoom: 6.4,
      filter: ["in", ["get", "class"], ["literal", ["ocean", "sea"]]],
      /* Ocean and sea names are the largest type on a world map, and they are
         set the way charts set them: wide-tracked italic capitals, low contrast,
         so they name the water without competing with the land. */
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 10, 3, 12.5, 6.4, 14],
        "text-letter-spacing": 0.35,
        "text-transform": "uppercase",
        "text-max-width": 6,
        "text-padding": 6,
      },
      paint: {
        "text-color": PALETTE.labelWater,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.2,
        "text-halo-blur": 1,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.24, 3, 0.34, 6.4, 0.3],
      },
    },
    {
      id: "water-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 3,
      filter: [
        "all",
        ["==", ["geometry-type"], "Point"],
        ["!=", ["get", "class"], "ocean"],
        ["!=", ["get", "class"], "sea"],
      ],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 9, 11.5, 14, 13],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
      },
      paint: {
        "text-color": PALETTE.labelWater,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 6, 0.72, 12, 0.8],
      },
    },
    {
      id: "water-label-line",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 6,
      /* Lakes and long rivers carry their name along the geometry, not at a
         point; without this layer a reservoir was an unnamed blue shape. */
      filter: ["!=", ["geometry-type"], "Point"],
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.italic,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 14, 12],
        "text-letter-spacing": 0.06,
        "text-max-angle": 40,
        "symbol-spacing": 320,
        "text-padding": 4,
      },
      paint: {
        "text-color": PALETTE.labelWater,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 7, 0.7],
      },
    },
    {
      id: "label-continent",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "continent"],
      minzoom: 0,
      maxzoom: 3.4,
      /* Continents are the one label allowed to be large at planet scale: they
         give the globe its composition, and they hand over to country names as
         the camera arrives. */
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 14, 2, 18, 3.4, 20],
        "text-letter-spacing": 0.38,
        "text-transform": "uppercase",
        "text-max-width": 5,
        "text-padding": 10,
      },
      paint: {
        "text-color": PALETTE.labelCountry,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.6,
        "text-halo-blur": 2,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 2.4, 0.44, 3.4, 0],
      },
    },
    {
      id: "label-country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "country"],
      minzoom: 2.2,
      // Overlaps the state handover on purpose: a country label vanishing on the
      // exact frame state labels appear reads as a flicker.
      maxzoom: 7.4,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 2.2, 9, 5, 11.5, 7, 15],
        "text-letter-spacing": 0.24,
        "text-transform": "uppercase",
        "text-max-width": 8,
      },
      paint: {
        "text-color": PALETTE.labelCountry,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.3,
        "text-halo-blur": 0.8,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 2.2, 0.55, 4, 0.72],
      },
    },
    {
      id: "label-state",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "state"],
      minzoom: 5.6,
      maxzoom: 10,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": 9,
        "text-letter-spacing": 0.3,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": PALETTE.labelState,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1,
        "text-halo-blur": 0.8,
        "text-opacity": 0.42,
      },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "city"],
      minzoom: 6.4,
      /* Cities are the one settlement class set in bold: weight is the hierarchy,
         not size alone, and it lets a city name beat a taller village name for
         the same collision without shouting in capitals. */
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6.4, 10.5, 11, 12.5, 14, 14, 16, 15],
        "text-max-width": 8,
        "text-padding": 8,
      },
      paint: {
        "text-color": PALETTE.label,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.3,
        "text-halo-blur": 0.6,
        "text-opacity": 0.8,
      },
    },
    {
      id: "label-town",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "town"],
      minzoom: 7.4,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 7.4, 9.5, 11, 11, 14, 12.5, 16, 13.5],
        "text-max-width": 8,
        "text-padding": 7,
      },
      paint: {
        "text-color": PALETTE.labelTown,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.6,
        "text-opacity": 0.68,
      },
    },
    {
      id: "label-village",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["==", ["get", "class"], "village"],
      minzoom: 9.6,
      maxzoom: 14.5,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9.6, 9.5, 14, 11],
        "text-max-width": 8,
        "text-padding": 7,
      },
      paint: {
        "text-color": PALETTE.labelVillage,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.1,
        "text-halo-blur": 0.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 9.6, 0, 10.3, 0.62],
      },
    },
    {
      id: "label-detail",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 12,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["hamlet", "suburb", "quarter", "neighbourhood", "isolated_dwelling", "locality"]],
      ],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 9, 16, 10.5],
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: {
        "text-color": PALETTE.labelState,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1,
        "text-halo-blur": 0.5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 12.8, 0.45],
      },
    },
    {
      id: "label-peak",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "mountain_peak",
      minzoom: 9.5,
      /* Named summits with their elevation, straight from the basemap: the alpine
         typography the destination dots could never carry, because most summits
         are not in our catalogue. Rank keeps the count honest — the top of a range
         names itself, every shoulder does not. */
      filter: [
        "all",
        ["has", "name"],
        [
          "any",
          ["<=", ["coalesce", ["get", "rank"], 999], 12],
          [">=", ["coalesce", ["get", "ele"], 0], 3000],
        ],
      ],
      layout: {
        "text-field": [
          "format",
          ["coalesce", ["get", "name:en"], ["get", "name"]],
          {},
          "\n",
          {},
          ["case", ["has", "ele"], ["concat", ["to-string", ["get", "ele"]], " m"], ""],
          { "font-scale": 0.72 },
        ],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9.5, 9.5, 14, 11],
        "text-letter-spacing": 0.02,
        "text-anchor": "top",
        "text-offset": [0, 0.4],
        "text-max-width": 8,
        "text-padding": 5,
        "text-optional": true,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: {
        "text-color": PALETTE.labelPeak,
        "text-halo-color": PALETTE.space,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 9.5, 0, 10.5, 0.85],
      },
    },
    {
      id: "label-road",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 12.5,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]],
      ],
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 9, 16, 11],
        "text-letter-spacing": 0.02,
        "text-padding": 4,
        "symbol-spacing": 260,
        "text-max-angle": 40,
        "text-keep-upright": true,
      },
      paint: {
        "text-color": PALETTE.labelState,
        "text-halo-color": PALETTE.halo,
        "text-halo-width": 1.2,
        "text-halo-blur": 0.5,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.2, 0.7],
      },
    },
  ],
};
