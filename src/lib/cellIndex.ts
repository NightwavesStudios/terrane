import { cellUrl, setStoreVersion } from "./cells";

/**
 * The store's upload manifest, read for one thing: the version its cells were
 * published under.
 *
 * `upload-manifest.json` is the uploader's own incremental state
 * (`scripts/upload-changed.mjs`), i.e. every object *one checkout* has written —
 * not an inventory of the bucket. It cannot answer "does this cell exist":
 *
 *   - on 2026-11-20 it listed 98 `poi/6/…` cells, while the store served
 *     `poi/6/33/22.json` (11.7 MB), `poi/6/31/21.json` and most other cells the
 *     harvest wrote; those were uploaded by an earlier run whose state file this
 *     checkout never had (the state is gitignored);
 *   - the store offers no client-readable listing (`coverage.json` reports
 *     totals, not keys), so nothing can prove a cell is absent.
 *
 * An earlier version inferred absence from a family ("`poi/6/` is tracked and
 * this key is not listed, so the cell is empty"), which hid nearly every real
 * cell: the practical pins never appeared and the map looked like the harvest had
 * failed. So presence here is positive-only — a listed cell is known to exist, an
 * unlisted one is unknown and is fetched. A cell that really is missing answers
 * 404, which `mapped.ts` and `trails.ts` already turn into a backed-off miss
 * rather than a repeated request.
 *
 * Reading the manifest still earns its keep: `setStoreVersion` appends its
 * `generatedAt` to cell URLs, so a weekly publish is not hidden behind a cell's
 * one-hour cache.
 */
const TTL_MS = 10 * 60_000;

type Index = { at: number; keys: Set<string> };
let cached: Index | null = null;
let attemptedAt = 0;
let inflight: Promise<Index | null> | null = null;

/**
 * `true` when the manifest lists this path, `null` when it does not know — which
 * includes the ordinary case of a cell this checkout never uploaded. Never
 * `false`: the manifest cannot prove a cell is missing.
 */
export function cellPresence(index: Set<string> | null, path: string): true | null {
  return index?.has(path) ? true : null;
}

async function fetchIndex(): Promise<Index | null> {
  try {
    const res = await fetch(cellUrl("upload-manifest.json"));
    if (!res.ok) return null;
    const body = (await res.json()) as {
      files?: Record<string, string | { hash?: string; bytes?: number }>;
      generatedAt?: string;
    };
    setStoreVersion(body?.generatedAt);
    const keys = body?.files ? Object.keys(body.files) : [];
    return keys.length ? { at: Date.now(), keys: new Set(keys) } : null;
  } catch {
    /* The manifest only supplies a cache version: without it cells are still fetched. */
    return null;
  }
}

/** The store's manifest, refreshed at most every ten minutes, or null if unavailable. */
function loadCellIndex(): Promise<Index | null> {
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

/**
 * Whether a cell is worth fetching. Always `true`: this awaits the manifest only
 * so `cellUrl` can version the request. It stays a function (rather than a no-op)
 * because callers already treat it as the "should I fetch?" decision, and a cell
 * the manifest does list is still fetched normally.
 */
export async function cellMayExist(path: string): Promise<boolean> {
  const index = await loadCellIndex();
  return cellPresence(index?.keys ?? null, path) ?? true;
}
