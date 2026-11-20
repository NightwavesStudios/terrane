import { CATEGORIES, category } from "../data/features";
import type { AreaRow, CatalogRow } from "./catalog";
import { kmBetween } from "./geo";
import { pickContext } from "./present";
import { normalize, singular } from "./text";

/**
 * Geographic search over the discovery catalog.
 *
 * A query is not one string match. Words are classified first: a category word
 * ("falls", "camping", "hot springs") becomes a filter over the taxonomy, an
 * area word ("Iceland", "Valais") becomes a region result that can be flown to,
 * and the rest must appear in a place's name or context. Every text word must
 * match — "falls iceland" cannot return a French waterfall because "falls"
 * matched — and the ordering is deterministic: exact, prefix, word prefix,
 * substring, then proximity to the camera and finally fame.
 */

export type SearchHit =
  | { kind: "place"; row: CatalogRow; score: number; why: string }
  | { kind: "area"; area: AreaRow; score: number }
  | { kind: "point"; lat: number; lon: number; label: string };

export interface SearchResult {
  hits: SearchHit[];
  /** Every matching place, before the display limit. */
  total: number;
  /** True once the query is long enough to run at all. */
  active: boolean;
}

export interface SearchArgs {
  rows: CatalogRow[];
  areas: AreaRow[];
  query: string;
  /** The active category chips; empty or absent means every category. */
  cats?: Set<string>;
  /** Rounded map centre, for the proximity boost and the distance column. */
  center?: { lat: number; lon: number } | null;
  limit?: number;
}

const TERMS = new Map<string, string[]>();

function addTerm(term: string, ids: string[]): void {
  const key = normalize(term);
  if (!key) return;
  const existing = TERMS.get(key);
  if (existing) {
    for (const id of ids) if (!existing.includes(id)) existing.push(id);
  } else {
    TERMS.set(key, [...ids]);
  }
}

for (const cat of CATEGORIES) {
  addTerm(cat.label, [cat.id]);
  addTerm(cat.one, [cat.id]);
}

/* Words a reader uses that the taxonomy does not spell the same way. Kept
   explicit: a synonym is a promise about what a result will be. */
const SYNONYMS: [string, string[]][] = [
  ["falls", ["waterfall"]],
  ["fall", ["waterfall"]],
  ["cascades", ["waterfall"]],
  ["mountains", ["peak", "range", "volcano"]],
  ["mountain", ["peak", "range"]],
  ["hills", ["peak", "volcano"]],
  ["summits", ["peak"]],
  ["national park", ["park"]],
  ["national parks", ["park"]],
  ["nature reserve", ["reserve"]],
  ["nature reserves", ["reserve"]],
  ["lakes", ["lake"]],
  ["hot springs", ["spring"]],
  ["hot spring", ["spring"]],
  ["thermal springs", ["spring"]],
  ["caves", ["cave"]],
  ["glaciers", ["glacier"]],
  ["islands", ["island"]],
  ["beaches", ["beach"]],
  ["canyons", ["canyon"]],
  ["valleys", ["valley"]],
  ["deserts", ["desert"]],
  ["volcanoes", ["volcano"]],
  ["camping", ["camp", "caravan"]],
  ["campground", ["camp"]],
  ["campgrounds", ["camp"]],
  ["campsite", ["camp"]],
  ["campsites", ["camp"]],
  ["refuge", ["hut"]],
  ["refuges", ["hut"]],
  ["mountain hut", ["hut"]],
  ["mountain huts", ["hut"]],
  ["car park", ["parking"]],
  ["car parks", ["parking"]],
  ["parking lot", ["parking"]],
  ["toilet", ["toilets"]],
  ["loo", ["toilets"]],
  ["lookout", ["view"]],
  ["lookouts", ["view"]],
  ["viewpoint", ["view"]],
  ["viewpoints", ["view"]],
  ["picnic", ["picnic"]],
  ["picnic area", ["picnic"]],
  ["information", ["info"]],
  ["info board", ["info"]],
  ["trail head", ["trailhead"]],
  ["trail heads", ["trailhead"]],
  ["parking area", ["parking"]],
];

for (const [word, ids] of SYNONYMS) addTerm(word, ids);

function termFor(word: string): string[] | undefined {
  return TERMS.get(word) ?? TERMS.get(singular(word));
}

/** Split a normalized query into category constraints and free text. */
function classify(query: string): { catSets: string[][]; text: string[] } {
  const tokens = normalize(query).split(" ").filter(Boolean);
  const catSets: string[][] = [];
  const text: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const pair = i + 1 < tokens.length ? `${tokens[i]} ${tokens[i + 1]}` : "";
    const phrase = pair ? termFor(pair) : undefined;
    if (phrase) {
      catSets.push(phrase);
      i += 1;
      continue;
    }
    const single = termFor(tokens[i]);
    if (single) catSets.push(single);
    else text.push(tokens[i]);
  }
  return { catSets, text };
}

