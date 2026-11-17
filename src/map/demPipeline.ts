/**
 * Elevation tile pipeline: fetch → decode → resample → encode.
 *
 * This module is deliberately context-free: it runs inside the DEM worker (see
 * `dem.worker.ts`) so the resample never blocks a frame, and it can also be
 * instantiated on the main thread as a fallback for environments without
 * workers. The main thread only ever receives a finished `ImageBitmap`.
 *
 * Two providers, in order:
 *
 *   - **Mapterhorn** — 512 px Terrarium from Copernicus GLO-30 plus national
 *     LiDAR where it exists. Native to z12 worldwide, z13/z14 only over those
 *     national datasets.
 *   - **AWS Terrarium** — 256 px, independent infrastructure, native to z11.
 *     Coarser, but it is what keeps relief on screen when Mapterhorn is down:
 *     after two consecutive network failures Mapterhorn is skipped for five
 *     minutes and every tile comes from AWS instead.
 *
 * Every request is answered at `OUT_SIZE` px, at the zoom MapLibre asked for:
 * native where the provider has that level, otherwise the deepest level it does
 * have, resampled up. That is what keeps the hillshade slope maths honest — an
 * overzoomed tile has its slopes multiplied by 2^(camera − tile) in MapLibre,
 * which flattens the relief at exactly the zooms people zoom in to.
 *
 * Resampling happens on decoded elevations. Terrarium packs one number into R, G
 * and B; interpolating the channels separately puts a 256 m notch wherever the
 * carry lands, which the hillshade draws as a hard contour line every 256 m.
 */

export const OUT_SIZE = 512;

export type Provider = {
  id: string;
  template: string;
  /** Native tile grid, in pixels. */
  dim: number;
  /** Deepest native level that exists anywhere. */
  nativeMax: number;
  /** Deepest native level that exists everywhere. */
  globalMax: number;
};

export const PRIMARY: Provider = {
  id: "mapterhorn",
  template: "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp",
  dim: 512,
  nativeMax: 14,
  globalMax: 12,
};

export const FALLBACK: Provider = {
  id: "aws",
  template: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  dim: 256,
  nativeMax: 11,
  globalMax: 11,
};

/** Plain HTTP templates, for consumers that cannot use the MapLibre protocol. */
export const PRIMARY_HTTP_TILE_URL = PRIMARY.template;
export const FALLBACK_HTTP_TILE_URL = FALLBACK.template;

/** Extra credit the fallback provider asks for. */
export const DEM_FALLBACK_ATTRIBUTION = "AWS Terrain Tiles";

export type TileKind = "native" | "resample" | "flat";

export type TileResult = {
  bitmap: ImageBitmap;
  kind: TileKind;
  /** Time spent resampling, which is the work that used to block the main thread. */
  computeMs: number;
};

/** Worker message shapes, shared so the two sides cannot drift apart. */
export type DemJob = { id: number; z: number; x: number; y: number };

export type DemReply =
  | { id: number; bitmap: ImageBitmap; kind: TileKind; computeMs: number }
  | { id: number; error: string };

type Grid = { el: Float32Array; dim: number };

const GRID_LIMIT = 16;
const DOWN_MS = 5 * 60_000;

/** A 2d surface in the worker (OffscreenCanvas) or on the main thread (fallback). */
function surface(size: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("dem: no 2d context");
    return { ctx, take: async () => canvas.transferToImageBitmap() };
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("dem: no 2d context");
    return { ctx, take: () => createImageBitmap(canvas) };
  }
  throw new Error("dem: no canvas available");
}

