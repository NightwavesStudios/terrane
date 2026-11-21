import { useEffect, useState } from "react";
import type {
  CollectionRecord,
  CollectionCatalogRow,
  CollectionScopeId,
} from "../data/collections";
import { kmBetween } from "./geo";
import { normalize } from "./text";

/**
 * Lazy access to the generated Collection index.
 *
 * The catalogue is one compact file (one row per wide group) and each Collection
 * is one hash-bucket shard, so the list can search and filter without loading
 * every member Experience record.
 */

type CatalogFile = {
  generated?: string;
  count?: number;
  items?: CollectionCatalogRow[];
};
type ShardFile = { generated?: string; items?: Record<string, CollectionRecord> };

const FILES = import.meta.glob("../data/collection-index/*.json");
const shardCache = new Map<string, Promise<ShardFile | null>>();
let catalogPromise: Promise<CatalogFile | null> | null = null;

/** Mirrors `bucketOf` in `scripts/build-collections.mjs`. */
function bucketOf(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
}

function loadJson<T>(file: string): Promise<T | null> {
  const loader = FILES[`../data/collection-index/${file}`];
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

export function useCollectionCatalog(): {
  rows: CollectionCatalogRow[];
  generated: string;
  status: CatalogStatus;
} {
  const [state, setState] = useState<{
    rows: CollectionCatalogRow[];
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

/** The catalogue without a component, for map-first consumers. */
export function loadCollectionCatalog(): Promise<CollectionCatalogRow[]> {
  return loadCatalog().then((file) =>
    Array.isArray(file?.items) ? file.items : [],
  );
}

export function loadCollection(slug: string): Promise<CollectionRecord | null> {
  return loadShard(slug).then((file) => file?.items?.[slug] ?? null);
}

export function useCollection(slug: string): {
  collection: CollectionRecord | null;
  loading: boolean;
} {
  const [collection, setCollection] = useState<CollectionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setCollection(null);
    setLoading(true);
    void loadShard(slug).then((file) => {
      if (!alive) return;
      setCollection(file?.items?.[slug] ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return { collection, loading };
}

/* ── pure helpers ────────────────────────────────────────────────────────── */

function scoreRow(row: CollectionCatalogRow, term: string): number {
  let score = 0;
  const title = normalize(row.title);
  if (title === term) score += 100;
  else if (title.startsWith(term)) score += 60;
  else if (title.includes(term)) score += 40;

  const where = normalize(`${row.where} ${row.countries.join(" ")}`);
  if (where.includes(term)) score += 25;
  if (row.experienceNames.some((name) => normalize(name).includes(term))) {
    score += 20;
  }
  return score;
}

/** How far from a chosen place a wide collection still counts as "near". */
export const NEAR_RADIUS_KM = 750;

export type CollectionNear = { lat: number; lon: number; label: string };

export type CollectionFilter = {
  query?: string;
  scope?: CollectionScopeId | null;
  near?: CollectionNear | null;
};

export function kilometresFrom(
  row: Pick<CollectionCatalogRow, "lat" | "lon">,
  near: CollectionNear,
): number {
  return kmBetween(near.lat, near.lon, row.lat, row.lon);
}

/**
 * Filter and order the catalogue. Scope narrows the pool; a query scores titles,
 * geography and member Experience names; a chosen place keeps collections within
 * `NEAR_RADIUS_KM` and orders them by distance.
 */
export function filterCollections(
  rows: CollectionCatalogRow[],
  options: CollectionFilter = {},
): CollectionCatalogRow[] {
  const term = normalize((options.query ?? "").trim());
  const scope = options.scope ?? null;
  const near = options.near ?? null;

  let pool = rows;
  if (scope) pool = pool.filter((row) => row.scope === scope);
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

/** The member Experience a query matched, for the "Includes X" line. */
export function matchedExperience(
  row: CollectionCatalogRow,
  query: string,
): string | undefined {
  const term = normalize(query.trim());
  if (!term) return undefined;
  return row.experienceNames.find((name) => normalize(name).includes(term));
}

/** The one wide Collection an Experience belongs to, from the catalogue. */
export function collectionForExperience(
  rows: CollectionCatalogRow[],
  experienceSlug: string,
): CollectionCatalogRow | undefined {
  return rows.find((row) => row.experienceSlugs.includes(experienceSlug));
}

export function nearbyCollections(
  rows: CollectionCatalogRow[],
  point: { lat: number; lon: number },
  excludeSlug: string,
  limit = 4,
): { row: CollectionCatalogRow; km: number }[] {
  return rows
    .filter((row) => row.slug !== excludeSlug)
    .map((row) => ({ row, km: kmBetween(point.lat, point.lon, row.lat, row.lon) }))
    .sort((a, b) => a.km - b.km || a.row.title.localeCompare(b.row.title))
    .slice(0, limit);
}
