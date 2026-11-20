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
 * Space a selected place must clear.
 *
 * Above 860 px the card is a column on the left, so the camera centre moves right
 * by booking that column as left padding. At and below 860 px the card is a
 * bottom sheet, so the equivalent reservation is on the bottom. This is the same
 * breakpoint as the card and Discover sheet in `styles.css`; a wider one left a
 * 40 px band where the camera used the phone layout over a desktop card.
 */
export function flyPadding(width: number): { left: number; bottom: number } {
  return width > 860 ? { left: 440, bottom: 40 } : { left: 0, bottom: 300 };
}

/**
 * A camera in the URL: `?at=lat,lon,zoom`.
 *
 * Read here rather than in `Globe.tsx` so the Discover panel can start on the
 * same centre before the map chunk has arrived. Values outside the Web Mercator
 * envelope are video-game coordinates, not places, so they fall back to the
 * world view.
 */
export function readCamera(search = window.location.search): {
  center: [number, number];
  zoom: number | null;
} {
  const raw = new URLSearchParams(search).get("at");
  if (raw) {
    const [lat, lon, zoom] = raw.split(",").map(Number);
    if (
      [lat, lon, zoom].every(Number.isFinite) &&
      Math.abs(lat) <= 85 &&
      Math.abs(lon) <= 180
    ) {
      return {
        center: [lon, lat],
        zoom: Math.max(0.4, Math.min(16, zoom)),
      };
    }
  }
  return { center: [12, 22], zoom: null };
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
