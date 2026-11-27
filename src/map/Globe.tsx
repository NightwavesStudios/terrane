import { useEffect, useRef, useState } from "react";
import { Map as MlMap, NavigationControl, ScaleControl } from "maplibre-gl";
import type {
  GeoJSONSource,
  IControl,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle, FIRST_SYMBOL_LAYER } from "./style";
import { installDemProtocol, noteDemCamera } from "./dem";
import { focusFor, pitchForZoom, readCamera, terrainExaggeration, worldZoom } from "./camera";
import { circleRing, kmBetween } from "../lib/geo";
import { shouldShowBootFailure } from "./bootGuard";
import { createContours, type ContourHandle } from "./contours";
import {
  DEST_LAYERS,
  addDestinations,
  loadDestinations,
  loadMoreDestinations,
  resetDestinations,
  setAtlasPlaces,
  setDestinationCats,
} from "./destinations";
import {
  EXPERIENCE_LAYERS,
  addExperiences,
  resetExperiences,
  setExperienceLayers,
  showExperience,
} from "./experiences";
import { pickOf, type Pick } from "../data/features";
import { DEFAULT_LAYERS, type LayerState } from "../components/LayerControl";
import type { Place } from "../data/places";
import {
  LOG_LAYERS,
  addLog,
  setLogPoints,
  setLogVisibility,
  type LogMapPoint,
} from "./log";
import {
  LISTED_LAYERS,
  addListed,
  setListedPoints,
  setListedVisibility,
  type ListedPoint,
} from "./listed";

export interface GlobeFocus {
  lon: number;
  lat: number;
  zoom: number;
  key: number;
}

/** Where the globe opens, and where the reset button returns it. */
const WORLD: [number, number] = [12, 22];

/**
 * The way back.
 *
 * A pitched camera over 3D terrain can be left off-centre by a fast wheel
 * gesture: the centre is still a real coordinate, but it is no longer where the
 * reader is looking, and nothing on the map undoes that. One button puts the
 * globe back where it opened — level, at world zoom — instead of asking someone
 * to fight the camera until it behaves.
 */
class ResetControl implements IControl {
  private map: MlMap | null = null;

  private onClick = () => {
    const map = this.map;
    if (!map) return;
    const canvas = map.getCanvas();
    map.easeTo({
      center: WORLD,
      zoom: worldZoom(
        canvas.clientWidth || window.innerWidth,
        canvas.clientHeight || window.innerHeight,
      ),
      bearing: 0,
      pitch: 0,
      duration: 900,
      essential: true,
      padding: { left: 0, top: 0, right: 0, bottom: 0 },
    });
  };

  onAdd(map: MlMap) {
    this.map = map;
    const group = document.createElement("div");
    group.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-reset";
    button.title = "Reset the view";
    button.setAttribute("aria-label", "Reset the view");
    button.textContent = "↺";
    button.addEventListener("click", this.onClick);
    group.appendChild(button);
    return group;
  }

  onRemove() {
    this.map = null;
  }
}

interface Props {
  places: Place[];
  pick?: Pick | null;
  onPick?: (pick: Pick | null) => void;
  /** The settled camera, for the Discover panel's nearby lists. */
  onView?: (view: { lon: number; lat: number; zoom: number }) => void;
  focus?: GlobeFocus | null;
  layers?: LayerState;
  /** Bagged and wanted entries with a real coordinate. */
  logPoints?: LogMapPoint[];
  /** Listed peaks that also have a place page. */
  listedPoints?: ListedPoint[];
}

/* Which base layers answer to which switch. Relief is handled separately: the
   hillshade and the snow layer are two halves of one switch, so they cannot be
   turned on by a later key after `relief` turned everything off. Features are
   handled by category in `destinations.ts`, not here. */
