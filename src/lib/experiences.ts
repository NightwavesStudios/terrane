import { useEffect, useState } from "react";
import type {
  Experience,
  ExperienceCatalogRow,
  ExperienceCategoryId,
} from "../data/experiences";
import { kmBetween } from "./geo";
import { normalize } from "./text";

/**
 * Lazy access to the generated experience index.
 *
 * The catalog is one compact file (one row per collection) and each collection
 * is one hash-bucket shard, so a page downloads exactly one shard. The list can
 * search and filter without loading the full stop, photo and trail records.
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

/** Mirrors `bucketOf` in `scripts/build-experiences.mjs`. */
function bucketOf(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
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
  const file = `${bucketOf(slug)}.json`;
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

/**
 * The catalogue without a component.
 *
 * The map draws every collection as one marker and needs the rows before any
 * page mounts, so the same cached fetch the list page uses is exposed here.
 */
export function loadExperienceCatalog(): Promise<ExperienceCatalogRow[]> {
  return loadCatalog().then((file) =>
    Array.isArray(file?.items) ? file.items : [],
  );
}

/** One collection, for drawing its places on the globe. */
export function loadExperience(slug: string): Promise<Experience | null> {
  return loadShard(slug).then((file) => file?.items?.[slug] ?? null);
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
 * A title match leads, the region/country answers "where", and a place name is
 * the discovery path from somewhere the reader already knows. Everything is
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

/** How far from a chosen place a collection still counts as "near". */
export const NEAR_RADIUS_KM = 150;

export type ExperienceNear = { lat: number; lon: number; label: string };

export type ExperienceFilter = {
  query?: string;
  category?: ExperienceCategoryId | null;
  near?: ExperienceNear | null;
};

/** Straight-line kilometres from a place to a collection's centre. */
export function kilometresFrom(
  row: Pick<ExperienceCatalogRow, "lat" | "lon">,
  near: ExperienceNear,
): number {
  return kmBetween(near.lat, near.lon, row.lat, row.lon);
}

/**
 * Filter and order the catalogue.
 *
 * Category narrows the pool; a query scores titles, regions and place names; a
 * chosen place keeps collections within `NEAR_RADIUS_KM` and orders them by
 * distance. A query inside a place still ranks matches first, with distance
 * breaking ties.
 */
export function filterExperiences(
  rows: ExperienceCatalogRow[],
  options: ExperienceFilter = {},
): ExperienceCatalogRow[] {
  const term = normalize((options.query ?? "").trim());
  const category = options.category ?? null;
  const near = options.near ?? null;

  let pool = rows;
  if (category) pool = pool.filter((row) => row.category === category);
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

/** The place a query matched, for the "includes X" line on a card. */
export function matchedStop(
  row: ExperienceCatalogRow,
  query: string,
): string | undefined {
  const term = normalize(query.trim());
  if (!term) return undefined;
  return row.stopNames.find((name) => normalize(name).includes(term));
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
