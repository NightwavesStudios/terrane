import { useEffect, useState } from "react";
import type {
  Experience,
  ExperienceCatalogRow,
  ExperienceCategoryId,
  ExperienceDifficulty,
} from "../data/experiences";
import { kmBetween } from "./geo";
import { formatKm } from "./present";
import { normalize } from "./text";

/**
 * Lazy access to the generated experience index.
 *
 * The catalog is one compact file (one row per route) and each route is one
 * first-character shard, following `placePages.ts`. The list page can search and
 * filter without downloading the full stop, photo and trail records; the detail
 * page loads exactly one shard.
 *
 * Filtering is a pure function of rows here, not of the page's state, so it is
 * unit-tested rather than checked by clicking.
 */

type CatalogFile = {
  generated?: string;
  count?: number;
  items?: ExperienceCatalogRow[];
};
type ShardFile = { generated?: string; items?: Record<string, Experience> };

const FILES = import.meta.glob("../data/experience-index/*.json");
const shardCache = new Map<string, Promise<ShardFile | null>>();
let catalogPromise: Promise<CatalogFile | null> | null = null;

function shardOf(slug: string): string {
  const first = slug.slice(0, 1).toLowerCase();
  return /[a-z0-9]/.test(first) ? first : "_";
}

function loadJson<T>(file: string): Promise<T | null> {
  const loader = FILES[`../data/experience-index/${file}`];
  if (!loader) return Promise.resolve(null);
  return loader()
    .then((mod) => ((mod as { default?: T }).default ?? (mod as T)))
    .catch(() => null);
}

function loadCatalog(): Promise<CatalogFile | null> {
  if (!catalogPromise) catalogPromise = loadJson<CatalogFile>("catalog.json");
  return catalogPromise;
}

function loadShard(slug: string): Promise<ShardFile | null> {
  const file = `${shardOf(slug)}.json`;
  let pending = shardCache.get(file);
  if (!pending) {
    pending = loadJson<ShardFile>(file);
    shardCache.set(file, pending);
  }
  return pending;
}

export type CatalogStatus = "loading" | "ready" | "error";

