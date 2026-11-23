import { addProtocol, type AddProtocolAction, type GetResourceResponse } from "maplibre-gl";
import DemWorkerClient from "./dem.worker?worker&inline";
import {
  createDemPipeline,
  DEM_FALLBACK_ATTRIBUTION,
  gridForZoom,
  OUT_SIZE,
  PRIMARY_HTTP_TILE_URL,
  type DemReply,
  type DemTrace,
  type TileKind,
  type TileResult,
} from "./demPipeline";

/**
 * Terrane's elevation source, exposed to MapLibre as a custom protocol.
 *
 * The map asks for a DEM tile at a zoom; the worker answers with a real 512 px
 * tile at that zoom — the native national LiDAR level where it exists, the
 * provider's global level resampled up where it does not. See `demPipeline.ts`
 * for why that matters and how the fallback provider works.
 *
 * This file is only the plumbing: a single worker, a bounded number of jobs in
 * flight, a timeout that degrades to a blank tile instead of a hole, and a
 * main-thread pipeline for environments where a worker cannot start at all.
 *
 * Why a worker: resampling one tile costs 12–31 ms of CPU on a desktop, which
 * becomes 70–190 ms on a throttled phone — per tile, with ~10 tiles per deep
 * viewport. On the main thread that is a second of dropped frames per zoom.
 */

export const DEM_SCHEME = "terranedem";

/** Tile grid declared to MapLibre, in px.
 *
 *  This number is what decides WHICH zoom MapLibre asks for, not how detailed the
 *  surface is: it scales the requested level by log2(512 / tileSize). Declared at
 *  256 it asked for one level deeper than the camera — at z11 the source pulled
 *  z12 tiles as well, so a stationary view never closed its request set,
 *  `isSourceLoaded` never flipped and the renderer starved. Declared at 512 it
 *  asks for the camera's own level, which is what the earlier runs showed
 *  (z9 at camera 9, z10 at camera 10).
 *
 *  Mesh cost is not decided here: MapLibre builds the terrain mesh from the image
 *  it is handed, and below z12 that image is `gridForZoom`'s 256 px. So the
 *  requested level and the mesh density are separate knobs, and this one belongs
 *  to the level. */
export const DEM_TILE_SIZE = OUT_SIZE;

/** Deepest level the source advertises — the map's own maxZoom. */
export const DEM_MAX_ZOOM = 14;

/** Plain HTTP template, for consumers that cannot use the MapLibre protocol
 *  (the contour worker fetches tiles itself). */
export const DEM_HTTP_TILE_URL = PRIMARY_HTTP_TILE_URL;

/** Attribution for whatever both providers require. */
export const DEM_ATTRIBUTION = `© Mapterhorn · Copernicus DEM · ${DEM_FALLBACK_ATTRIBUTION}`;

const BENCH = import.meta.env.DEV || import.meta.env.VITE_BENCH === "1";

/* Which level a request is, and what may stand in for it, lives in ./tileRole so
   the rule can be tested against a real ledger without MapLibre in the way. */
import { allowsCoarseStandIn, needsNativeSurface, tileRole } from "./tileRole";
export { allowsCoarseStandIn, needsNativeSurface, tileRole, type TileRole } from "./tileRole";

/* Bounded concurrency: each in-flight tile can hold a decoded parent grid plus a
   512² float buffer in the worker, so a phone zooming fast must not queue fifty
   of them. MapLibre's own image queue is wider than this.

   The cap follows the cores actually available. Decoding a tile is CPU work with
   a memory-bound readback in the middle, so it does not overlap: on a two-core
   box six parallel tiles finish later than two run back to back, because each of
   the six is slower and none of them beats its timeout. */
const CORES = typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency || 4;
/* Raised from `min(4, CORES - 1)` after the ledger showed 27 of 61 requests at a
   stationary z9 view ending `no-slot`: the ceiling, not the work, was what kept
   the source's outstanding set from ever emptying. The worker decodes off the main
   thread, so a higher in-flight count does not block frames; it is the tile
   count that has to drain inside the renderer's lifetime. */
