#!/usr/bin/env node
/**
 * The data manifest.
 *
 * Every number the interface prints comes from here, so no count is typed into a
 * component and none can drift away from the files the map is actually serving.
 * Runs before `validate-data.mjs`, which records its result back into the file.
 *
 * Dates come from the data files themselves, never from the clock or a checkout's
 * mtimes: two builds of the same commit must produce the same manifest.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, p), "utf8"));
  } catch {
    return fallback;
  }
};

const categories = read("src/data/categories.json");
const atlas = read("src/data/atlas.json");
const reach = read("src/data/reach.json");
const reachMore = read("src/data/reach-more.json");
const wikidataMeta = read("src/data/wikidata-meta.json", {});
const pageMeta = read("src/data/place-index/meta.json", { pages: 0 });
const detailSummary = read("src/data/place-details-summary.json", {});
const wikidataUpdated =
  [wikidataMeta.atlas, wikidataMeta.reach, wikidataMeta.reachMore]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

const destinations = atlas.length + reach.items.length + reachMore.items.length;
const countries = new Set(atlas.map((r) => r.country));

const byCategory = {};
const add = (id, count) => {
  byCategory[id] = (byCategory[id] || 0) + count;
};
for (const r of atlas) add(r.type, 1);
for (const r of reach.items) add(reach.kinds[r[2]], 1);
for (const r of reachMore.items) add(reachMore.kinds[r[2]], 1);

const manifest = {
  pipeline: categories.version,
  days: { wikidata: wikidataUpdated },
  totals: { all: destinations, destinations },
  categories: categories.categories.length,
  countries: { atlas: countries.size },
  byCategory,
  details: {
    pages: pageMeta.pages ?? destinations,
    described: detailSummary.described ?? 0,
    photographed: detailSummary.photographed ?? 0,
    official: detailSummary.official ?? 0,
    ranges: detailSummary.ranges ?? 0,
    protected: detailSummary.protected ?? 0,
    updated: detailSummary.generated ?? null,
  },
  validation: { ok: null, checks: [] },
};

writeFileSync(join(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `manifest: ${manifest.totals.all.toLocaleString()} destinations · ${manifest.categories} categories`,
);
