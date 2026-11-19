#!/usr/bin/env node
/**
 * The data manifest.
 *
 * Every number the interface prints comes from here, so no count is typed into a
 * component and none can drift away from the files the map is actually serving.
 * Runs before `validate-data.mjs`, which records its result back into the file.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readCurated } from "./lib/curated.mjs";

const root = process.cwd();
const read = (p, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, p), "utf8"));
  } catch {
    return fallback;
  }
};
const day = (p) => statSync(join(root, p)).mtime.toISOString().slice(0, 10);

const categories = read("src/data/categories.json");
const atlas = read("src/data/atlas.json");
const reach = read("src/data/reach.json");
const reachMore = read("src/data/reach-more.json");
const poi = read("src/data/poi-stats.json");
const curated = readCurated();
const trailStats = read("src/data/trail-stats.json", { segments: 0 });
const registry = read("src/data/sources.json", { sources: [] });

const destinations = atlas.length + curated.length + reach.items.length + reachMore.items.length;
const agencyRecords = (registry.sources ?? [])
  .filter((s) => s.family === "points" && s.id !== "osm")
  .reduce((sum, s) => sum + (read(`data/sources/${s.id}.json`, null)?.placed ?? 0), 0);
const osmRecords = poi.places + poi.parkingPlaces;
const mapped = osmRecords + agencyRecords;
const countries = new Set(atlas.map((r) => r.country));

const byCategory = {};
const add = (id, count) => {
  byCategory[id] = (byCategory[id] || 0) + count;
};
for (const r of atlas) add(r.type, 1);
for (const r of curated) add(r.cat, 1);
for (const r of reach.items) add(reach.kinds[r[2]], 1);
for (const r of reachMore.items) add(reachMore.kinds[r[2]], 1);
for (const [id, count] of Object.entries(poi.byKind)) add(id, count);
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
    updated: poi.day,
    note: `${poi.extracts} extracts · ${poi.countries} countries`,
  },
  {
    id: "wikidata",
    name: "Wikidata",
    licence: "CC0",
    records: atlas.length + reach.items.length + reachMore.items.length,
    updated: [day("src/data/atlas.json"), day("src/data/reach.json"), day("src/data/reach-more.json")]
      .sort()
      .at(-1),
    note: `${atlas.length} atlas destinations · ${reach.items.length + reachMore.items.length} long-tail records`,
  },
  {
    id: "editorial",
    name: "Hand-written field entries",
    licence: "—",
    records: curated.length,
    updated: day("src/data/places.ts"),
    note: `${curated.length} destinations with a page; facts only; frozen`,
  },
  ...agencySources,
];

const manifest = {
  pipeline: categories.version,
  generatedAt: new Date().toISOString(),
  days: {
    osm: poi.day,
    wikidata: sources.find((s) => s.id === "wikidata")?.updated ?? null,
  },
  totals: { all: destinations + mapped, destinations, mapped, trails: trailStats.segments ?? 0 },
  categories: categories.categories.length,
  countries: { atlas: countries.size, mapped: poi.countries },
  byCategory,
  files: poi.files,
  sources,
  coverage:
    "OpenStreetMap completeness follows mapping effort. Europe is mapped far more densely than most of Africa, South America and Central Asia; Wikidata is a selection, not a census.",
  trailStats,
  validation: { ok: null, checkedAt: null, checks: [] },
};

writeFileSync(join(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `manifest: ${manifest.totals.all.toLocaleString()} places · ${manifest.categories} categories · ${destinations.toLocaleString()} destinations · ${mapped.toLocaleString()} mapped`,
);
