/**
 * "The first pin cell has arrived."
 *
 * Pins and route lines both come from megabyte cells, and both start on the same
 * `moveend`. Loading them together splits the bandwidth and the main thread
 * between the thing the reader is looking at (the pins) and the thing they read
 * afterwards (the named routes), so the pins land late on a slow link. This is
 * the one signal the two modules share: mapped.ts resolves it when its first
 * cell is on the map, trails.ts waits for it before it spends a byte.
 */
let resolveFirst: (() => void) | null = null;

const settled = new Promise<void>((resolve) => {
  resolveFirst = resolve;
});

/** Resolves once, when the first practical-pin cell has been drawn. */
export const firstPinCell = settled;

export function markFirstPinCell(): void {
  resolveFirst?.();
  resolveFirst = null;
}