export function createDemPipeline() {
  const grids = new Map<string, Grid>();
  /** Exact tiles known to 404, so a pan back over a gap costs nothing. */
  const missing = new Set<string>();
  /** z12 cell → deepest native zoom the provider actually has there. */
  const coverage = new Map<string, number>();
  /** Provider id → epoch ms until which it is considered unavailable. */
  const down = new Map<string, number>();
  const fails = new Map<string, number>();

  const isUp = (p: Provider) => (down.get(p.id) ?? 0) <= Date.now();

  function noteFailure(p: Provider) {
    const next = (fails.get(p.id) ?? 0) + 1;
    fails.set(p.id, next);
    if (next >= 2) {
      down.set(p.id, Date.now() + DOWN_MS);
      fails.set(p.id, 0);
    }
  }

  function noteSuccess(p: Provider) {
    fails.set(p.id, 0);
    down.delete(p.id);
  }

  async function fetchBitmap(
    p: Provider,
    z: number,
    x: number,
    y: number,
  ): Promise<ImageBitmap | null> {
    const key = `${p.id}:${z}/${x}/${y}`;
    if (missing.has(key)) return null;
    const url = p.template
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        if (res.status >= 500) noteFailure(p);
        else noteSuccess(p);
        if (res.status === 404 && missing.size < 4096) missing.add(key);
        return null;
      }
      /* Not cached: the caller may hand the bitmap to MapLibre, which transfers
         it and detaches our copy, so a cached one would be dead on reuse. What
         is worth caching is the decoded grid below, not the image. */
      const bitmap = await createImageBitmap(await res.blob());
      noteSuccess(p);
      return bitmap;
    } catch {
      // Network-level failure: no response at all.
      noteFailure(p);
      return null;
    }
  }

  /** Decode a tile to elevations, cached per tile so four children share one. */
  async function gridAt(
    p: Provider,
    z: number,
    x: number,
    y: number,
  ): Promise<Grid | null> {
    const key = `${p.id}:${z}/${x}/${y}`;
    const cached = grids.get(key);
    if (cached) return cached;
    const bitmap = await fetchBitmap(p, z, x, y);
    if (!bitmap) return null;
    const { ctx } = surface(p.dim);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
    const data = ctx.getImageData(0, 0, p.dim, p.dim).data;
    const plain = p.dim * p.dim;
    const el = new Float32Array(plain);
    for (let i = 0, q = 0; q < plain; i += 4, q += 1) {
      el[q] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    }
    const grid = { el, dim: p.dim };
    grids.set(key, grid);
    if (grids.size > GRID_LIMIT) {
      const oldest = grids.keys().next().value;
      if (oldest !== undefined) grids.delete(oldest);
    }
    return grid;
  }

  /**
   * Deepest native level this provider can serve for the tile, learning
   * per-z12-cell coverage once. Without this, every tile at z13/z14 over open
   * terrain would probe the provider and log a 404; with it, a cell costs at
   * most two probes for the whole session and its neighbours cost none.
   */
  async function nativeZoomFor(
    p: Provider,
    z: number,
    x: number,
    y: number,
  ): Promise<number> {
    const capped = Math.min(z, p.nativeMax);
    if (capped <= p.globalMax) return capped;
    const shift = z - p.globalMax;
    const key = `${p.id}:${p.globalMax}/${x >> shift}/${y >> shift}`;
    const known = coverage.get(key);
    if (known !== undefined) return Math.min(capped, known);
    let best = p.globalMax;
    for (let probe = capped; probe > p.globalMax; probe -= 1) {
      const s = z - probe;
      const hit = await fetchBitmap(p, probe, x >> s, y >> s);
      if (hit) {
        best = probe;
        break;
      }
    }
    coverage.set(key, best);
    return best;
  }

  async function remap(
    grid: Grid,
    z: number,
    pz: number,
    x: number,
    y: number,
  ): Promise<TileResult> {
    const started = performance.now();
    const levels = z - pz;
    const children = 2 ** levels;
    const mask = children - 1;
    const dim = grid.dim;
    const span = dim / children;
    const originX = (x & mask) * span;
    const originY = (y & mask) * span;
    const step = span / OUT_SIZE;
    const src = grid.el;

    /* One pixel of apron on every side. The tile next door samples the same
       continuous field across the shared edge, so computing the apron means the
       two tiles agree there to the last bit — without it the sharpening pass has
       a one-sided neighbourhood at the border and every edge shows as a hairline
       step in the hillshade. */
    const N = OUT_SIZE + 2;

    /* Sampling taps are the same for every row, so build them once. */
    const x0 = new Int32Array(N);
    const x1 = new Int32Array(N);
    const fx = new Float32Array(N);
    for (let i = 0; i < N; i += 1) {
      const px = i - 1;
      const sx = Math.min(dim - 1, Math.max(0, originX + (px + 0.5) * step - 0.5));
      const base = Math.floor(sx);
      x0[i] = base;
      x1[i] = Math.min(dim - 1, base + 1);
      fx[i] = sx - base;
    }

    const out = new Float32Array(N * N);
    for (let i = 0; i < N; i += 1) {
      const py = i - 1;
      const sy = Math.min(dim - 1, Math.max(0, originY + (py + 0.5) * step - 0.5));
      const y0 = Math.floor(sy);
      const y1 = Math.min(dim - 1, y0 + 1);
      const fy = sy - y0;
      const row0 = y0 * dim;
      const row1 = y1 * dim;
      const dest = i * N;
      for (let j = 0; j < N; j += 1) {
        const a = x0[j];
        const b = x1[j];
        const t = fx[j];
        const top = src[row0 + a] + (src[row0 + b] - src[row0 + a]) * t;
        const bottom = src[row1 + a] + (src[row1 + b] - src[row1 + a]) * t;
        out[dest + j] = top + (bottom - top) * fy;
      }
    }

    /* Unsharp with a 3×3 box, clamped to the neighbourhood's own range so the
       pass cannot invent a slope where there is none. Edge samples replicate
       the apron, which both keeps the border consistent across tiles and stops
       the clamp at the ends of the parent grid. */
    const AMOUNT = 0.65;
    const sharpened = new Float32Array(N * N);
    for (let y = 0; y < N; y += 1) {
      const row = y * N;
      const up = (y > 0 ? y - 1 : 0) * N;
      const down = (y < N - 1 ? y + 1 : N - 1) * N;
      for (let x = 0; x < N; x += 1) {
        const left = x > 0 ? x - 1 : 0;
        const right = x < N - 1 ? x + 1 : N - 1;
        let sum = 0;
        let lo = Infinity;
        let hi = -Infinity;
        for (const base of [up, row, down]) {
          for (const at of [base + left, base + x, base + right]) {
            const v = out[at];
            sum += v;
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        const mean = sum / 9;
        const here = out[row + x];
        const value = here + AMOUNT * (here - mean);
        sharpened[row + x] = value < lo ? lo : value > hi ? hi : value;
      }
    }

    const { ctx, take } = surface(OUT_SIZE);
    const image = ctx.createImageData(OUT_SIZE, OUT_SIZE);
    const pixels = image.data;
    for (let y = 0; y < OUT_SIZE; y += 1) {
      const from = (y + 1) * N + 1;
      let i = y * OUT_SIZE * 4;
      for (let x = 0; x < OUT_SIZE; x += 1, i += 4) {
        const v = sharpened[from + x] + 32768;
        const whole = Math.floor(v);
        const r = whole >> 8;
        pixels[i] = r;
        pixels[i + 1] = whole - r * 256;
        pixels[i + 2] = Math.round((v - whole) * 256);
        pixels[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const bitmap = await take();
    return {
      bitmap,
      kind: "resample",
      computeMs: performance.now() - started,
    };
  }

  async function resolveFrom(
    p: Provider,
    z: number,
    x: number,
    y: number,
  ): Promise<TileResult | null> {
    const nz = await nativeZoomFor(p, z, x, y);
    if (nz >= z) {
      const native = await fetchBitmap(p, z, x, y);
      if (native) return { bitmap: native, kind: "native", computeMs: 0 };
    }
    for (let pz = Math.min(nz, z - 1); pz >= 0; pz -= 1) {
      const s = z - pz;
      const grid = await gridAt(p, pz, x >> s, y >> s);
      if (grid) return remap(grid, z, pz, x, y);
    }
    return null;
  }

  /** Terrarium sea level: R=128, G=0, B=0 encodes exactly 0 m. A fresh bitmap
   *  each time, for the same reason: the one before it has been handed over. */
  async function flatTile(): Promise<ImageBitmap> {
    const { ctx, take } = surface(OUT_SIZE);
    ctx.fillStyle = "rgb(128, 0, 0)";
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
    return take();
  }

  return {
    /** A blank tile for the client's timeout path, without running a request. */
    flatTile,
    async resolve(z: number, x: number, y: number): Promise<TileResult> {
      for (const provider of [PRIMARY, FALLBACK]) {
        if (!isUp(provider)) continue;
        const result = await resolveFrom(provider, z, x, y);
        if (result) return result;
      }
      return { bitmap: await flatTile(), kind: "flat", computeMs: 0 };
    },
    /** Exposed for tests and for the client's diagnostics. */
    status() {
      return {
        primaryUp: isUp(PRIMARY),
        fallbackUp: isUp(FALLBACK),
        cells: coverage.size,
        grids: grids.size,
      };
    },
  };
}