const MAX_IN_FLIGHT = CORES <= 2 ? 4 : Math.min(12, Math.max(8, CORES * 2));
/* A tile that never arrives must not leave a hole in the relief.

   This is the last resort, not the budget. Every tile in the deep band used to
   trip it, so nothing ever resolved; the work itself is now bounded (CPU-side
   readbacks, one canvas per size, coalesced ancestors, a fetch deadline, and a
   cancel that actually reaches the worker). What is left is the time a slow box
   needs for one tile, and dropping a tile that is still progressing just throws
   that work away and asks for it again. */
const TILE_TIMEOUT_MS = 45_000;

/** A finished tile nobody was waiting for any more, kept for the next ask. */
const late = new Map<string, { bitmap: ImageBitmap; kind: TileResult["kind"]; from?: number }>();
const LATE_LIMIT = 24;
/** Which tile each posted job belongs to, so a late reply can be recognised. */
const posted = new Map<number, { z: number; x: number; y: number }>();
/* A run of slow tiles worth saying out loud in a bench build. It is not a
   reason to take the worker apart — see the timeout path in `requestTile`. */
const TIMEOUT_STREAK_LIMIT = 3;
let timeoutStreak = 0;

type Job = {
  resolve: (result: TileResult | null) => void;
  timer: number;
  started: number;
};

let worker: Worker | null = null;
let workerBroken = false;
let local: ReturnType<typeof createDemPipeline> | null = null;

const pending = new Map<number, Job>();

/** Bitmaps already decoded, by tile key — held as a copy we own.
 *
 *  This is the request count, not a slot knob. Two thirds of the requests a
 *  stationary z9 view made were tiles that had already been decoded: MapLibre
 *  asks for the same URL again ten seconds later, and the terrain asks for one
 *  level deeper than the camera while the ideal tiles load. Every one of those
 *  re-fetched and re-decoded the tile, because the bitmap we had was the one we
 *  handed to MapLibre, and MapLibre transfers it — the copy is dead the moment
 *  it leaves this module. One `createImageBitmap` copy per tile keeps it alive,
 *  and then a repeat costs nothing and an ancestor crop has something real to
 *  crop from.
 *
 *  The limit is by bytes, not entries: a z12+ tile is 512², i.e. a megabyte.
 *  Below z12 the grid is 256 and the same count costs a quarter as much. */
const resolvedTiles = new Map<
  string,
  { z: number; bitmap: ImageBitmap; kind: TileKind; from: number }
>();
const RESOLVED_LIMIT = 64;

function remember(
  z: number,
  x: number,
  y: number,
  bitmap: ImageBitmap,
  kind: TileKind,
  from: number,
) {
  resolvedTiles.set(`${z}/${x}/${y}`, { z, bitmap, kind, from });
  while (resolvedTiles.size > RESOLVED_LIMIT) {
    const oldest = resolvedTiles.keys().next();
    if (oldest.done) break;
    resolvedTiles.get(oldest.value)?.bitmap.close();
    resolvedTiles.delete(oldest.value);
  }
}

/** Keep a copy of a finished tile, so the next request can have it again.
 *
 *  The caller's bitmap is about to be transferred to MapLibre, so the cache
 *  gets its own. A failed copy is not a failed tile: it is served, just not
 *  reusable. */
async function rememberForReuse(
  z: number,
  x: number,
  y: number,
  bitmap: ImageBitmap,
  kind: TileKind,
  from: number,
) {
  const copy = await boundedBitmap(createImageBitmap(bitmap));
  if (copy) remember(z, x, y, copy, kind, from);
}

/** The nearest ancestor already decoded, if any, with the shift to reach it. */
function nearestResolved(z: number, x: number, y: number, maxShift = 6) {
  for (let shift = 1; shift <= maxShift; shift += 1) {
    const lz = z - shift;
    if (lz < 0) break;
    const hit = resolvedTiles.get(`${lz}/${x >> shift}/${y >> shift}`);
    if (hit) return { shift, hit };
  }
  return null;
}

/** A tile cropped out of an ancestor we already hold.
 *
 *  `createImageBitmap` does the crop and the scale off the main thread, so this
 *  path neither fetches nor blocks a frame. The result is honestly a resample
 *  of `hit.z`: MapLibre sees which level the surface actually came from.
 */
