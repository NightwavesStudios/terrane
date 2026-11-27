import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type IControl,
  type LayerSpecification,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ADVENTURES,
  KIND_META,
  KINDS,
  adventureById,
  type AdventureKind,
} from "../data/atlas";
import { useJournal } from "../lib/journal";
import { worldZoom } from "../lib/camera";
import { FONTS } from "../map/theme";
import { createStyle } from "../map/style";

setWorkerUrl(maplibreWorkerUrl);

const WORLD: [number, number] = [12, 22];

export interface GlobeProps {
  selectedId: string | null;
  kindFilter: AdventureKind | "all";
  onSelect: (id: string) => void;
}

/**
 * The old camera's height ramp: the wider the view, the more the relief has to
 * be stretched to read as height at all.
 */
function terrainExaggeration(zoom: number): number {
  const stops: [number, number][] = [
    [0, 2.8],
    [3, 2.6],
    [6, 2.2],
    [9, 1.85],
    [12, 1.6],
    [14, 1.45],
  ];
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [z0, v0] = stops[i - 1];
    const [z1, v1] = stops[i];
    if (zoom <= z1) return v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0);
  }
  return stops[stops.length - 1][1];
}

/** The old way back to the opening camera. */
class ResetControl implements IControl {
  private map: MapLibreMap | null = null;

  private onClick = () => {
    const map = this.map;
    if (!map) return;
    map.easeTo({
      center: WORLD,
      zoom: worldZoom(window.innerWidth, window.innerHeight),
      bearing: 0,
      pitch: 0,
      duration: 900,
      essential: true,
      padding: { left: 0, top: 0, right: 0, bottom: 0 },
    });
  };

  onAdd(map: MapLibreMap) {
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

const kindColor = [
  "match",
  ["get", "kind"],
  ...KINDS.flatMap((kind) => [kind, KIND_META[kind].color]),
  "#7ce0c0",
];

function markerData(
  selectedId: string | null,
  kindFilter: AdventureKind | "all",
  visited: Set<string>,
) {
  return {
    type: "FeatureCollection" as const,
    features: ADVENTURES.map((adventure) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [adventure.lon, adventure.lat],
      },
      properties: {
        id: adventure.id,
        name: adventure.name,
        kind: adventure.kind,
        dim: kindFilter !== "all" && adventure.kind !== kindFilter,
        visited: visited.has(adventure.id),
        selected: adventure.id === selectedId,
        rank: -(adventure.elevationM ?? 0),
      },
    })),
  };
}

function atlasLayers(): LayerSpecification[] {
  const layers = [
    {
      id: "atlas-halo",
      type: "circle",
      source: "atlas",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0.5, 5, 3, 8, 6, 12, 10, 15],
        "circle-color": ["case", ["get", "visited"], "#7ce0c0", kindColor],
        "circle-opacity": ["case", ["get", "dim"], 0.05, 0.2],
        "circle-blur": 1,
      },
    },
    {
      id: "atlas-dot",
      type: "circle",
      source: "atlas",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0.5, 2.6, 3, 3.8, 6, 5, 10, 6.4],
        "circle-color": kindColor,
        "circle-opacity": ["case", ["get", "dim"], 0.18, 0.96],
        "circle-stroke-color": ["case", ["get", "visited"], "#f7f2e6", "#05070c"],
        "circle-stroke-width": ["case", ["get", "visited"], 1.5, 0.9],
      },
    },
    {
      id: "atlas-selected",
      type: "circle",
      source: "atlas",
      filter: ["==", ["get", "selected"], true],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0.5, 11, 4, 14, 10, 18],
        "circle-color": "rgba(124, 224, 192, 0)",
        "circle-stroke-color": "#7ce0c0",
        "circle-stroke-width": 1.4,
        "circle-stroke-opacity": 0.9,
      },
    },
    {
      id: "atlas-label",
      type: "symbol",
      source: "atlas",
      minzoom: 2.4,
      filter: ["==", ["get", "dim"], false],
      layout: {
        "text-field": ["get", "name"],
        "text-font": FONTS.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 2.4, 10, 5, 11.5, 9, 13],
        "text-anchor": "top",
        "text-offset": [0, 1.15],
        "text-max-width": 8,
        "text-padding": 3,
        "text-optional": true,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: {
        "text-color": "#e6eef2",
        "text-halo-color": "#04070c",
        "text-halo-width": 1.3,
        "text-halo-blur": 0.6,
        "text-opacity": ["case", ["get", "visited"], 1, 0.86],
      },
    },
  ] as unknown as LayerSpecification[];

  return layers;
}

