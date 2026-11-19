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
 *
 * A 404 means "this source has not published yet" and is recorded as missing. A
 * bucket that cannot be reached, answers 5xx, or returns unparseable JSON is a
 * hard failure: a job that cannot read the other sources' state must not report
 * success and then publish counts it could not verify.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const bucket = (process.env.POI_BUCKET ?? "").replace(/\/+$/, "");
if (!bucket) {
  console.log("source state: POI_BUCKET is not set — nothing to pull (local run)");
  process.exit(0);
}

const registry = JSON.parse(readFileSync(join(root, "src/data/sources.json"), "utf8"));
mkdirSync(join(root, "data/sources"), { recursive: true });

let pulled = 0;
const missing = [];
const failures = [];
for (const source of registry.sources ?? []) {
  if (source.id === "osm") continue;
  const url = `${bucket}/sources/${source.id}.json`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    failures.push(`${source.id}: ${err?.cause?.code ?? err?.name ?? "network error"}: ${err?.message ?? err}`);
    continue;
  }
  if (res.status === 404) {
    // A source that has never run has no remote manifest; its adapter will write one.
    missing.push(source.id);
    continue;
  }
  if (!res.ok) {
    failures.push(`${source.id}: HTTP ${res.status} ${res.statusText}`);
    continue;
  }
  const body = await res.text();
  try {
    JSON.parse(body);
  } catch (err) {
    failures.push(`${source.id}: unparseable JSON (${err.message})`);
    continue;
  }
  writeFileSync(join(root, "data/sources", `${source.id}.json`), body);
  pulled += 1;
}

console.log(
  `source state: ${pulled} pulled from ${bucket}` +
    (missing.length ? ` · ${missing.length} not published yet (${missing.join(", ")})` : ""),
);

if (failures.length) {
  console.error(`source state: ${failures.length} source(s) could not be read from ${bucket}`);
  for (const failure of failures) console.error(`  FAILED ${failure}`);
  process.exit(1);
}