async function fromAncestor(z: number, x: number, y: number, maxShift: number) {
  const near = nearestResolved(z, x, y, maxShift);
  if (!near) return null;
  const { shift, hit } = near;
  const size = gridForZoom(z);
  const w = hit.bitmap.width >> shift;
  const h = hit.bitmap.height >> shift;
  if (w <= 0 || h <= 0) return null;
  const sx = (x & ((1 << shift) - 1)) * w;
  const sy = (y & ((1 << shift) - 1)) * h;
  const bitmap = await boundedBitmap(
    createImageBitmap(hit.bitmap, sx, sy, w, h, {
      resizeWidth: size,
      resizeHeight: size,
      resizeQuality: "low",
    }),
  );
  if (!bitmap) return null;
  return { bitmap, kind: "resample" as TileKind, from: hit.z, computeMs: 0 };
}

/** What the main-thread bitmap copies cost, for the bench. */
const copyStats = { n: 0, total: 0, max: 0, missed: 0 };

/** `createImageBitmap` behind a saturated rasteriser can queue and never come
 *  back. It is a copy, not the request: the tile must not wait on it forever. */
async function boundedBitmap(work: Promise<ImageBitmap>, ms = 1200) {
  const t0 = performance.now();
  const out = await Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), ms);
    }),
  ]);
  if (import.meta.env.DEV || import.meta.env.VITE_BENCH === "1") {
    const ms = performance.now() - t0;
    copyStats.n += 1;
    copyStats.total += ms;
    copyStats.max = Math.max(copyStats.max, ms);
    if (!out) copyStats.missed += 1;
    (window as unknown as { __demCopy?: typeof copyStats }).__demCopy = copyStats;
  }
  return out;
}

/** The camera the map is looking through.
 *
 *  A request that is not the camera's own level is a backfill: MapLibre asks
 *  for one level deeper than the camera while the ideal tiles load, and for
 *  ancestors while a deep tile is missing. Those are the requests that kept the
 *  source's outstanding set open, and they are the ones an already-decoded
 *  bitmap can answer. Only while the camera is still — mid-gesture the next
 *  frame moves the ideal level, and a soft answer would stay soft, because
 *  MapLibre keeps the tile it was given. */
let cameraZoom = -1;
let cameraMoving = false;

export function noteDemCamera(zoom: number, moving = false) {
  cameraZoom = zoom;
  cameraMoving = moving;
}
/** Dev-only: resolvers waiting for a trace reply from the worker. */
const traceWaiters = new Map<number, (trace: DemTrace) => void>();
let nextId = 1;
let inFlight = 0;
/** Jobs waiting for a slot, ordered by what the view actually needs. */
type Waiting = { z: number; backfill: boolean; queuedAt: number; start: () => void };

/** How long a queued tile may wait for a slot before it gives up.
 *
 *  Without this the wait was unbounded, and that is what kept
 *  `isSourceLoaded("relief")` false forever: deepest-first ordering meant a z5 or
 *  z7 backfill tile could sit in the queue behind an unbroken stream of deep
 *  work, so its promise never settled, so MapLibre counted it outstanding for the
 *  life of the page. Every deep tile the camera actually drew had resolved; the
 *  flag was held down by requests that were never going to run. Past the
 *  deadline the tile reports failure, MapLibre settles the request, and the set
 *  closes. */
/* Six seconds, as it was before the one-tick experiment. A tick-long deadline
   looked like it would keep the outstanding set empty, and instead it turned
   every slot contention into a main-thread decode in the same frame: twenty-odd
   tiles fell through at once, blocked the event loop for seconds, and starved
   the very timers that were supposed to settle the rest. The request count is
   what had to come down, not the patience. */
const QUEUE_WAIT_MS = 6000;

/** How many tiles may exceed the in-flight cap rather than wait for the main
 *  thread. Two tiles passed the old cap by more than this at z11 and both of
 *  them wedged there, so the bound is a ceiling on a slow tail, not a queue. */
const OVERFLOW = 8;

/** A queued tile this old outranks a deeper one, so no level can be starved. */
const QUEUE_STARVE_MS = 6000;
const queue: Waiting[] = [];

