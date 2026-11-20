import { useEffect, useState } from "react";

export type TrailLink = {
  name: string;
  km: number;
  src: string;
  difficulty: string;
};

type Shard = {
  generated?: string;
  items: Record<string, TrailLink[]>;
};

export const TRAIL_RADIUS_KM = 10;

const SHARDS = import.meta.glob("../data/trail-links/*.json");

function shardOf(slug: string): string {
  const first = slug.slice(0, 1).toLowerCase();
  return /[a-z0-9]/.test(first) ? first : "_";
}

const cache = new Map<string, Promise<Shard | null>>();

function loadShard(slug: string): Promise<Shard | null> {
  const path = `../data/trail-links/${shardOf(slug)}.json`;
  const loader = SHARDS[path];
  if (!loader) return Promise.resolve(null);
  let pending = cache.get(path);
  if (!pending) {
    pending = loader()
      .then((mod) => (mod as { default: Shard }).default)
      .catch(() => null);
    cache.set(path, pending);
  }
  return pending;
}

/** Trail links for one page, loaded from that page's slug shard. */
export function useTrailLinks(slug: string): TrailLink[] {
  const [links, setLinks] = useState<TrailLink[]>([]);

  useEffect(() => {
    let alive = true;
    setLinks([]);
    void loadShard(slug).then((shard) => {
      if (alive) setLinks(shard?.items?.[slug] ?? []);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return links;
}
