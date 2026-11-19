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
 * 659 MB of a 1 GB R2 allowance, so a second environment would exceed the quota
 * before the objects could be copied. See docs/data-pipeline.md.
 */
const DEFAULT_BASE = "https://terrane-poi-cells-mqa53q-preview.freebuff.site";

export const CELLS_BASE = (
  (import.meta.env.VITE_POI_BASE as string | undefined) ?? DEFAULT_BASE
).replace(/\/+$/, "");

/** Build a URL under the cell store. `path` is "manifest.json", "poi/6/…". */
export function cellUrl(path: string): string {
  return `${CELLS_BASE}/${path.replace(/^\/+/, "")}`;
}
