import type { Map as MlMap } from "maplibre-gl";
import { DEM_HTTP_TILE_URL } from "./dem";

/**
 * Topographic contours, generated in the browser from the same Terrarium DEM the
 * hillshade uses.
 *
 * Why generate them: there is no free vector contour source we can rely on, and a
 * raster topographic basemap would fight the palette and cost a tile request per
 * pan. The DEM is already here, so contours come out of marching squares over the
 * tiles covering the viewport. The work happens in a worker built from a blob URL,
 * which is also what keeps the single-file build self-contained (no separate chunk).
 *
 * Contours only make sense once you are close enough for the interval to mean
 * something, so the controller is a no-op below CONTOUR_MIN_ZOOM.
 */

const CONTOUR_MIN_ZOOM = 10;
/* The first version of this allowed six tiles at a 100 m interval and emitted
   north of half a million segments; the structured clone plus MapLibre's line
   tessellation froze the tab. The caps below are the compromise: two tiles, at
   most ten elevation levels per tile, and a contiguous cap per level.

   The old version also fixed the DEM level at z10 and thinned each level to 220
   segments. That looks fine from z10 and falls apart close in: at z14 a z10
   cell is ~450 m wide on the ground, so every line arrives as a huge staircase
   with most of its segments missing. The levels now follow the camera and the
   caps are high enough that the linework stays continuous. */
const MAX_TILES = 2;
const MAX_SEGMENTS_PER_LEVEL = 900;
const MAX_LEVELS = 10;
const TIME_BUDGET_MS = 320;

const WORKER_SRC = String.raw`
const LOOKUP = {
  1: [3, 0], 14: [3, 0],
  2: [0, 1], 13: [0, 1],
  3: [3, 1], 12: [3, 1],
  4: [1, 2], 11: [1, 2],
  6: [0, 2], 9: [0, 2],
  7: [3, 2], 8: [3, 2],
};

function intersect(edge, x, y, level, a, b, c, d) {
  if (edge === 0) return [x + (level - a) / (b - a), y];
  if (edge === 1) return [x + 1, y + (level - b) / (c - b)];
  if (edge === 2) return [x + (level - d) / (c - d), y + 1];
  return [x, y + (level - a) / (d - a)];
}

function march(elev, w, h, level) {
  const segs = [];
  for (let y = 0; y < h - 1; y++) {
    const row = y * w;
    for (let x = 0; x < w - 1; x++) {
      const a = elev[row + x];
      const b = elev[row + x + 1];
      const c = elev[row + w + x + 1];
      const d = elev[row + w + x];
      let mask = 0;
      if (a > level) mask |= 1;
      if (b > level) mask |= 2;
      if (c > level) mask |= 4;
      if (d > level) mask |= 8;
      if (mask === 0 || mask === 15) continue;

      if (mask === 5) {
        segs.push([x, y, x + 1, y + 1]);
        continue;
      }
      if (mask === 10) {
        segs.push([x + 1, y, x, y + 1]);
        continue;
      }
      const pair = LOOKUP[mask];
      const p1 = intersect(pair[0], x, y, level, a, b, c, d);
      const p2 = intersect(pair[1], x, y, level, a, b, c, d);
      segs.push([p1[0], p1[1], p2[0], p2[1]]);
    }
  }
  return segs;
}

function tileBounds(z, x, y, n) {
  const lon = (v) => ((x + v) / n) * 360 - 180;
  const lat = (v) => {
    const t = 1 - 2 * (y + v) / n;
    return (Math.atan(Math.sinh(Math.PI * t)) * 180) / Math.PI;
  };
  return { lon, lat };
}

self.onmessage = async (e) => {
  const { tiles, interval, template, grid, maxLevels, maxSegments } = e.data;
  const features = [];
  const stats = { tiles: 0, levels: 0, segments: 0, dims: [], range: null, errors: 0 };

  for (const t of tiles) {
    const url = template
      .replace("{z}", t.z)
      .replace("{x}", t.x)
      .replace("{y}", t.y)
      .replace("{ratio}", "");
    let data = null;
    let w = 0;
    let h = 0;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bmp = await createImageBitmap(await res.blob());
      w = grid;
      h = grid;
      const cv = new OffscreenCanvas(w, h);
      const ctx = cv.getContext("2d");
      ctx.drawImage(bmp, 0, 0, w, h);
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (err) {
      stats.errors += 1;
      continue;
    }
    if (!data) continue;
    stats.tiles += 1;
    stats.dims.push([w, h]);
    const elev = new Float32Array(w * h);
    void stats.range;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const v = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
      elev[p] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!isFinite(lo) || !isFinite(hi)) continue;
    stats.range = [Math.round(lo), Math.round(hi)];

    const n = 2 ** t.z;
    const { lon, lat } = tileBounds(t.z, t.x, t.y, n);
    const first = Math.ceil(lo / interval) * interval;
    const started = performance.now();

    // Widen the interval if the tile spans more levels than we are willing to
    // draw, rather than emitting the bottom few and running out of budget.
    const count = Math.floor((hi - first) / interval) + 1;
    const step = count > maxLevels ? interval * Math.ceil(count / maxLevels) : interval;

    for (let level = first; level <= hi; level += step) {
      if (level <= 0) continue;
      // Hard time budget per tile: a view over the Himalaya is allowed to
      // produce fewer contours, never to stall the worker.
      if (performance.now() - started > ${TIME_BUDGET_MS}) break;
      const segs = march(elev, w, h, level);
      stats.levels += 1;
      stats.segments += segs.length;
      if (!segs.length) continue;

      // Contiguous cap: a dense alpine tile cannot flood the map, and the
      // lines that do arrive are unbroken, not sampled into dashes.
      const lines = [];
      for (let i = 0; i < segs.length && lines.length < maxSegments; i++) {
        const s = segs[i];
        lines.push([
          [lon(s[0]), lat(s[1])],
          [lon(s[2]), lat(s[3])],
        ]);
      }
      features.push({
        type: "Feature",
        properties: { level, major: level % 500 === 0 ? 1 : 0 },
        geometry: { type: "MultiLineString", coordinates: lines },
      });
    }
  }

  self.postMessage({ features, stats });
};
`;

