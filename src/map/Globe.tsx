import { useEffect, useRef, useState } from "react";
import { Map as MlMap } from "maplibre-gl";
import type {
  GeoJSONSource,
  HillshadeLayerSpecification,
  LayerSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle, FIRST_SYMBOL_LAYER } from "./style";
import { addCampIcons } from "./campIcon";
import { installDemProtocol } from "./dem";
import { pitchForZoom, worldZoom } from "./camera";
import { createContours, type ContourHandle } from "./contours";
import {
  DEST_LAYERS,
  addDestinations,
  loadDestinations,
  loadMoreDestinations,
  setAtlasPlaces,
  setDestinationCats,
} from "./destinations";
import { MAPPED_LAYERS, addMapped, refreshMapped, resetMapped, setMappedCats } from "./mapped";
import {
  TRAIL_LAYERS,
  addTrails,
  refreshTrails,
  resetTrails,
  setTrailLayers,
} from "./trails";
import { pickOf, type Pick } from "../data/features";
import { DEFAULT_LAYERS, type LayerState } from "../components/LayerControl";
import type { Place } from "../data/places";

/**
 * The single hillshade.
 *
 * Four lights in one pass. The 315° key light is the northwest sun the eye
 * expects and gets the brightest highlight and the deepest shadow; the other
 * three fill the faces it misses, lower and dimmer, because four equally weighted
 * lights turn relief into grey noise. The light is anchored to the map, not the
 * viewport, so pitching does not swing shadows across the ridges.
 *
 * The DEM protocol answers every requested zoom with a real 512 px tile, so
 * MapLibre's slope maths has no overscale factor to fight and the shading keeps
 * its density all the way in.
 */
const HILLSHADE_PAINT: HillshadeLayerSpecification["paint"] = {
  "hillshade-method": "multidirectional",
  "hillshade-illumination-anchor": "map",
  "hillshade-illumination-direction": [315, 45, 225, 135],
  "hillshade-illumination-altitude": [45, 30, 45, 30],
  "hillshade-highlight-color": ["#6f8158", "#5d6e4b", "#5a6a49", "#5d6e4b"],
  "hillshade-shadow-color": ["#020806", "#07120c", "#050e09", "#07120c"],
};

export interface GlobeFocus {
  lon: number;
  lat: number;
  zoom: number;
  key: number;
}

interface Props {
  places: Place[];
  pick?: Pick | null;
  onPick?: (pick: Pick | null) => void;
  focus?: GlobeFocus | null;
  layers?: LayerState;
}

/* Which base layers answer to which switch. Features are handled by category in
   `destinations.ts` and `mapped.ts`, not here: a place owns its labels, and the
   base map owns its own. */
const LAYER_GROUPS: Record<string, string[]> = {
  relief: ["relief-hillshade", "relief-snow"],
  contours: ["contours-minor", "contours-major"],
  trails: ["trails-casing", "trails-path", "trails-label", ...TRAIL_LAYERS],
  roads: ["road-casing", "road-minor", "road-major", "road-highway"],
  borders: ["boundary-country", "boundary-state"],
  labels: ["label-country", "label-state", "label-city", "water-label"],
};

/** Where a clicked destination lands: close enough to read the terrain. */
const PLACE_FOCUS_ZOOM = 14.2;
/** A practical pin has no page, but z15 is where a tent becomes a clearing. */
const MAPPED_FOCUS_ZOOM = 15;

const EMPTY = { type: "FeatureCollection" as const, features: [] };

