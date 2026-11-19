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

/**
 * How close a click should fly for a category.
 *
 * One zoom for every destination meant a national park, a mountain range and a
 * single summit all landed at 14.2: a park filled the screen with one trailhead
 * and a range was never visible. A park is a place you look at from 9.6, a lake
 * from 11.5, a summit from 13.4; a tent from 14.6. The globe keeps whichever
 * zoom the reader already chose if they are closer than this.
 */
export function focusZoomFor(cat: string): number {
  switch (cat) {
    case "park":
    case "reserve":
    case "range":
    case "desert":
    case "island":
    case "beach":
      return 9.6;
    case "lake":
    case "glacier":
    case "valley":
    case "canyon":
      return 11.5;
    case "peak":
    case "volcano":
    case "waterfall":
    case "cave":
    case "spring":
      return 13.4;
    case "camp":
    case "hut":
    case "caravan":
      return 14.6;
    case "shelter":
    case "pass":
    case "trailhead":
    case "view":
      return 14.2;
    case "parking":
      return 15.4;
    case "trail":
      return 12.5;
    default:
      return 13.2;
  }
}