export function useExperienceCatalog(): {
  rows: ExperienceCatalogRow[];
  generated: string;
  status: CatalogStatus;
} {
  const [state, setState] = useState<{
    rows: ExperienceCatalogRow[];
    generated: string;
    status: CatalogStatus;
  }>({ rows: [], generated: "", status: "loading" });

  useEffect(() => {
    let alive = true;
    void loadCatalog().then((file) => {
      if (!alive) return;
      const rows = Array.isArray(file?.items) ? file.items : [];
      setState({
        rows,
        generated: file?.generated ?? "",
        status: rows.length ? "ready" : "error",
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function useExperience(slug: string): {
  experience: Experience | null;
  loading: boolean;
} {
  const [experience, setExperience] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setExperience(null);
    setLoading(true);
    void loadShard(slug).then((file) => {
      if (!alive) return;
      setExperience(file?.items?.[slug] ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return { experience, loading };
}

/* ── pure helpers ────────────────────────────────────────────────────────── */

/**
 * How well a row answers a query.
 *
 * A title match leads, the region/country answers "where", and a stop name is
 * the discovery path from a place the reader already knows. Everything is
 * normalised the same way the map's search normalises names.
 */
function scoreRow(row: ExperienceCatalogRow, term: string): number {
  let score = 0;
  const title = normalize(row.title);
  if (title === term) score += 100;
  else if (title.startsWith(term)) score += 60;
  else if (title.includes(term)) score += 40;

  const where = normalize(`${row.region ?? ""} ${row.country ?? ""}`);
  if (where.includes(term)) score += 25;

  if (row.stopNames.some((name) => normalize(name).includes(term))) score += 20;
  return score;
}

/** How far from a chosen place a route still counts as "near". */
export const NEAR_RADIUS_KM = 150;

export type ExperienceNear = { lat: number; lon: number; label: string };

export type ExperienceFilter = {
  query?: string;
  category?: ExperienceCategoryId | null;
  difficulty?: ExperienceDifficulty | null;
  near?: ExperienceNear | null;
};

/** Straight-line kilometres from a place to a route's centre. */
export function kilometresFrom(
  row: Pick<ExperienceCatalogRow, "lat" | "lon">,
  near: ExperienceNear,
): number {
  return kmBetween(near.lat, near.lon, row.lat, row.lon);
}

/**
 * Filter and order the catalogue.
 *
 * Category and difficulty narrow the pool; a query scores titles, regions and
 * stop names; a chosen place keeps routes within `NEAR_RADIUS_KM` and orders
 * them by distance. A query inside a place still ranks matches first, with
 * distance breaking ties.
 */
export function filterExperiences(
  rows: ExperienceCatalogRow[],
  options: ExperienceFilter = {},
): ExperienceCatalogRow[] {
  const term = normalize((options.query ?? "").trim());
  const category = options.category ?? null;
  const difficulty = options.difficulty ?? null;
  const near = options.near ?? null;

  let pool = rows;
  if (category) pool = pool.filter((row) => row.category === category);
  if (difficulty) pool = pool.filter((row) => row.difficulty === difficulty);
  if (near) {
    pool = pool.filter((row) => kilometresFrom(row, near) <= NEAR_RADIUS_KM);
  }
  if (!term && !near) return pool;

  const scored = pool.map((row) => ({
    row,
    score: term ? scoreRow(row, term) : 0,
    km: near ? kilometresFrom(row, near) : 0,
  }));

  return scored
    .filter((item) => !term || item.score > 0)
    .sort(
      (a, b) =>
        (term ? b.score - a.score : 0) ||
        a.km - b.km ||
        a.row.title.localeCompare(b.row.title) ||
        a.row.slug.localeCompare(b.row.slug),
    )
    .map((item) => item.row);
}

/** The stop a query matched, for the "includes X" line on a card. */
export function matchedStop(
  row: ExperienceCatalogRow,
  query: string,
): string | undefined {
  const term = normalize(query.trim());
  if (!term) return undefined;
  return row.stopNames.find((name) => normalize(name).includes(term));
}

export function difficultyLabel(id: ExperienceDifficulty): string {
  return id === "easy" ? "Easy" : id === "moderate" ? "Moderate" : "Hard";
}

/** Kilometres in miles, rounded — the page gives both for a walking audience. */
export function kmAsMiles(km: number): number {
  return Math.round(km * 0.621371);
}

/** "12 km (7 mi)" — distance with its mile equivalent. */
export function formatKmMiles(km: number): string {
  return `${formatKm(km)} (${kmAsMiles(km).toLocaleString("en-US")} mi)`;
}

export function durationLabel(hours: number, days: number): string {
  const dayText = days === 1 ? "1 day" : `${days} days`;
  if (!Number.isFinite(hours) || hours <= 0) return `≈ ${dayText}`;
  const rounded = Math.round(hours * 10) / 10;
  return `≈ ${rounded} h · ${dayText}`;
}

/** The distance is a straight-line sum; never present it as road or trail km. */
export function straightLineLabel(km: number): string {
  return `${formatKm(km)} straight line`;
}

export function experienceWhere(row: {
  region?: string;
  country?: string;
}): string {
  if (row.region && row.country && row.region !== row.country) {
    return `${row.region}, ${row.country}`;
  }
  return row.region || row.country || "";
}

export function nearbyExperiences(
  rows: ExperienceCatalogRow[],
  point: { lat: number; lon: number },
  excludeSlug: string,
  limit = 4,
): { row: ExperienceCatalogRow; km: number }[] {
  return rows
    .filter((row) => row.slug !== excludeSlug)
    .map((row) => ({ row, km: kmBetween(point.lat, point.lon, row.lat, row.lon) }))
    .sort((a, b) => a.km - b.km || a.row.title.localeCompare(b.row.title))
    .slice(0, limit);
}
