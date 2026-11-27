#!/usr/bin/env node
/**
 * Build the compact page index for every destination.
 *
 * The map's atlas and reach chunks stay exactly as they are. A place page loads
 * only the shard for its first slug character, so a reach page never downloads
 * all 24,473 records just to render one name.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationMeta,
  readDestinations,
  shardOf,
} from "./lib/destinations.mjs";

const OUT = "src/data/place-index";
const destinations = readDestinations();
const shards = new Map();

for (const row of destinations) {
  const key = shardOf(row.slug);
  const list = shards.get(key) ?? [];
  const record = {
    slug: row.slug,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    wd: row.wd,
    tier: row.tier,
    ...(row.type ? { type: row.type } : {}),
    ...(row.cat ? { cat: row.cat } : {}),
    ...(row.country ? { country: row.country } : {}),
    ...(row.region ? { region: row.region } : {}),
    ...(row.elevation != null ? { elevation: row.elevation } : {}),
    ...(row.prominence != null ? { prominence: row.prominence } : {}),
  };
  list.push(record);
  shards.set(key, list);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const generated = destinationMeta();
for (const [key, list] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const items = Object.fromEntries(list.map((row) => [row.slug, row]));
  writeFileSync(join(OUT, `${key}.json`), `${JSON.stringify({ generated, items })}\n`);
}

const slugs = destinations.map((row) => row.slug).sort();
writeFileSync(
  join(OUT, "slugs.json"),
  `${JSON.stringify({ count: slugs.length, slugs })}\n`,
);
writeFileSync(
  join(OUT, "meta.json"),
  `${JSON.stringify({
    generated,
    pages: destinations.length,
    shards: shards.size,
    atlas: destinations.filter((row) => row.tier === 0).length,
    reach: destinations.filter((row) => row.tier !== 0).length,
  }, null, 2)}\n`,
);

console.log(`place index: ${destinations.length.toLocaleString()} pages · ${shards.size} shards`);
