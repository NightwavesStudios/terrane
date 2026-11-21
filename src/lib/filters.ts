import { PLACES, type Place, type PlaceType } from "../data/places";
import { kmBetween } from "./geo";
import type { Home } from "./locate";

/**
 * What the map is mainly showing.
 *
 * `experience` is the curated catalogue as a mode of its own: the destination
 * pins step back and the beacons are the subject. A kind narrows the database and
 * drops the curated layer, so one answer is on screen at a time.
 */
export type Filter = "all" | PlaceType | "home" | "experience";

/** What the visitor's own chip is called, and which places answer to it. */
export type HomeScope = {
  label: string;
  test: (place: Place) => boolean;
  /** Ground radius the scope keeps, when it is a radius rather than a name. */
  radiusKm?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Turn the IP answer into a chip.
 *
 * The atlas covers 156 countries unevenly: for a visitor in the Valais there are
 * dozens of places in the canton, for one in the Netherlands there are none. So
 * the chip looks for a *region* first, falls back to the country, and disappears
 * entirely when neither has anything to show — a chip that filters to an empty
 * map is worse than no chip.
 *
 * Region names never match exactly across sources ("Valais" against "Canton du
 * Valais"), so the comparison is on letters only, either direction.
 *
 * The atlas records countries, not states or cantons: no row carries a region
 * name to match, so the name test alone fell through to the country and the chip
 * said "United States" to someone in California. The IP answer also carries
 * coordinates, so a region that names no rows becomes a local scope around the
 * visitor: everything within 120 km, widened once to 400 km when that would leave
 * the map empty, and the country only when even that has nothing.
 */

/** Radii for a region the atlas has no rows for, narrow first. */
const REGION_RADII_KM = [120, 400];
/** Fewer places than this is a chip that filters to an empty map. */
const CHIP_MIN = 3;

export function homeScope(home: Home | null): HomeScope | null {
  if (!home) return null;

  const region = home.region ? norm(home.region) : "";
  if (region.length > 2) {
    const hit = PLACES.find((p) => p.region && norm(p.region).includes(region));
    if (hit) {
      return {
        label: hit.region as string,
        test: (p) => Boolean(p.region && norm(p.region).includes(region)),
      };
    }
    const inside = PLACES.find((p) => p.region && region.includes(norm(p.region)));
    if (inside?.region) {
      return {
        label: inside.region,
        test: (p) => p.region === inside.region,
      };
    }
    if (Number.isFinite(home.lat) && Number.isFinite(home.lon)) {
      const { lat, lon } = home;
      for (const km of REGION_RADII_KM) {
        const near = (p: Place) => kmBetween(lat, lon, p.lat, p.lon) <= km;
        if (PLACES.filter(near).length >= CHIP_MIN) {
          return { label: home.region as string, test: near, radiusKm: km };
        }
      }
    }
  }

  const country = home.country ? norm(home.country) : "";
  if (country && PLACES.some((p) => norm(p.country).includes(country))) {
    return { label: home.country as string, test: (p) => norm(p.country).includes(country) };
  }

  return null;
}

export function matches(place: Place, filter: Filter, scope: HomeScope | null) {
  if (filter === "all") return true;
  /* No atlas row is an Experience: the curated catalogue is its own layer. */
  if (filter === "experience") return false;
  if (filter === "home") return scope ? scope.test(place) : true;
  return place.type === filter;
}