/** The deepest waiting tile starts next.
 *
 *  A stationary deep view asks for its own level and, through the hole fill, for
 *  ancestors of it. First-in-first-out meant the coarse jobs that were already
 *  queued kept every slot, so the tile the camera was actually looking at was
 *  still waiting when the next gesture arrived — at z11 the native 11/… request
 *  never entered the pipeline at all while z5–z8 work cycled through the slots.
 *  Deeper is nearer the view, so deeper goes first. */
function takeNext(): Waiting | undefined {
  if (queue.length === 0) return undefined;
  const now = performance.now();
  let best = 0;
  /* Starving is worse than being out of order: anything that has waited past
     QUEUE_STARVE_MS starts next, oldest first. Deeper is only the tie-break. */
  for (let i = 1; i < queue.length; i += 1) {
    const a = queue[i];
    const b = queue[best];
    const starvedA = now - a.queuedAt >= QUEUE_STARVE_MS;
    const starvedB = now - b.queuedAt >= QUEUE_STARVE_MS;
    if (starvedA !== starvedB) {
      if (starvedA) best = i;
      continue;
    }
    if (starvedA) {
      if (a.queuedAt < b.queuedAt) best = i;
    } else if (a.backfill !== b.backfill) {
      if (!a.backfill) best = i;
    } else if (a.z > b.z) best = i;
  }
  return queue.splice(best, 1)[0];
}

function record(z: number, kind: string, total: number, compute: number, from?: number) {
  if (!import.meta.env.DEV && import.meta.env.VITE_BENCH !== "1") return;
  const scope = window as unknown as {
    __demStats?: { z: number; kind: string; total: number; compute: number; from?: number }[];
  };
  (scope.__demStats ??= []).push({ z, kind, total, compute, from });
  if (scope.__demStats.length > 600) scope.__demStats.shift();
}

/** Main-thread pipeline, used only if a worker cannot be created here. */
function localPipeline() {
  local ??= createDemPipeline();
  return local;
}

/** The worker acknowledged a job it was told to drop (or failed it).
 *
 *  Counted even when the answer arrives after the client stopped waiting: that
 *  late acknowledgement is the only evidence the work actually ended inside the
 *  worker, and it used to be thrown away with the orphan reply. */
function noteWorkerEnd() {
  if (!import.meta.env.DEV && import.meta.env.VITE_BENCH !== "1") return;
  if (typeof window === "undefined") return;
  const s = window as unknown as { __demCancelledReplies?: number };
  s.__demCancelledReplies = (s.__demCancelledReplies ?? 0) + 1;
}

function failPending() {
  for (const [id, job] of pending) {
    window.clearTimeout(job.timer);
    job.resolve(null);
    pending.delete(id);
  }
}

function ensureWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const instance = new DemWorkerClient();
    instance.onmessage = (event: MessageEvent<DemReply>) => {
      const reply = event.data;
      if ("trace" in reply) {
        const waiter = traceWaiters.get(reply.id);
        traceWaiters.delete(reply.id);
        waiter?.(reply.trace);
        return;
      }
      const job = pending.get(reply.id);
      if (!job) {
        if ("cancelled" in reply || "error" in reply) {
          noteWorkerEnd();
          return;
        }
        /* An answer to a tile the camera already left, or one that took longer
           than the client was willing to wait. The decode is already paid for,
           so hold it for a moment: MapLibre asks for the same tile again on the
           next frame pass, and the second ask is then instant instead of another
           forty seconds that also times out. */
        const where = posted.get(reply.id);
        if (where && "bitmap" in reply) {
          const key = `${where.z}/${where.x}/${where.y}`;
          late.get(key)?.bitmap.close();
          late.set(key, { bitmap: reply.bitmap, kind: reply.kind, from: reply.from });
          while (late.size > LATE_LIMIT) {
            const oldest = late.keys().next().value;
            if (oldest === undefined) break;
            late.get(oldest)?.bitmap.close();
            late.delete(oldest);
          }
          return;
        }
        if ("bitmap" in reply) reply.bitmap.close();
        return;
      }
      pending.delete(reply.id);
      window.clearTimeout(job.timer);
      /* A cancelled job and a failed tile both answer nothing, and neither is
         evidence that the worker is in trouble. */
      if ("cancelled" in reply || "error" in reply) {
        noteWorkerEnd();
        job.resolve(null);
        return;
      }
      job.resolve({
        bitmap: reply.bitmap,
        kind: reply.kind,
        computeMs: reply.computeMs,
        from: reply.from,
      });
    };
    instance.onerror = (event) => {
      if (BENCH) {
        const message = (event as unknown as { message?: string })?.message;
        console.error("[dem] worker error", message ?? "unknown");
      }
      workerBroken = true;
      instance.terminate();
      worker = null;
      failPending();
    };
    worker = instance;
    return instance;
  } catch (err) {
    if (BENCH) console.error("[dem] worker unavailable", String(err));
    workerBroken = true;
    return null;
  }
}

