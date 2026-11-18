import type { StyleSpecification } from "maplibre-gl";
import { DEM_ATTRIBUTION, DEM_MAX_ZOOM, DEM_SCHEME, DEM_TILE_SIZE } from "./dem";

/**
 * Terrane's basemap. A "deep water" palette rather than a flat black one:
 * ocean reads blue, land reads mossy, boundaries and roads sit a step above
 * both — so the globe has shape at world zoom and detail when you fly in.
 * Vector tiles: OpenFreeMap (no key, OSM data). Terrain: AWS Terrarium.
 */
export const FIRST_SYMBOL_LAYER = "label-country";

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
    // would otherwise be the space-coloured background. One polygon for the
    // whole planet sits under the water layers and gives land its own colour.
    world: {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-180, -85],
              [180, -85],
              [180, 85],
              [-180, 85],
              [-180, -85],
            ],
          ],
        },
      },
    },
    /* The DEM belongs in the style, not in a runtime addSource. A static layer
       that references a source added later makes MapLibre reject the ENTIRE
       style — blank map, getStyle() undefined. That is what broke the earlier
       attempts to declare hillshade statically: the layer was fine, the missing
       source was not. */
    relief: { ...TERRAIN_SOURCE, tiles: [...TERRAIN_SOURCE.tiles] },
    /* Marked hiking routes, as a transparent raster overlay: OSM `route=hiking`
       relations rendered by Waymarked Trails, coloured by difficulty with their
       route shields. The OpenMapTiles schema carries paths but not the routes
       themselves, so this is the keyless way to get real trails on the map. */
    trails: {
      type: "raster",
      tiles: ["https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Trails: © <a href="https://waymarkedtrails.org">Waymarked Trails</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
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
      paint: { "fill-color": "#1c3b2c" },
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
        "fill-color": "#4a5330",
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
      id: "landcover-ice",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      // Sea ice and ice caps: bright, so the poles read as snow rather than water.
      // Close in, glaciers have to stop being white paper and let the hillshade
      // through, or every icefield reads as a flat cut-out on the mountainside.
      paint: {
        "fill-color": "#b9d2dd",
        // Close in, an icefield has to stay a translucent snowfield: at 0.44 the
        // glaciers in an alpine view cover most of the frame with pale grey and
        // the whole map reads as washed out. Let the shaded rock show through.
        // Keeps fading at the closest zooms too: a 0.22 sheet over a whole
        // glacier basin is what turns the last zoom levels into a pale haze and
        // buries the hillshade underneath it.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.72,
          8,
          0.5,
          12,
          0.22,
          14,
          0.13,
        ],
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
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 9, 0.42, 12, 0.26],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: {
        "fill-color": "#082437",
        "fill-outline-color": "#2c6d8a",
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 14, 1.6],
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 16, 1.8],
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 14, 2.6],
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.4, 12, 3],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0, 4.9, 1],
      },
    },
    {
      id: "trails-hiking",
      type: "raster",
      source: "trails",
      /* Trails only mean something once you are near the ground: from world view
         the route lines are a web of colour across whole ranges. Dense areas
         (the Dolomites carry dozens of marked routes per screen) are why the ramp
         is deliberately faint while a whole range is in frame — the overlay has
         to stay behind the relief until the camera is close enough that you are
         looking at one valley, then it can lead. */
      minzoom: 10.2,
      paint: {
        "raster-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10.2,
          0,
          11.8,
          0.42,
          13.2,
          0.8,
        ],
        "raster-resampling": "linear",
        "raster-fade-duration": 250,
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
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 11, 12, 14, 13],
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
  ],
};


