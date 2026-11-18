import type { StyleSpecification } from "maplibre-gl";
import { DEM_ATTRIBUTION, DEM_MAX_ZOOM, DEM_SCHEME, DEM_TILE_SIZE } from "./dem";

/**
 * Terrane's basemap. A "deep water" palette rather than a flat black one:
 * ocean reads blue, land reads mossy, boundaries and roads sit a step above
 * both — so the globe has shape at world zoom and detail when you fly in.
 * Vector tiles: OpenFreeMap (no key, OSM data). Terrain: AWS Terrarium.
 */
export const FIRST_SYMBOL_LAYER = "label-country";

/**
 * The world backdrop, banded by latitude.
 *
 * The vector tiles carry water but not land, so the continents are painted by a
 * backdrop fill. One flat colour for all land was the reason the Sahara read as
 * green as a meadow: at the zooms where people look at whole countries there is
 * almost no landcover mapped, so the backup colour IS the desert, the taiga and
 * the pampas.
 *
 * Latitude is a crude climate proxy and a cheap one: ten bands, twenty polygons
 * mirrored across the equator, no new tiles, no new data, no per-frame cost.
 * It puts a dry belt either side of 30° and keeps the temperate and equatorial
 * bands green, which is enough to make continents read as places rather than as
 * one moss-green silhouette. Landcover still paints over it wherever OSM has
 * polygons, so this only decides where nothing is mapped.
 */
const CLIMATE: [number, string][] = [
  [0, "#2a3d26"], // equatorial green
  [8, "#38402a"], // savanna
  [15, "#464429"],
  [22, "#4e4629"], // the arid belt
  [30, "#404028"],
  [38, "#343e26"], // temperate
  [45, "#2e3c24"],
  [55, "#2b3523"], // boreal
  [62, "#2f3728"],
  [72, "#39403a"], // tundra
  [90, "#3c4340"],
];

const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Colour for an absolute latitude, interpolated between the CLIMATE stops. */
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
   as dark spokes. The polar caps beyond ±85.05° are covered by what belongs
   there anyway — the ice sheet over Antarctica, water over the Arctic Ocean. */
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

/** MapLibre mutates the style spec it is given, so each map needs a copy. */
export const TERRAIN_SOURCE = {
  type: "raster-dem" as const,
  /* Every tile comes through the `terranedem` protocol (see ./dem.ts), which
     answers with a real 512 px tile at whatever zoom MapLibre asks for — the
     national LiDAR DEM where one exists, the 30 m global parent cropped and
     scaled where it does not. That is what keeps the hillshade sharp at z14
     instead of overzooming a coarse pyramid. */
  tiles: [`${DEM_SCHEME}://{z}/{x}/{y}`],
  encoding: "terrarium" as const,
  tileSize: DEM_TILE_SIZE,
  maxzoom: DEM_MAX_ZOOM,
  attribution: DEM_ATTRIBUTION,
};

