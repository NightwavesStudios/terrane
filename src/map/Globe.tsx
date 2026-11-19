import { useEffect, useRef, useState } from "react";
import { Map as MlMap, NavigationControl, ScaleControl } from "maplibre-gl";
import type {
  GeoJSONSource,
  HillshadeLayerSpecification,
  LayerSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle } from "./style";
import { addCampIcons } from "./campIcon";
import { installDemProtocol } from "./dem";
import { focusZoomFor, pitchForZoom, worldZoom } from "./camera";
import { createContours, type ContourHandle } from "./contours";
import {
  DEST_LAYERS,
  addDestinations,
  loadDestinations,
  loadMoreDestinations,
  setAtlasPlaces,
  setDestinationCats,
} from "./destinations";
import {
  MAPPED_LAYERS,
  addMapped,
  mappedStats,
  refreshMapped,
  refreshDuplicates,
  resetMapped,
  setMappedCats,
} from "./mapped";
import {
  TRAIL_LAYERS,
  addTrails,
  refreshTrails,
  resetTrails,
  setTrailLayers,
  trailStats,
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
 * Four lights are also the most expensive thing on a moving map, so a gesture
 * drops to the one key light (`HILLSHADE_BASIC`) and the full pass returns when
 * the camera settles. A still frame keeps the shading; a zoom keeps the frames.
 */
type HillshadePaint = NonNullable<HillshadeLayerSpecification["paint"]>;

const HILLSHADE_MULTI: HillshadePaint = {
  "hillshade-method": "multidirectional",
  "hillshade-illumination-anchor": "map",
  "hillshade-illumination-direction": [315, 45, 225, 135],
  "hillshade-illumination-altitude": [45, 30, 45, 30],
  "hillshade-highlight-color": ["#6f8158", "#5d6e4b", "#5a6a49", "#5d6e4b"],
  "hillshade-shadow-color": ["#020806", "#07120c", "#050e09", "#07120c"],
};

const HILLSHADE_BASIC: HillshadePaint = {
  "hillshade-method": "basic",
  "hillshade-illumination-anchor": "map",
  "hillshade-illumination-direction": 315,
  "hillshade-illumination-altitude": 45,
  "hillshade-highlight-color": "#6f8158",
  "hillshade-shadow-color": "#020806",
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

/* Which base layers answer to which switch. Relief is handled separately: the
   hillshade and the snow layer are two halves of one switch, so they cannot be
   turned on by a later key after `relief` turned everything off. Features are
   handled by category in `destinations.ts` and `mapped.ts`, not here. */
const LAYER_GROUPS: Record<string, string[]> = {
  contours: ["contours-minor", "contours-major"],
  contourLabels: ["contours-label"],
  trails: ["trails-casing", "trails-path", "trails-label", ...TRAIL_LAYERS],
  roads: ["road-casing", "road-minor", "road-major", "road-highway"],
  parks: ["park-area", "park-outline"],
  borders: ["boundary-country", "boundary-state", "boundary-disputed"],
  labels: [
    "label-country",
    "label-state",
    "label-city",
    "label-village",
    "label-detail",
    "water-label",
    "water-label-line",
  ],
  roadLabels: ["label-road"],
};

/** Layers that must exist after a style rebuild before the fast path is taken. */
const RUNTIME_IDS = [
  "relief-hillshade",
  "features-dot-0",
  "mapped-pin-0",
  "trail-route-line",
  "pick-ring",
];

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/** A camera in the URL: `?at=lat,lon,zoom`, 3/3/2 decimals. */
function readCamera(): { center: [number, number]; zoom: number | null } {
  const raw = new URLSearchParams(window.location.search).get("at");
  if (raw) {
    const [lat, lon, zoom] = raw.split(",").map(Number);
    if (
      [lat, lon, zoom].every(Number.isFinite) &&
      Math.abs(lat) <= 85 &&
      Math.abs(lon) <= 180
    ) {
      return {
        center: [lon, lat],
        zoom: Math.max(0.4, Math.min(16, zoom)),
      };
    }
  }
  return { center: [12, 22], zoom: null };
}

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
  const [debugLines, setDebugLines] = useState<string[] | null>(null);
  const debugOn = useRef(
    new URLSearchParams(window.location.search).get("debug") === "1",
  );
  pickRef.current = onPick;
  dataRef.current = places;

  /* ── init once ─────────────────────────────────────── */
  useEffect(() => {
    if (!holder.current) return;

    installDemProtocol();

    const camera = readCamera();
    const map_ = new MlMap({
      container: holder.current,
      style: createStyle(),
      center: camera.center,
      zoom:
        camera.zoom ??
        worldZoom(holder.current.clientWidth, holder.current.clientHeight),
      minZoom: 0.4,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      maxPitch: 65,
      fadeDuration: 180,
      refreshExpiredTiles: false,
      maxTileCacheSize: 48,
      renderWorldCopies: false,
      cooperativeGestures: false,
      doubleClickZoom: true,
      keyboard: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    map.current = map_;

    /* Wheel and touch rates: the default wheel step was a half screen at a flick.
       Slower on the wheel, quicker on touch, so a trackpad and a phone feel like
       the same camera. */
    map_.scrollZoom.setWheelZoomRate(1 / 450);
    map_.scrollZoom.setZoomRate(1 / 120);

    map_.addControl(
      new NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }),
      "bottom-left",
    );
    map_.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");

    /* Keyboard pan and zoom need a focusable canvas. */
    const canvas = map_.getCanvas();
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("aria-label", "Map — arrow keys pan, + and − zoom");

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
            paint: HILLSHADE_MULTI,
          },
          map_.getLayer("water") ? "water" : "label-country",
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

    const setReliefQuality = (moving: boolean) => {
      if (!map_.getLayer("relief-hillshade")) return;
      const paint = moving ? HILLSHADE_BASIC : HILLSHADE_MULTI;
      /* The two tiers differ in colour *length*: one light has a single colour,
         four lights have four. MapLibre's default paint transition tries to
         interpolate the old array against the new one and throws mid-render
         ("colorArray: Arrays have mismatched length"); zero-length transitions
         switch the tier atomically, which is what a gesture needs anyway. */
      for (const key of ["hillshade-highlight-color", "hillshade-shadow-color"]) {
        map_.setPaintProperty("relief-hillshade", `${key}-transition`, { duration: 0, delay: 0 });
      }
      for (const [key, value] of Object.entries(paint)) {
        map_.setPaintProperty("relief-hillshade", key, value);
      }
      const snow = layersRef.current.relief && layersRef.current.snow;
      if (map_.getLayer("relief-snow")) {
        map_.setLayoutProperty("relief-snow", "visibility", moving || !snow ? "none" : "visible");
      }
    };

    /** Re-adds everything the style does not declare. Idempotent and cheap when whole. */
    const ensureRuntimeLayers = () => {
      if (!booted.current || !map_.getStyle()) return;
      if (!RUNTIME_IDS.every((id) => map_.getLayer(id))) {
        addHillshade();
        addCampIcons(map_);
        addDestinations(map_);
        setAtlasPlaces(map_, dataRef.current);
        addMapped(map_, layersRef.current);
        addTrails(map_, layersRef.current);
        addPickRing();
      }
      setDestinationCats(map_, layersRef.current);
      setMappedCats(map_, layersRef.current);
      setTrailLayers(map_, layersRef.current);
      if (layersRef.current.contours && !map_.getLayer("contours-minor")) {
        contours.current?.reload();
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

      try {
        map_.setSky({
          "sky-color": "#02040a",
          "horizon-color": "#22779a",
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
      contours.current.setLabels(layersRef.current.contourLabels);

      ensureRuntimeLayers();

      /* Two chunks, both after first paint: the famous half of the long tail and
         the practical cells. The atlas dots are already on screen. */
      const loadCore = () => void loadDestinations(map_).then(() => refreshDuplicates(map_));
      const idle = window.requestIdleCallback?.(loadCore, { timeout: 3000 });
      if (!idle) window.setTimeout(loadCore, 1600);

      refreshMapped(map_);
      refreshTrails(map_);
      /* Time from navigation start to the first interactive frame, read by the
         dev bench. `performance.now()` is measured from the navigation start. */
      if (import.meta.env.DEV) {
        (window as unknown as { __terraneReadyMs?: number }).__terraneReadyMs = Math.round(
          performance.now(),
        );
      }
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

    /* Hover is desktop-only and 8 Hz: a spatial query over 20+ layers on every
       pointer move competed with tile loading. */
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let lastPick = 0;
    let hovering = false;
    map_.on("mousemove", (e) => {
      if (!finePointer || map_.isMoving()) return;
      const now = performance.now();
      if (now - lastPick < 125) return;
      lastPick = now;
      const on = Boolean(pickAt(e.point.x, e.point.y));
      if (on !== hovering) {
        hovering = on;
        map_.getCanvas().style.cursor = on ? "pointer" : "";
      }
    });

    /* A shareable view, written on settle. No server, no route change. */
    const writeCamera = () => {
      if (window.location.pathname !== "/") return;
      const c = map_.getCenter();
      const at = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${map_.getZoom().toFixed(2)}`;
      const url = new URL(window.location.href);
      if (url.searchParams.get("at") === at) return;
      url.searchParams.set("at", at);
      window.history.replaceState(null, "", url);
    };

    map_.on("style.load", bootstrap);
    map_.on("load", bootstrap);
    const t = window.setTimeout(() => {
      if (map_.isStyleLoaded()) bootstrap();
    }, 2500);

    map_.on("styledata", ensureRuntimeLayers);
    map_.on("movestart", () => setReliefQuality(true));
    map_.on("moveend", () => {
      setReliefQuality(false);
      writeCamera();
      if (map_.getZoom() >= 6.6) {
        void loadMoreDestinations(map_).then(() => refreshDuplicates(map_));
      }
    });

    const guard = window.setTimeout(() => {
      if (!booted.current) setStalled(true);
    }, 8000);

    map_.on("error", (e) => {
      if (import.meta.env.DEV) console.error("[terrane] map error", e?.error);
    });

    /* A window drag fires resize on every frame; one rAF keeps one rebuild. */
    let resizeFrame = 0;
    const ro = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => map_.resize());
    });
    if (holder.current) ro.observe(holder.current);

    return () => {
      ro.disconnect();
      window.cancelAnimationFrame(resizeFrame);
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
    const setVisible = (id: string, on: boolean) => {
      if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    setVisible("elevation-tint", layers.relief);
    setVisible("relief-hillshade", layers.relief && layers.hillshade);
    setVisible("relief-snow", layers.relief && layers.snow);
    for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
      const on = Boolean(layers[key as keyof LayerState]);
      for (const id of ids) setVisible(id, on);
    }

    contours.current?.setEnabled(layers.contours);
    contours.current?.setLabels(layers.contourLabels && layers.contours);
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
    /* A park is a place you look at from 9.6, a tent from 14.6. If the reader is
       already closer than the category's frame, keep their zoom. */
    const zoom = Math.max(map_.getZoom(), focusZoomFor(pick.cat));
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

    map_.on("pitchstart", onPitchStart);
    map_.on("moveend", applyPitch);

    return () => {
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

  /* ── debug readout: ?debug=1 ────────────────────────── */
  useEffect(() => {
    /* The counters are always published in development so a measurement can be
       taken without a query string; only the overlay needs `?debug=1`. */
    if (!ready || !import.meta.env.DEV) return;
    const fps = { value: 0 };
    let frames = 0;
    let last = performance.now();
    let alive = true;

    const tick = () => {
      if (!alive) return;
      frames += 1;
      const now = performance.now();
      if (now - last >= 1000) {
        fps.value = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);

    const id = window.setInterval(() => {
      const map_ = map.current;
      if (!map_) return;
      const pins = mappedStats();
      const trails = trailStats();
      const scope = window as unknown as { __demStats?: unknown[] };
      const demTiles = scope.__demStats?.length ?? 0;
      const lines = [
        `z ${map_.getZoom().toFixed(2)} · pitch ${map_.getPitch().toFixed(0)}° · ${fps.value} fps`,
        `pins ${pins.drawn.toLocaleString()} / ${pins.cached.toLocaleString()} cached · ${pins.duplicates} dup · setData ${pins.lastSetDataMs.toFixed(1)} ms`,
        `trails ${trails.drawn.toLocaleString()} · ${trails.cells} cells · setData ${trails.lastSetDataMs.toFixed(1)} ms`,
        `dem ${demTiles} · ${pins.cells + pins.parkingCells} cells`, 
      ];
      if (debugOn.current) setDebugLines(lines);
      (window as unknown as { __terraneStats?: unknown }).__terraneStats = {
        zoom: map_.getZoom(),
        fps: fps.value,
        ...pins,
        trails,
      };
    }, 700);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [ready]);

  /* ── bench: three 0.4-zoom jumps, medians ───────────── */
  useEffect(() => {
    if (!import.meta.env.DEV || !ready) return;
    const scope = window as unknown as {
      __terraneBench?: (zoom?: number, lat?: number, lon?: number) => Promise<number[]>;
    };

    const run = (zoom: number) =>
      new Promise<number>((resolve) => {
        const map_ = map.current;
        if (!map_) return resolve(0);
        let frames = 0;
        const started = performance.now();
        const step = () => {
          frames += 1;
          if (performance.now() - started < 1200) {
            window.requestAnimationFrame(step);
          } else {
            resolve((frames * 1000) / (performance.now() - started));
          }
        };
        window.requestAnimationFrame(step);
        map_.easeTo({ zoom, duration: 1200, essential: true });
      });

    scope.__terraneBench = async (zoom = 11, lat = 46.5, lon = 8) => {
      const map_ = map.current;
      if (!map_) return [];
      const runs: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        map_.jumpTo({ center: [lon, lat], zoom });
        await new Promise((r) => window.setTimeout(r, 900));
        runs.push(Number((await run(zoom + 0.4)).toFixed(1)));
        await new Promise((r) => window.setTimeout(r, 600));
      }
      return runs;
    };

    return () => {
      delete scope.__terraneBench;
    };
  }, [ready]);

  return (
    <>
      <div className="globe" ref={holder} aria-label="Interactive globe" />
      {stalled && (
        <p className="globe-stalled mono" role="status">
          The globe couldn’t start. Opening this file straight from disk blocks the
          map’s background workers — serve it instead, e.g.{" "}
          <code>npx serve .</code>
        </p>
      )}
      {debugLines && (
        <div className="map-debug mono" aria-label="Map diagnostics">
          {debugLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
    </>
  );
}