async function acquire(z: number, signal?: AbortSignal, backfill = false): Promise<boolean> {
  if (signal?.aborted) return false;
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
    return true;
  }
  return new Promise<boolean>((resolve) => {
    const entry: Waiting = { z, backfill, queuedAt: performance.now(), start: () => {
      window.clearTimeout(deadline);
      const at = queue.indexOf(entry);
      if (at >= 0) queue.splice(at, 1);
      /* A gesture can abandon twenty queued tiles at once. Each used to hold a
         slot until its turn came, so the tiles actually on screen waited behind
         requests nobody was waiting for any more. */
      if (signal?.aborted) {
        resolve(false);
        return;
      }
      inFlight += 1;
      resolve(true);
    } };
    /* Past the wait, start anyway — up to a bounded overflow.
       The cap is politeness, not correctness: it exists so a fast gesture cannot
       put fifty decodes in the worker at once. The alternative, decoding on the
       main thread, is what froze the page and left z6 backfills sitting in this
       queue for the life of the session, with the source never reporting loaded.
       The overflow is bounded so the memory argument for the cap still holds. */
    const deadline = window.setTimeout(() => {
      const at = queue.indexOf(entry);
      if (at < 0) return;
      queue.splice(at, 1);
      if (inFlight < MAX_IN_FLIGHT + OVERFLOW) {
        inFlight += 1;
        resolve(true);
        return;
      }
      resolve(false);
    }, QUEUE_WAIT_MS);
    queue.push(entry);
  });
}

function release() {
  inFlight -= 1;
  const next = takeNext();
  if (next) next.start();
}

/** Control mode: answer every request with a 1×1 sea-level plate.
 *
 *  Bench only, and not a product path. It removes every fetch, decode and
 *  encode this pipeline does — leaving MapLibre with the same number of tiles
 *  to prepare and nothing of ours to pay for. The settle time it measures is
 *  therefore the page's own floor, which is what separates “our DEM work is
 *  slow” from “this rasteriser cannot prepare this many tiles”. */
const PLATE_CONTROL = (() => {
  if (!import.meta.env.DEV && import.meta.env.VITE_BENCH !== "1") return false;
  try {
    return new URLSearchParams(window.location.search).get("demcontrol") === "1";
  } catch {
    return false;
  }
})();

const PLATE_SIZE = 4;
/** A fresh plate every time: MapLibre transfers the bitmap it is handed, so a
 *  shared one would be closed under the next tile. */