const LAYER_GROUPS: Record<string, string[]> = {
  contours: ["contours-minor", "contours-major"],
  contourLabels: ["contours-label"],
  roads: ["road-glow", "road-casing", "road-minor", "road-major", "road-highway"],
  parks: ["park-area", "park-outline"],
  borders: ["boundary-country", "boundary-state", "boundary-disputed"],
  labels: [
    FIRST_SYMBOL_LAYER,
    "label-state",
    "label-city",
    "label-village",
    "label-detail",
    "water-label",
    "water-label-line",
  ],
  roadLabels: ["label-road"],
};

/* Layers that must exist after a style rebuild before the fast path is taken.
   Relief is declared in the style now, so it is not a runtime layer. */
const RUNTIME_IDS = [
  "features-peak-glow",
  "features-dot-0",
  "experiences-dot",
  "log-done-ring",
  "listed-ring",
  "pick-area",
  "pick-ring",
];

const EMPTY = { type: "FeatureCollection" as const, features: [] };

/**
 * The 3D mesh.
 *
 * MapLibre draws terrain correctly at rest. What it does not survive is being
 * re-created: the earlier version called `setTerrain` for every exaggeration
 * step and once more on settle, and each call builds a new Terrain and a new
 * RenderToTexture over the same tile manager. The render-to-texture pass the
 * map keeps is then the one taken while the DEM was still an empty 1x1 texture,
 * so the mesh draws flat as soon as the camera stops.
 *
 * So the mesh is created once, by the switch, and the slider writes
 * `terrain.exaggeration` — a uniform every frame reads — with one repaint.
 */
function applyTerrainTo(map: MlMap, layers: LayerState) {
  if (!map.getSource("relief")) return;
  const on = Boolean(map.getTerrain());
  /* The slider is the height at detail zoom; the zoom ramp is what makes the
     same mesh read at planet scale. Keeping the slider's 1.4 as neutral means
     its number still means "× real height" where the real shape is legible. */
  const exaggeration = layers.exaggeration * (terrainExaggeration(map.getZoom()) / 1.4);

  if (layers.terrain && !on) {
    map.setTerrain({ source: "relief", exaggeration });
    return;
  }
  if (!layers.terrain && on) {
    map.setTerrain(null);
    return;
  }
  if (layers.terrain && map.terrain && Math.abs(map.terrain.exaggeration - exaggeration) > 0.01) {
    map.terrain.exaggeration = exaggeration;
    map.triggerRepaint();
  }
}

/**
 * The space the place card is actually using.
 *
 * A fixed 440 px reservation was booked on every flight, card or no card, and on
 * a phone it is the wrong edge entirely: `PickSheet` makes the card a bottom
 * sheet under 900 px. Measuring the live card means the clicked point lands in
 * the middle of the free area at every width.
 */
function pickPadding(): { left: number; bottom: number } {
  const card = document.querySelector<HTMLElement>(".pick");
  if (!card) return { left: 0, bottom: 0 };
  const box = card.getBoundingClientRect();
  if (!box.width || !box.height) return { left: 0, bottom: 0 };
  if (window.innerWidth > 900) return { left: Math.round(box.right + 20), bottom: 40 };
  return { left: 0, bottom: Math.max(0, Math.round(window.innerHeight - box.top + 12)) };
}

