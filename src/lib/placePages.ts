import { useEffect, useState } from "react";
import { bySlug, hueFor, type Place } from "../data/places";
import { destinationCategoryFor } from "../data/features";

/**
 * A page record for any destination.
 *
 * Atlas rows are already in the entry bundle, so those pages render immediately.
 * Reach pages load one small shard of `src/data/place-index/`; a page never
 * downloads all 24,474 records.
 */
export type PagePlace = {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  wd?: string;
  tier?: number;
  type?: Place["type"];
  cat: string;
  country?: string;
  region?: string;
  elevation?: number;
  prominence?: number;
  hue: number;
};

type PageRecord = Omit<PagePlace, "cat" | "hue"> & {
  cat?: string;
  hue?: number;
};

type Shard = { generated?: string; items: Record<string, PageRecord> };

const SHARDS = import.meta.glob("../data/place-index/*.json");

function shardOf(slug: string): string {
  const first = slug.slice(0, 1).toLowerCase();
  return /[a-z0-9]/.test(first) ? first : "_";
}

const cache = new Map<string, Promise<Shard | null>>();

function loadShard(slug: string): Promise<Shard | null> {
  const path = `../data/place-index/${shardOf(slug)}.json`;
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

function pageFromRecord(record: PageRecord): PagePlace {
  const cat = record.cat ?? destinationCategoryFor(record.type ?? "landmark", record.name);
  return {
    ...record,
    cat,
    hue: record.hue ?? hueFor(cat, record.slug),
  };
}

function pageFromAtlas(place: Place): PagePlace {
  const cat = destinationCategoryFor(place.type, place.name);
  return {
    slug: place.slug,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    wd: place.wd,
    tier: 0,
    type: place.type,
    cat,
    country: place.country,
    region: place.region,
    elevation: place.elevation,
    prominence: place.prominence,
    hue: place.hue,
  };
}

export function usePlacePage(slug: string): {
  place: PagePlace | null;
  loading: boolean;
} {
  const immediate = bySlug.get(slug);
  const [place, setPlace] = useState<PagePlace | null>(() =>
    immediate ? pageFromAtlas(immediate) : null,
  );
  const [loading, setLoading] = useState(!immediate);

  useEffect(() => {
    let alive = true;
    const atlas = bySlug.get(slug);
    if (atlas) {
      setPlace(pageFromAtlas(atlas));
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setPlace(null);
    setLoading(true);
    void loadShard(slug).then((shard) => {
      if (!alive) return;
      const record = shard?.items?.[slug];
      setPlace(record ? pageFromRecord(record) : null);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [slug]);

  return { place, loading };
}
