import { useEffect, useRef, useState } from "react";
import { Map as MlMap } from "maplibre-gl";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  HillshadeLayerSpecification,
  LayerSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle, FIRST_SYMBOL_LAYER } from "./style";
import { addCampIcons } from "./campIcon";
import { installDemProtocol } from "./dem";
import { worldZoom } from "./camera";
import { createContours, type ContourHandle } from "./contours";
import { DEFAULT_LAYERS, type LayerState } from "../components/LayerControl";
import type { Place } from "../data/places";

/* The hillshade's look, kept in one named place, because these values are the
   whole difference between a physical landscape and a flat grey sheet.

   Four lights, in one pass. `multidirectional` (MapLibre 5.5+) shades the same
   DEM from several directions at once, and that is the fix for the blind spot a
   single light cannot avoid: with the conventional 315° key light, every ridge
   running roughly northwest–southeast is lit head-on and disappears, and every
   hollow parallel to the light goes black. Stacking separate hillshade layers at
   different directions was the old way to fake this, and it drew the DEM once per
   layer; `multidirectional` is one layer and one draw with four lights in it.

   Each light carries its own highlight and shadow colour, and index `i` in those
   arrays belongs to index `i` of the direction and altitude arrays. 315° at 45°
   altitude is the key light — the northwest sun the eye expects — so it gets the
   brightest highlight and the deepest shadow. The other three sit lower and
   dimmer: they exist to fill the faces the key light misses, not to compete with
   it, and four equally weighted lights is what turns relief into grey noise.

   `hillshade-exaggeration` and `hillshade-accent-color` are deliberately absent:
   the style spec applies both to `standard` only, and a paint value the renderer
   ignores silently is exactly the kind of lie this file spent a revision
   unlearning. Vertical scale belongs to the terrain mesh now — see `addTerrain`
   in the bootstrap below — which is the honest place for it.

   Why the shading holds up at depth instead of collapsing: MapLibre computes
   slope per DEM texel against the tile ID's zoom, so an overzoomed tile has its
   slopes multiplied by 2^(camera − tile). The DEM protocol (see ./dem.ts)
   answers every requested zoom with a real 512 px tile, so there is no overscale
   factor to fight and the shading keeps its density all the way in.

   The light is anchored to the map, not the viewport, so pitching the camera
   does not swing shadows across the ridges, and the tones are deep greens rather
   than pale ones so lit slopes keep the ground colour instead of fogging to grey. */
const HILLSHADE_PAINT: HillshadeLayerSpecification["paint"] = {
  "hillshade-method": "multidirectional",
  "hillshade-illumination-anchor": "map",
  // Northwest key light first, then the three fills: northeast, southwest,
  // southeast. The pairs opposite each other are what put a lit face on every
  // aspect, so a valley reads as a valley whichever way it runs.
  "hillshade-illumination-direction": [315, 45, 225, 135],
  // The key light high in the sky, the fills lower: a key light near the horizon
  // throws long black shadows behind every ridge once the camera tilts.
  "hillshade-illumination-altitude": [45, 30, 45, 30],
  // Warm-ish greens, brightest on the key light. Snow is drawn ABOVE this layer
  // (`relief-snow`), so these no longer have to lift to white at high zoom.
  "hillshade-highlight-color": ["#6f8158", "#5d6e4b", "#5a6a49", "#5d6e4b"],
  // Near-black but not black: the shade sits under every land polygon, and the
  // dark end is what gives rock, forest and sand their separation.
  "hillshade-shadow-color": ["#020806", "#07120c", "#050e09", "#07120c"],
};

export interface GlobeFocus {
  lon: number;
  lat: number;
  zoom: number;
  key: number;
}

/** A clicked kit pin, as the card needs it: no lookup, no second request. */
export interface KitPick {
  id: number;
  kind: number;
  /** Card title for the kind: "Camp site", "Mountain hut", … */
  label: string;
  /** Pictogram name, for the card's art. */
  icon: string;
  name: string;
  /** Slug of the nearest atlas place, when the harvest recorded one. */
  near?: string;
  lon: number;
  lat: number;
  tier: number;
  detail: boolean;
}

/** A clicked dot from the long tail of places (peaks, lakes, parks worldwide). */
export interface ReachPick {
  id: number;
  kind: number;
  /** "Peak", "Lake", "Canyon", … */
  label: string;
  name: string;
  near?: string;
  lon: number;
  lat: number;
  tier: number;
  /** True when the dot came from reach-more.json (tiers 3–4). */
  more: boolean;
}

interface Props {
  places: Place[];
  selected: string | null;
  onSelect: (slug: string) => void;
  kitPick?: KitPick | null;
  onPickKit?: (pick: KitPick | null) => void;
  reachPick?: ReachPick | null;
  onPickReach?: (pick: ReachPick | null) => void;
  focus?: GlobeFocus | null;
  layers?: LayerState;
}

/* Which layers answer to which switch.

   Grouped by what a person is looking at, not by what the style happens to call
   them. The old split had one "Roads & borders" switch that also owned landcover
   and water — turn it off and the ocean vanished with the roads, which reads as a
   broken map rather than as a hidden layer.

   Two consequences worth keeping:
   - **The base is not a switch.** Land cover and water are always drawn; there is
     no state in which the globe is better off without them.
   - **A place owns its labels.** Toggling markers off used to leave the peak names
     floating over nothing, because those labels lived with the map labels. */