const LAYER_MINOR = "contours-minor";
const LAYER_MAJOR = "contours-major";

export interface ContourHandle {
  setEnabled(on: boolean): void;
  reload(): void;
  destroy(): void;
}

function intervalForZoom(zoom: number) {
  if (zoom < 11.5) return 250;
  if (zoom < 12.5) return 150;
  if (zoom < 13.5) return 100;
  return 50;
}

/* DEM level per camera zoom: close enough to the camera that the marching
   squares grid is a few tens of metres on the ground, deep enough that one or
   two tiles still cover the viewport. Capped at z12, the last level that exists
   worldwide, so contours never vanish over ranges outside national coverage. */
function demZoomForZoom(zoom: number) {
  return Math.max(10, Math.min(12, Math.floor(zoom) - 1));
}

/* 256 cells per tile is what this always ran at; past z12 a wider grid is
   affordable (one tile, few levels) and keeps the lines off a coarse staircase. */
function gridForZoom(zoom: number) {
  return zoom >= 12.5 ? 512 : 256;
}

export function createContours(map: MlMap): ContourHandle {
  let enabled = false;
  let worker: Worker | null = null;
  let url: string | null = null;
  let timer: number | undefined;

  // The protocol used by the hillshade is MapLibre-only; the worker fetches
  // the tiles itself, so it uses the plain HTTPS template.
  const template = DEM_HTTP_TILE_URL;

  function ensureLayers() {
    if (!map.getSource("contours")) {
      map.addSource("contours", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer(LAYER_MINOR)) {
      map.addLayer(
        {
          id: LAYER_MINOR,
          type: "line",
          source: "contours",
          filter: ["==", ["get", "major"], 0],
          paint: {
            "line-color": "#dcefe6",
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.1],
            "line-opacity": 0.26,
          },
        },
        "water",
      );
    }
    if (map.getLayer(LAYER_MAJOR)) raise();
    if (!map.getLayer(LAYER_MAJOR)) {
      map.addLayer(
        {
          id: LAYER_MAJOR,
          type: "line",
          source: "contours",
          filter: ["==", ["get", "major"], 1],
          paint: {
            "line-color": "#f2fbf7",
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 14, 1.7],
            "line-opacity": 0.44,
          },
        },
        "water",
      );
    }
  }

  /* Relief is inserted below the labels on a 2.5 s timer, which can land it on
     top of these lines. Moving them to just under the labels after every change
     keeps contours over the hillshade, where they belong. */
  function raise() {
    for (const id of [LAYER_MINOR, LAYER_MAJOR]) {
      const anchor = map.getLayer("water") ? "water" : "label-country";
      if (map.getLayer(id) && map.getLayer(anchor)) {
        map.moveLayer(id, anchor);
      }
    }
  }

  function clearLayers() {
    raise();
    const src = map.getSource("contours");
    if (src) {
      (src as unknown as { setData: (d: unknown) => void }).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }

  function generate() {
    if (!enabled || !worker || !url) return;
    const zoom = map.getZoom();
    const tiles: { z: number; x: number; y: number }[] = [];
    if (zoom >= CONTOUR_MIN_ZOOM) {
      // A level or two shallower than the camera: fewer, larger tiles carry the
      // same linework at this scale and cost less to decode.
      const z = demZoomForZoom(zoom);
      const n = 2 ** z;
      const b = map.getBounds();
      const lonToX = (v: number) => Math.floor(((v + 180) / 360) * n);
      const latToY = (v: number) => {
        const r = (Math.max(-85, Math.min(85, v)) * Math.PI) / 180;
        return Math.floor(
          ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
        );
      };
      const x0 = lonToX(b.getWest());
      const x1 = lonToX(b.getEast());
      const y0 = latToY(b.getNorth());
      const y1 = latToY(b.getSouth());
      for (let x = x0; x <= x1; x += 1) {
        for (let y = y0; y <= y1; y += 1) {
          if (tiles.length >= MAX_TILES) break;
          tiles.push({ z, x: ((x % n) + n) % n, y: Math.max(0, Math.min(n - 1, y)) });
        }
      }
      worker.postMessage({
        tiles,
        interval: intervalForZoom(zoom),
        grid: gridForZoom(zoom),
        maxLevels: MAX_LEVELS,
        maxSegments: MAX_SEGMENTS_PER_LEVEL,
        template,
      });
    } else {
      clearLayers();
    }
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(generate, 320);
  }

  function boot() {
    if (worker) return;
    ensureLayers();
    clearLayers();
    url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onerror = (e) => {
      if (import.meta.env.DEV) console.error("[terrane] contour worker", e.message);
    };
    worker.onmessage = (
      e: MessageEvent<{ features: unknown[]; stats: unknown }>,
    ) => {
      if (import.meta.env.DEV) {
        (window as unknown as { __contourInfo?: unknown }).__contourInfo = {
          features: e.data.features.length,
          stats: e.data.stats,
        };
      }
      const src = map.getSource("contours");
      if (!enabled || !src) return;
      raise();
      (src as unknown as { setData: (d: unknown) => void }).setData({
        type: "FeatureCollection",
        features: e.data.features,
      });
    };
  }

  const onMoveEnd = () => schedule();
  map.on("moveend", onMoveEnd);

  return {
    setEnabled(on: boolean) {
      enabled = on;
      if (on) {
        boot();
        for (const id of [LAYER_MINOR, LAYER_MAJOR]) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
        }
        schedule();
      } else if (map.getLayer(LAYER_MINOR)) {
        for (const id of [LAYER_MINOR, LAYER_MAJOR]) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
        }
        clearLayers();
      }
    },
    reload: schedule,
    destroy() {
      window.clearTimeout(timer);
      map.off("moveend", onMoveEnd);
      worker?.terminate();
      worker = null;
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
  };
}