export default function MapGlobe({ selectedId, kindFilter, onSelect }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const { entries } = useJournal();

  const visited = useMemo(
    () => new Set(entries.map((entry) => entry.adventureId)),
    [entries],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = container.closest(".home");
    stage?.removeAttribute("data-map");
    setFailed(false);
    setMarkersReady(false);

    let disposed = false;
    let map: MapLibreMap | null = null;
    let ready = false;
    let revealPoll: number | undefined;
    let failTimer: number | undefined;

    /* Only lift the veil once the style and our own atlas source are actually
       loaded. Showing a half-drawn globe under a fallback timer reads as a
       broken map, especially on a slow tile connection. */
    const reveal = () => {
      if (disposed || ready) return;
      const liveMap = map;
      if (!liveMap || !liveMap.isStyleLoaded()) return;
      if (!liveMap.getSource("atlas") || !liveMap.isSourceLoaded("atlas")) return;
      ready = true;
      if (revealPoll !== undefined) window.clearInterval(revealPoll);
      stage?.setAttribute("data-map", "ready");
    };

    function applyTerrain(liveMap: MapLibreMap) {
      try {
        if (!liveMap.getSource("relief")) return;
        const exaggeration = terrainExaggeration(liveMap.getZoom());
        if (!liveMap.getTerrain()) {
          liveMap.setTerrain({ source: "relief", exaggeration });
        } else if (liveMap.terrain) {
          liveMap.terrain.exaggeration = exaggeration;
          liveMap.triggerRepaint();
        }
      } catch {
        // The globe still renders when relief cannot be built.
      }
    }

    function addAtlas(liveMap: MapLibreMap) {
      if (liveMap.getSource("atlas")) return;
      liveMap.addSource("atlas", {
        type: "geojson",
        data: markerData(selectedId, kindFilter, visited) as never,
      });
      for (const layer of atlasLayers()) liveMap.addLayer(layer);

      liveMap.on("click", "atlas-dot", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      liveMap.on("click", "atlas-label", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      liveMap.on("mousemove", "atlas-dot", () => {
        liveMap.getCanvas().style.cursor = "pointer";
      });
      liveMap.on("mouseleave", "atlas-dot", () => {
        liveMap.getCanvas().style.cursor = "";
      });

      setMarkersReady(true);
    }

    try {
      map = new MapLibreMap({
        container,
        style: createStyle({ globe: true }),
        center: WORLD,
        zoom: worldZoom(container.clientWidth, container.clientHeight),
        pitch: 0,
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
        canvasContextAttributes: { antialias: true },
      });

      const liveMap = map;
      mapRef.current = liveMap;
      liveMap.scrollZoom.setWheelZoomRate(1 / 450);
      liveMap.scrollZoom.setZoomRate(1 / 120);

      liveMap.addControl(
        new NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }),
        "bottom-left",
      );
      liveMap.addControl(new ResetControl(), "bottom-left");
      liveMap.addControl(new ScaleControl({ maxWidth: 90, unit: "metric" }), "bottom-left");
      liveMap.addControl(new AttributionControl({ compact: true }), "bottom-right");

      const canvas = liveMap.getCanvas();
      canvas.setAttribute("tabindex", "0");
      canvas.setAttribute("aria-label", "Map — arrow keys pan, + and − zoom");

      liveMap.on("error", (event) => {
        if (import.meta.env.DEV) console.error("Terrane map error", event.error);
      });

      /* Markers and relief belong to us, not to the basemap. Attach them when
         the style is parsed (`style.load`) rather than on `load`, which also
         waits for the first remote vector tiles: a slow or blocked tile host
         must not hide the atlas or the terrain. */
      const prepareLayers = () => {
        if (disposed) return;
        try {
          liveMap.setSky({
            "sky-color": "#05070d",
            "horizon-color": "#2b6c82",
            "fog-color": "#12333f",
            "sky-horizon-blend": 0.7,
            "horizon-fog-blend": 0.25,
            "fog-ground-blend": 0.06,
            "atmosphere-blend": 0.55,
          });
        } catch {
          // Sky is optional.
        }
        applyTerrain(liveMap);
        addAtlas(liveMap);
      };

      /* Adding a source synchronously inside `style.load` lands before the
         style's source caches are registered: MapLibre accepts the layer but
         never loads its data. Defer by one turn; `load` also calls prepare as
         a second chance if it arrives first. */
      let prepareTimer: number | undefined;
      const schedulePrepare = () => {
        if (disposed || prepareTimer !== undefined) return;
        prepareTimer = window.setTimeout(prepareLayers, 0);
      };

      liveMap.on("style.load", schedulePrepare);
      liveMap.on("load", prepareLayers);

      liveMap.on("zoomend", () => applyTerrain(liveMap));
      liveMap.once("idle", reveal);
      liveMap.on("sourcedata", (event) => {
        if (event.sourceId === "atlas") reveal();
      });

      revealPoll = window.setInterval(reveal, 500);
      failTimer = window.setTimeout(() => {
        if (!disposed && !ready) setFailed(true);
      }, 60000);

      const resizeObserver = new ResizeObserver(() => liveMap.resize());
      resizeObserver.observe(container);

      return () => {
        disposed = true;
        if (revealPoll !== undefined) window.clearInterval(revealPoll);
        if (failTimer !== undefined) window.clearTimeout(failTimer);
        if (prepareTimer !== undefined) window.clearTimeout(prepareTimer);
        resizeObserver.disconnect();
        mapRef.current = null;
        liveMap.remove();
        stage?.removeAttribute("data-map");
      };
    } catch {
      setFailed(true);
      return () => {
        disposed = true;
        stage?.removeAttribute("data-map");
      };
    }
    // Selection and filters are applied to the existing source below; the map
    // itself is built once per retry.
  }, [retryKey]);

  useEffect(() => {
    const source = mapRef.current?.getSource("atlas") as GeoJSONSource | undefined;
    if (!markersReady || !source) return;
    source.setData(
      markerData(selectedId, kindFilter, visited) as unknown as Parameters<
        GeoJSONSource["setData"]
      >[0],
    );
  }, [markersReady, selectedId, kindFilter, visited]);

  useEffect(() => {
    const map = mapRef.current;
    if (!markersReady || !map || selectedId) return;
    if ((map.getPadding()?.bottom ?? 0) > 0) {
      map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: 500 });
    }
  }, [markersReady, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!markersReady || !map || !selectedId) return;
    const adventure = adventureById(selectedId);
    if (!adventure) return;
    /* On a phone the place card is a bottom sheet, so keep the selected peak
       in the strip of map above it instead of centering it behind the card. */
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    map.flyTo({
      center: [adventure.lon, adventure.lat],
      zoom: Math.max(map.getZoom(), 4.2),
      pitch: 26,
      bearing: 0,
      duration: 1500,
      essential: true,
      padding: mobile
        ? { top: 0, right: 0, bottom: Math.round(window.innerHeight * 0.62), left: 0 }
        : { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }, [markersReady, selectedId]);

  return (
    <div className="globe">
      <div
        ref={containerRef}
        className="globe__canvas"
        role="region"
        aria-label="Interactive globe of outdoor places. Drag to orbit, scroll to zoom, and select a marker to open it."
      />

      <p className="globe__loading mono" aria-hidden="true">
        Charting the atlas
      </p>

      {failed ? (
        <div className="globe__cover globe__cover--error" role="alert">
          <strong>The globe could not draw.</strong>
          <span>The basemap may be unavailable from this network.</span>
          <button
            type="button"
            className="button button--small"
            onClick={() => setRetryKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