const LAYER_GROUPS: Record<keyof LayerState, string[]> = {
  relief: ["relief-hillshade", "relief-snow"],
  contours: ["contours-minor", "contours-major"],
  trails: ["trails-casing", "trails-path", "trails-label"],
  roads: ["road-casing", "road-minor", "road-major", "road-highway"],
  borders: ["boundary-country", "boundary-state"],
  labels: ["label-country", "label-state", "label-city", "water-label"],
  /* The kit layers do not exist until `kit.json` lands (see ensureKit), and
     applyVisibility skips ids the map does not have, so this list is safe to
     declare up front. */
  camp: ["kit-pins-0", "kit-pins-1", "kit-pins-2", "kit-pins-3", "kit-names-0", "kit-names-1"],
  /* Same deal as the kit: these arrive after the first frame. */
  poi: [
    "poi-camp",
    "poi-hut",
    "poi-shelter",
    "poi-water",
    "poi-view",
    "poi-picnic",
    "poi-pass",
    "poi-names",
  ],
  reach: [
    "reach-dots-1",
    "reach-dots-2",
    "reach-dots-3",
    "reach-dots-4",
    "reach-names",
    "reach-names-more",
  ],
  places: [
    "places-heat",
    "places-halo",
    "places-dot",
    "places-curated",
    "places-selected",
    "places-label-top",
    "places-label",
  ],
};

function applyVisibility(map_: MlMap, layers: LayerState) {
  for (const key of Object.keys(LAYER_GROUPS) as (keyof LayerState)[]) {
    if (key === "contours") continue; // owned by the contour controller
    const visibility = layers[key] ? "visible" : "none";
    for (const id of LAYER_GROUPS[key]) {
      if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visibility);
    }
  }
}

const TYPE_COLOR = [
  "match",
  ["get", "type"],
  "peak",
  "#eaf7ff",
  "park",
  "#57f0b2",
  "landmark",
  "#ffc766",
  "gem",
  "#c99bff",
  "#57f0b2",
] as unknown as ExpressionSpecification;

const DOT_LAYERS = ["places-halo", "places-dot", "places-curated"];

type PlacesGeoJSON = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
      slug: string;
      name: string;
      type: string;
      curated: number;
      tier: number;
    };
  }[];
};

/* Rebuilding 1,288 GeoJSON features is only worth doing when the filter
   actually changes; React hands us the same array on every selection render, so
   the last result is cached against it. */
const geoCache = new WeakMap<Place[], PlacesGeoJSON>();

/** Camera tilt for a given zoom: level at planet scale, oblique over ranges. */
function pitchForZoom(zoom: number) {
  // Up to 75°, not 55: with a terrain mesh the steep angle is the view that
  // actually shows height — at 55 a range still reads mostly as its footprint.
  return Math.max(0, Math.min(75, (zoom - 1.9) * 13));
}

/** Where a clicked place lands: close enough to read the terrain around it. */
const PLACE_FOCUS_ZOOM = 14.2;

function toGeoJSON(places: Place[]): PlacesGeoJSON {
  const hit = geoCache.get(places);
  if (hit) return hit;
  const fc: PlacesGeoJSON = {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] as [number, number] },
      properties: {
        slug: p.slug,
        name: p.name,
        type: p.type,
        curated: p.curated ? 1 : 0,
        // 1 = the eight headline places, 2 = other curated, 3 = atlas rows.
        // Labels stagger by tier so the globe doesn't explain itself at once.
        tier: p.featured ? 1 : p.curated ? 2 : 3,
      },
    })),
  };
  geoCache.set(places, fc);
  return fc;
}

