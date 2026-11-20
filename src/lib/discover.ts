import type { Pick } from "../data/features";
import type { CatalogRow } from "./catalog";
import { kmBetween } from "./geo";

/**
 * Turning a map position into places worth going to.
 *
 * Everything here is a pure function of rows and a centre: Discover recomputes
 * it on a settled camera or a category change, never mid-gesture. Each list is
 * capped per category so "nearby" cannot be four car parks and "lesser known"
 * cannot be four waterfalls in one valley.
 */

export type RankedRow = { row: CatalogRow; km: number };

/**
 * How far "nearby" reaches at a zoom.
 *
 * The radius is a frame, not a filter: at planet scale a reader is asking what
 * is on this continent, at trail zoom what is on this ridge. The same list
 * refresh from a zoom change never chases a file, because every row is local.
 */
export function radiusForZoom(zoom: number): number {
  if (zoom < 3) return 2000;
  if (zoom < 5) return 600;
  if (zoom < 6.5) return 250;
  if (zoom < 8) return 90;
  if (zoom < 9.5) return 30;
  if (zoom < 11) return 12;
  return 5;
}

function within(
  rows: CatalogRow[],
  center: { lat: number; lon: number },
  radiusKm: number,
  cats?: Set<string> | null,
): RankedRow[] {
  const out: RankedRow[] = [];
  for (const row of rows) {
    if (cats && cats.size && !cats.has(row.cat)) continue;
    const km = kmBetween(center.lat, center.lon, row.lat, row.lon);
    if (km <= radiusKm) out.push({ row, km });
  }
  return out;
}