export default function Globe({
  places,
  pick,
  onPick,
  focus,
  layers = DEFAULT_LAYERS,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const contours = useRef<ContourHandle | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const map = useRef<MlMap | null>(null);
  const pickRef = useRef(onPick);
  const booted = useRef(false);
  const dataRef = useRef(places);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  pickRef.current = onPick;
  dataRef.current = places;

  /* ── init once ─────────────────────────────────────── */
  useEffect(() => {
    if (!holder.current) return;

    installDemProtocol();

    const map_ = new MlMap({
      container: holder.current,
      style: createStyle(),
      center: [12, 22],
      zoom: worldZoom(holder.current.clientWidth, holder.current.clientHeight),
      minZoom: 0.4,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      maxPitch: 60,
      fadeDuration: 180,
      refreshExpiredTiles: false,
      maxTileCacheSize: 48,
      renderWorldCopies: false,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    map.current = map_;

    if (import.meta.env.DEV) {
      (window as unknown as { __terraneMap?: MlMap }).__terraneMap = map_;
    }

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
          map_.getLayer("water") ? "water" : FIRST_SYMBOL_LAYER,
        );
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
            map_.getLayer("water") ? "water" : undefined,
          );
        }
      } catch {
        /* hillshade unavailable */
      }
    };

    const addPickRing = () => {
      if (!map_.getSource("pick")) {
        map_.addSource("pick", { type: "geojson", data: EMPTY });
      }
      if (!map_.getLayer("pick-ring")) {
        map_.addLayer({
          id: "pick-ring",
          type: "circle",
          source: "pick",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 7, 14, 16],
            "circle-color": "rgba(124, 224, 192, 0.12)",
            "circle-stroke-color": "#7ce0c0",
            "circle-stroke-width": 1.8,
          },
        });
      }
    };

    /** Re-adds everything the style does not declare. Idempotent. */
    const ensureRuntimeLayers = () => {
      if (!booted.current || !map_.getStyle()) return;
      addHillshade();
      addCampIcons(map_);
      addDestinations(map_);
      setAtlasPlaces(map_, dataRef.current);
      addMapped(map_, layersRef.current);
      addTrails(map_, layersRef.current);
      setDestinationCats(map_, layersRef.current);
      setMappedCats(map_, layersRef.current);
      setTrailLayers(map_, layersRef.current);
      addPickRing();
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

      ensureRuntimeLayers();

      /* Two chunks, both after first paint: the famous half of the long tail and
         the practical cells. The atlas dots are already on screen. */
      const idle = window.requestIdleCallback?.(() => void loadDestinations(map_), {
        timeout: 3000,
      });
      if (!idle) window.setTimeout(() => void loadDestinations(map_), 1600);

      refreshMapped(map_);
      refreshTrails(map_);
      setReady(true);
    };

    /* One click, one pick. Destination layers are queried first because a
       destination usually has a page, then the practical pins. */
    const featureLayers = () =>
      [...DEST_LAYERS, ...MAPPED_LAYERS, ...TRAIL_LAYERS].filter((id) => map_.getLayer(id));

    const pickAt = (x: number, y: number): MapGeoJSONFeature | undefined => {
      const layers = featureLayers();
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

    map_.on("click", (e) => {
      const hit = pickAt(e.point.x, e.point.y);
      if (!hit) return;
      const geom = hit.geometry as unknown as {
        type: string;
        coordinates: [number, number] | [number, number][];
      };
      const [lon, lat] =
        geom.type === "LineString"
          ? (geom.coordinates as [number, number][])[
              Math.floor((geom.coordinates as [number, number][]).length / 2)
            ]
          : (geom.coordinates as [number, number]);
      pickRef.current?.(pickOf(hit.properties as Record<string, unknown>, lon, lat));
    });

    /* No hit-testing mid-gesture, and 16 Hz at rest: a spatial query on every
       pointer event competed with tile loading for the whole zoom gesture. */
    let lastPick = 0;
    let hovering = false;
    map_.on("mousemove", (e) => {
      if (map_.isMoving()) return;
      const now = performance.now();
      if (now - lastPick < 60) return;
      lastPick = now;
      const on = Boolean(pickAt(e.point.x, e.point.y));
      if (on !== hovering) {
        hovering = on;
        map_.getCanvas().style.cursor = on ? "pointer" : "";
      }
    });

    map_.on("style.load", bootstrap);
    map_.on("load", bootstrap);
    const t = window.setTimeout(() => {
      if (map_.isStyleLoaded()) bootstrap();
    }, 2500);

    map_.on("styledata", ensureRuntimeLayers);
    map_.on("zoomend", () => {
      // Band 4 starts at z7.2; fetch the tail before it is needed, not on it.
      if (map_.getZoom() >= 6.6) void loadMoreDestinations(map_);
      refreshTrails(map_);
    });

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
      map_.off("styledata", ensureRuntimeLayers);
      resetTrails();
      resetMapped();
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
    for (const key of Object.keys(LAYER_GROUPS)) {
      const visibility = layers[key as keyof LayerState] ? "visible" : "none";
      for (const id of LAYER_GROUPS[key]) {
        if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visibility);
      }
    }
    contours.current?.setEnabled(layers.contours);
    setDestinationCats(map_, layers);
    setMappedCats(map_, layers);
    setTrailLayers(map_, layers);
  }, [layers, ready]);

  /* ── data updates (ranked atlas rows) ──────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    setAtlasPlaces(map_, places);
  }, [places, ready]);

  /* ── one selection ring and one camera move ────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const src = map_.getSource("pick") as GeoJSONSource | undefined;
    src?.setData(
      pick
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [pick.lon, pick.lat] },
                properties: {},
              },
            ],
          }
        : EMPTY,
    );

    if (!pick) return;
    const zoom = Math.max(map_.getZoom(), pick.slug ? PLACE_FOCUS_ZOOM : MAPPED_FOCUS_ZOOM - 2.4);
    map_.flyTo({
      center: [pick.lon, pick.lat],
      zoom,
      pitch: pitchForZoom(zoom),
      speed: 0.75,
      curve: 1.45,
      essential: true,
      padding:
        window.innerWidth > 900 ? { right: 380, bottom: 40 } : { bottom: 300 },
    });
  }, [pick, ready]);

  /* ── camera travel: pitch follows zoom ───────────────
     Applied when the camera comes to rest, never mid-gesture: a setPitch during a
     gesture re-projects the camera, changes the tile cover and throws away what is
     on screen. Automatic until the reader pitches by hand. */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    let userPitched = false;

    const onPitchStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userPitched = true;
    };

    const applyPitch = () => {
      if (userPitched || map_.isEasing() || map_.isMoving()) return;
      const target = pitchForZoom(map_.getZoom());
      if (Math.abs(map_.getPitch() - target) > 1.2) map_.setPitch(target);
    };

    /* Warm the HTTP cache for the next integer zoom. MapLibre 5 has no tile
       prefetching, so every zoom step is a cold pyramid; eight tiles every 700 ms
       is the cheap insurance, not a guarantee. */
    let template: string | undefined;
    let lastPrefetch = 0;
    const prefetch = () => {
      const now = performance.now();
      if (now - lastPrefetch < 700) return;
      lastPrefetch = now;

      if (!template) {
        const src = map_.getSource("openmaptiles") as unknown as { tiles?: string[] };
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
        void fetch(url, { mode: "cors", priority: "low" }).catch(() => undefined);
      }
    };

    map_.on("pitchstart", onPitchStart);
    map_.on("zoom", prefetch);
    map_.on("moveend", applyPitch);

    return () => {
      map_.off("zoom", prefetch);
      map_.off("moveend", applyPitch);
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

  /* Keeps the map's own label/click behaviour independent of the route. */

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