export function parseCoordinates(query: string): { lat: number; lon: number } | null {
  const match = query
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function nameScore(norm: string, token: string): number {
  if (norm === token) return 100;
  const parts = norm.split(" ");
  if (parts.some((word) => word === token)) return 90;
  if (parts.some((word) => word.startsWith(token))) return 80;
  if (norm.startsWith(token)) return 70;
  if (norm.includes(token)) return 40;
  return 0;
}

function contextScore(row: CatalogRow, token: string): number {
  const fields = [row.region, row.country, row.near?.name]
    .filter((value): value is string => Boolean(value))
    .map(normalize);
  for (const field of fields) {
    if (field === token) return 62;
    if (field.split(" ").some((word) => word === token)) return 58;
    if (field.split(" ").some((word) => word.startsWith(token))) return 50;
    if (field.includes(token)) return 26;
  }
  return 0;
}

function proximityScore(km: number | null): number {
  if (km == null) return 0;
  if (km < 10) return 42;
  if (km < 50) return 28;
  if (km < 200) return 14;
  return 0;
}

function fameScore(tier: number): number {
  if (tier === 0) return 16;
  if (tier === 1) return 14;
  if (tier === 2) return 8;
  return 0;
}

/** The list's second line: what it is and where it is, in one phrase. */
export function rowWhy(row: CatalogRow): string {
  return `${category(row.cat).one} · ${pickContext(row.pick, row.near)}`;
}

export function search({
  rows,
  areas,
  query,
  cats,
  center,
  limit = 12,
}: SearchArgs): SearchResult {
  const trimmed = query.trim();
  const normQuery = normalize(trimmed);
  if (normQuery.length < 2) return { hits: [], total: 0, active: false };

  const point = parseCoordinates(trimmed);
  if (point) {
    return {
      hits: [
        {
          kind: "point",
          lat: point.lat,
          lon: point.lon,
          label: `${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}`,
        },
      ],
      total: 1,
      active: true,
    };
  }

  const { catSets, text } = classify(trimmed);
  const allowed = cats && cats.size ? cats : null;
  const matches: { hit: SearchHit; km: number | null }[] = [];
  let total = 0;

  for (const row of rows) {
    if (allowed && !allowed.has(row.cat)) continue;
    if (catSets.length && !catSets.every((set) => set.includes(row.cat))) continue;

    let score = 300;
    if (row.norm === normQuery) score = 1200;
    else if (row.norm.startsWith(normQuery)) score = 900;
    let matched = true;
    for (const token of text) {
      const tokenScore = Math.max(nameScore(row.norm, token), contextScore(row, token));
      if (tokenScore === 0) {
        matched = false;
        break;
      }
      score += tokenScore;
    }
    if (!matched) continue;

    if (text.length > 0 && row.norm.includes(text.join(" "))) score += 120;

    const km = center ? kmBetween(center.lat, center.lon, row.lat, row.lon) : null;
    score += proximityScore(km) + fameScore(row.tier) + (row.hasPage ? 3 : 0);

    matches.push({
      hit: { kind: "place", row, score, why: rowWhy(row) },
      km,
    });
    total += 1;
  }

  const areaQuery = text.join(" ");
  const areaHits: SearchHit[] = [];
  if (areaQuery.length >= 3) {
    const scored = areas
      .filter(
        (area) =>
          area.norm === areaQuery ||
          area.norm.startsWith(areaQuery) ||
          normQuery.includes(area.norm) ||
          area.norm.split(" ").some((word) => word.startsWith(areaQuery)),
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
    for (const area of scored) {
      areaHits.push({
        kind: "area",
        area,
        score: 1000 + Math.min(200, area.count),
      });
    }
    total += areaHits.length;
  }

  matches.sort(
    (a, b) =>
      (b.hit.kind === "place" ? b.hit.score : 0) - (a.hit.kind === "place" ? a.hit.score : 0) ||
      (a.km ?? Infinity) - (b.km ?? Infinity) ||
      (a.hit.kind === "place" ? a.hit.row.name : "").localeCompare(
        b.hit.kind === "place" ? b.hit.row.name : "",
      ) ||
      (a.hit.kind === "place" ? a.hit.row.key : "").localeCompare(
        b.hit.kind === "place" ? b.hit.row.key : "",
      ),
  );

  return {
    hits: [...areaHits, ...matches.slice(0, limit).map((match) => match.hit)],
    total,
    active: true,
  };
}
