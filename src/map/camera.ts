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
 * from 11.5, a summit from 13.4; a tent from 14.6.
 */
const FOCUS_ZOOM: Record<string, number> = {
  park: 9.6,
  reserve: 9.6,
  range: 9.6,
  desert: 9.6,
  island: 9.6,
  beach: 9.6,
  lake: 11.5,
  glacier: 11.5,
  valley: 11.5,
  canyon: 11.5,
  peak: 13.4,
  volcano: 13.4,
  waterfall: 13.4,
  cave: 13.4,
  spring: 13.4,
  camp: 14.6,
  hut: 14.6,
  caravan: 14.6,
  shelter: 14.2,
  pass: 14.2,
  trailhead: 14.2,
  view: 14.2,
  parking: 15.4,
  trail: 12.5,
};

/**
 * Elevation widens the frame.
 *
 * The camera sits 55° over the ground and the terrain is drawn at 1.4×, so a
 * 4,200 m summit framed at a shoulder's zoom is a wall of its own south face
 * instead of a peak: the thing being looked at ends up above the top of the
 * screen and the surrounding valleys never appear. Standing back by about one
 * zoom level at continental high points keeps the summit and its neighbours in
 * frame. A 1,200 m ridge is framed exactly as before.
 */
export function focusZoomFor(cat: string, elev?: number | null): number {
  const base = FOCUS_ZOOM[cat] ?? 13.2;
  if (!elev || elev < 1200) return base;
  const tall = Math.min(1, (elev - 1200) / 3000);
  return base - tall * 1.2;
}

/**
 * Zoom that fits a ground radius across the viewport.
 *
 * A chip keeping the places within 120 km of a visitor cannot fly to a view a
 * thousand kilometres wide: the list and the camera would be describing
 * different areas. The radius is a radius, so the frame is its diameter across
 * the shorter side of the screen.
 */
export function radiusZoom(
  radiusKm: number,
  lat: number,
  width: number,
  height: number,
): number {
  const metres = radiusKm * 2000;
  const px = Math.max(240, Math.min(width, height) * 0.9);
  /* 156,543 m per pixel at z0 on the equator, narrowed by latitude. */
  const atZoomZero = 156543 * Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  return Math.max(3, Math.min(11, Math.log2(atZoomZero / (metres / px))));
}

/**
 * The zoom a picked place should land on.
 *
 * The frame comes from the category and the elevation, never from the zoom the
 * reader happened to be at. `Math.max(current, frame)` looked reasonable and was
 * the reason a click on a park from street level stayed at 16 and showed one
 * trailhead, while a click on a summit from the planet view jumped eleven levels
 * in one move. The one case where the reader's zoom is the answer is the place
 * already under the camera: within 3 km and at least as close as the frame.
 */
export function pickZoom(
  cat: string,
  elev: number | null | undefined,
  current: number,
  km: number,
): number {
  const frame = focusZoomFor(cat, elev);
  if (km <= 3 && current >= frame) return current;
  return frame;
}
