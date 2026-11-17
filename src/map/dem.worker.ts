/**
 * The DEM worker: one pipeline instance, one job at a time per message.
 *
 * Everything expensive about a terrain tile — the fetch, the elevation decode,
 * the resample and the re-encode — happens here, so the main thread only ever
 * receives an `ImageBitmap` it can hand straight to MapLibre.
 */
import {
  createDemPipeline,
  type DemJob,
  type DemReply,
} from "./demPipeline";

const pipeline = createDemPipeline();

self.onmessage = async (event: MessageEvent<DemJob>) => {
  const { id, z, x, y } = event.data;
  try {
    const result = await pipeline.resolve(z, x, y);
    const reply: DemReply = {
      id,
      bitmap: result.bitmap,
      kind: result.kind,
      computeMs: result.computeMs,
    };
    (self as unknown as Worker).postMessage(reply, [result.bitmap]);
  } catch (err) {
    const reply: DemReply = { id, error: String(err) };
    (self as unknown as Worker).postMessage(reply);
  }
};
