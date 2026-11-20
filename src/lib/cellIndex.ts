import { cellUrl } from "./cells";

/**
 * Which cells the store actually holds.
 *
 * The store publishes `upload-manifest.json`: the list its uploader keeps of every
 * object it has written (`scripts/upload-changed.mjs`, served by
 * `infra/cell-store/worker.js`). Asking for that list first turns "this cell was
 * never harvested" — a 404, which the browser logs as a failed request — into an
 * ordinary empty answer, without hiding anything the store does have: a cell the
 * index lists is still fetched normally, and any failure on it (bad status, broken
 * JSON) still throws and is reported.
 *
 * Only families the uploader tracks are judged. Parking cells (`.parking.json`) are
 * published outside this manifest, so their family is unknown and they are fetched
 * exactly as before rather than being declared absent.
 */
const TTL_MS = 10 * 60_000;

type Index = { at: number; keys: Set<string> };
let cached: Index | null = null;
let attemptedAt = 0;
let inflight: Promise<Index | null> | null = null;

function dirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? "" : path.slice(0, cut + 1);
}

function extOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.indexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1);
}

/**
 * `true` when the store lists this cell, `false` when the store tracks this family
 * of cells and does not list it, `null` when the index cannot say (no index, or a
 * family the uploader does not track).
 */
export function cellPresence(index: Set<string> | null, path: string): boolean | null {
  if (!index || index.size === 0) return null;
  if (index.has(path)) return true;
  const dir = dirOf(path);
  const ext = extOf(path);
  if (!dir || !ext) return null;
  const suffix = `.${ext}`;
  for (const key of index) {
    if (key.startsWith(dir) && key.endsWith(suffix)) return false;
  }
  return null;
}

async function fetchIndex(): Promise<Index | null> {
  try {
    const res = await fetch(cellUrl("upload-manifest.json"));
    if (!res.ok) return null;
    const body = (await res.json()) as { files?: Record<string, string> };
    const keys = body?.files ? Object.keys(body.files) : [];
    return keys.length ? { at: Date.now(), keys: new Set(keys) } : null;
  } catch {
    /* The index is an optimisation: without it every cell is fetched as before. */
    return null;
  }
}

/** The store's tile list, refreshed at most every ten minutes, or null if unavailable. */
export function loadCellIndex(): Promise<Index | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  if (!cached && attemptedAt && Date.now() - attemptedAt < TTL_MS) return Promise.resolve(null);
  inflight = fetchIndex()
    .then((next) => {
      attemptedAt = Date.now();
      if (next) cached = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Unknown counts as yes: never skip a cell the store might have. */
export async function cellMayExist(path: string): Promise<boolean> {
  const index = await loadCellIndex();
  return cellPresence(index?.keys ?? null, path) !== false;
}
