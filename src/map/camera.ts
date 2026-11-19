/**
 * Camera maths that does not need MapLibre.
 *
 * `worldZoom` lives here rather than in `Globe.tsx` so pages can size the
 * opening camera without importing the map library — a static import of a
 * value from `Globe.tsx` would drag ~1 MB of MapLibre into the entry bundle and
 * delay first paint on every route.
 */

/**
 * Zoom that shows the whole sphere without wasting the stage.
 *
 * At globe projection the rendered diameter is ≈ 161 · 2^zoom CSS px (measured
 * on MapLibre 5), so we can solve for the zoom that makes the planet about 90%
 * of the viewport width. Phones were otherwise cropped at both edges, and a
 * fixed low zoom left the globe looking lost on a narrow screen.
 */
export function worldZoom(width: number, height: number) {
  // Fit the sphere to whichever dimension binds first — a wide, short window
  // is limited by height, a phone by width.
  const fit = Math.log2(Math.min(width * 0.9, height * 0.82) / 161);
  return Math.max(0.6, Math.min(2.2, fit));
}

/** Camera tilt for a zoom: level at planet scale, oblique over ranges. */
export function pitchForZoom(zoom: number): number {
  return Math.max(0, Math.min(55, (zoom - 1.9) * 13));
}