export default function Globe({
  places,
  pick,
  onPick,
  onView,
  focus,
  layers = DEFAULT_LAYERS,
  logPoints = [],
  listedPoints = [],
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const contours = useRef<ContourHandle | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const map = useRef<MlMap | null>(null);
  const pickRef = useRef(onPick);
  const viewRef = useRef(onView);
  const booted = useRef(false);
  /* The 3D mesh is the most expensive thing the map can start, and it is not
     needed to paint the first frame. It is armed after the first idle. */
  const terrainArmed = useRef(false);
  const terrainFrame = useRef<number | null>(null);
  const terrainTimer = useRef<number | null>(null);
  const dataRef = useRef(places);
  const logRef = useRef(logPoints);
  const listedRef = useRef(listedPoints);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [debugLines, setDebugLines] = useState<string[] | null>(null);
  const debugOn = useRef(
    new URLSearchParams(window.location.search).get("debug") === "1",
  );
  pickRef.current = onPick;
  viewRef.current = onView;
  dataRef.current = places;
  logRef.current = logPoints;
  listedRef.current = listedPoints;

  /* ── init once ─────────────────────────────────────── */
  useEffect(() => {
    if (!holder.current) return;

    installDemProtocol();

    /* The stage stays veiled until the map has a whole frame to show. The cap
       is for the case where MapLibre never reaches idle: a hidden tab, or a
       style that failed, must still end up showing something. */
    const stage = holder.current.closest(".home");
    const reveal = () => stage?.setAttribute("data-map", "ready");
    const revealTimer = window.setTimeout(reveal, 6000);

    const camera = readCamera();
    /* The opening camera is built, not animated, so its tilt has to be part of
       the constructor: the pitch effect below only corrects a camera that has
       settled after a move, and a phone opening on a deep link never moves. */
    const startZoom =
      camera.zoom ?? worldZoom(holder.current.clientWidth, holder.current.clientHeight);
    const map_ = new MlMap({
      container: holder.current,
      style: createStyle({ globe: true }),
      center: camera.center,
      zoom: startZoom,
      pitch: pitchForZoom(startZoom),
      minZoom: 0.4,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      maxPitch: 68,
      fadeDuration: 260,
      refreshExpiredTiles: false,
      maxTileCacheSize: 48,
      renderWorldCopies: false,
      cooperativeGestures: false,
      doubleClickZoom: true,
      keyboard: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    map.current = map_;

    /* The settled centre and zoom, rounded to ~1 km. Discover recomputes its
       nearby lists from this, and a sub-kilometre camera jitter is not a new
       question. */
    const reportView = () => {
      const c = map_.getCenter();
      const zoom = Number(map_.getZoom().toFixed(2));
      viewRef.current?.({
        lon: Number(c.lng.toFixed(2)),
        lat: Number(c.lat.toFixed(2)),
        zoom,
      });
      /* Past the regional zooms the chrome is sitting on top of actual terrain:
         the stylesheet fades the running heads and the credits back, and deepens
         the top scrim so the navigation stays legible over a busy surface. */
      const home = holder.current?.closest(".home");
      if (home) {
        const depth = zoom >= 8.5 ? "close" : "far";
        if (home.getAttribute("data-depth") !== depth) home.setAttribute("data-depth", depth);
      }
    };

    /* Wheel and touch rates: the default wheel step was a half screen at a flick.
       Slower on the wheel, quicker on touch, so a trackpad and a phone feel like
       the same camera. */
    map_.scrollZoom.setWheelZoomRate(1 / 450);
    map_.scrollZoom.setZoomRate(1 / 120);

    map_.addControl(
      new NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }),
      "bottom-left",
    );
    map_.addControl(new ResetControl(), "bottom-left");
    map_.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");

    /* Keyboard pan and zoom need a focusable canvas. */
    const canvas = map_.getCanvas();
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("aria-label", "Map — arrow keys pan, + and − zoom");

    const addPickArea = () => {
      if (!map_.getSource("pick-area")) {
        map_.addSource("pick-area", { type: "geojson", data: EMPTY });
      }
      if (!map_.getLayer("pick-area")) {
        const before = map_.getLayer(FIRST_SYMBOL_LAYER) ? FIRST_SYMBOL_LAYER : undefined;
        map_.addLayer(
          {
            id: "pick-area",
            type: "line",
            source: "pick-area",
            paint: {
              "line-color": "#e6c382",
              "line-width": 1,
              "line-opacity": 0.5,
              "line-dasharray": [2, 2],
            },
          },
          before,
        );
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

    const applyTerrain = () => {
      if (!terrainArmed.current) return;
      applyTerrainTo(map_, layersRef.current);
    };

    /** Re-adds everything the style does not declare. Idempotent and cheap when whole. */
    const ensureRuntimeLayers = () => {
      if (!booted.current || !map_.getStyle()) return;
      if (!RUNTIME_IDS.every((id) => map_.getLayer(id))) {
        addDestinations(map_);
        setAtlasPlaces(map_, dataRef.current);
        /* Experiences last: a beacon has to sit above every destination and
           every label. */
        addExperiences(map_, layersRef.current);
        addLog(map_, layersRef.current.log);
        setLogPoints(map_, logRef.current);
        addListed(map_, layersRef.current.listed);
        setListedPoints(map_, listedRef.current);
        addPickArea();
        addPickRing();
      }
      setDestinationCats(map_, layersRef.current);
      setExperienceLayers(map_, layersRef.current);
      if (layersRef.current.contours && !map_.getLayer("contours-minor")) {
        contours.current?.reload();
      }
      applyTerrain();
    };

    const bootstrap = () => {
      if (booted.current) return;
      booted.current = true;
      setStalled(false);

      /* The projection is declared in the style, so the first frame is already
         the globe. Asking for it here reprojected a map that had painted. */
      map_.once("idle", reveal);

      /* Blue hour: a deeper space, a brighter limb and a longer ground haze.
         The atmosphere is what gives the sphere its edge; the fog blend is what
         makes a pitched camera over a range feel like distance rather than a
         texture. */
      try {
        map_.setSky({
          "sky-color": "#05070d",
          "horizon-color": "#2b6c82",
          "fog-color": "#12333f",
          "sky-horizon-blend": 0.7,
          "horizon-fog-blend": 0.25,
          "fog-ground-blend": 0.06,
          "atmosphere-blend": 0.55,
        });
      } catch {
        /* sky unsupported */
      }

      contours.current = createContours(map_);
      contours.current.setEnabled(layersRef.current.contours);
      contours.current.setLabels(layersRef.current.contourLabels);

      ensureRuntimeLayers();

      /* Two chunks, both after first paint: the famous half of the long tail. The atlas dots are already on screen. */
      /* The mesh is created one frame after the planet first paints, not after
         an idle callback. The DEM tiles the hillshade needs are already in
         flight from the style itself, so the mesh costs a render-to-texture
         pass rather than a new download — while waiting for an idle frame meant
         a busy phone armed it at the 2.2 s fallback, and that wait is exactly
         why the relief arrived so late. One flat, shaded frame, then relief. */
      const armTerrain = () => {
        if (terrainFrame.current != null) window.cancelAnimationFrame(terrainFrame.current);
        if (terrainTimer.current != null) window.clearTimeout(terrainTimer.current);
        terrainFrame.current = null;
        terrainTimer.current = null;
        if (terrainArmed.current) return;
        terrainArmed.current = true;
        applyTerrainTo(map_, layersRef.current);
      };
      const armAfterPaint = () => {
        if (terrainFrame.current != null) return;
        terrainFrame.current = window.requestAnimationFrame(armTerrain);
      };
      if (map_.loaded()) armAfterPaint();
      else map_.once("render", armAfterPaint);
      terrainTimer.current = window.setTimeout(armTerrain, 1500);

      const loadCore = () => {
      void loadDestinations().then(() => {
      });
    };
      const idle = window.requestIdleCallback?.(loadCore, { timeout: 3000 });
      if (!idle) window.setTimeout(loadCore, 1600);

      reportView();
      setReady(true);
    };

    /* One click, one pick. Experiences are queried first because they sit above
       everything, then the log and listed rings, then the destinations. */
    const featureLayers = () =>
      [...EXPERIENCE_LAYERS, ...LOG_LAYERS, ...LISTED_LAYERS, ...DEST_LAYERS].filter((id) =>
        map_.getLayer(id),
      );

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

    /* The pick's coordinate belongs to the feature, not to the finger: the query
       is a 10 px box, so a click beside a dot lands kilometres away at world
       zoom, and the card, the ring and "near X" all read that coordinate. A line
       has no single coordinate, so it takes the vertex nearest the click — the
       midpoint would send a 40 km area's camera twenty kilometres away. */
    const nearestVertex = (coords: [number, number][], lon: number, lat: number) => {
      let best = coords[0];
      let bestKm = Infinity;
      for (const coord of coords) {
        const km = kmBetween(lat, lon, coord[1], coord[0]);
        if (km < bestKm) {
          bestKm = km;
          best = coord;
        }
      }
      return best;
    };

    const pickCoords = (
      hit: MapGeoJSONFeature,
      lon: number,
      lat: number,
    ): [number, number] => {
      const geom = hit.geometry as unknown as {
        type: string;
        coordinates: [number, number] | [number, number][] | [number, number][][];
      };
      if (geom.type === "Point") return geom.coordinates as [number, number];
      if (geom.type === "LineString") {
        const coords = geom.coordinates as [number, number][];
        return coords.length ? nearestVertex(coords, lon, lat) : [lon, lat];
      }
      if (geom.type === "MultiLineString") {
        const coords = (geom.coordinates as [number, number][][]).flat();
        return coords.length ? nearestVertex(coords, lon, lat) : [lon, lat];
      }
      return [lon, lat];
    };

    map_.on("click", (e) => {
      const hit = pickAt(e.point.x, e.point.y);
      if (!hit) return;
      const [lon, lat] = pickCoords(hit, e.lngLat.lng, e.lngLat.lat);
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

    /* Which level the camera is actually on, and whether it is still: the DEM
       protocol uses both to tell an ideal tile from a backfill. */
    const reportDemCamera = () => noteDemCamera(map_.getZoom(), map_.isMoving());
    map_.on("zoom", reportDemCamera);
    reportDemCamera();

    map_.on("styledata", ensureRuntimeLayers);
    map_.on("moveend", () => {
      writeCamera();
      reportView();
      reportDemCamera();
      /* Exaggeration follows the camera; the mesh is never re-created. */
      applyTerrain();
      /* The famous tail is an 8 MB JSON: it can wait until the reader is close
         enough for it to mean something, and until the frame is idle. */
      if (map_.getZoom() >= 8.2) {
        const more = () => {
          void loadMoreDestinations().then(() => {
          });
        };
        const idle = window.requestIdleCallback?.(more, { timeout: 2500 });
        if (!idle) window.setTimeout(more, 900);
      }
    });

    /* The guard is a diagnosis, not a stopwatch: a suspended/hidden tab does
       not advance MapLibre's first frame, so elapsed time alone must not accuse
       it. A visible tab with no style and no rendered tiles still gets the
       message; a visible tab that becomes ready after a retry does not. */
    let guardRetry = 0;
    const checkBoot = () => {
      if (
        shouldShowBootFailure({
          booted: booted.current,
          styleLoaded: Boolean(map_.isStyleLoaded()),
          loaded: Boolean(map_.loaded()),
          hidden: document.visibilityState === "hidden",
        })
      ) {
        setStalled(true);
      }
    };
    const guard = window.setTimeout(checkBoot, 8000);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(guardRetry);
      guardRetry = window.setTimeout(checkBoot, 1200);
    };
    document.addEventListener("visibilitychange", onVisibility);

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
      resetDestinations();
      resetExperiences();
      window.clearTimeout(t);
      window.clearTimeout(guard);
      window.clearTimeout(guardRetry);
      if (terrainFrame.current != null) window.cancelAnimationFrame(terrainFrame.current);
      if (terrainTimer.current != null) window.clearTimeout(terrainTimer.current);
      terrainArmed.current = false;
      terrainFrame.current = null;
      terrainTimer.current = null;
      window.clearTimeout(revealTimer);
      stage?.removeAttribute("data-map");
      document.removeEventListener("visibilitychange", onVisibility);
      contours.current?.destroy();
      contours.current = null;
      booted.current = false;
      holder.current?.closest(".home")?.removeAttribute("data-depth");
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
    setVisible("relief-hillshade-near", layers.relief && layers.hillshade);
    setVisible("relief-snow", layers.relief && layers.snow);
    for (const [key, ids] of Object.entries(LAYER_GROUPS)) {
      const on = Boolean(layers[key as keyof LayerState]);
      for (const id of ids) setVisible(id, on);
    }

    contours.current?.setEnabled(layers.contours);
    contours.current?.setLabels(layers.contourLabels && layers.contours);
    setDestinationCats(map_, layers);
    setExperienceLayers(map_, layers);
    setLogVisibility(map_, layers.log);
    setListedVisibility(map_, layers.listed);
    layersRef.current = layers;
    if (terrainArmed.current) applyTerrainTo(map_, layers);
  }, [layers, ready]);

  /* ── data updates (ranked atlas rows) ──────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    setAtlasPlaces(map_, places);
  }, [places, ready]);

  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    setLogPoints(map_, logPoints);
  }, [logPoints, ready]);

  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    setListedPoints(map_, listedPoints);
  }, [listedPoints, ready]);

  /* ── one selection ring and one camera move ────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const isExperience = pick?.cat === "experience";
    const area = map_.getSource("pick-area") as GeoJSONSource | undefined;
    const radiusKm = 10;
    area?.setData(
      pick
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: circleRing(pick.lat, pick.lon, radiusKm),
                },
                properties: {},
              },
            ],
          }
        : EMPTY,
    );
    const src = map_.getSource("pick") as GeoJSONSource | undefined;
    src?.setData(
      pick && !isExperience
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
    /* A park is a place you look at from 9.6, a tent from 14.6, and a 4,000 m
       summit from a step further back than its category alone implies. A place
       already under the camera steps in instead of holding still — see
       `focusFor`. A beacon has no single frame of its own, so it takes the same
       step in, never wider than 13.5 so the route's shape stays in view. */
    const centre = map_.getCenter();
    const km = kmBetween(centre.lat, centre.lng, pick.lat, pick.lon);
    const zoom = isExperience
      ? Math.max(10, Math.min(13.5, map_.getZoom() + 1.4))
      : focusFor(pick.cat, pick.elev, map_.getZoom(), km);
    /* A bounded move. `flyTo` scales its duration with distance and zoom, so a
       click from a wide view zoomed for five seconds and read as a map that
       never stopped; 850 ms is the same destination at a predictable cost. */
    map_.easeTo({
      center: [pick.lon, pick.lat],
      zoom,
      pitch: pitchForZoom(zoom),
      duration: 850,
      essential: true,
      /* Reserve exactly the card's footprint, so the point is centred in what
         the reader can actually see. */
      padding: pickPadding(),
    });
  }, [pick, ready]);

  /* ── the selected route ────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    showExperience(map_, pick?.cat === "experience" ? pick.slug ?? null : null);
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
    /* A deep link sets its camera at construction, and a phone that lands on one
       never fires that first move: without these two the relief sat under a
       straight-down view until the reader moved the map themselves. */
    map_.on("load", applyPitch);
    map_.once("idle", applyPitch);

    return () => {
      map_.off("moveend", applyPitch);
      map_.off("pitchstart", onPitchStart);
      map_.off("load", applyPitch);
    };
  }, [ready]);

  /* ── external focus ────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !focus || !ready) return;
    map_.easeTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom,
      pitch: pitchForZoom(focus.zoom),
      duration: 850,
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
      const scope = window as unknown as { __demStats?: unknown[] };
      const demTiles = scope.__demStats?.length ?? 0;
      const lines = [
        `z ${map_.getZoom().toFixed(2)} · pitch ${map_.getPitch().toFixed(0)}° · ${fps.value} fps`,
        `dem ${demTiles} · terrain ${map_.getTerrain() ? `on ×${map_.terrain?.exaggeration.toFixed(1)}` : "off"}`,
      ];
      if (debugOn.current) setDebugLines(lines);
      (window as unknown as { __terraneStats?: unknown }).__terraneStats = {
        zoom: map_.getZoom(),
        fps: fps.value,
      };
    }, 700);

    return () => {
      alive = false;
      window.clearInterval(id);
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
