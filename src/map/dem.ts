import { addProtocol, type AddProtocolAction, type GetResourceResponse } from "maplibre-gl";
import DemWorkerClient from "./dem.worker?worker&inline";
import {
  createDemPipeline,
  DEM_FALLBACK_ATTRIBUTION,
  OUT_SIZE,
  PRIMARY_HTTP_TILE_URL,
  type DemReply,
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

/** Tile grid handed back to MapLibre, in px. */
export const DEM_TILE_SIZE = OUT_SIZE;

/** Deepest level the source advertises — the map's own maxZoom. */
export const DEM_MAX_ZOOM = 14;

/** Plain HTTP template, for consumers that cannot use the MapLibre protocol
 *  (the contour worker fetches tiles itself). */
export const DEM_HTTP_TILE_URL = PRIMARY_HTTP_TILE_URL;

/** Attribution for whatever both providers require. */
export const DEM_ATTRIBUTION = `© Mapterhorn · Copernicus DEM · ${DEM_FALLBACK_ATTRIBUTION}`;

/* Bounded concurrency: each in-flight tile can hold a decoded parent grid plus a
   512² float buffer in the worker, so a phone zooming fast must not queue fifty
   of them. MapLibre's own image queue is wider than this. */
const MAX_IN_FLIGHT = 6;
/* A tile that never arrives must not leave a hole in the relief. */
const TILE_TIMEOUT_MS = 20_000;

type Job = {
  resolve: (result: TileResult | null) => void;
  timer: number;
  started: number;
};

let worker: Worker | null = null;
let workerBroken = false;
let local: ReturnType<typeof createDemPipeline> | null = null;

const pending = new Map<number, Job>();
let nextId = 1;
let inFlight = 0;
const queue: (() => void)[] = [];

function record(z: number, kind: string, total: number, compute: number) {
  if (!import.meta.env.DEV) return;
  const scope = window as unknown as {
    __demStats?: { z: number; kind: string; total: number; compute: number }[];
  };
  (scope.__demStats ??= []).push({ z, kind, total, compute });
  if (scope.__demStats.length > 600) scope.__demStats.shift();
}

/** Main-thread pipeline, used only if a worker cannot be created here. */
function localPipeline() {
  local ??= createDemPipeline();
  return local;
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
      const job = pending.get(reply.id);
      if (!job) return;
      pending.delete(reply.id);
      window.clearTimeout(job.timer);
      if ("error" in reply) {
        job.resolve(null);
        return;
      }
      job.resolve({ bitmap: reply.bitmap, kind: reply.kind, computeMs: reply.computeMs });
    };
    instance.onerror = () => {
      workerBroken = true;
      instance.terminate();
      worker = null;
      failPending();
    };
    worker = instance;
    return instance;
  } catch {
    workerBroken = true;
    return null;
  }
}

function acquire(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    queue.push(() => {
      inFlight += 1;
      resolve();
    });
  });
}

function release() {
  inFlight -= 1;
  const next = queue.shift();
  if (next) next();
}

async function requestTile(z: number, x: number, y: number): Promise<TileResult> {
  await acquire();
  const started = performance.now();
  try {
    const instance = ensureWorker();
    if (!instance) {
      const result = await localPipeline().resolve(z, x, y);
      record(z, `${result.kind}:local`, performance.now() - started, result.computeMs);
      return result;
    }
    const id = nextId;
    nextId += 1;
    const result = await new Promise<TileResult | null>((resolve) => {
      const timer = window.setTimeout(() => {
        pending.delete(id);
        resolve(null);
      }, TILE_TIMEOUT_MS);
      pending.set(id, { resolve, timer, started });
      instance.postMessage({ id, z, x, y });
    });
    if (result) {
      record(z, result.kind, performance.now() - started, result.computeMs);
      return result;
    }

    /* The worker died or stalled. Serve the rest of this session on the main
       thread rather than leaving the globe without relief. */
    workerBroken = true;
    worker?.terminate();
    worker = null;
    failPending();
    const blank = await localPipeline().flatTile(z);
    record(z, "flat", performance.now() - started, 0);
    return { bitmap: blank, kind: "flat", computeMs: 0 };
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
  const load = (async ({ url }, abortController) => {
    const match = /^terranedem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(url);
    if (!match) throw new Error(`Unrecognised DEM tile URL: ${url}`);
    if (abortController?.signal.aborted) throw new Error("aborted");
    const result = await requestTile(Number(match[1]), Number(match[2]), Number(match[3]));
    // MapLibre takes an ImageBitmap as the tile image directly: no decode, and
    // for a raster-dem source it is transferred to the tile worker as-is.
    return { data: result.bitmap } as unknown as GetResourceResponse<ArrayBuffer>;
  }) as AddProtocolAction;
  addProtocol(DEM_SCHEME, load);
}
