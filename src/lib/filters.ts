import { PLACES, type Place, type PlaceType } from "../data/places";
import type { Home } from "./locate";

export type Filter = "all" | PlaceType | "home";

/** What the visitor's own chip is called, and which places answer to it. */
export type HomeScope = { label: string; test: (place: Place) => boolean };

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
 */
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
  }

  const country = home.country ? norm(home.country) : "";
  if (country && PLACES.some((p) => norm(p.country).includes(country))) {
    return { label: home.country as string, test: (p) => norm(p.country).includes(country) };
  }

  return null;
}

export function matches(place: Place, filter: Filter, scope: HomeScope | null) {
  if (filter === "all") return true;
  if (filter === "home") return scope ? scope.test(place) : true;
  return place.type === filter;
}
