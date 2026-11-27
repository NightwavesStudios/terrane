import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type IControl,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { worldZoom } from "../lib/camera";
import { createStyle } from "../map/style";

setWorkerUrl(maplibreWorkerUrl);

const WORLD: [number, number] = [12, 22];

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

export default function MapGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stage = container.closest(".home");
    stage?.removeAttribute("data-map");
    setFailed(false);

    let disposed = false;
    let map: MapLibreMap | null = null;
    let ready = false;
    let revealTimer: number | undefined;
    let failTimer: number | undefined;

    const reveal = () => {
      if (disposed || ready) return;
      ready = true;
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

      liveMap.on("load", () => {
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
      });

      liveMap.on("zoomend", () => applyTerrain(liveMap));
      liveMap.once("idle", reveal);

      revealTimer = window.setTimeout(reveal, 6000);
      failTimer = window.setTimeout(() => {
        if (!disposed && !ready) setFailed(true);
      }, 18000);

      const resizeObserver = new ResizeObserver(() => liveMap.resize());
      resizeObserver.observe(container);

      return () => {
        disposed = true;
        if (revealTimer !== undefined) window.clearTimeout(revealTimer);
        if (failTimer !== undefined) window.clearTimeout(failTimer);
        resizeObserver.disconnect();
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
  }, [retryKey]);

  return (
    <div className="globe">
      <div
        ref={containerRef}
        className="globe__canvas"
        role="region"
        aria-label="Interactive globe. Drag to orbit and scroll or pinch to zoom."
      />

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
