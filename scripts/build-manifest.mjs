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
const poi = read("src/data/poi-stats.json", {});
const trailStats = read("src/data/trail-stats.json", { segments: 0 });
const registry = read("src/data/sources.json", { sources: [] });
const wikidataMeta = read("src/data/wikidata-meta.json", {});
const details = read("src/data/place-details.json", { items: {} });
const detailRows = Object.values(details.items ?? {});
const wikidataUpdated =
  [wikidataMeta.atlas, wikidataMeta.reach, wikidataMeta.reachMore]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

const destinations = atlas.length + reach.items.length + reachMore.items.length;
const agencyRecords = (registry.sources ?? [])
  .filter((s) => s.family === "points" && s.id !== "osm")
  .reduce((sum, s) => sum + (read(`data/sources/${s.id}.json`, null)?.placed ?? 0), 0);
const osmRecords = (poi.places ?? 0) + (poi.parkingPlaces ?? 0);
const mapped = osmRecords + agencyRecords;
const countries = new Set(atlas.map((r) => r.country));

const byCategory = {};
const add = (id, count) => {
  byCategory[id] = (byCategory[id] || 0) + count;
};
for (const r of atlas) add(r.type, 1);
for (const r of reach.items) add(reach.kinds[r[2]], 1);
for (const r of reachMore.items) add(reachMore.kinds[r[2]], 1);
for (const [id, count] of Object.entries(poi.byKind ?? {})) add(id, count);
add("trail", trailStats.segments ?? 0);

const agencySources = [];
for (const entry of registry.sources ?? []) {
  if (entry.id === "osm") continue;
  const rec = read(`data/sources/${entry.id}.json`, null);
  if (!rec) continue;
  agencySources.push({
    id: entry.id,
    name: entry.name,
    licence: entry.licence,
    records: rec.placed ?? 0,
    updated: rec.updated ?? null,
    note: entry.note ?? "",
  });
}

const sources = [
  {
    id: "osm",
    name: "OpenStreetMap, via Geofabrik extracts",
    licence: "ODbL 1.0",
    records: osmRecords,
    updated: poi.day ?? null,
    note: `${poi.extracts ?? 0} extracts · ${poi.countries ?? 0} countries`,
  },
  {
    id: "wikidata",
    name: "Wikidata",
    licence: "CC0",
    records: atlas.length + reach.items.length + reachMore.items.length,
    updated: wikidataUpdated,
    note: `${atlas.length} atlas destinations · ${reach.items.length + reachMore.items.length} long-tail records`,
  },
  ...agencySources,
];

const manifest = {
  pipeline: categories.version,
  days: {
    osm: poi.day ?? null,
    wikidata: wikidataUpdated,
  },
  totals: { all: destinations + mapped, destinations, mapped, trails: trailStats.segments ?? 0 },
  categories: categories.categories.length,
  countries: { atlas: countries.size, mapped: poi.countries ?? 0 },
  byCategory,
  files: poi.files ?? 0,
  sources,
  coverage:
    "OpenStreetMap completeness follows mapping effort. Europe is mapped far more densely than most of Africa, South America and Central Asia; Wikidata is a selection, not a census.",
  trailStats,
  details: {
    pages: atlas.length,
    described: detailRows.filter((item) => item.desc).length,
    photographed: detailRows.filter((item) => item.img?.length).length,
    official: detailRows.filter((item) => item.site).length,
    ranges: detailRows.filter((item) => item.range).length,
    protected: detailRows.filter((item) => item.protected).length,
    updated: details.generated ?? null,
  },
  validation: { ok: null, checks: [] },
};

writeFileSync(join(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `manifest: ${manifest.totals.all.toLocaleString()} places · ${manifest.categories} categories · ${destinations.toLocaleString()} destinations · ${mapped.toLocaleString()} mapped`,
);
