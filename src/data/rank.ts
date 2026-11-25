import type { Place } from "./places";
import bandsFile from "./bands.json";

/**
 * One ranking, one band per place. Importance sets the order; a regional quota
 * sets the band, so the world view is a world view and not a Himalaya view.
 *
 * Provenance does not decide prominence: a peak earns its place with height, and
 * a park or landmark is notable by existing. No row gets a bonus for the file it
 * arrived in.
 *
 * The cap is a cell quota at each band's own cell size, not a per-country cap and
 * not one global top list. A global list of the highest summits was 24 rows in
 * seven z4 cells — every continent but Asia and South America empty. One row per
 * z4 cell gives each region its best, and the next bands add depth in the same
 * cells instead of opening a new hemisphere of nothing.
 */

export interface BandDef {
  band: number;
  dot: number;
  label: number;
  scale: number;
  opacity: number;
  labelSize: number;
  cell?: number;
  perCell?: number;
}

export const BANDS = (bandsFile as unknown as { bands: BandDef[] }).bands;

function heightShare(p: Place): number {
  /* Terrane is a mountain app first: a peak keeps a floor above every park and
     landmark, then earns its place with elevation and prominence. A 4,000-foot
     summit with a clean 900 m of prominence now beats a low foothill with none,
     which is the order a reader looking for mountains expects. The caps keep the
     scale comparable to the other types. */
  if (p.type === "peak") {
    const height = Math.min(1, Math.max(0, (p.elevation ?? 0) / 5000));
    const prominence = Math.min(1, Math.max(0, (p.prominence ?? 0) / 1500));
    return 0.55 + 0.3 * height + 0.15 * prominence;
  }
  if (p.type === "park") return 0.5;
  if (p.type === "landmark") return 0.45;
  return 0.3;
}

/** Deterministic: same input, same order. No provenance bonus. */
export function importance(p: Place): number {
  return heightShare(p);
}

export function cellOf(lat: number, lon: number, zoom: number): string {
  const cells = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * cells);
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * cells,
  );
  return `${x}/${y}`;
}

/**
 * Assign every place to a band.
 *
 * Walk the ranked list once: the first row in a z4 cell is band 0 (the world
 * dots), the next two in a z5 cell are band 1, the next six in a z6 cell are
 * band 2. Anything left over joins the long-tail bands rather than stacking a
 * whole mountain range at one zoom.
 */
export function rankPlaces(places: Place[]): Place[] {
  const ranked = [...places].sort(
    (a, b) => importance(b) - importance(a) || a.name.localeCompare(b.name),
  );

  const cells4 = new Map<string, number>();
  const cells5 = new Map<string, number>();
  const cells6 = new Map<string, number>();
  const assigned = new Map<string, number>();

  for (const p of ranked) {
    const c4 = cellOf(p.lat, p.lon, 4);
    const c5 = cellOf(p.lat, p.lon, 5);
    const c6 = cellOf(p.lat, p.lon, 6);
    const used4 = cells4.get(c4) ?? 0;
    const used5 = cells5.get(c5) ?? 0;
    const used6 = cells6.get(c6) ?? 0;

    let band = 3;
    if (used4 < 1) {
      cells4.set(c4, used4 + 1);
      band = 0;
    } else if (used5 < 2) {
      cells5.set(c5, used5 + 1);
      band = 1;
    } else if (used6 < 6) {
      cells6.set(c6, used6 + 1);
      band = 2;
    }
    assigned.set(p.slug, band);
  }

  return places.map((p) => {
    const band = assigned.get(p.slug) ?? 3;
    return p.band === band ? p : { ...p, band };
  });
}
