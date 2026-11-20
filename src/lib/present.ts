import type { Pick } from "../data/features";

/**
 * The one way a place is described.
 *
 * A summit, a lake, a campsite and a car park are one record, so they get one
 * fact order: where it is, how high, what it costs or offers, how far the trail
 * runs, and the source. The card, the Discover rows and the place page all read
 * these helpers, which is what keeps "informative" from meaning four different
 * layouts.
 */

/** A near named destination, for context a row does not record itself. */
export type NearRef = { name: string; km: number } | null | undefined;

/** Kilometres in plain words: metres under 1 km, one decimal under 10. */
export function formatKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km)} km`;
}

/** Decimal degrees as a reader reads them. */
export function coordinates(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}

/** Region and country, without saying "Switzerland, Switzerland". */
export function placeLine(region?: string, country?: string): string {
  if (region && country && region !== country) return `${region}, ${country}`;
  return region || country || "";
}

/**
 * Where a place is, in the most specific honest form available:
 * structured region/country, then a named neighbour, then the source's own
 * location string, then coordinates. Never empty.
 */
export function pickContext(pick: Pick, near?: NearRef): string {
  const structured = placeLine(pick.region, pick.country);
  if (structured) return structured;
  if (near) return `${formatKm(near.km)} from ${near.name}`;
  if (pick.where && pick.where !== pick.name) return pick.where;
  return coordinates(pick.lat, pick.lon);
}

/** The card's title; unnamed pins still get a readable sentence. */
export function pickTitle(pick: Pick, fallbackOne: string): string {
  const name = pick.name.trim();
  return name || `Unnamed ${fallbackOne.toLowerCase()}`;
}

/** The ordered facts under a title, de-duplicated, no empty lines. */
export function pickFacts(pick: Pick, near?: NearRef): string[] {
  const facts: string[] = [pickContext(pick, near)];
  if (pick.elev && pick.elev > 0) {
    facts.push(`${Math.round(pick.elev).toLocaleString("en-US")} m`);
  }
  if (pick.note) facts.push(pick.note);
  if (pick.distance && pick.distance > 0) facts.push(formatKm(pick.distance / 1000));
  if (pick.difficulty) facts.push(pick.difficulty);

  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = fact.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