function plateTile(): ImageBitmap {
  const canvas = new OffscreenCanvas(PLATE_SIZE, PLATE_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgb(128, 0, 0)";
  ctx.fillRect(0, 0, PLATE_SIZE, PLATE_SIZE);
  return canvas.transferToImageBitmap();
}

async function requestTile(
  z: number,
  x: number,
  y: number,
  signal?: AbortSignal,
): Promise<TileResult | null> {
  if (PLATE_CONTROL) {
    return { bitmap: plateTile(), kind: "native", from: z, computeMs: 0 };
  }
  /* Bench: the levels MapLibre actually ASKS for. `__demStats` only records
     finished tiles, so a level whose jobs are still queued looks like a level
     that was never requested — which is exactly the question this answers. */
  if (import.meta.env.DEV || import.meta.env.VITE_BENCH === "1") {
    const s = window as unknown as { __demRequested?: number[] };
    (s.__demRequested ??= []).push(z);
  }
  /* Per-request ledger on the MAIN thread: URL plus the state it reached.
     The trace lives in the worker, and the worker is exactly what was
     unreachable when the renderer froze, so an outstanding-tile account could
     only ever be a count. This one survives a wedged worker. */
  const ledger = (() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_BENCH !== "1") return null;
    const url = PRIMARY_HTTP_TILE_URL.replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
    const s = window as unknown as {
      __demLedger?: {
        url: string;
        z: number;
        x: number;
        y: number;
        state: string;
        ms: number;
        phase: string;
        at: number;
      }[];
    };
    const e = {
      url,
      z,
      x,
      y,
      state: "queued",
      ms: 0,
      phase: "start",
      at: Math.round(performance.now()),
    };
    (s.__demLedger ??= []).push(e);
    return e;
  })();
  const t0 = performance.now();
  const settle = (state: string) => {
    if (!ledger) return;
    ledger.state = state;
    ledger.ms = Math.round(performance.now() - t0);
  };
  /* Where the request is right now. A request that never settles used to be one
     anonymous `queued` line; the phase says which await it is sitting in, which
     is the difference between a slow fetch and a wedged copy. */
  const phase = (value: string) => {
    if (ledger) ledger.phase = value;
  };
  /* A tile the worker finished after we stopped waiting is already in hand. */
  const readyKey = `${z}/${x}/${y}`;
  const ready = late.get(readyKey);
  if (ready) {
    late.delete(readyKey);
    record(z, ready.kind, 0, 0, ready.from ?? z);
    settle("late");
    return { bitmap: ready.bitmap, kind: ready.kind, computeMs: 0, from: ready.from ?? z };
  }
  /* Asked for again: MapLibre re-requests the same URL while the view sits
     still, and the terrain asks one level deeper than the camera. Neither is
     new work — hand back a copy of the tile already decoded. */
  const held = resolvedTiles.get(readyKey);
  if (held) {
    phase("reuse");
    const bitmap = await boundedBitmap(createImageBitmap(held.bitmap));
    if (bitmap) {
      record(z, `reuse:${held.kind}`, 0, 0, held.from);
      settle(`reuse:${held.kind}:from${held.from}`);
      return { bitmap, kind: held.kind, computeMs: 0, from: held.from };
    }
    /* The copy is gone (closed by eviction, or detached): drop and refetch. */
    resolvedTiles.delete(readyKey);
  }
  /* Not the camera's own level, and the camera is still: this is a backfill,
     and a coarser bitmap already in hand answers it without a request. */
  const ideal = cameraZoom >= 0 ? Math.round(cameraZoom) : -1;
  const role = tileRole(z, cameraZoom, cameraMoving);
  /* A coarse parent of the camera's level. MapLibre draws it only while the
     camera's own tiles load, so it is answered with one fetch — not with the
     probe-and-walk the visible surface gets. */
  const shallow = role === "under";
  /* The level one deeper than the camera: mesh refinement only. */
  const child = role === "child";
  /* Camera and child tiles are the surface a skirt wall would be built against,
     so they may only be answered natively: no ancestor crop, no second provider. */
  const strict = needsNativeSurface(role);
  if (allowsCoarseStandIn(role, cameraMoving) && ideal >= 0 && z !== ideal) {
    phase("backfill");
    /* One look, never a wait: a coarser level behind the camera takes the crop
       if one is already decoded, and otherwise goes to the queue like any other
       tile. Waiting for a parent to land was the old child-level path, and it
       is gone with the rule that made children answerable from a crop — the two
       on-screen levels fetch their own surface now, so nothing waits on a
       parent that is no longer allowed to stand in. */
    const near = await fromAncestor(z, x, y, 3);
    if (near) {
      record(z, `ancestor:from${near.from}`, performance.now() - t0, 0, near.from);
      settle(`ancestor:from${near.from}`);
      return near;
    }
  }
  phase("acquire");
  if (!(await acquire(z, signal, shallow || child))) {
    /* Never answer a DEM request without data. This used to return null, and a
       single dropped backfill tile was enough to leave `relief` reporting
       unloaded for the rest of the session: 61 of 61 requests terminal, zero
       queued, and the source still not loaded because one tile had come back
       empty. A request that finds no slot is now decoded on the main-thread
       pipeline instead — slower for that one tile, but it always returns
       pixels. */
    if (signal?.aborted) {
      settle("aborted");
      return null;
    }
    /* Answer from an ancestor that is already decoded. `createImageBitmap` crops
       and resizes off the main thread, so this path allocates no decode and sets
       no timer — it cannot starve anything. */
    phase("noslot");
    const near = allowsCoarseStandIn(role, cameraMoving) ? await fromAncestor(z, x, y, 6) : null;
    if (near) {
      record(z, `ancestor:from${near.from}`, performance.now() - t0, 0, near.from);
      settle(`ancestor:from${near.from}`);
      return near;
    }
    phase("local");
    /* Last resort, and bounded. The main thread is drawing the view, so a decode
       here can sit behind frames for minutes — which is exactly what two z6
       backfills did at z11: every tile around them finished and the source still
       reported unloaded. After this the request settles with a plate instead of
       holding the set open forever. */
    const fallback = await Promise.race([
      localPipeline().resolve(z, x, y, signal, { shallow, child, strict }),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 8000);
      }),
    ]);
    if (!fallback) {
      settle("fallback-failed");
      return null;
    }
    if (fallback.bitmap) {
      phase("copy");
      await rememberForReuse(z, x, y, fallback.bitmap, fallback.kind, fallback.from ?? z);
    }
    record(z, `${fallback.kind}:fallback`, performance.now() - t0, fallback.computeMs, fallback.from);
    settle(`fallback:${fallback.kind}`);
    return fallback;
  }
  const started = performance.now();
  try {
    if (signal?.aborted) return null;
    phase("worker");
    const instance = ensureWorker();
    if (!instance) {
      const result = await localPipeline().resolve(z, x, y, signal, { shallow, child, strict });
      if (!result) return null;
      record(z, `${result.kind}:local`, performance.now() - started, result.computeMs, result.from);
      settle(`local:${result.kind}`);
      return result;
    }
    const id = nextId;
    nextId += 1;
    type Settled =
      | { kind: "reply"; result: TileResult | null }
      | { kind: "abort" }
      | { kind: "timeout" };
    const settled = await new Promise<Settled>((resolve) => {
      const finish = (value: Settled) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      };
      const onAbort = () => {
        if (!pending.delete(id)) return;
        window.clearTimeout(timer);
        settle("aborted");
        /* Tell the worker to stop as well: the fetch and the decode it had
           started were the reason the next viewport waited. */
        void instance.postMessage({ id, z, x, y, cancel: true });
        if (import.meta.env.DEV || import.meta.env.VITE_BENCH === "1") {
          const s = window as unknown as {
            __demCancels?: number;
            __demAborts?: { url: string; z: number; x: number; y: number; aborted: boolean }[];
          };
          s.__demCancels = (s.__demCancels ?? 0) + 1;
          /* The URL, not just a count: the bench matches this against the
             browser's own network cancellation for the same request. */
          const url = PRIMARY_HTTP_TILE_URL.replace("{z}", String(z))
            .replace("{x}", String(x))
            .replace("{y}", String(y));
          (s.__demAborts ??= []).push({ url, z, x, y, aborted: signal?.aborted ?? false });
        }
        finish({ kind: "abort" });      };
      const timer = window.setTimeout(() => {
        pending.delete(id);
        timeoutStreak += 1;
        /* The ledger has to say so. A timed-out tile used to keep its `queued`
           state for the life of the page: the request had settled (MapLibre got
           a plate), the worker had been told to stop, and every readout still
           counted it outstanding. That is the difference between a set that
           closed and a set that looked open forever. */
        settle("timeout");
        /* Giving up on the answer is not the same as ending the work. Without
           this the worker sat on a request nobody was waiting for, holding a
           decoded tile and one of its runs: the deep band timed out six tiles at
           a time and never got far enough to answer any of them. */
        void instance.postMessage({ id, z, x, y, cancel: true });
        if (BENCH) console.warn("[dem] tile timeout", z, "streak", timeoutStreak);
        finish({ kind: "timeout" });
      }, TILE_TIMEOUT_MS);
      pending.set(id, {
        resolve: (result) => finish({ kind: "reply", result }),
        timer,
        started,
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      posted.set(id, { z, x, y });
      instance.postMessage({ id, z, x, y, shallow, child, strict });
    });
    if (settled.kind === "reply" && settled.result) {
      timeoutStreak = 0;
      if (settled.result.bitmap) {
        phase("copy");
        await rememberForReuse(
          z,
          x,
          y,
          settled.result.bitmap,
          settled.result.kind,
          settled.result.from ?? z,
        );
      }
      settle(`done:${settled.result.kind}`);
      record(
        z,
        settled.result.kind,
        performance.now() - started,
        settled.result.computeMs,
        settled.result.from,
      );
      return settled.result;
    }

    /* Cancelled, or this one tile failed in the worker. The worker is still
       healthy — demoting the session to main-thread decoding over it would
       block frames, which is the thing the worker exists to prevent. */
    /* A slow tile is not a broken worker, and this used to treat it as one:
       after a single timeout it terminated the worker and served the rest of
       the session from the main thread, where every decode blocks a frame. On a
       phone, three slow tiles were enough to turn the map into a slideshow.
       Let MapLibre ask again instead; a worker that is genuinely stuck just
       keeps timing out, which costs relief but never costs the frame rate. */
    if (BENCH && timeoutStreak === TIMEOUT_STREAK_LIMIT) {
      console.warn("[dem] tiles still timing out after", timeoutStreak);
    }
    return null;
  } finally {
    release();
  }
}

