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

/**
 * The coverage cell a tile belongs to.
 *
 * The cell is the tile itself at or above the provider's global level, and the
 * provider's global-max ancestor below it. The shift therefore has to be
 * clamped: `z - globalMax` is negative at z2, and a negative shift in JS wraps
 * modulo 32, so every level under the global max used to hash to the same cell.
 * One z1 globe tile then recorded "level 1 here" for the whole world, and every
 * later z6–11 request was answered from z1 and resampled up: the smooth mush
 * the relief turned into after the globe opened.
 *
 * `coverage` and `blankCoverage` are both keyed by this, so they cannot drift
 * apart the way the two hand-written expressions did.
 */
export function demCell(p: Provider, z: number, x: number, y: number): string {
  const level = Math.min(z, p.globalMax);
  const shift = z - level;
  return `${p.id}:${level}/${x >> shift}/${y >> shift}`;
}

/**
 * Whether this request has anything to learn about coverage.
 *
 * Below the global level there is nothing to learn anywhere: the provider has
 * every tile there. At the global level it depends on the provider — Mapterhorn
 * keeps going to z14 on national datasets, so its z12 can be a blank plate over
 * a country it does not cover, and that level still has to be checked. AWS stops
 * at its global level, so a zero there is sea level and not a mask.
 *
 * Getting this wrong is not a slow tile: skipping the check at Mapterhorn z12
 * paints a 0 m plate under a 1 500 m ridge, which is the coastal wedge the
 * blank-tile handling exists to prevent.
 */
export function needsProbe(p: Provider, z: number): boolean {
  if (z < p.globalMax) return false;
  if (z === p.globalMax && p.nativeMax <= p.globalMax) return false;
  return true;
}

/** Plain HTTP templates, for consumers that cannot use the MapLibre protocol. */
export const PRIMARY_HTTP_TILE_URL = PRIMARY.template;

/** Extra credit the fallback provider asks for. */
export const DEM_FALLBACK_ATTRIBUTION = "AWS Terrain Tiles";

/** One coverage probe that actually answered, and how much it carried. */
export type CoverageProbe = { level: number; bytes: number };

/** What a coverage walk learned: the deepest level that answered, whether that
 *  level was a blank plate, and whether anything answered at all.
 *
 *  `learned` is the part that matters. A walk whose probes all failed — a 404,
 *  a 5xx, a socket that never came back — learned nothing about the ground, and
 *  caching that as "level 0 here" pinned the whole cell to a planet-scale grid:
 *  every later tile in it was remapped from a z0 tile, i.e. a kilometre or two
 *  of height in the wrong place. That is a spike, and it lasts for the session. */
export type CoverageVerdict = { level: number; blank: boolean; learned: boolean };

export function coverageVerdict(probes: CoverageProbe[]): CoverageVerdict {
  let level = 0;
  let blank = false;
  for (const probe of probes) {
    /* The walk descends, so the last entry is the deepest level that answered;
       the first one carrying real data is the one to use. */
    level = probe.level;
    blank = probe.bytes < BLANK_TILE_BYTES;
    if (!blank) break;
  }
  return { level, blank: probes.length > 0 ? blank : false, learned: probes.length > 0 };
}

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
export type DemTileJob = {
  id: number;
  z: number;
  x: number;
  y: number;
  /** A parent of the camera's own level: one fetch, no probe walk, no hole
   *  fill. MapLibre only draws it while the camera's tiles load. */
  shallow?: boolean;
  /** The level one deeper than the camera: mesh refinement only, so the
   *  provider's bitmap is passed through instead of being conditioned. */
  child?: boolean;
  cancel?: boolean;
};
/** Dev-only: ask the worker what it actually fetched. */
export type DemStatsJob = { id: number; stats: true };
export type DemJob = DemTileJob | DemStatsJob;

export type DemReply =
  | {
      id: number;
      bitmap: ImageBitmap;
      kind: TileKind;
      computeMs: number;
      /** The level the surface actually came from. */
      from?: number;
    }
  | { id: number; cancelled: true }
  | { id: number; trace: DemTrace }
  | { id: number; error: string };

/**
 * What the worker actually did, for the dev bench. Fetch counts per level are
 * the only honest way to show that a zoom no longer probes the pyramid: the
 * resolved-tile log alone would look the same either way.
 */