export function createStyle(): StyleSpecification {
  return structuredClone(MAP_STYLE);
}

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Terrane Deep",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    // The vector tiles carry water, not land — at world zoom the continents
    // would otherwise be the space-coloured background. Latitude bands (see
    // LAND_BANDS) sit under the water layers and give each climate belt its
    // own colour.
    world: {
      type: "geojson",
      data: WORLD_BANDS,
    },
    /* The DEM belongs in the style, not in a runtime addSource. A static layer
       that references a source added later makes MapLibre reject the ENTIRE
       style — blank map, getStyle() undefined. That is what broke the earlier
       attempts to declare hillshade statically: the layer was fine, the missing
       source was not. */
    relief: { ...TERRAIN_SOURCE, tiles: [...TERRAIN_SOURCE.tiles] },

    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '© <a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#04060d" } },
    {
      id: "land-base",
      type: "fill",
      source: "world",
      // The colour comes from the band polygon, so this layer is one draw call
      // over static features: the cheapest colour the map has. Antialiasing off
      // on purpose — adjacent bands share an edge, and per-pixel AA along those
      // shared edges is what drew a visible hairline across the map at the
      // antimeridian, where every band edge lines up on the same meridian.
      paint: { "fill-color": ["get", "col"], "fill-antialias": false },
    },
    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      // Kept translucent, and faded hard once the polygons get dense: at regional
      // zoom the wood fill covers whole ranges in flat colour, which is what made
      // the map go monotone and lose its relief in the middle of a zoom.
      paint: {
        "fill-color": "#14352a",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.34,
          8,
          0.42,
          11,
          0.38,
        ],
      },
    },
    {
      id: "landcover-grass",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "scrub"]]],
      paint: {
        "fill-color": "#5b6531",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.28,
          8,
          0.34,
          11,
          0.3,
        ],
      },
    },
    {
      id: "landcover-farmland",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "farmland"],
      minzoom: 4,
      // Fields, not forest: a lighter, yellower green, kept low so a patchwork of
      // farmland does not flatten the relief the way wood did before.
      paint: {
        "fill-color": "#4e5730",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 9, 0.3, 14, 0.26],
      },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      // Snow. Ice and glacier polygons are the only permanent snow the basemap
      // carries, so this layer is what puts white on the high peaks: the
      // Matterhorn's north face, the Mont Blanc snowfields, the poles.
      //
      // It inverts the old curve. Fading ice to 0.13 at z14 was wrong once this
      // became the snow layer: at the zoom where you are actually looking at a
      // summit, the snowfield disappeared and left bare shaded rock. Now the
      // sheet stays faint in the middle zooms — a whole icefield at full
      // strength buries the hillshade — and firms back up close in, where it is
      // a summit cap and not the whole frame. The shading still lands on top,
      // because the hillshade is drawn above landcover.
      paint: {
        // Have to be white at the polar scales, where this layer is the only ice
        // there is (sea ice, ice sheets) and no hillshade detail exists to blend
        // with anyway.
        "fill-color": "#e6eef0",
        // Gone by z13.6, on purpose: past that the polygons read as flat geometric
        // shapes on the mountainside, and `relief-snow` in Globe.tsx has taken over
        // — real elevation snow, sampled from the DEM, with no polygon edges at
        // all. Two snow layers would double the white and show both edges.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.74,
          8,
          0.44,
          11,
          0.24,
          12.5,
          0.12,
          13.6,
          0,
        ],
        "fill-outline-color": "rgba(228, 237, 239, 0)",
      },
    },
    {
      id: "landcover-rock",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "rock"],
      minzoom: 6,
      // Bare high ground: scree and rock slabs above the treeline. Warm brown so
      // altitude reads as a colour band under the shading instead of the whole
      // range sitting in one green.
      // Sits under the hillshade with the vegetation, so a rock boundary is a
      // shift of tone rather than a cut-out edge. Kept translucent for the same
      // reason: the base band and the shade carry most of the colour.
      paint: {
        "fill-color": "#5a4c3a",
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          0.16,
          11,
          0.24,
          14,
          0.28,
          16,
          0.32,
        ],
      },
    },
    {
      id: "landcover-sand",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "sand"],
      // Desert and dune sand: the one place in the palette that is allowed to be
      // warm and bright, because sand that stays grey-moss is the single most
      // obviously wrong thing on a world map.
      paint: {
        "fill-color": "#c6a474",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 6, 0.66, 12, 0.74],
      },
    },
    {
      id: "landuse-residential",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", ["get", "class"], "residential"],
      paint: {
        "fill-color": "#2b3a4e",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 9, 0.34, 12, 0.22],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      // Depth by body, not by bathymetry: there is no depth field in these
      // tiles, and shipping a bathymetry raster would cost a whole extra tile
      // pyramid for one gradient. Ocean is the deepest and darkest, lakes one
      // step up, rivers and canals the lightest — which is true of almost every
      // water body in the order people read them, and costs nothing at all.
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "ocean",
          "#03182b",
          "lake",
          "#06293f",
          "river",
          "#0a3a53",
          "#06293f",
        ],
        "fill-outline-color": "#25607a",
      },
    },
    {
      id: "waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 6,
      paint: {
        "line-color": "#0f3a4d",
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 14, 1.6, 16, 2.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 7, 0.7],
      },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: [
        "all",
        ["<=", ["get", "admin_level"], 2],
        ["!=", ["get", "maritime"], 1],
      ],
      paint: {
        "line-color": "#4a6d84",
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 1.1, 12, 1.5],
        "line-opacity": 0.6,
        "line-dasharray": [3, 3],
      },
    },
    {
      id: "boundary-state",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: [
        "all",
        ["==", ["get", "admin_level"], 4],
        ["!=", ["get", "maritime"], 1],
      ],
      minzoom: 3,
      paint: {
        "line-color": "#3a5a70",
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 10, 1],
        "line-opacity": 0.55,
        "line-dasharray": [2, 3],
      },
    },
    {
      id: "water-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      minzoom: 3,
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Italic"],
        "text-size": 11,
        "text-letter-spacing": 0.1,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": "#5d8ba3",
        "text-halo-color": "#04121c",
        "text-halo-width": 1.2,
        "text-opacity": 0.8,
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 10,
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track"]]],
      paint: {
        /* Dark and thin, and deliberately narrower than before: at trail zooms
           the minor/track network was the layer that read as a footpath, which
           is what made roads and marked routes hard to tell apart. Roads now
           carry the neutral slate and a casing (above), trails the colour. */
        "line-color": "#2b3945",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 2.8],
        // Roads bleed in over roughly one zoom level instead of snapping on:
        // a line layer has no cross-fade of its own, so the opacity ramp is
        // what keeps a zoom from flicking detail into existence.
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0,
          10.9,
          1,
        ],
      },
    },
    /* A casing under the drivable network: a dark line two pixels wider than the
       road on top of it. Roads read as built infrastructure — solid, cased,
       neutral slate — while marked trails are coloured routes with shields. Without
       the casing both were thin lines of similar weight and colour on a dark map. */
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
      paint: {
        "line-color": "#050a10",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          1.4,
          12,
          4,
          14,
          5.4,
          16,
          7.2,
        ],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0, 6.9, 0.9],
      },
    },
    {
      id: "road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["primary", "secondary", "tertiary"]],
      ],
      paint: {
        "line-color": "#465a6c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 14, 2.6, 16, 4],
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
      paint: {
        "line-color": "#4d6173",
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 3, 16, 4.6],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 4.9, 1],
      },
    },
    /* Footpaths, drawn from the basemap's own vector tiles rather than a raster
       overlay. Two things follow from that, both wanted:

       - **No markers, no shields.** The previous overlay baked grey pictogram
         markers and numbered route badges into the tiles; they cannot be restyled
         or removed, and they were the unreadable part.
       - **Trails read as trails.** A dashed warm line with a dark casing is a
         different species from a solid cased slate road, so the two never get
         confused.

       The OpenMapTiles schema carries the geometry of every path but not the
       names of long-distance route relations — those only come from Overpass,
       which measured 33 s and 1.2 MB for one small viewport cell (see README). */
    {
      id: "trails-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 11.4,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["path", "footway", "steps", "pedestrian"]],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#04090e",
        "line-width": ["interpolate", ["linear"], ["zoom"], 11.4, 1.3, 14, 3.2, 16, 5],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.4, 0, 12.2, 0.8],
      },
    },
    {
      id: "trails-path",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 11.4,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["path", "footway", "steps", "pedestrian"]],
      ],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "subclass"],
          "steps",
          "#e0c08a",
          "#c9a06b",
        ],
        // Dash lengths are in multiples of line width, so the array shrinks as
        // the line widens: 2.2 at 2.6 px is a trail tick, not a screen-long
        // stretch of gold, and the geometry past z14 is overzoomed anyway.
        "line-width": ["interpolate", ["linear"], ["zoom"], 11.4, 0.7, 14, 1.9, 16, 2.6],
        "line-dasharray": [2.2, 1.4],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.4, 0, 12.2, 1],
      },
    },
    /* Named paths. `transportation` carries the geometry but no names; the
       companion `transportation_name` layer does carry them, as long as the way
       has a `name` in OSM — so "Europaweg", "Riffelberg-Trail", "Arvenweg"
       arrive from the tiles already on screen. Same source, no request of its
       own, which is why the labels are affordable where an Overpass lookup of
       route relations was not (see README). Unnamed paths stay unlabelled, so
       this annotates the network instead of tiling the map with text. */
    {
      id: "trails-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 12.4,
      // `pedestrian` is deliberately excluded even though it is drawn as a trail:
      // in towns that class is the shopping street — Zermatt's Bahnhofstrasse came
      // through as a "trail" label on the first pass — and a street name set in
      // gold along a pale dashed line reads as a route. Paths, footways and steps
      // are the things people came to see.
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["path", "footway", "steps"]],
      ],
      layout: {
        "symbol-placement": "line",
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 12.4, 10.5, 16, 14],
        "text-letter-spacing": 0.05,
        "text-padding": 3,
        "symbol-spacing": 240,
        "text-max-angle": 40,
        "text-keep-upright": true,
      },
      paint: {
        "text-color": "#eddbb8",
        "text-halo-color": "#040906",
        "text-halo-width": 1.7,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 12.4, 0, 13, 1],
      },
    },
    /* ── camping kit ───────────────────────────────────────────────────────

       What you need once you are there, rather than what you came to see:
       somewhere to sleep, water to fill, a place to leave the car. All three
       come from the `poi` layer of the same vector source the basemap already
       downloads, so this costs no extra request and no extra bytes on the wire —
       only two circle layers and one label layer once the tiles are in.

       The schema only carries POIs in its z14 tiles (verified against the live
       OpenFreeMap tiles: 0 features at z11.2, none at z13, 1,600+ at z14.3), so
       these appear at the zoom where a summit has become a hillside and a
       campsite is a clearing — which is exactly the zoom at which they matter. */
    {
      id: "camp-icon",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 13.8,
      // The tent comes from addCampIcon() in ../map/campIcon: drawn into a canvas
      // at load, because there is no sprite sheet to borrow one from. Where the
      // icon is missing for a frame the layer draws nothing and the dot layer
      // below still has the huts, so the map never waits on it.
      filter: ["==", ["get", "class"], "campsite"],
      layout: {
        "icon-image": "camp-tent",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 13.8, 0.6, 16, 0.9],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    {
      id: "camp-dot",
      type: "circle",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 14,
      filter: [
        "any",
        ["==", ["get", "class"], "shelter"],
        [
          "all",
          ["==", ["get", "class"], "lodging"],
          ["in", ["get", "subclass"], ["literal", ["alpine_hut", "wilderness_hut"]]],
        ],
      ],
      paint: {
        // Amber for a hut with a roof and a bed, blue-grey for a shelter. Two
        // different questions — booking, or an emergency — so two colours.
        // Campsites are not here: they get the tent above.
        "circle-color": [
          "match",
          ["get", "class"],
          "shelter",
          "#9ec7e0",
          "#ffb066",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 4.2, 16, 6.2],
        "circle-stroke-color": "#05090f",
        "circle-stroke-width": 1.8,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.6, 1],
      },
    },
    {
      id: "supplies-dot",
      type: "circle",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 14,
      // Water and parking, drawn small and unlabelled: they are a yes/no on the
      // route, not destinations, and 26 drinking-water taps in one Zermatt tile
      // would bury the map in text if every one of them got a name.
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["drinking_water", "spring", "parking"]],
      ],
      paint: {
        "circle-color": [
          "match",
          ["get", "class"],
          "parking",
          "#78808c",
          "#5fb4d8",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 2.4, 16, 3.6],
        "circle-stroke-color": "#05090f",
        "circle-stroke-width": 1.2,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.6, 0.9],
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
      maxzoom: 6.8,
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2.2, 8, 5, 10.5],
        "text-letter-spacing": 0.24,
        "text-transform": "uppercase",
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#93b2c7",
        "text-halo-color": "#04060d",
        "text-halo-width": 1.4,
        "text-opacity": 0.75,
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
        "text-font": ["Noto Sans Regular"],
        "text-size": 9,
        "text-letter-spacing": 0.2,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": "#7a9cb2",
        "text-halo-color": "#04060d",
        "text-halo-width": 1.2,
        "text-opacity": 0.48,
      },
    },
    {
      id: "label-city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 7,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 11, 12, 14, 13, 16, 14],
        "text-max-width": 8,
        "text-padding": 8,
      },
      paint: {
        "text-color": "#b3ccdd",
        "text-halo-color": "#04060d",
        "text-halo-width": 1.5,
        "text-opacity": 0.62,
      },
    },
    /* Names for the camps and huts only. The dots say a place exists; the name is
       what you search for in a booking or on a signpost, so it is worth the one
       extra symbol layer at these zooms. */
    {
      id: "camp-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 14.4,
      filter: [
        "any",
        ["==", ["get", "class"], "campsite"],
        ["==", ["get", "class"], "shelter"],
        [
          "all",
          ["==", ["get", "class"], "lodging"],
          ["in", ["get", "subclass"], ["literal", ["alpine_hut", "wilderness_hut"]]],
        ],
      ],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14.4, 10.5, 16, 12.5],
        "text-anchor": "top",
        "text-offset": [0, 1.15],
        "text-max-width": 9,
        "text-padding": 4,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f3e6cd",
        "text-halo-color": "#05090f",
        "text-halo-width": 1.6,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.4, 0, 15, 1],
      },
    },
  ],
};


