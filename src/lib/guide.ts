import { useEffect, useState } from "react";
import type {
  GuideCatalogRow,
  GuideExperience,
  GuideKindId,
} from "../data/guide";
import { kmBetween } from "./geo";
import { normalize } from "./text";

/**
 * Lazy access to the curated Experience index.
 *
 * The catalogue is one compact file and each Experience is one hash-bucket
 * shard, so the list and the map can load every row without downloading every
 * page record. Only the Experience you open downloads its shard.
 */

type CatalogFile = {
  generated?: string;
  count?: number;
  items?: GuideCatalogRow[];
};
type ShardFile = { generated?: string; items?: Record<string, GuideExperience> };

const FILES = import.meta.glob("../data/guide-index/*.json");
const shardCache = new Map<string, Promise<ShardFile | null>>();
let catalogPromise: Promise<CatalogFile | null> | null = null;

/** Mirrors `bucketOf` in `scripts/build-guide.mjs`. */
function bucketOf(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
}

function loadJson<T>(file: string): Promise<T | null> {
  const loader = FILES[`../data/guide-index/${file}`];
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

export function useGuideCatalog(): {
  rows: GuideCatalogRow[];
  generated: string;
  status: CatalogStatus;
} {
  const [state, setState] = useState<{
    rows: GuideCatalogRow[];
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

/** The catalogue without a component, for the map's first paint. */
export function loadGuideCatalog(): Promise<GuideCatalogRow[]> {
  return loadCatalog().then((file) =>
    Array.isArray(file?.items) ? file.items : [],
  );
}

export function loadGuide(slug: string): Promise<GuideExperience | null> {
  return loadShard(slug).then((file) => file?.items?.[slug] ?? null);
}

export function useGuide(slug: string): {
  guide: GuideExperience | null;
  loading: boolean;
} {
  const [guide, setGuide] = useState<GuideExperience | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setGuide(null);
    setLoading(true);
    void loadShard(slug).then((file) => {
      if (!alive) return;
      setGuide(file?.items?.[slug] ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return { guide, loading };
}

/* ── pure helpers ────────────────────────────────────────────────────────── */

function scoreRow(row: GuideCatalogRow, term: string): number {
  let score = 0;
  const name = normalize(row.name);
  if (name === term) score += 100;
  else if (name.startsWith(term)) score += 60;
  else if (name.includes(term)) score += 40;

  const where = normalize(`${row.region ?? ""} ${row.country ?? ""}`);
  if (where.includes(term)) score += 25;
  if (normalize(row.summary).includes(term)) score += 14;
  if (row.associatedNames.some((place) => normalize(place).includes(term))) {
    score += 20;
  }
  return score;
}

export const GUIDE_NEAR_RADIUS_KM = 250;

export type GuideNear = { lat: number; lon: number; label: string };

export type GuideFilter = {
  query?: string;
  kind?: GuideKindId | null;
  near?: GuideNear | null;
};

export function kilometresFrom(
  row: Pick<GuideCatalogRow, "lat" | "lon">,
  near: GuideNear,
): number {
  return kmBetween(near.lat, near.lon, row.lat, row.lon);
}

export function filterGuides(
  rows: GuideCatalogRow[],
  options: GuideFilter = {},
): GuideCatalogRow[] {
  const term = normalize((options.query ?? "").trim());
  const kind = options.kind ?? null;
  const near = options.near ?? null;

  let pool = rows;
  if (kind) pool = pool.filter((row) => row.kind === kind);
  if (near) pool = pool.filter((row) => kilometresFrom(row, near) <= GUIDE_NEAR_RADIUS_KM);
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
        a.row.name.localeCompare(b.row.name) ||
        a.row.slug.localeCompare(b.row.slug),
    )
    .map((item) => item.row);
}

export function guideWhere(row: {
  region?: string;
  country?: string;
}): string {
  if (row.region && row.country && row.region !== row.country) {
    return `${row.region}, ${row.country}`;
  }
  return row.region || row.country || "";
}

export function nearbyGuides(
  rows: GuideCatalogRow[],
  point: { lat: number; lon: number },
  excludeSlug: string,
  limit = 4,
): { row: GuideCatalogRow; km: number }[] {
  return rows
    .filter((row) => row.slug !== excludeSlug)
    .map((row) => ({ row, km: kmBetween(point.lat, point.lon, row.lat, row.lon) }))
    .sort((a, b) => a.km - b.km || a.row.name.localeCompare(b.row.name))
    .slice(0, limit);
}
