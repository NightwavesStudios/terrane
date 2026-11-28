/**
 * Zoom that fits the rendered globe comfortably inside the available stage.
 * MapLibre's globe diameter is roughly 161 · 2^zoom CSS pixels.
 */
export function worldZoom(width: number, height: number): number {
  const fit = Math.log2(Math.min(width * 0.9, height * 0.82) / 161);
  return Math.max(0.6, Math.min(2.2, fit));
}

/** A close, readable peak view without taking the camera to street level. */
export function peakFocusZoom(currentZoom: number): number {
  return Math.min(11.2, Math.max(7.8, currentZoom + 1.9));
}

/** Keep a selected peak above the mobile preview panel. */
export function peakFocusPadding(width: number): { bottom: number } {
  return { bottom: width <= 700 ? Math.min(340, Math.max(240, width * 0.8)) : 0 };
}
