#!/usr/bin/env node
/**
 * Pull the last run's per-source accounting out of the data bucket.
 *
 * A scheduled job only runs one source family, but the manifest and the coverage
 * page describe all of them. The small JSON manifests travel through the same
 * bucket as the cells, so every job starts with the other sources' last known
 * counts instead of treating them as missing.
 *
 *   POI_BUCKET=https://... node scripts/fetch-source-state.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const bucket = (process.env.POI_BUCKET ?? "").replace(/\/+$/, "");
if (!bucket) process.exit(0);

const registry = JSON.parse(readFileSync(join(root, "src/data/sources.json"), "utf8"));
mkdirSync(join(root, "data/sources"), { recursive: true });
let pulled = 0;
for (const source of registry.sources ?? []) {
  if (source.id === "osm") continue;
  try {
    const res = await fetch(`${bucket}/sources/${source.id}.json`);
    if (!res.ok) continue;
    const body = await res.text();
    JSON.parse(body);
    writeFileSync(join(root, "data/sources", `${source.id}.json`), body);
    pulled += 1;
  } catch {
    // A source that has never run has no remote manifest; its adapter will write one.
  }
}
console.log(`source state: ${pulled} pulled from ${bucket}`);
