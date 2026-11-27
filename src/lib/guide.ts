import { useEffect, useState } from "react";
import { pickOf, type Pick as MapPick } from "../data/features";
import type { GuideCatalogRow, GuideExperience } from "../data/guide";
import { kmBetween } from "./geo";

/**
 * Lazy access to the curated Experience catalogue.
 *
 * The catalogue is one compact file and each Experience is one hash-bucket
 * shard, so the map can load every row without downloading every page record.
 * Only the Experience you open downloads its shard.
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

/**
 * A curated catalogue row as the one map pick shape, so a link can open the
 * Globe with this Experience already selected. The row has no detail record,
 * only the counts the catalogue carries, which is exactly what the card shows.
 */
export function guidePick(row: GuideCatalogRow): MapPick {
  return pickOf(
    {
      cat: "experience",
      n: row.name,
      slug: row.slug,
      kind: row.kind,
      hue: row.hue,
      region: row.region,
      country: row.country,
      places: row.placeCount,
    },
    row.lon,
    row.lat,
  );
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