export type DemTrace = {
  fetches: { provider: string; level: number }[];
  /** One entry per coverage probe, with the zoom that asked for it. */
  probes: { provider: string; root: number; level: number }[];
  /** One entry per tile produced: the level it came from and the elevation
   *  spread of the surface encoded. `min === max` means a flat plate, so this
   *  is what tells a real ridge from the resampled mush. */
  tiles: { z: number; kind: string; from?: number; min: number; max: number }[];
};

type Grid = { el: Float32Array; dim: number };

const GRID_LIMIT = 16;
/** Probe bitmaps parked for a caller that may never come back, at most. */
const RECENT_LIMIT = 24;
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

type Surface = {
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  take: () => Promise<ImageBitmap>;
};

/** One canvas per size, reused for the life of the pipeline. */
const surfaces = new Map<number, Surface>();

/** A 2d surface in the worker (OffscreenCanvas) or on the main thread (fallback).
 *
 *  Two things here were the deep-zoom stall. The context was created with no
 *  options, so it was GPU-backed and every `getImageData` was a readback through
 *  the same GPU process the main thread is drawing the globe with: six parallel
 *  tiles per worker meant six readbacks queued behind the frame in progress, and
 *  at z9–z11 that pushed every tile past the 20 s timeout, so none of them ever
 *  resolved. `willReadFrequently` keeps the surface CPU-side, where the read is a
 *  copy, and the canvas is kept instead of allocated per call, which is what made
 *  each of those readbacks also pay for a fresh GPU texture.
 *
 *  Every caller paints the whole surface before taking it, so one canvas per size
 *  can be shared: `take` snapshots synchronously, before any await. */
function surface(size: number): Surface {
  const cached = surfaces.get(size);
  if (cached) return cached;
  const options: CanvasRenderingContext2DSettings = { willReadFrequently: true };
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d", options);
    if (!ctx) throw new Error("dem: no 2d context");
    const made: Surface = { ctx, take: async () => canvas.transferToImageBitmap() };
    surfaces.set(size, made);
    return made;
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", options);
    if (!ctx) throw new Error("dem: no 2d context");
    const made: Surface = { ctx, take: () => createImageBitmap(canvas) };
    surfaces.set(size, made);
    return made;
  }
  throw new Error("dem: no canvas available");
}

/** How long one tile fetch may take before we stop waiting on the socket. */
const FETCH_DEADLINE_MS = 8000;

