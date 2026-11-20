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

/**
 * Deep zooms get the full 512 grid; everything below this one gets 256.
 *
 * The hillshade is the most expensive thing on the map while zooming — a zoom
 * gesture uploads roughly a megabyte of DEM and runs a prepare pass per tile per
 * level — and the cost is texels, not tiles: a 256 grid is a quarter of them for
 * the same ground and the same tile count. Slopes stay right because MapLibre's
 * prepare shader takes metres-per-texel from the image grid (`u_dimension`), not
 * from the source's `tileSize`, so a coarser image is simply a coarser surface.
 */
export const FULL_GRID_ZOOM = 12;

/** Image grid for a tile at `z`, in px. */
export function gridForZoom(z: number) {
  // Tried dropping this to 128 at z9–11 on the theory that the DEM was texel-bound.
  // Measured at z11: 1.4 fps both ways against a 1.5–1.8 baseline, so the texture
  // size is not what a zoom is waiting on and the coarser grid is not worth its
  // loss of detail. What does cost, measured with the layer hidden: 41 fps at z11.
  return z >= FULL_GRID_ZOOM ? OUT_SIZE : OUT_SIZE / 2;
}

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

/** Extra credit the fallback provider asks for. */
export const DEM_FALLBACK_ATTRIBUTION = "AWS Terrain Tiles";

export type TileKind = "native" | "resample" | "flat";

