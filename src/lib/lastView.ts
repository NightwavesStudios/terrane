/**
 * The camera the reader left the globe on.
 *
 * The map already writes `?at=lat,lon,zoom` into the URL, but a place page is a
 * different path and loses the query. Home records the settled camera here; the
 * page's back link returns to it instead of resetting the globe to the world.
 */

const KEY = "terrane.lastView";

export type LastView = { lat: number; lon: number; zoom: number };

export function rememberView(view: LastView): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    /* Private mode: the back link falls back to the world view. */
  }
}

export function readLastView(): LastView | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LastView>;
    if (
      typeof value.lat !== "number" ||
      !Number.isFinite(value.lat) ||
      typeof value.lon !== "number" ||
      !Number.isFinite(value.lon) ||
      typeof value.zoom !== "number" ||
      !Number.isFinite(value.zoom)
    ) {
      return null;
    }
    return { lat: value.lat, lon: value.lon, zoom: value.zoom };
  } catch {
    return null;
  }
}

export function globeHref(view: LastView | null): string {
  if (!view) return "/";
  return `/?at=${view.lat.toFixed(3)},${view.lon.toFixed(3)},${view.zoom.toFixed(2)}`;
}
