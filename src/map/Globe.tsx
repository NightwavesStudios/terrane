import { useEffect, useRef, useState } from "react";
import { Map as MlMap } from "maplibre-gl";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  HillshadeLayerSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle, FIRST_SYMBOL_LAYER } from "./style";
import { installDemProtocol } from "./dem";
import { worldZoom } from "./camera";
import { createContours, type ContourHandle } from "./contours";
import { DEFAULT_LAYERS, type LayerState } from "../components/LayerControl";
import type { Place } from "../data/places";

/* The hillshade's look, kept in one named place, because these values are the
   whole difference between a physical landscape and a flat grey sheet.

   `standard` (MapLibre's own curve) rather than `basic`: basic shades the true
   slope and clamps at full highlight/shadow, so a 1–5 m LiDAR DEM — which has
   plenty of near-vertical faces — turns into black valleys and blown-out pale
   plateaus at deep zoom. `standard` eases the slope through a curve whose
   intensity is the exaggeration below, which keeps the mid tones a mountain
   flank needs while still reading as a lit surface.

   Exaggeration is a real, zoom-dependent dial — and a subtle one, because
   `hillshade-exaggeration` is capped at 1 by the style spec. Asking for 1.15 or
   3.4 (as earlier revisions did) is an invalid paint value: MapLibre rejects the
   update, so the layer silently keeps whatever it had. Everything here stays in
   0…1.

   Why the curve holds up at depth instead of collapsing: MapLibre computes
   slope per DEM texel against the tile ID's zoom, so an overzoomed tile has its
   slopes multiplied by 2^(camera − tile). The DEM protocol (see ./dem.ts)
   answers every requested zoom with a real 512 px tile, so there is no overscale
   factor to fight any more and the shading keeps its density all the way in.
   A small dip at the deepest levels only stops 1–5 m LiDAR noise    from sparkling on snowfields. It stays near 0.85 because deep zoom is where
   the 30 m global model (outside national coverage) is smoothest and needs the
   most help to read as terrain.

   The light is anchored to the map, not the viewport, so pitching the camera
   does not swing shadows across the ridges, and it is a deep green rather than a
   pale tone so lit slopes keep the ground colour instead of fogging to grey. */
const HILLSHADE_PAINT: HillshadeLayerSpecification["paint"] = {
  "hillshade-method": "standard",
  "hillshade-exaggeration": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.58,
    3,
    0.72,
    6,
    0.84,
    9,
    0.9,
    11,
    0.9,
    12,
    0.88,
    13,
    0.86,
    14,
    0.88,
    16,
    0.9,
  ],
  "hillshade-illumination-anchor": "map",
  // Slightly wider range than before: relief on a dark map reads through the
  // top and bottom of the shade, not the middle, so the lit side goes warmer
  // and the shaded side goes deeper. It costs nothing — same tile, same pass.
  "hillshade-highlight-color": "#61774f",
  "hillshade-shadow-color": "#030b08",
  "hillshade-accent-color": "#05110b",
};

export interface GlobeFocus {
  lon: number;
  lat: number;
  zoom: number;
  key: number;
}

interface Props {
  places: Place[];
  selected: string | null;
  onSelect: (slug: string) => void;
  focus?: GlobeFocus | null;
  layers?: LayerState;
}

/* Which layers answer to which switch. Street-level furniture (roads, borders,
   landcover, water) travels together as "detail". */
const LAYER_GROUPS: Record<keyof LayerState, string[]> = {
  relief: ["relief-hillshade"],
  contours: ["contours-minor", "contours-major"],
  trails: ["trails-casing", "trails-path", "trails-label"],
  detail: [
    "landcover-wood",
    "landcover-grass",
    "landcover-farmland",
    "landcover-ice",
    "landcover-rock",
    "landcover-sand",
    "landuse-residential",
    "water",
    "waterway",
    "water-label",
    "boundary-country",
    "boundary-state",
    "road-casing",
    "road-minor",
    "road-major",
    "road-highway",
  ],
  labels: [
    "label-country",
    "label-state",
    "label-city",
    "places-label-top",
    "places-label",
  ],
  places: [
    "places-heat",
    "places-halo",
    "places-dot",
    "places-curated",
    "places-selected",
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
  return Math.max(0, Math.min(55, (zoom - 1.9) * 13));
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
  focus,
  layers = DEFAULT_LAYERS,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const contours = useRef<ContourHandle | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const map = useRef<MlMap | null>(null);
  const selectRef = useRef(onSelect);
  const booted = useRef(false);
  const dataRef = useRef(places);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  selectRef.current = onSelect;
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
      maxPitch: 60,

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
      fadeDuration: 180,
      refreshExpiredTiles: false,
      /* A deliberate cap rather than MapLibre's dynamic sizing, so the DEM
         tiles' GPU memory is bounded. Measured: 48 and 128 gave the same zoom
         frame rate and no background pixels either way, so the smaller bound
         it is — cache retention was not what made zooms feel heavy. */
      maxTileCacheSize: 48,
      renderWorldCopies: false,
    });
    map.current = map_;

    if (import.meta.env.DEV) {
      (window as unknown as { __terraneMap?: MlMap }).__terraneMap = map_;
    }

    /* Relief comes from one hillshade — no terrain mesh.

       A `setTerrain` mesh was tried and removed: with globe projection it does
       not displace the surface, but it still fetches a full extra DEM pyramid
       and re-tessellates on every gesture — all of the cost of 3D, none of the
       relief.

       It cannot live in the static style (a hillshade there fails style
       parsing) so it is added as soon as the style lands, not on the 2.5 s timer
       this used to use — that timer meant the planet was flat for the first
       seconds of every visit, which is exactly the moment relief matters. */
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
          // Above the vegetation fills but BELOW the snow, water, roads and
          // labels. Two constraints pull in opposite directions here:
          // - vegetation has to sit under the shade, or a flat green polygon on
          //   top erases both the colour and the 3D at mid zoom;
          // - snow has to sit OVER the shade, or the lit-shade colour (a green)
          //   tints every glacier into a grey-green smear instead of white.
          // Splitting them at `landcover-ice` satisfies both with one insertion.
          map_.getLayer("landcover-ice")
            ? "landcover-ice"
            : map_.getLayer("water")
              ? "water"
              : FIRST_SYMBOL_LAYER,
        );
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
      addHillshade();

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

      map_.on("click", (e) => {
        const hit = pick(e.point.x, e.point.y);
        if (hit?.properties?.slug) selectRef.current(hit.properties.slug);
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
        const on = Boolean(pick(e.point.x, e.point.y));
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
      if (booted.current && map_.isStyleLoaded()) addHillshade();
    };
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