export type TileResult = {
  bitmap: ImageBitmap;
  kind: TileKind;
  /** The level the surface actually came from: the accepted native level, or
   *  the ancestor a blank one was remapped up from. Diagnostics and tests. */
  from?: number;
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

/* ── surface conditioning ───────────────────────────────────────────────

   Two defects lived in the raw provider surface:

   - Sea level was whatever the surface model said — negative terrarium
     values and a metre or two of coastal noise included — and the
     exaggeration slider multiplied both into spikes across every water body.
   - Placeholder tiles. Mapterhorn answers 200 with a 52–126 byte blank tile
     where it has no national dataset (the Ligurian Apennines at z12–z14, for
     one), and a 200 used to read as coverage: a 1 500 m ridge got painted at
     0 m beside full-height neighbours, which is the wedge and the shelves
     seen over the coast.

   Everything below runs on the one path every provider and the fallback
   share, so the rules cannot drift apart. */

/** Sharpening is only honest on a full grid: a 256 grid has no detail to boost. */
export const SHARPEN_AMOUNT = 0.65;

/** At or below this elevation a sample is water, and reads as exactly 0 m. */
export const SEA_FLAT_M = 1;

/** By this elevation the true value is back: a ramp, not a coastal shelf. */
export const SEA_RAMP_M = 7;

/** Lowland smoothing is full strength at the shore and gone by this height. */
export const LOWLAND_M = 40;

/** A provider tile under this many bytes carries no raster data at all.
 *  Blank Mapterhorn webp tiles are 52–126 bytes and blank AWS png 757, while a
 *  real tile at any level is tens of kilobytes. */
export const BLANK_TILE_BYTES = 2000;

/** Sea level: flat at 0, with a C¹ ramp back to the true value by SEA_RAMP_M. */
export function settleSea(elevation: number): number {
  if (elevation <= SEA_FLAT_M) return 0;
  if (elevation >= SEA_RAMP_M) return elevation;
  const t = (elevation - SEA_FLAT_M) / (SEA_RAMP_M - SEA_FLAT_M);
  return elevation * (t * t * (3 - 2 * t));
}

/** How much of the 3×3 mean to mix in: 1 on water, 0 above LOWLAND_M. */
export function lowlandWeight(elevation: number): number {
  if (elevation <= 5) return 1;
  if (elevation >= LOWLAND_M) return 0;
  const t = (elevation - 5) / (LOWLAND_M - 5);
  return 1 - t * t * (3 - 2 * t);
}

/** Sharpening amount for a tile of `size` px: 0 below the full grid. */
export function sharpenAmountFor(size: number): number {
  return size >= OUT_SIZE ? SHARPEN_AMOUNT : 0;
}

/** A 32×32 read of a tile, for deciding whether it needs conditioning at all:
 *  a mountain tile has nothing near the shore, and a water tile is already
 *  flat. Both go to MapLibre untouched, which keeps the deep zooms cheap. */
export type TileSample = { min: number; max: number; zeros: number };

/** Whether any sample would be changed by the lowland smoothing or sea clamp. */
export function touchesLowland(el: Float32Array): boolean {
  for (let i = 0; i < el.length; i += 1) {
    if (el[i] <= LOWLAND_M) return true;
  }
  return false;
}

/** True for a decoded grid that holds no relief at all. */
export function isPlaceholder(el: Float32Array): boolean {
  for (let i = 0; i < el.length; i += 1) {
    if (el[i] > 1 || el[i] < -1) return false;
  }
  return true;
}

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
  /** The same key where that level turned out to be a blank plate: open water,
   *  not a gap, so the tile can be served flat without resampling the pyramid. */
  const blankCoverage = new Set<string>();
  /** The tile a probe just accepted, so the caller does not fetch it again. */
  const recent = new Map<string, { bitmap: ImageBitmap; bytes: number }>();
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
  ): Promise<{ bitmap: ImageBitmap; bytes: number } | null> {
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
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      noteSuccess(p);
      return { bitmap, bytes: blob.size };
    } catch {
      // Network-level failure: no response at all.
      noteFailure(p);
      return null;
    }
  }

  /** Turn a fetched bitmap into elevations. The tile is decoded once here and
   *  the grid is what gets cached: the bitmap itself is handed to MapLibre and
   *  detached. */
  function gridFromBitmap(p: Provider, bitmap: ImageBitmap): Grid {
    const { ctx } = surface(p.dim);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
    const data = ctx.getImageData(0, 0, p.dim, p.dim).data;
    const plain = p.dim * p.dim;
    const el = new Float32Array(plain);
    for (let i = 0, q = 0; q < plain; i += 4, q += 1) {
      el[q] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    }
    return { el, dim: p.dim };
  }

  /** One cheap thumbnail read: the decision, not the surface. */
  function sampleTile(bitmap: ImageBitmap): TileSample {
    const n = 32;
    const { ctx } = surface(n);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, n, n);
    const data = ctx.getImageData(0, 0, n, n).data;
    let min = Infinity;
    let max = -Infinity;
    let zeros = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
      if (v < min) min = v;
      if (v > max) max = v;
      if (Math.abs(v) < 1) zeros += 1;
    }
    return { min, max, zeros: zeros / (n * n) };
  }

  /** A provider tile at the grid this zoom uses. Deep zooms take the 512 grid
   *  and below FULL_GRID_ZOOM the same surface is scaled to 256, which is what
   *  keeps the terrain mesh (and the hillshade) cheap at regional zooms. */
  async function scaleBitmap(bitmap: ImageBitmap, size: number): Promise<ImageBitmap> {
    const { ctx, take } = surface(size);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, size, size);
    return take();
  }

  function remember(key: string, grid: Grid) {
    grids.set(key, grid);
    if (grids.size > GRID_LIMIT) {
      const oldest = grids.keys().next().value;
      if (oldest !== undefined) grids.delete(oldest);
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
    const hit = await fetchBitmap(p, z, x, y);
    if (!hit) return null;
    const grid = gridFromBitmap(p, hit.bitmap);
    remember(key, grid);
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
    const shift = z - p.globalMax;
    const key = `${p.id}:${p.globalMax}/${x >> shift}/${y >> shift}`;
    const known = coverage.get(key);
    if (known !== undefined) return Math.min(capped, known);

    /* Coverage is decided by payload, not by status. The provider answers 200
       with an empty tile wherever it has no dataset, and a blank taken as a
       level would put a 0 m plate under a 1 500 m ridge: the wedges and
       shelves that used to hang over the Ligurian coast. Descend until a tile
       carries data; the budget stops a flat sea cell walking the whole
       pyramid, and the answer is cached per cell either way. */
    let best = 0;
    let blank = false;
    for (let probe = capped, budget = 6; probe >= 0 && budget > 0; probe -= 1, budget -= 1) {
      const s = z - probe;
      const hit = await fetchBitmap(p, probe, x >> s, y >> s);
      if (!hit) continue;
      best = probe;
      blank = hit.bytes < BLANK_TILE_BYTES;
      /* The bitmap is kept: at the level it accepts, the caller needs exactly
         this tile, and fetching it twice would decode it twice. */
      if (!blank) recent.set(`${p.id}:${probe}/${x >> s}/${y >> s}`, hit);
      if (!blank) break;
    }
    coverage.set(key, best);
    if (blank) blankCoverage.add(key);
    else blankCoverage.delete(key);
    return best;
  }

  /** Bilinear projection of an ancestor grid onto this tile's pixel grid.
   *  `pz === z` is the same-level case: a 512 native tile going to a 256 grid. */
  function project(
    g: Grid,
    z: number,
    pz: number,
    x: number,
    y: number,
    size: number,
    apron: number,
  ): Float32Array {
    const children = 2 ** (z - pz);
    const mask = children - 1;
    const span = g.dim / children;
    const originX = (x & mask) * span;
    const originY = (y & mask) * span;
    const step = span / size;
    const N = size + 2 * apron;
    const out = new Float32Array(N * N);
    const src = g.el;
    for (let j = 0; j < N; j += 1) {
      const sy = Math.min(g.dim - 1, Math.max(0, originY + (j - apron + 0.5) * step - 0.5));
      const y0 = Math.floor(sy);
      const y1 = Math.min(g.dim - 1, y0 + 1);
      const fy = sy - y0;
      const row0 = y0 * g.dim;
      const row1 = y1 * g.dim;
      const dest = j * N;
      for (let i = 0; i < N; i += 1) {
        const sx = Math.min(g.dim - 1, Math.max(0, originX + (i - apron + 0.5) * step - 0.5));
        const x0 = Math.floor(sx);
        const x1 = Math.min(g.dim - 1, x0 + 1);
        const fx = sx - x0;
        const top = src[row0 + x0] + (src[row0 + x1] - src[row0 + x0]) * fx;
        const bottom = src[row1 + x0] + (src[row1 + x1] - src[row1 + x0]) * fx;
        out[dest + i] = top + (bottom - top) * fy;
      }
    }
    return out;
  }

  /** Replace provider holes with the coarser surface: a 0 m sample where the
   *  ancestor says 700 m is missing data, not sea. Only the holes move. */
  async function fillHoles(
    p: Provider,
    out: Float32Array,
    z: number,
    pz: number,
    x: number,
    y: number,
    size: number,
    apron: number,
  ): Promise<boolean> {
    let holes = 0;
    for (let i = 0; i < out.length; i += 1) {
      if (out[i] > -1 && out[i] < 1) holes += 1;
    }
    if (holes === 0) return false;
    /* A tile can be a hole in its entirety — the provider's blank plate for a
       level it does not have — so "all zero" is not a reason to stop; the
       coarser grid is exactly what is needed then. Only two ancestors are
       consulted: past that the surface is a different landscape. */
    for (let level = pz - 1, tries = 0; level >= 0 && tries < 2; level -= 1, tries += 1) {
      const s = z - level;
      const g = await gridAt(p, level, x >> s, y >> s);
      if (!g) continue;
      const ref = project(g, z, level, x, y, size, apron);
      let filled = 0;
      for (let i = 0; i < out.length; i += 1) {
        if (out[i] <= -1 || out[i] >= 1) continue;
        const v = ref[i];
        if (v > 25 || v < -25) {
          out[i] = v;
          filled += 1;
        }
      }
      if (filled > 0) return true;
    }
    return false;
  }

  /** One surface, one encode: sharpen where the grid is full, settle lowland
   *  noise, clamp the sea, then pack terrarium. */
  async function encode(
    src: Float32Array,
    size: number,
    apron: number,
    from: number,
  ): Promise<TileResult> {
    const started = performance.now();
    const N = size + 2 * apron;
    const amount = sharpenAmountFor(size);
    const settled = new Float32Array(size * size);
    for (let y = 0; y < size; y += 1) {
      const by = y + apron;
      const up = (by > 0 ? by - 1 : 0) * N;
      const row = by * N;
      const down = (by < N - 1 ? by + 1 : N - 1) * N;
      for (let x = 0; x < size; x += 1) {
        const bx = x + apron;
        const l = bx > 0 ? bx - 1 : 0;
        const r = bx < N - 1 ? bx + 1 : N - 1;
        const here = src[row + bx];
        const north = src[up + bx];
        const south = src[down + bx];
        const west = src[row + l];
        const east = src[row + r];
        const mean =
          (src[up + l] + north + src[up + r] + west + here + east + src[down + l] + south + src[down + r]) / 9;
        let lo = here;
        let hi = here;
        for (const v of [north, south, west, east]) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        /* Sharpening is clamped to the neighbourhood's own range so it cannot
           invent a slope, and it is zero below the full grid, where there is
           no native detail to sharpen — only facet edges to amplify. */
        let value = here + amount * (here - mean);
        if (value < lo) value = lo;
        if (value > hi) value = hi;
        /* A light 3×3 mix at low elevations only: coastal needle noise goes,
           ridges keep every metre. */
        const weight = lowlandWeight(value);
        if (weight > 0) value += (mean - value) * weight;
        settled[y * size + x] = settleSea(value);
      }
    }

    const { ctx, take } = surface(size);
    const image = ctx.createImageData(size, size);
    const pixels = image.data;
    for (let i = 0, q = 0; q < settled.length; q += 1, i += 4) {
      const v = settled[q] + 32768;
      const whole = Math.floor(v);
      const r = whole >> 8;
      pixels[i] = r;
      pixels[i + 1] = whole - r * 256;
      pixels[i + 2] = Math.round((v - whole) * 256);
      pixels[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return { bitmap: await take(), kind: "resample", from, computeMs: performance.now() - started };
  }

  async function remap(
    p: Provider,
    grid: Grid,
    z: number,
    pz: number,
    x: number,
    y: number,
  ): Promise<TileResult | null> {
    const levels = z - pz;
    const children = 2 ** levels;
    const mask = children - 1;
    const dim = grid.dim;
    const span = dim / children;
    const originX = (x & mask) * span;
    const originY = (y & mask) * span;
    const size = gridForZoom(z);
    const step = span / size;
    const src = grid.el;

    /* One pixel of apron on every side. The tile next door samples the same
       continuous field across the shared edge, so computing the apron means the
       two tiles agree there to the last bit — without it the sharpening pass has
       a one-sided neighbourhood at the border and every edge shows as a hairline
       step in the hillshade. */
    const N = size + 2;

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

    await fillHoles(p, out, z, pz, x, y, size, 1);
    /* A surface that is still mostly zero after refilling is a provider mask,
       not a coastline: the coastal strip Mapterhorn leaves empty is one. The
       other provider has real relief there, so hand the tile over rather than
       painting a flat plate beside an 800 m neighbour. */
    if (p === PRIMARY) {
      let zeros = 0;
      for (let i = 0; i < out.length; i += 1) {
        if (out[i] > -1 && out[i] < 1) zeros += 1;
      }
      if (zeros / out.length > 0.4) return null;
    }
    return encode(out, size, 1, pz);
  }

  async function resolveFrom(
    p: Provider,
    z: number,
    x: number,
    y: number,
  ): Promise<TileResult | null> {
    const nz = await nativeZoomFor(p, z, x, y);
    if (nz >= z) {
      const reuseKey = `${p.id}:${z}/${x}/${y}`;
      const reused = recent.get(reuseKey);
      if (reused) recent.delete(reuseKey);
      const hit = reused ?? (await fetchBitmap(p, z, x, y));
      if (hit) {
        const size = gridForZoom(z);
        const sample = sampleTile(hit.bitmap);
        /* Open water, or ground that never comes near the shore: nothing the
           conditioning would change, so the provider's bitmap is the surface —
           at this zoom's grid, not the provider's. */
        if (sample.max < 5 || (sample.min > LOWLAND_M && sample.zeros < 0.01)) {
          const bitmap =
            p.dim === size ? hit.bitmap : await scaleBitmap(hit.bitmap, size);
          return { bitmap, kind: "native", from: z, computeMs: 0 };
        }
        const grid = gridFromBitmap(p, hit.bitmap);
        const scaled =
          grid.dim === size ? grid.el : project(grid, z, z, x, y, size, 0);
        const hadHoles = await fillHoles(p, scaled, z, z, x, y, size, 0);
        if (p === PRIMARY && sample.zeros > 0.4) return null;
        if (!hadHoles && !touchesLowland(scaled)) {
          const bitmap =
            p.dim === size ? hit.bitmap : await scaleBitmap(hit.bitmap, size);
          return { bitmap, kind: "native", from: z, computeMs: 0 };
        }
        return encode(scaled, size, 0, z);
      }
    }
    /* Every level this provider has is blank. That is water over open sea, but
       it is also what a coverage hole looks like (the Ligurian coast at z13):
       before calling it flat, let the other provider answer — AWS keeps real
       relief there, and a flat plate beside an 800 m neighbour is the wedge.
       Only the last provider in the chain may conclude "water". */
    const cellKey = `${p.id}:${p.globalMax}/${x >> Math.max(0, z - p.globalMax)}/${y >> Math.max(0, z - p.globalMax)}`;
    if (blankCoverage.has(cellKey)) {
      if (p === PRIMARY) return null;
      return { bitmap: await flatTile(z), kind: "flat", from: nz, computeMs: 0 };
    }
    for (let pz = Math.min(nz, z - 1); pz >= 0; pz -= 1) {
      const s = z - pz;
      const grid = await gridAt(p, pz, x >> s, y >> s);
      if (grid) {
        const tile = await remap(p, grid, z, pz, x, y);
        if (tile) return tile;
      }
    }
    return null;
  }

  /** Terrarium sea level: R=128, G=0, B=0 encodes exactly 0 m. A fresh bitmap
   *  each time, for the same reason: the one before it has been handed over. */
  async function flatTile(z: number): Promise<ImageBitmap> {
    const size = gridForZoom(z);
    const { ctx, take } = surface(size);
    ctx.fillStyle = "rgb(128, 0, 0)";
    ctx.fillRect(0, 0, size, size);
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
      return { bitmap: await flatTile(z), kind: "flat", computeMs: 0 };
    },
  };
}