/** The caller's abort signal, plus a deadline of our own. */
function boundedSignal(signal?: AbortSignal): AbortSignal | undefined {
  const api = AbortSignal as unknown as {
    timeout?: (ms: number) => AbortSignal;
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  const deadline = api.timeout?.(FETCH_DEADLINE_MS);
  if (!deadline) return signal;
  if (!signal) return deadline;
  return api.any ? api.any([signal, deadline]) : signal;
}

export function createDemPipeline() {
  /* Dev counters, and the browser bench's production build (VITE_BENCH=1).
     Without the flag the pushes are compiled out of the bundle entirely. */
  const TRACE = import.meta.env.DEV || import.meta.env.VITE_BENCH === "1";
  const trace: DemTrace = { fetches: [], probes: [], tiles: [] };
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
    signal?: AbortSignal,
    size?: number,
  ): Promise<{ bitmap: ImageBitmap; bytes: number } | null> {
    if (signal?.aborted) return null;
    const key = `${p.id}:${z}/${x}/${y}`;
    if (missing.has(key)) return null;
    if (TRACE) trace.fetches.push({ provider: p.id, level: z });
    const url = p.template
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    /* A request that never answers used to hold its job forever: the timeout in
       the client stops waiting, but the worker stayed inside this await, so the
       next tile queued behind a connection nobody was going to close. Bounded
       here, the job always reaches its end. */
    const bound = boundedSignal(signal);
    try {
      const res = await fetch(url, { mode: "cors", signal: bound });
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
      if (signal?.aborted) return null;
      /* Decode straight to the grid this request will emit.

         Every surface below z12 is a 256 grid, and the browser can scale during
         the decode: without this the worker decoded a 512×512 image, then drew
         it down and read a quarter of it back — the decode and the readback are
         the two most expensive steps in the whole pipeline on a software
         rasteriser, and both were being paid for pixels that were thrown away. */
      const bitmap =
        size && size !== p.dim
          ? await createImageBitmap(blob, {
              resizeWidth: size,
              resizeHeight: size,
              resizeQuality: "medium",
            })
          : await createImageBitmap(blob);
      noteSuccess(p);
      return { bitmap, bytes: blob.size };
    } catch {
      /* A tile the camera left behind is not a provider failure: zooming away
         twice must not take Mapterhorn out of service for five minutes. */
      if (signal?.aborted) return null;
      /* Our own deadline, not the network's answer: one stalled connection must
         not read as a provider outage. */
      if (bound?.aborted) return null;
      // Network-level failure: no response at all.
      noteFailure(p);
      return null;
    }
  }

  /** Turn a fetched bitmap into elevations. The tile is decoded once here and
   *  the grid is what gets cached: the bitmap itself is handed to MapLibre and
   *  detached. */
  function gridFromBitmap(p: Provider, bitmap: ImageBitmap, dim = p.dim): Grid {
    /* Read at the grid this zoom actually emits, not always at the provider's
       full size. Every `getImageData` is a GPU readback, the most expensive
       thing in the worker on a software rasteriser, and below z12 the surface
       is emitted at 256 anyway: reading 512 and throwing three quarters of it
       away was paying four times the readback for the same result. */
    const { ctx } = surface(dim);
    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, dim, dim);
    const data = ctx.getImageData(0, 0, dim, dim).data;
    const plain = dim * dim;
    const el = new Float32Array(plain);
    for (let i = 0, q = 0; q < plain; i += 4, q += 1) {
      el[q] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    }
    return { el, dim };
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

  /** The bitmap at `size`, copying only when the decode did not already do it. */
  async function atSize(bitmap: ImageBitmap, size: number): Promise<ImageBitmap> {
    return bitmap.width === size ? bitmap : scaleBitmap(bitmap, size);
  }

  function remember(key: string, grid: Grid) {
    grids.set(key, grid);
    if (grids.size > GRID_LIMIT) {
      const oldest = grids.keys().next().value;
      if (oldest !== undefined) grids.delete(oldest);
    }
  }

  /** Keep a probe's bitmap for the caller, but never without a bound.
   *
   * A z13 request probes z12, accepts it, and then resamples it — so nothing
   * ever reads the bitmap the probe parked under the z12 key. Unbounded, that
   * is a megabyte of decoded tile per cell for the life of the worker, and a
   * phone panning a range collects enough of them to be evicted mid-gesture. */
  function keepRecent(key: string, hit: { bitmap: ImageBitmap; bytes: number }) {
    recent.set(key, hit);
    while (recent.size > RECENT_LIMIT) {
      const oldest = recent.keys().next().value;
      if (oldest === undefined) break;
      const stale = recent.get(oldest);
      recent.delete(oldest);
      stale?.bitmap.close();
    }
  }

  /** A tile that is being decoded right now. Six adjacent deep tiles all want
   *  the same parent, and every one of them used to fetch and decode it again:
   *  at z9–z11 the hole fill was re-requesting the same ancestor six times over,
   *  which is what put every deep tile past its timeout. */
  const decoding = new Map<string, Promise<Grid | null>>();

  /** Decode a tile to elevations, cached per tile so four children share one. */
  async function gridAt(
    p: Provider,
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
    dim = p.dim,
  ): Promise<Grid | null> {
    /* The grid is read at the resolution the caller's output actually needs,
       and the cache key says which, so a 256 read never shadows a 512 one. An
       ancestor is only ever sampled into a grid of that size anyway, and a 512
       readback for a 256 output was four times the most expensive step in the
       worker for no extra detail. */
    const key = `${p.id}:${z}/${x}/${y}@${dim}`;
    const cached = grids.get(key);
    if (cached) return cached;
    const shared = decoding.get(key);
    if (shared) return shared;
    const job = (async () => {
      const hit = await fetchBitmap(p, z, x, y, signal);
      if (!hit) return null;
      const grid = gridFromBitmap(p, hit.bitmap, dim);
      remember(key, grid);
      return grid;
    })();
    decoding.set(key, job);
    try {
      return await job;
    } finally {
      decoding.delete(key);
    }
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
    signal?: AbortSignal,
  ): Promise<number> {
    /* Probing used to cost a fetch per level and then cache the answer on a
       cell that every level shared — see `demCell`. */
    if (!needsProbe(p, z)) return z;
    const capped = Math.min(z, p.nativeMax);
    const key = demCell(p, z, x, y);
    const known = coverage.get(key);
    if (known !== undefined) return Math.min(capped, known);

    /* Coverage is decided by payload, not by status. The provider answers 200
       with an empty tile wherever it has no dataset, and a blank taken as a
       level would put a 0 m plate under a 1 500 m ridge: the wedges and
       shelves that used to hang over the Ligurian coast. Descend until a tile
       carries data; the budget stops a flat sea cell walking the whole
       pyramid, and the answer is cached per cell either way. */
    const probes: CoverageProbe[] = [];
    let accepted: { bitmap: ImageBitmap; bytes: number; level: number } | null = null;
    for (let probe = capped, budget = 6; probe >= 0 && budget > 0; probe -= 1, budget -= 1) {
      const s = z - probe;
      if (TRACE) trace.probes.push({ provider: p.id, root: z, level: probe });
      const hit = await fetchBitmap(p, probe, x >> s, y >> s, signal);
      if (!hit) continue;
      probes.push({ level: probe, bytes: hit.bytes });
      if (hit.bytes >= BLANK_TILE_BYTES) {
        accepted = { bitmap: hit.bitmap, bytes: hit.bytes, level: probe };
        break;
      }
    }
    if (signal?.aborted) return Math.min(z, p.nativeMax);
    const verdict = coverageVerdict(probes);
    /* Nothing answered, so nothing was learned. Ask for the native level and let
       this tile fail honestly: the caller then walks real ancestors, one fetch
       each, instead of resampling the cell from a z0 tile for the session. */
    if (!verdict.learned) return Math.min(z, p.nativeMax);
    coverage.set(key, verdict.level);
    if (verdict.blank) blankCoverage.add(key);
    else blankCoverage.delete(key);
    /* The bitmap is kept: at the level it accepts, the caller needs exactly
       this tile, and fetching it twice would decode it twice. */
    if (accepted) {
      const s = z - accepted.level;
      keepRecent(`${p.id}:${accepted.level}/${x >> s}/${y >> s}`, accepted);
    }
    return verdict.level;
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
    signal?: AbortSignal,
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
      const g = await gridAt(p, level, x >> s, y >> s, signal, size);
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
    z: number,
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

    if (TRACE) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < settled.length; i += 1) {
        const v = settled[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      trace.tiles.push({ z, kind: "resample", from, min: Math.round(lo), max: Math.round(hi) });
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
    signal?: AbortSignal,
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

    if (signal?.aborted) return null;
    await fillHoles(p, out, z, pz, x, y, size, 1, signal);
    /* A surface that is still mostly zero after refilling is a provider mask,
       not a coastline: the coastal strip Mapterhorn leaves empty is one. The
       other provider has real relief there, so hand the tile over rather than
       painting a flat plate beside an 800 m neighbour. */
    /* Only above the global level: that is where a provider can mask a region
       it has no dataset for. At or below it the global dataset covers the whole
       planet, so a mostly-zero surface is a coastline — and rejecting it sent
       every coastal tile of the opening view to the coarser provider, paying
       for the fetch twice. */
    if (p === PRIMARY && z >= p.globalMax) {
      let zeros = 0;
      for (let i = 0; i < out.length; i += 1) {
        if (out[i] > -1 && out[i] < 1) zeros += 1;
      }
      if (zeros / out.length > 0.4) return null;
    }
    return encode(out, size, 1, pz, z);
  }

  async function resolveFrom(
    p: Provider,
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
    shallow = false,
    child = false,
  ): Promise<TileResult | null> {
    /* A parent of the camera's level, answered with exactly one fetch.

       The full path is right for the surface the camera is on and wasteful for a
       fallback: it probes coverage, then walks the pyramid a level at a time if
       the tile is missing, and every attempt may burn an eight second fetch
       deadline. At z11 that turned two z6 parents into 72 and 84 second tiles,
       long after every visible tile had arrived — the last thing keeping the
       source from reporting loaded. A parent needs one honest surface, not the
       best available ancestor. */
    if (shallow) {
      const size = gridForZoom(z);
      const hit = await fetchBitmap(p, z, x, y, signal, size);
      if (!hit) return null;
      const sample = sampleTile(hit.bitmap);
      if (sample.max < 5 || (sample.min > LOWLAND_M && sample.zeros < 0.01)) {
        const bitmap = await atSize(hit.bitmap, size);
        if (TRACE) {
          trace.tiles.push({ z, kind: "native", from: z, min: Math.round(sample.min), max: Math.round(sample.max) });
        }
        return { bitmap, kind: "native", from: z, computeMs: 0 };
      }
      const grid = gridFromBitmap(p, hit.bitmap, size);
      return encode(grid.el, size, 0, z, z);
    }
    /* The level one deeper than the camera: MapLibre builds its mesh
       refinement from it, and it is never the surface on screen. The parent
       tile has already been conditioned for this ground, so this one is passed
       through as the provider drew it — no readback, no sharpening, no 512
       encode. A blank plate is the one thing it may not pass on: that is a
       coverage hole, and the parent is the right answer there. */
    if (child) {
      const size = gridForZoom(z);
      const hit = await fetchBitmap(p, z, x, y, signal, size);
      if (!hit || hit.bytes < BLANK_TILE_BYTES) return null;
      const sample = sampleTile(hit.bitmap);
      if (TRACE) {
        trace.tiles.push({
          z,
          kind: "native",
          from: z,
          min: Math.round(sample.min),
          max: Math.round(sample.max),
        });
      }
      return { bitmap: await atSize(hit.bitmap, size), kind: "native", from: z, computeMs: 0 };
    }
    const nz = await nativeZoomFor(p, z, x, y, signal);
    if (signal?.aborted) return null;
    if (nz >= z) {
      const reuseKey = `${p.id}:${z}/${x}/${y}`;
      const reused = recent.get(reuseKey);
      if (reused) recent.delete(reuseKey);
      const size = gridForZoom(z);
      const hit = reused ?? (await fetchBitmap(p, z, x, y, signal, size));
      if (hit) {
        const sample = sampleTile(hit.bitmap);
        /* Open water, or ground that never comes near the shore: nothing the
           conditioning would change, so the provider's bitmap is the surface —
           at this zoom's grid, not the provider's. */
        if (sample.max < 5 || (sample.min > LOWLAND_M && sample.zeros < 0.01)) {
          const bitmap = await atSize(hit.bitmap, size);
          if (TRACE) {
            trace.tiles.push({
              z,
              kind: "native",
              from: z,
              min: Math.round(sample.min),
              max: Math.round(sample.max),
            });
          }
          return { bitmap, kind: "native", from: z, computeMs: 0 };
        }
        const grid = gridFromBitmap(p, hit.bitmap, size);
        const scaled =
          grid.dim === size ? grid.el : project(grid, z, z, x, y, size, 0);
        const hadHoles = await fillHoles(p, scaled, z, z, x, y, size, 0, signal);
        /* Same rule as the remap path: a mask cannot exist below the global
           level, so zeros there are water and Mapterhorn's own tile is the
           right answer. */
        if (p === PRIMARY && z >= p.globalMax && sample.zeros > 0.4) return null;
        if (!hadHoles && !touchesLowland(scaled)) {
          const bitmap = await atSize(hit.bitmap, size);
          if (TRACE) {
            trace.tiles.push({
              z,
              kind: "native",
              from: z,
              min: Math.round(sample.min),
              max: Math.round(sample.max),
            });
          }
          return { bitmap, kind: "native", from: z, computeMs: 0 };
        }
        return encode(scaled, size, 0, z, z);
      }
    }
    /* Every level this provider has is blank. That is water over open sea, but
       it is also what a coverage hole looks like (the Ligurian coast at z13):
       before calling it flat, let the other provider answer — AWS keeps real
       relief there, and a flat plate beside an 800 m neighbour is the wedge.
       Only the last provider in the chain may conclude "water". */
    const cellKey = demCell(p, z, x, y);
    if (blankCoverage.has(cellKey)) {
      if (p === PRIMARY) return null;
      if (TRACE) trace.tiles.push({ z, kind: "flat", from: nz, min: 0, max: 0 });
      return { bitmap: await flatTile(z), kind: "flat", from: nz, computeMs: 0 };
    }
    for (let pz = Math.min(nz, z - 1); pz >= 0; pz -= 1) {
      const s = z - pz;
      const grid = await gridAt(p, pz, x >> s, y >> s, signal);
      if (grid) {
        const tile = await remap(p, grid, z, pz, x, y, signal);
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
    /** Dev-only: the fetches and probes this pipeline has run. */
    trace: () => trace,
    /** A blank tile for the client's timeout path, without running a request. */
    flatTile,
    async resolve(
      z: number,
      x: number,
      y: number,
      signal?: AbortSignal,
      opts?: { shallow?: boolean; child?: boolean },
    ): Promise<TileResult | null> {
      for (const provider of [PRIMARY, FALLBACK]) {
        if (!isUp(provider)) continue;
        if (signal?.aborted) return null;
        const result = await resolveFrom(
          provider,
          z,
          x,
          y,
          signal,
          opts?.shallow ?? false,
          opts?.child ?? false,
        );
        if (result) return result;
      }
      /* An abandoned tile is answered by not answering: the caller has already
         stopped caring, and a flat plate would only cost an encode. */
      if (signal?.aborted) return null;
      return { bitmap: await flatTile(z), kind: "flat", computeMs: 0 };
    },
  };
}