let installed = false;

/**
 * Register the DEM tile protocol. Idempotent, and global to the module so a
 * second globe (a remount, a route change) does not pay for it twice.
 */
export function installDemProtocol() {
  if (installed) return;
  installed = true;
  /* Handle for the browser bench: what the worker actually fetched. */
  if (import.meta.env.DEV || import.meta.env.VITE_BENCH === "1") {
    (window as unknown as { __demTrace?: () => Promise<DemTrace | null> }).__demTrace = () =>
      new Promise((resolve) => {
        const instance = ensureWorker();
        if (!instance) {
          /* The counters live in whichever pipeline is resolving tiles, so a
             dead worker must not blind the bench. */
          resolve(localPipeline().trace());
          return;
        }
        const id = nextId;
        nextId += 1;
        traceWaiters.set(id, resolve);
        instance.postMessage({ id, stats: true });
      });
  }
  const load = (async ({ url }, abortController) => {
    const match = /^terranedem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(url);
    if (!match) throw new Error(`Unrecognised DEM tile URL: ${url}`);
    const signal = abortController?.signal;
    if (signal?.aborted) throw new Error("aborted");
    const z = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    const result = await requestTile(z, x, y, signal);
    if (!result) {
      /* MapLibre abandoned this tile: say so, and let it drop the request. */
      if (signal?.aborted) throw new Error("aborted");
      /* A camera or child tile with no native surface must fail, not be filled.
         A sea-level plate under a mountain is the cliff the skirt wall is built
         on, and MapLibre keeps whatever it is handed, so the wall outlives the
         request. Failing leaves the parent tile visible underneath and lets
         MapLibre ask again. Coarser levels still get a plate: they sit behind
         the camera surface, where a hole is worse than a flat stand-in. */
      if (needsNativeSurface(tileRole(z, cameraZoom, cameraMoving))) {
        throw new Error(`dem: no native surface for ${z}/${x}/${y}`);
      }
      const blank = await localPipeline().flatTile(z);
      return { data: blank } as unknown as GetResourceResponse<ArrayBuffer>;
    }
    // MapLibre takes an ImageBitmap as the tile image directly: no decode, and
    // for a raster-dem source it is transferred to the tile worker as-is.
    return { data: result.bitmap } as unknown as GetResourceResponse<ArrayBuffer>;
  }) as AddProtocolAction;
  addProtocol(DEM_SCHEME, load);
}