export default function Globe({
  places,
  selected,
  onSelect,
  kitPick,
  onPickKit,
  reachPick,
  onPickReach,
  focus,
  layers = DEFAULT_LAYERS,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const contours = useRef<ContourHandle | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const map = useRef<MlMap | null>(null);
  const selectRef = useRef(onSelect);
  const kitPickRef = useRef(onPickKit);
  const reachPickRef = useRef(onPickReach);
  const reachApi = useRef<typeof import("./reach") | null>(null);
  const poiApi = useRef<typeof import("./poi") | null>(null);
  /* The kit's module, kept once it has loaded: a click needs KIT_KIND_LABEL,
     iconForKind and nearSlug synchronously, and a static import would drag the
     72 kB dataset into the entry chunk. */
  const kitApi = useRef<typeof import("./kit") | null>(null);
  const booted = useRef(false);
  const dataRef = useRef(places);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  selectRef.current = onSelect;
  kitPickRef.current = onPickKit;
  reachPickRef.current = onPickReach;
  dataRef.current = places;

  /* ── init once ─────────────────────────────────────── */
  useEffect(() => {
    if (!holder.current) return;

    /* The DEM tiles are served through a custom protocol, so it has to be
       registered before the style that references it is parsed. */
    installDemProtocol();

    const map_ = new MlMap({
      container: holder.current,
      style: createStyle(),
      center: [12, 22],
      zoom: worldZoom(
        holder.current.clientWidth,
        holder.current.clientHeight,
      ),
      minZoom: 0.4,
      /* Deeper than the tile schema's own z14: past that the vector tiles
         overzoom, which keeps existing paths on screen and simply draws them
         larger. That is the point — at a summit you want the footpath network
         legible, not more data than the source has. */
      maxZoom: 16,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      /* 75°, not 60. Beyond ~75 the horizon fills with sky and the far half of
         the viewport is haze, so this is the deepest useful tilt rather than an
         arbitrary limit. */
      maxPitch: 75,

      /* Zooming is a tile-loading problem before it is anything else. These four
         settings are what stop the map flashing bare land as you go in:
         - fadeDuration: newly arrived tiles cross-fade instead of snapping in.
         - refreshExpiredTiles:false: never re-request a tile we already have
           (OSM tiles carry a short expiry; refetching them mid-zoom is what
           puts holes in a range you are descending into).
         - maxTileCacheSize: keep several zoom levels resident, so pulling back
           out and diving again costs nothing.
         - renderWorldCopies:false: a globe never needs the world twice, and the
           duplicate copies were extra tiles in flight. */
      /* MSAA stays on: `antialias: false` was measured at z11 and bought nothing
         (1.8–1.9 fps against 1.6–1.8), because what costs there is DEM tiles, not
         the multisample resolve. Worth knowing before anyone tries it again. */
      fadeDuration: 180,
      refreshExpiredTiles: false,
      /* A deliberate cap rather than MapLibre's dynamic sizing, so the DEM
         tiles' GPU memory is bounded. Measured: 48 and 128 gave the same zoom
         frame rate and no background pixels either way, so the smaller bound
         it is — cache retention was not what made zooms feel heavy. */
      maxTileCacheSize: 48,
      renderWorldCopies: false,
      /* The hillshade is a full-screen fragment shader, so its cost is pixel
         count, and a 3x retina phone asks for nine times the pixels of a laptop.
         Capping at 1.5 keeps the relief soft enough that the difference is not
         visible on shading, while cutting fragment work by half or more.
         Measured on the relief at z11.2, pitch 50 (same frame, three ratios):
         pr 1 → 1.9 fps, pr 1.5 → 1.0 fps, pr 2 → 0.6 fps. */
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    map.current = map_;

    if (import.meta.env.DEV) {
      (window as unknown as { __terraneMap?: MlMap }).__terraneMap = map_;
    }

    /* Relief is a hillshade AND a terrain mesh, both reading the one `relief`
       DEM source — one pyramid, two consumers, rather than the second source the
       MapLibre 3D examples carry.

       The mesh was removed once because it did nothing: it was set while the
       projection was still mercator, and terrain attached to a mercator camera
       that then becomes a globe stays flat, while the extra DEM tiles and the
       per-gesture re-tessellation were paid for anyway. MapLibre 5 does draw
       terrain on the globe (support landed in 5.0), so the fix is the order:
       projection first, then the mesh.

       Everything here is added as soon as the style lands, not on the 2.5 s
       timer this used to use — that timer meant the planet was flat for the
       first seconds of every visit, which is exactly the moment relief matters. */
    /* The 3D mesh. `exaggeration` is a plain number on purpose: MapLibre 5's
       TerrainSpecification takes a number, not a zoom expression, so a
       zoom-dependent dial has to be re-set per zoom rather than declared here.
       1.25 is enough that a range reads as height at regional zoom without
       spiking the national LiDAR levels, where the DEM is already detailed and
       scaling it up further turns a footpath into a wall. */
    const addTerrain = () => {
      if (map_.getTerrain()) return;
      try {
        map_.setTerrain({ source: "relief", exaggeration: 1.25 });
      } catch {
        /* terrain unavailable */
      }
    };

    const addHillshade = () => {
      if (map_.getLayer("relief-hillshade")) return;
      try {
        map_.addLayer(
          {
            id: "relief-hillshade",
            type: "hillshade",
            source: "relief",
            paint: HILLSHADE_PAINT,
          },
          // Directly under the water, which puts it ABOVE every land polygon.
          //
          // That is the whole point: a fill drawn over the shade is flat, and a
          // flat patch with a hard edge is what made rock, sand and built-up areas
          // look pasted onto the map while forest and grass looked embedded. With
          // everything underneath, every polygon gets the same shading, so its
          // boundary is a tone change rather than an edge — which is how sand and
          // rock were always meant to behave.
          map_.getLayer("water") ? "water" : FIRST_SYMBOL_LAYER,
        );
        /* Snow by elevation, from the same DEM the hillshade is reading.

           The OSM ice polygons were the only snow available before, and past
           z13 they read as what they are: flat shapes with straight-ish edges
           laid over the terrain, which is why snow never sat in the landscape
           the way sand and rock do. A `color-relief` layer colours the DEM's own
           pixels instead, so the snowline follows the terrain and the shading
           passes through it — no polygon edges to see at any zoom.

           It is inserted just ABOVE the hillshade — below it the lit colour of the
           shade (a green) tints every snowfield sage, which is what the first
           attempt at this looked like. Above it the fill stays white and the peak
           alpha stays under 0.75 so the shading still reads through. The ramp is
           transparent below ~2100 m: this is a summit treatment, not a global
           whitening. One more DEM pass over the viewport at trail zooms. */
        if (!map_.getLayer("relief-snow")) {
          map_.addLayer(
            {
              id: "relief-snow",
              type: "color-relief",
              source: "relief",
              minzoom: 10.5,
              paint: {
                "color-relief-opacity": 1,
                resampling: "linear",
                "color-relief-color": [
                  "interpolate",
                  ["linear"],
                  ["elevation"],
                  // A long, shallow ramp on purpose. A short one puts a hard
                  // edge at one elevation: the snow then reads as a white shape
                  // pasted on the mountain, because that is what a step function
                  // looks like from above. Spread over 2.6 km of altitude the
                  // boundary is a haze that thickens upward, which is how snow
                  // actually arrives on a face.
                  2800,
                  "rgba(228, 238, 241, 0)",
                  3200,
                  "rgba(231, 240, 243, 0.08)",
                  3600,
                  "rgba(236, 244, 247, 0.22)",
                  4000,
                  "rgba(242, 248, 250, 0.38)",
                  4600,
                  "rgba(248, 251, 252, 0.5)",
                  5200,
                  "rgba(251, 253, 253, 0.6)",
                ],
              },
            } as unknown as LayerSpecification,
            /* Same anchor as the hillshade, added after it, so the snow lands
               above the shade and below the water. */
            map_.getLayer("water") ? "water" : undefined,
          );
        }
      } catch {
        /* hillshade unavailable */
      }
    };

    const bootstrap = () => {
      if (booted.current) return;
      booted.current = true;
      setStalled(false);

      try {
        map_.setProjection({ type: "globe" });
      } catch {
        /* mercator fallback */
      }
      addTerrain();
      addHillshade();
      /* The camping pictograms: tents, huts, shelters, water, parking. Drawn into
         canvases here rather than fetched as a sprite sheet, and needed by the
         camp-* layers in the style. */
      addCampIcons(map_);

      try {
        map_.setSky({
          "sky-color": "#02040a",
          "horizon-color": "#1d6f92",
          "fog-color": "#0a2434",
          "sky-horizon-blend": 0.72,
          "horizon-fog-blend": 0.42,
          "fog-ground-blend": 0.22,
          "atmosphere-blend": 0.45,
        });
      } catch {
        /* sky unsupported */
      }

      contours.current = createContours(map_);
      contours.current.setEnabled(layersRef.current.contours);
      applyVisibility(map_, layersRef.current);

      /* Deferred, not awaited: the kit is 6,000 features of JSON and the map is
         already usable without it. */
      const idle = window.requestIdleCallback?.(ensureKit, { timeout: 2500 });
      if (!idle) window.setTimeout(ensureKit, 1200);
      /* World POIs: campsites, huts, shelters, water and viewpoints everywhere,
         one file per z6 cell, fetched as the camera looks at them. Also idle. */
      const idlePoi = window.requestIdleCallback?.(ensurePoi, { timeout: 3500 });
      if (!idlePoi) window.setTimeout(ensurePoi, 2000);
      /* The famous half of the long tail — a few thousand peaks, lakes, parks and
         waterfalls — also waits for idle. It is dots and circles; no file. */
      const idleReach = window.requestIdleCallback?.(ensureReach, { timeout: 3000 });
      if (!idleReach) window.setTimeout(ensureReach, 1600);

      map_.addSource("places", { type: "geojson", data: toGeoJSON(dataRef.current) });
      map_.addSource("selected", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      /* Density wash. At world scale the individual points are switched off and
         these soft, blurred discs pile up wherever places are concentrated —
         a hint of where the world is busy, without a wall of dots. */
      map_.addLayer({
        id: "places-heat",
        type: "circle",
        source: "places",
        // Faded to nothing by ~4.6. Stopping the layer there keeps 1,288 blurred
        // circles out of the per-frame work once you are over a range.
        maxzoom: 4.7,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            7,
            2,
            13,
            4,
            22,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.05,
            2.4,
            0.045,
            3.6,
            0.02,
            4.6,
            0,
          ],
          "circle-blur": 1,
        },
      });

      map_.addLayer({
        id: "places-halo",
        type: "circle",
        source: "places",
        // Blurred circles are the most expensive thing on screen at depth; past
        // z9.5 the dots and labels carry it alone.
        maxzoom: 9.5,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            3,
            4,
            6,
            8,
            11,
            14,
            17,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.1,
            4,
            0.2,
            9,
            0.16,
          ],
          "circle-blur": 1,
        },
      });

      map_.addLayer({
        id: "places-dot",
        type: "circle",
        source: "places",
        // Atlas rows fade in from ~2.2 rather than appearing all at once; below
        // that the density wash and the curated rings do the talking.
        minzoom: 2.2,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1.3,
            4,
            2.5,
            8,
            3.7,
            14,
            5,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.2,
            0,
            3.4,
            0.95,
          ],
        },
      });

      /* Curated places get a fine white ring, so the written-up set stays
         findable at every zoom — including world view, where the dots are off. */
      map_.addLayer({
        id: "places-curated",
        type: "circle",
        source: "places",
        filter: ["==", ["get", "curated"], 1],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            2.6,
            4,
            4.4,
            8,
            5.8,
          ],
          "circle-color": "transparent",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.9,
          "circle-stroke-opacity": 0.6,
        },
      });

      map_.addLayer({
        id: "places-selected",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 6, 13],
          "circle-color": "transparent",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 0.85,
        },
      });

      map_.addLayer({
        id: "places-label-top",
        type: "symbol",
        source: "places",
        minzoom: 1.2,
        filter: ["==", ["get", "tier"], 1],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3.2, 9, 8, 11],
          "text-offset": [0, 0.95],
          "text-anchor": "top",
          "text-padding": 5,
          "text-optional": true,
          "text-max-width": 9,
        },
        paint: {
          "text-color": "#d7e7f5",
          "text-halo-color": "#04070c",
          "text-halo-width": 1.5,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.2,
            0,
            2.1,
            0.9,
          ],
        },
      });

      // Second label pass: the rest of the curated set, later and quieter.
      map_.addLayer({
        id: "places-label",
        type: "symbol",
        source: "places",
        minzoom: 3.8,
        // Curated, but NOT tier 1 — those are already labelled by the layer above.
        // Without the exclusion every featured place got two identical labels at
        // the same offset from z3.8 on, and the two fought for placement frame by
        // frame: text flickering in and out over the Alps.
        filter: [
          "all",
          ["==", ["get", "curated"], 1],
          ["!=", ["get", "tier"], 1],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4.2, 10, 9, 12],
          "text-offset": [0, 0.95],
          "text-anchor": "top",
          "text-padding": 5,
          "text-optional": true,
          "text-max-width": 9,
        },
        paint: {
          "text-color": "#c8dced",
          "text-halo-color": "#04070c",
          "text-halo-width": 1.6,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3.8,
            0,
            4.7,
            0.85,
          ],
        },
      });

      const pickLayers = DOT_LAYERS.filter((id) => map_.getLayer(id));
      const pick = (x: number, y: number): MapGeoJSONFeature | undefined => {
        const r = 9;
        const hits = map_.queryRenderedFeatures(
          [
            [x - r, y - r],
            [x + r, y + r],
          ],
          { layers: pickLayers },
        );
        return hits[0];
      };

      /* Kit pins are hit-tested after the atlas dots: where a camp sits on top of
         a written-up summit, the summit is still what the click meant. */
      const kitLayerIds = () =>
        ["kit-pins-0", "kit-pins-1", "kit-pins-2", "kit-pins-3"].filter((id) =>
          map_.getLayer(id),
        );

      const pickKit = (x: number, y: number): MapGeoJSONFeature | undefined => {
        const layers = kitLayerIds();
        if (!layers.length) return undefined;
        const r = 10;
        return map_.queryRenderedFeatures(
          [
            [x - r, y - r],
            [x + r, y + r],
          ],
          { layers },
        )[0];
      };

      const toKitPick = (hit: MapGeoJSONFeature): KitPick => {
        const api = kitApi.current;
        const props = hit.properties as { k?: number; t?: number; n?: string; near?: number };
        const kind = Number(props.k ?? 0);
        const [lon, lat] = (hit.geometry as unknown as { coordinates: [number, number] })
          .coordinates;
        return {
          id: Number(hit.id ?? -1),
          kind,
          label: api?.KIT_KIND_LABEL[kind] ?? "Camp site",
          icon: api?.iconForKind(kind) ?? "camp-tent",
          name: String(props.n ?? ""),
          near: api?.nearSlug(props.near),
          lon,
          lat,
          tier: Number(props.t ?? 0),
          detail: hit.layer?.id === "kit-pins-3",
        };
      };

      /* Order of intent: an atlas dot (it has a page), then a camp pin (it is
         what you plan around), then a dot from the long tail. */
      const reachLayerIds = () =>
        ["reach-dots-1", "reach-dots-2", "reach-dots-3", "reach-dots-4"].filter((id) =>
          map_.getLayer(id),
        );

      const poiLayerIds = () =>
        [
          "poi-camp",
          "poi-hut",
          "poi-shelter",
          "poi-water",
          "poi-view",
          "poi-picnic",
          "poi-pass",
        ].filter((id) => map_.getLayer(id));

      const pickPoi = (x: number, y: number): MapGeoJSONFeature | undefined => {
        const layers = poiLayerIds();
        if (!layers.length) return undefined;
        const r = 10;
        return map_.queryRenderedFeatures(
          [
            [x - r, y - r],
            [x + r, y + r],
          ],
          { layers },
        )[0];
      };

      const toPoiPick = (hit: MapGeoJSONFeature): KitPick => {
        const api = poiApi.current;
        const props = hit.properties as { k?: number; n?: string };
        const kind = Number(props.k ?? 0);
        const [lon, lat] = (hit.geometry as unknown as { coordinates: [number, number] })
          .coordinates;
        return {
          id: -1,
          kind,
          label: api?.POI_KIND_LABEL[kind] ?? "POI",
          icon: api?.poiIconForKind(kind) ?? "camp-tent",
          name: String(props.n ?? ""),
          lon,
          lat,
          tier: 0,
          detail: false,
        };
      };

      const pickReach = (x: number, y: number): MapGeoJSONFeature | undefined => {
        const layers = reachLayerIds();
        if (!layers.length) return undefined;
        const r = 8;
        return map_.queryRenderedFeatures(
          [
            [x - r, y - r],
            [x + r, y + r],
          ],
          { layers },
        )[0];
      };

      const toReachPick = (hit: MapGeoJSONFeature): ReachPick => {
        const api = reachApi.current;
        const props = hit.properties as { k?: number; t?: number; n?: string; near?: number };
        const kind = Number(props.k ?? 0);
        const more = hit.layer?.id === "reach-dots-3" || hit.layer?.id === "reach-dots-4";
        const [lon, lat] = (hit.geometry as unknown as { coordinates: [number, number] })
          .coordinates;
        return {
          id: Number(hit.id ?? -1),
          kind,
          label: api?.REACH_KIND_LABEL[kind] ?? "Place",
          name: String(props.n ?? ""),
          near: api?.nearSlug(props.near, more),
          lon,
          lat,
          tier: Number(props.t ?? 0),
          more,
        };
      };

      map_.on("click", (e) => {
        const hit = pick(e.point.x, e.point.y);
        if (hit?.properties?.slug) {
          selectRef.current(hit.properties.slug);
          kitPickRef.current?.(null);
          reachPickRef.current?.(null);
          return;
        }
        const kitHit = pickKit(e.point.x, e.point.y);
        if (kitHit) {
          reachPickRef.current?.(null);
          kitPickRef.current?.(toKitPick(kitHit));
          return;
        }
        const poiHit = pickPoi(e.point.x, e.point.y);
        if (poiHit) {
          reachPickRef.current?.(null);
          kitPickRef.current?.(toPoiPick(poiHit));
          return;
        }
        const reachHit = pickReach(e.point.x, e.point.y);
        if (reachHit) {
          kitPickRef.current?.(null);
          reachPickRef.current?.(toReachPick(reachHit));
        }
      });

      /* Hit-testing is a spatial query over three layers and 1,288 features.
         Doing it on every pointer event means ~60 queries a second competing with
         tile loading — and during a wheel zoom the pointer never stops moving, so
         it ran through the whole gesture. Skip it while the camera is moving, and
         throttle the rest. */
      let lastPick = 0;
      let hovering = false;
      map_.on("mousemove", (e) => {
        if (map_.isMoving()) return;
        const now = performance.now();
        if (now - lastPick < 60) return;
        lastPick = now;
        const on =
          Boolean(pick(e.point.x, e.point.y)) ||
          Boolean(pickKit(e.point.x, e.point.y)) ||
          Boolean(pickPoi(e.point.x, e.point.y)) ||
          Boolean(pickReach(e.point.x, e.point.y));
        if (on !== hovering) {
          hovering = on;
          map_.getCanvas().style.cursor = on ? "pointer" : "";
        }
      });

      setReady(true);
    };

    map_.on("style.load", bootstrap);
    map_.on("load", bootstrap);
    const t = window.setTimeout(() => {
      if (map_.isStyleLoaded()) bootstrap();
    }, 2500);

    /* The hillshade is the only layer added at runtime that the style itself
       does not declare, so it is also the only one a style rebuild can drop.
       Put it back if it ever goes missing. */
    const ensureRelief = () => {
      if (booted.current && map_.isStyleLoaded()) {
        // A style rebuild drops terrain as well as the runtime layers.
        addTerrain();
        addHillshade();
        addCampIcons(map_);
        ensureKit();
        ensurePoi();
        ensureReach();
      }
    };
    /* The kit: ~6,000 harvested camps, huts, shelters, water points, parking
       spots and picnic tables, in its own chunk so the globe paints first. It is
       the one thing on this map that can wait — the hillshade and the atlas dots
       are what make the first frame. Inserted under the map labels so the place
       names stay on top of it. */
    /* Where the kit sits in the stack: above the basemap's own labels (city,
       trail, water names) and below the atlas places. Inserting it under
       `label-country` — the first version — put every camp name at the bottom of
       the symbol stack, where MapLibre's collision pass had already claimed the
       space, so the labels were drawn but never shown. */
    const kitSlot = () =>
      map_.getLayer("places-heat") ? "places-heat" : undefined;

    const ensureKit = () => {
      /* `isStyleLoaded()` flickers false while tiles stream in, and the first
         version of this guard made the whole kit a no-op whenever the idle
         callback landed on such a frame. `getStyle()` is the stable question:
         does the map have a style at all? */
      if (!booted.current || !map_.getStyle() || map_.getSource("kit")) return;
      void import("./kit").then((mod) => {
        if (!booted.current) return;
        kitApi.current = mod;
        const { addKit, KIT_LAYERS: ids } = mod;
        addKit(map_, kitSlot());
        const visible = layersRef.current.camp ? "visible" : "none";
        for (const id of ids) {
          if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visible);
        }
        ensureKitDetail();
      });
    };

    /* Tier 3 — 2,781 water taps, car parks and picnic tables — is a second file
       and a second decision: fetch it the first time the camera goes past z13.8,
       not before. Most visits never ask for it. */
    const ensureKitDetail = () => {
      if (!booted.current || !map_.getStyle()) return;
      if (map_.getZoom() < 13.8 || map_.getSource("kit-detail")) return;
      void import("./kit").then(({ addKitDetail, KIT_DETAIL_LAYERS: ids }) =>
        addKitDetail(map_, kitSlot()).then(() => {
          const visible = layersRef.current.camp ? "visible" : "none";
          for (const id of ids) {
            if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visible);
          }
        }),
      );
    };

    /* The tail: ~20,000 more places, a file of its own. Fetched the first time
       the camera passes z7.2 — the zoom where these tiers start appearing — so a
       visit that never leaves the world view never downloads it. */
    const ensureReachMore = () => {
      if (!booted.current || !map_.getStyle()) return;
      if (map_.getZoom() < 7.2 || map_.getSource("reach-more")) return;
      if (!map_.getSource("reach")) return;
      void import("./reach").then((mod) =>
        mod.addReachMore(map_, kitSlot()).then(() => {
          const visible = layersRef.current.reach ? "visible" : "none";
          for (const id of mod.REACH_MORE_LAYERS) {
            if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visible);
          }
        }),
      );
    };

    const ensurePoi = () => {
      if (!booted.current || !map_.getStyle() || map_.getSource("poi")) return;
      void import("./poi").then((mod) => {
        if (!booted.current) return;
        poiApi.current = mod;
        mod.addPoi(map_, kitSlot());
        const visible = layersRef.current.poi ? "visible" : "none";
        for (const id of mod.POI_LAYERS) {
          if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visible);
        }
        /* Cells follow the camera, not the clock: one check per settled move, and
           a no-op unless something new is in view. */
        map_.on("moveend", () => mod.refreshPoi(map_));
        mod.refreshPoi(map_);
      });
    };

    const ensureReach = () => {
      if (!booted.current || !map_.getStyle() || map_.getSource("reach")) return;
      void import("./reach").then((mod) => {
        if (!booted.current) return;
        reachApi.current = mod;
        mod.addReach(map_, kitSlot());
        const visible = layersRef.current.reach ? "visible" : "none";
        for (const id of mod.REACH_LAYERS) {
          if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visible);
        }
        ensureReachMore();
      });
    };

    map_.on("zoomend", ensureKitDetail);
    map_.on("zoomend", ensureReachMore);
    map_.on("styledata", ensureRelief);

    /* If the style never arrives, the usual cause is a page opened straight off
       disk: browsers block MapLibre's blob workers on file:// origins. Say so
       rather than leaving a black rectangle. */
    const guard = window.setTimeout(() => {
      if (!booted.current) setStalled(true);
    }, 8000);

    map_.on("error", (e) => {
      if (import.meta.env.DEV) console.error("[terrane] map error", e?.error);
    });

    const ro = new ResizeObserver(() => map_.resize());
    if (holder.current) ro.observe(holder.current);

    return () => {
      ro.disconnect();
      map_.off("styledata", ensureRelief);
      window.clearTimeout(t);
      window.clearTimeout(guard);
      contours.current?.destroy();
      contours.current = null;
      booted.current = false;
      map_.remove();
      map.current = null;
      setReady(false);
    };
  }, []);

  /* ── layer switches ────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    applyVisibility(map_, layers);
    contours.current?.setEnabled(layers.contours);
  }, [layers, ready]);

  /* ── data updates (filters) ────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const src = map_.getSource("places") as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(places));
  }, [places, ready]);

  /* ── selection ─────────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const place = selected ? places.find((p) => p.slug === selected) : undefined;

    const src = map_.getSource("selected") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: place
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [place.lon, place.lat] },
              properties: {},
            },
          ]
        : [],
    });

    if (!place) return;
    /* Clicking a place is a request to see the place, not the region around it,
       so the camera goes all the way down to terrain detail (z13.2) rather than
       stopping at a regional view where the summit is a dot in a green field.
       Already deeper than that? Stay where the reader put the camera. */
    const zoom = Math.max(map_.getZoom(), PLACE_FOCUS_ZOOM);
    map_.flyTo({
      center: [place.lon, place.lat],
      zoom,
      pitch: pitchForZoom(zoom),
      speed: 0.7,
      curve: 1.5,
      essential: true,
      padding:
        window.innerWidth > 900 ? { right: 380, bottom: 40 } : { bottom: 300 },
    });
  }, [selected, ready, places]);

  /* A picked kit pin gets the same treatment as a place: a ring on the spot and
     a camera that closes in far enough to read the ground around it. The ring
     lives in its own source so this costs one feature, not 3,232. */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const src = map_.getSource("kit-pick") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: kitPick
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [kitPick.lon, kitPick.lat] },
              properties: {},
            },
          ]
        : [],
    });

    if (!kitPick) return;
    /* z15 is the "I can see the clearing" zoom: a tent icon becomes a place with
       a track to it. Deeper stays put, same rule as clicking a place. */
    const zoom = Math.max(map_.getZoom(), 15);
    map_.flyTo({
      center: [kitPick.lon, kitPick.lat],
      zoom,
      pitch: pitchForZoom(zoom),
      speed: 0.8,
      curve: 1.4,
      essential: true,
      padding:
        window.innerWidth > 900 ? { right: 380, bottom: 40 } : { bottom: 300 },
    });
  }, [kitPick, ready]);

  /* A tail place behaves like a camp pin: ring on the spot, camera down to
     terrain detail. z12.6 is enough to see what kind of thing it is — a lake's
     shape, a summit's ridge — without pretending there is a page to read. */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const src = map_.getSource("reach-pick") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: reachPick
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [reachPick.lon, reachPick.lat] },
              properties: {},
            },
          ]
        : [],
    });

    if (!reachPick) return;
    const zoom = Math.max(map_.getZoom(), 12.6);
    map_.flyTo({
      center: [reachPick.lon, reachPick.lat],
      zoom,
      pitch: pitchForZoom(zoom),
      speed: 0.8,
      curve: 1.4,
      essential: true,
      padding:
        window.innerWidth > 900 ? { right: 380, bottom: 40 } : { bottom: 300 },
    });
  }, [reachPick, ready]);

  /* ── camera travel: pitch follows zoom ───────────────
     Far out you look straight at the globe; as you close on a range the camera
     tilts so ridges and valleys read as relief instead of paint. Automatic
     until the moment you pitch the camera yourself, then it hands over. */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    let userPitched = false;

    const onPitchStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userPitched = true;
    };

    /* Tilt is applied when the camera comes to rest, not while it moves.

       Doing it on every zoom frame re-project the camera mid-gesture: the tile
       cover changes under the finger, tiles for the new tilt start loading and
       the ones on screen get thrown away, so a zoom went blank exactly when the
       reader was watching. Rest-to-rest, the pitch follows the zoom without any
       of that.

       Never touch the camera while MapLibre is animating a flight — a setPitch
       mid-flight cancels it. */
    const applyPitch = () => {
      if (userPitched || map_.isEasing() || map_.isMoving()) return;
      const target = pitchForZoom(map_.getZoom());
      if (Math.abs(map_.getPitch() - target) > 1.2) map_.setPitch(target);
    };

    const onMoveEnd = () => {
      applyPitch();
    };

    /* Warm the HTTP cache for the level you are zooming into.

       MapLibre 5 has no tile prefetching (the old prefetchZoomDelta is gone), so
       every zoom step is a cold request for a whole new pyramid — that pause is
       the "unsmooth" part. While a gesture is running we fetch the tiles the next
       integer zoom will need, so MapLibre's own request is a cache hit. Capped at
       eight tiles every 700 ms so a long drag can't turn into a download. */
    let template: string | undefined;
    let lastPrefetch = 0;
    const prefetch = () => {
      const now = performance.now();
      if (now - lastPrefetch < 700) return;
      lastPrefetch = now;

      /* The template comes from the loaded source and is cached: this runs on
         every zoom event, and asking the source directly avoids building a
         serialized copy of the whole style each time, which is what
         `getStyle()` does. */
      if (!template) {
        const src = map_.getSource("openmaptiles") as unknown as {
          tiles?: string[];
        };
        const first = src?.tiles?.[0];
        if (!first?.includes("{z}")) return;
        template = first;
      }

      const z = Math.min(13, Math.ceil(map_.getZoom() + 0.4));
      const n = 2 ** z;
      const b = map_.getBounds();
      const x0 = Math.floor(((b.getWest() + 180) / 360) * n);
      const x1 = Math.floor(((b.getEast() + 180) / 360) * n);
      const lat2y = (lat: number) => {
        const r = (lat * Math.PI) / 180;
        return Math.floor(
          ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
        );
      };
      const y0 = lat2y(Math.min(85, b.getNorth()));
      const y1 = lat2y(Math.max(-85, b.getSouth()));

      const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
      const tiles: [number, number][] = [];
      for (let x = x0; x <= x1 && tiles.length < 32; x += 1) {
        for (let y = y0; y <= y1 && tiles.length < 32; y += 1) {
          tiles.push([clamp(x), clamp(y)]);
        }
      }
      const step = Math.max(1, Math.ceil(tiles.length / 8));
      for (let i = 0; i < tiles.length; i += step) {
        const [x, y] = tiles[i];
        const url = template
          .replace("{z}", String(z))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        // low priority: never compete with the tiles the camera needs now.
        void fetch(url, { mode: "cors", priority: "low" }).catch(() => undefined);
      }
    };

    map_.on("pitchstart", onPitchStart);
    map_.on("zoom", prefetch);
    map_.on("moveend", onMoveEnd);

    return () => {
      map_.off("zoom", prefetch);
      map_.off("moveend", onMoveEnd);
      map_.off("pitchstart", onPitchStart);
    };
  }, [ready]);

  /* ── external focus ────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !focus || !ready) return;
    map_.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom,
      pitch: pitchForZoom(focus.zoom),
      speed: 0.75,
      curve: 1.45,
      essential: true,
    });
  }, [focus, ready]);

  return (
    <div className="globe" ref={holder} aria-label="Interactive globe">
      {stalled && (
        <p className="globe-stalled mono" role="status">
          The globe couldn’t start. Opening this file straight from disk blocks the
          map’s background workers — serve it instead, e.g.{" "}
          <code>npx serve .</code>
        </p>
      )}
    </div>
  );
}
