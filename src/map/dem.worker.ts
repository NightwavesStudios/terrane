/**
 * The DEM worker: one pipeline instance, one job at a time per message.
 *
 * Everything expensive about a terrain tile — the fetch, the elevation decode,
 * the resample and the re-encode — happens here, so the main thread only ever
 * receives an `ImageBitmap` it can hand straight to MapLibre.
 *
 * A job can also be cancelled. A zoom gesture abandons most of the tiles it
 * asked for a moment earlier, and without this the worker kept fetching and
 * decoding them, so the viewport's own tiles queued behind work nobody wanted.
 */
import {
  createDemPipeline,
  type DemJob,
  type DemReply,
} from "./demPipeline";

const pipeline = createDemPipeline();

/** Jobs still running, so a cancel can stop their fetch and decode. */
const running = new Map<number, AbortController>();

/** Deep tiles decode at most this many at a time; the rest queue here.
 *
 *  A deep tile is the most expensive thing this worker does — a fetch, a decode,
 *  an ancestor pass and an encode — and running four of them at once on a small
 *  box meant each one finished later than the client's patience and the source
 *  never reached idle: resolutions kept trickling in, `relief` stayed unloaded,
 *  and the renderer starved. Two at a time drains the band instead of thrashing
 *  it, and a stationary view only ever needs a couple of tiles. */
const DEEP_FROM_Z = 9;
/* Two was chosen when the deep band never finished and the guess was thrash. The
   ledger afterwards showed the opposite failure: a stationary view issued ~60
   requests and 27 of them never got a slot at all, so a two-deep cap guaranteed
   the set could not close. The cap still bounds the deep band, it just no longer
   guarantees starvation. */
const DEEP_PARALLEL = 6;
let deepRunning = 0;
const deepQueue: (() => void)[] = [];

function takeDeepSlot(): Promise<void> {
  if (deepRunning < DEEP_PARALLEL) {
    deepRunning += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    deepQueue.push(() => {
      deepRunning += 1;
      resolve();
    });
  });
}

function releaseDeepSlot() {
  deepRunning -= 1;
  const next = deepQueue.shift();
  if (next) next();
}

self.onmessage = async (event: MessageEvent<DemJob>) => {
  if ("stats" in event.data) {
    const reply: DemReply = { id: event.data.id, trace: pipeline.trace() };
    (self as unknown as Worker).postMessage(reply);
    return;
  }
  const { id, z, x, y, shallow, child, cancel } = event.data;
  if (cancel) {
    running.get(id)?.abort();
    return;
  }
  const controller = new AbortController();
  running.set(id, controller);
  const deep = z >= DEEP_FROM_Z;
  if (deep) await takeDeepSlot();
  try {
    /* The camera may have left while this waited for its turn. */
    if (controller.signal.aborted) {
      const reply: DemReply = { id, cancelled: true };
      (self as unknown as Worker).postMessage(reply);
      return;
    }
    const result = await pipeline.resolve(z, x, y, controller.signal, { shallow, child });
    if (!result) {
      const reply: DemReply = { id, cancelled: true };
      (self as unknown as Worker).postMessage(reply);
      return;
    }
    const reply: DemReply = {
      id,
      bitmap: result.bitmap,
      kind: result.kind,
      computeMs: result.computeMs,
      from: result.from,
    };
    (self as unknown as Worker).postMessage(reply, [result.bitmap]);
  } catch (err) {
    const reply: DemReply = { id, error: String(err) };
    (self as unknown as Worker).postMessage(reply);
  } finally {
    running.delete(id);
    if (deep) releaseDeepSlot();
  }
};