/** At most `per` rows of each category, walking an already-sorted list. */
function diversify(sorted: RankedRow[], limit: number, per = 2): RankedRow[] {
  const counts = new Map<string, number>();
  const out: RankedRow[] = [];
  for (const item of sorted) {
    const used = counts.get(item.row.cat) ?? 0;
    if (used >= per) continue;
    counts.set(item.row.cat, used + 1);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** The closest places, with a category cap so the list stays useful. */
export function nearby(
  rows: CatalogRow[],
  center: { lat: number; lon: number },
  radiusKm: number,
  cats?: Set<string> | null,
  limit = 4,
): RankedRow[] {
  const sorted = within(rows, center, radiusKm, cats).sort(
    (a, b) => a.km - b.km || a.row.name.localeCompare(b.row.name),
  );
  return diversify(sorted, limit);
}

function fame(row: CatalogRow): number {
  if (row.tier === 0) return 100;
  if (row.tier === 1) return 80;
  if (row.tier === 2) return 58;
  if (row.tier === 3) return 26;
  if (row.tier === 4) return 12;
  return 4;
}

/**
 * What the area is known for. Empty over an ocean falls back to the world list
 * rather than showing an empty section, because "worth the detour" is a global
 * question at that zoom.
 */
export function notable(
  rows: CatalogRow[],
  center: { lat: number; lon: number },
  radiusKm: number,
  cats?: Set<string> | null,
  limit = 4,
  exclude?: Set<string>,
): RankedRow[] {
  const pool = within(rows, center, radiusKm, cats).filter(
    (item) => !exclude?.has(item.row.key),
  );
  const ranked = (items: RankedRow[]) =>
    items
      .map((item) => ({
        ...item,
        score:
          fame(item.row) +
          Math.min(20, (item.row.pick.elev ?? 0) / 250) +
          (item.row.hasPage ? 12 : 0) +
          Math.max(0, 12 - item.km / Math.max(1, radiusKm) * 12),
      }))
      .sort((a, b) => b.score - a.score || a.km - b.km)
      .map(({ row, km }) => ({ row, km }));

  let sorted = ranked(pool);
  if (sorted.length < limit) {
    const picked = new Set(sorted.map((item) => item.row.key));
    const global = rows.filter(
      (row) =>
        !picked.has(row.key) &&
        !exclude?.has(row.key) &&
        (!cats || !cats.size || cats.has(row.cat)),
    );
    sorted = [
      ...sorted,
      ...ranked(within(global, center, Number.POSITIVE_INFINITY, cats)),
    ];
  }
  return diversify(sorted, limit);
}

/**
 * Places the famous lists do not carry: reach tiers 3 and 4, which are the
 * local rows rather than the continental ones. Proximity leads; the name of a
 * nearby destination is the only bonus, because it means the place has a
 * context a reader can navigate by.
 */
export function hiddenGems(
  rows: CatalogRow[],
  center: { lat: number; lon: number },
  radiusKm: number,
  cats?: Set<string> | null,
  limit = 4,
  exclude?: Set<string>,
): RankedRow[] {
  const sorted = within(rows, center, radiusKm, cats)
    .filter((item) => !exclude?.has(item.row.key))
    .filter((item) => item.row.tier >= 3 && item.row.tier <= 4)
    .map((item) => ({
      ...item,
      score:
        Math.max(0, 40 - (item.km / radiusKm) * 30) +
        (item.row.near ? 8 : 0) +
        (item.row.pick.elev ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.km - b.km)
    .map(({ row, km }) => ({ row, km }));
  return diversify(sorted, limit);
}

function samePoint(a: Pick | { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  return Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lon - b.lon) < 0.005;
}

/**
 * More of the same kind around a point. Used by the card's "more peaks nearby"
 * chips, so it only ever returns the same category and never the place itself.
 */
export function relatedRows(
  point: { cat: string; lat: number; lon: number; slug?: string; name?: string },
  rows: CatalogRow[],
  limit = 3,
  radiusKm = 200,
): RankedRow[] {
  const out: RankedRow[] = [];
  for (const row of rows) {
    if (row.cat !== point.cat) continue;
    if (point.slug && row.pick.slug === point.slug) continue;
    if (samePoint(point, row)) continue;
    const km = kmBetween(point.lat, point.lon, row.lat, row.lon);
    if (km <= radiusKm) out.push({ row, km });
  }
  out.sort((a, b) => a.km - b.km || a.row.name.localeCompare(b.row.name));
  return out.slice(0, limit);
}

export type CatalogRelations = {
  /** Closest catalog rows, including the long tail. */
  nearby: RankedRow[];
  /** Same category within visiting distance. */
  sameKind: RankedRow[];
  /** Same region (or country when the atlas has no region). */
  sameArea: RankedRow[];
  /** Tier 3–4 rows close enough to be a detour, not a headline. */
  lesser: RankedRow[];
  areaLabel?: string;
};

/**
 * The place page's relationships, from the full catalog once it is available.
 * The page can render immediately from the atlas-only snapshot and fill in the
 * tail when the lazy catalog load completes.
 */
export function relatedPlaces(
  base: CatalogRow,
  rows: CatalogRow[],
  limit = 6,
): CatalogRelations {
  const nearby: RankedRow[] = [];
  const sameKind: RankedRow[] = [];
  const sameArea: RankedRow[] = [];
  const lesser: RankedRow[] = [];
  let areaLabel = base.region ?? base.country;
  const byRegion = Boolean(base.region);

  for (const row of rows) {
    if (row.key === base.key) continue;
    const km = kmBetween(base.lat, base.lon, row.lat, row.lon);
    if (km <= 30) nearby.push({ row, km });
    if (row.cat === base.cat && km <= 300) sameKind.push({ row, km });
    if (row.tier >= 3 && row.tier <= 4 && km <= 50) lesser.push({ row, km });
    const inArea = byRegion ? row.region === base.region : row.country === base.country;
    if (inArea && km <= 1000) sameArea.push({ row, km });
  }

  /* Most atlas rows have no region, so a Valais summit would otherwise have no
     area section at all. Fall back to the country when the region list is empty,
     and relabel it, never mixing the two. */
  if (byRegion && sameArea.length === 0 && base.country) {
    for (const row of rows) {
      if (row.key === base.key || row.country !== base.country) continue;
      const km = kmBetween(base.lat, base.lon, row.lat, row.lon);
      if (km <= 1000) sameArea.push({ row, km });
    }
    areaLabel = base.country;
  }

  const rank = (items: RankedRow[]) =>
    items.sort((a, b) => a.km - b.km || a.row.name.localeCompare(b.row.name));
  /* One place, one section: the closest rows must not reappear under "more
     like this" or "elsewhere", otherwise the strongest relationships are
     repeated and the wider list never gets a look. */
  const used = new Set<string>();
  const take = (items: RankedRow[], cap: number) => {
    const picked = rank(items)
      .filter(({ row }) => !used.has(row.key))
      .slice(0, cap);
    for (const item of picked) used.add(item.row.key);
    return picked;
  };
  return {
    nearby: take(nearby, limit),
    sameKind: take(sameKind, limit),
    /* Local gems are more specific than the wider area, so they are claimed
       before the "elsewhere in …" list. */
    lesser: take(lesser, 4),
    sameArea: take(sameArea, 4),
    areaLabel,
  };
}
