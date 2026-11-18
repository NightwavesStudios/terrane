import type { Place } from "./places";

/* One ranking, two sources.

   The map has two provenances — 68 hand-written entries and the generated atlas
   rows — and drawing them as two classes was wrong in both directions. The
   written-up set is 51 United States entries out of 68, 33 of them in Georgia, so
   at world zoom the labels were half in one corner of one country, while a 4,900 m
   peak in Colorado with a Wikidata record never got a name at all.

   So provenance stops deciding what is prominent. Every place is scored on what it
   is and how high it is, the ranking is capped per country so no single country can
   fill the screen, and the flags the map already understands (`featured` = named
   first, `curated` = named later, neither = a dot until you zoom) are assigned from
   that ranking instead of from the file the place came from. */

/* Parks and landmarks come from Wikidata's national-park and natural-feature
   queries, so their presence already means "notable"; a peak has to earn it with
   height. Gems are the local set and start lower on purpose. */
function heightShare(p: Place): number {
  if (p.type === "peak") return Math.min(1, Math.max(0, p.elevation ?? 0) / 5000);
  if (p.type === "park") return 0.62;
  if (p.type === "landmark") return 0.55;
  return 0.4;
}

/**
 * How prominent a place is, 0…1. Deterministic: same input, same order.
 *
 * The first version scored height almost alone, and the names it produced at world
 * zoom were Acamarachi, Antofalla and Cerro Cañapa — six-thousand-metre Andean
 * summits that almost nobody has heard of, ahead of Torres del Paine. Height is
 * where a peak earns its place *within* the written-up set, not a substitute for
 * being worth a detour, so the editorial pick carries most of the weight and
 * height breaks the ties. Provenance still never decides on its own: a country's
 * written-up entries are capped exactly like everyone else's, and a generated row
 * with height behind it takes the slots they cannot hold.
 */
export function importance(p: Place): number {
  const editorial = p.featured ? 1 : p.curated ? 0.8 : 0;
  return editorial * 0.6 + heightShare(p) * 0.4;
}

/* Per country, so the world view is a world view. Two names per country in the
   first pass is roughly what fits without collisions at z2, and six in the second
   pass is what a country-sized viewport can hold. */
const TOP_PER_COUNTRY = 2;
const SECOND_PER_COUNTRY = 6;
const TOP_TOTAL = 16;
const SECOND_TOTAL = 260;

/**
 * The same places, in the same order, with `featured` / `curated` reassigned from
 * the global ranking. Pass it whatever is about to be drawn: ranking the filtered
 * set means "Peaks" or the visitor's own country gets its own best names, which
 * is the behaviour a filter is asking for.
 */
export function rankPlaces(places: Place[]): Place[] {
  const ranked = [...places].sort(
    (a, b) => importance(b) - importance(a) || a.name.localeCompare(b.name),
  );

  const topPerCountry = new Map<string, number>();
  const secondPerCountry = new Map<string, number>();
  let topUsed = 0;
  let secondUsed = 0;
  const flags = new Map<string, { featured: boolean; curated: boolean }>();

  for (const p of ranked) {
    const inTop = topPerCountry.get(p.country) ?? 0;
    const inSecond = secondPerCountry.get(p.country) ?? 0;
    if (inTop < TOP_PER_COUNTRY && topUsed < TOP_TOTAL) {
      topPerCountry.set(p.country, inTop + 1);
      topUsed += 1;
      flags.set(p.slug, { featured: true, curated: true });
    } else if (inSecond < SECOND_PER_COUNTRY && secondUsed < SECOND_TOTAL) {
      secondPerCountry.set(p.country, inSecond + 1);
      secondUsed += 1;
      flags.set(p.slug, { featured: false, curated: true });
    } else {
      flags.set(p.slug, { featured: false, curated: false });
    }
  }

  return places.map((p) => {
    const rank = flags.get(p.slug);
    if (!rank) return p;
    if (rank.featured === !!p.featured && rank.curated === !!p.curated) return p;
    return { ...p, featured: rank.featured, curated: rank.curated };
  });
}

/** How many places the ranking will name, for the layer note. */
export function rankedCounts(places: Place[]) {
  const flagged = rankPlaces(places);
  return {
    first: flagged.filter((p) => p.featured).length,
    second: flagged.filter((p) => p.curated && !p.featured).length,
    dots: flagged.filter((p) => !p.curated).length,
  };
}
