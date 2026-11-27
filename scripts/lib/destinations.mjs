import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
}

/** First path-safe character of a slug, used for every generated page shard. */
export function shardOf(slug) {
  const first = String(slug ?? "").slice(0, 1).toLowerCase();
  return /[a-z0-9]/.test(first) ? first : "_";
}

/**
 * One destination model for the page pipeline.
 *
 * Atlas rows keep their type (peak/park/landmark) because the page applies the
 * existing name heuristic to it. Reach rows already carry the source kind, so
 * they use `cat`. Every row has a stable slug and a Wikidata Q id.
 */
export function readDestinations() {
  const atlas = readJson("src/data/atlas.json", []);
  const reach = readJson("src/data/reach.json", { kinds: [], near: [], items: [] });
  const more = readJson("src/data/reach-more.json", { kinds: [], near: [], items: [] });
  const atlasBySlug = new Map(atlas.map((row) => [row.slug, row]));
  const rows = [];

  for (const row of atlas) {
    rows.push({
      slug: row.slug,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      wd: row.wd,
      tier: 0,
      type: row.type,
      country: row.country,
      region: row.region,
      elevation: row.elevation ?? undefined,
      prominence: row.prominence ?? undefined,
    });
  }

  for (const file of [reach, more]) {
    for (const row of file.items ?? []) {
      const [lat, lon, kind, tier, name, near, wd, slug] = row;
      const nearSlug = typeof near === "number" ? file.near?.[near] : undefined;
      const nearPlace = nearSlug ? atlasBySlug.get(nearSlug) : undefined;
      rows.push({
        slug,
        name: String(name ?? ""),
        lat,
        lon,
        wd,
        tier,
        cat: file.kinds?.[kind],
        country: nearPlace?.country,
        region: nearPlace?.region,
      });
    }
  }

  const seen = new Set();
  for (const row of rows) {
    if (!row.slug || !row.name || !Number.isFinite(row.lat) || !Number.isFinite(row.lon)) {
      throw new Error(`destination is missing a page key: ${row.name ?? "unnamed"}`);
    }
    if (seen.has(row.slug)) throw new Error(`duplicate destination slug: ${row.slug}`);
    seen.add(row.slug);
  }
  return rows;
}

export function destinationMeta() {
  const meta = readJson("src/data/wikidata-meta.json", {});
  return (
    [meta.atlas, meta.reach, meta.reachMore]
      .filter(Boolean)
      .sort()
      .at(-1) ?? "unknown"
  );
}
