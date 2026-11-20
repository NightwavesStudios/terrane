/**
 * The runtime data origin.
 *
 * The vector map is built into the app; places, trail routes, the manifest and
 * the coverage report are fetched at runtime from the cell store. One constant
 * means a fork or a local mirror only has to set `VITE_POI_BASE` once, and the
 * three clients (`live.ts`, `mapped.ts`, `trails.ts`) cannot drift apart.
 *
 * The default is the published preview environment of the "Terrane POI cells"
 * Sites project. Production is deliberately not the default yet: the store is
 * ~700 MB of a 1 GB R2 allowance, so a second environment would exceed the quota
 * before the objects could be copied. See docs/data-pipeline.md.
 */
const DEFAULT_BASE = "https://terrane-poi-cells-mqa53q-preview.freebuff.site";

export const CELLS_BASE = (
  (import.meta.env.VITE_POI_BASE as string | undefined) ?? DEFAULT_BASE
).replace(/\/+$/, "");

/**
 * The upload manifest's `generatedAt`, once the index has been read. Appending it
 * to cell requests means a weekly publish is not hidden behind a cell's one-hour
 * cache; metadata keeps its own short TTL and is not versioned here.
 */
let storeVersion = "";

export function setStoreVersion(version: string | undefined): void {
  storeVersion = version ?? "";
}

/** Build a URL under the cell store. `path` is "manifest.json", "poi/6/…". */
export function cellUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  const versioned = storeVersion && /^(poi|trails)\//.test(clean);
  return `${CELLS_BASE}/${clean}${versioned ? `?v=${encodeURIComponent(storeVersion)}` : ""}`;
}
