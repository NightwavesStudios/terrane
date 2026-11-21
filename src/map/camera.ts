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

/** A linear ramp through [zoom, value] stops; flat outside the ends. */
function ramp(zoom: number, stops: [number, number][]): number {
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [z0, v0] = stops[i - 1];
    const [z1, v1] = stops[i];
    if (zoom <= z1) return v0 + ((zoom - z0) / (z1 - z0)) * (v1 - v0);
  }
  return stops[stops.length - 1][1];
}

/**
 * Camera tilt for a zoom: level at planet scale, oblique over ranges.
 *
 * The earlier curve — `(z - 1.9) * 13` — only reached 40° at z5, so the views
 * where a range is small enough to see whole were also the views where it was
 * seen face-on. Relief has to be oblique before it is large: 30° by z4, 48° by
 * z6 and the full 58° from z13.
 */
export function pitchForZoom(zoom: number): number {
  return ramp(zoom, [
    [2.2, 0],
    [4, 30],
    [6, 48],
    [8, 55],
    [13, 58],
  ]);
}

/**
 * How tall the mesh is drawn, as a multiple of the terrain slider.
 *
 * Exaggeration was a single number for every camera, and at 1.4 a 4 000 m range
 * seen whole is a bump on a 400 km frame — the reason the globe read flat until
 * the mountains filled the screen. The wider the camera, the more the height has
 * to be stretched to read at all; close in, the real shape is legible and more
 * exaggeration only makes spikes. The layer slider multiplies this.
 */
export function terrainExaggeration(zoom: number): number {
  return ramp(zoom, [
    [0, 2.8],
    [3, 2.6],
    [6, 2.1],
    [9, 1.6],
    [12, 1.35],
    [14, 1.25],
  ]);
}

/**
 * Space a selected place must clear.
 *
 * This is the fallback for callers that cannot measure the card (the route
 * framing, a map with no card). The globe itself measures the live card, so the
 * reservation matches what is actually on screen.
 *
 * The breakpoint is 900 px, the same one `PickSheet` uses to decide whether the
 * card is a bottom sheet or a desktop column.
 */
export function flyPadding(width: number): { left: number; bottom: number } {
  return width > 900 ? { left: 440, bottom: 40 } : { left: 0, bottom: 300 };
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
 * Far away, the frame comes from the category and the elevation, never from the
 * zoom the reader happened to be at: a park clicked from street level has to
 * pull back to 9.6 or it is one trailhead. But a place already under the camera
 * (within 3 km) takes a step *in* from where the reader is — the earlier rule
 * kept the current zoom in that case, which made clicking a nearby pin a literal
 * no-op.
 */
export function focusFor(
  cat: string,
  elev: number | null | undefined,
  current: number,
  km: number,
): number {
  const frame = focusZoomFor(cat, elev);
  const target = km <= 3 ? Math.max(frame, current + 1.4) : frame;
  return Math.max(3, Math.min(16, target));
}
