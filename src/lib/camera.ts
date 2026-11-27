/**
 * Zoom that fits the rendered globe comfortably inside the available stage.
 * MapLibre's globe diameter is roughly 161 · 2^zoom CSS pixels.
 */
export function worldZoom(width: number, height: number): number {
  const fit = Math.log2(Math.min(width * 0.9, height * 0.82) / 161);
  return Math.max(0.6, Math.min(2.2, fit));
}
