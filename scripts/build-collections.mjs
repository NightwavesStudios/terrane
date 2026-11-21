#!/usr/bin/env node
/**
 * Build wide Collections from the curated Experience catalogue.
 *
 * Source inputs:
 *   - `src/data/collection-groups.json` — the committed wide-scope grouping;
 *   - `src/data/guide-index/` — 183 generated curated Experiences;
 *   - `src/data/guide-selection.json` — the editorial order used on cards.
 *
 * Output:
 *   `src/data/collection-index/` — one compact catalogue, 16 hash-bucket shards
 *   and a meta file. Every field is composed from recorded facts; nothing is
 *   fetched at build time and nothing depends on the clock.
 *
 * A Collection is not a group of raw destinations and not an itinerary. It is a
 * browse layer over Experiences: country, great range, large area or recorded
 * long-distance trail. Each Experience has its own page and Wikipedia source.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  boundsOf,
  centerOf,
  collectionHue,
  describeCollection,
  kindCounts,
  orderExperiences,
  round,
  spanKm,
  validateGroups,
} from "./lib/collections.mjs";

const root = process.cwd();
const OUT = "src/data/collection-index";
const GROUPS = "src/data/collection-groups.json";
const GUIDE = "src/data/guide-index";

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
};

const guideCatalog = read(`${GUIDE}/catalog.json`, { items: [], generated: "unknown" });
const guideMeta = read(`${GUIDE}/meta.json`, { generated: "unknown" });
const selection = read("src/data/guide-selection.json", { slugs: [] });
const groupFile = read(GROUPS, null);
if (!groupFile?.groups?.length) {
  throw new Error(`${GROUPS} is missing or has no groups`);
}

const guideRows = Array.isArray(guideCatalog.items) ? guideCatalog.items : [];
if (guideRows.length === 0) {
  throw new Error("the guide catalogue is empty; run `npm run experiences` before `npm run collections`");
}

/** Merge every generated guide shard's `items`, skipping the catalogue/meta. */
const guideRecords = {};
for (const name of readdirSync(join(root, GUIDE))) {
  if (!name.endsWith(".json") || name === "catalog.json" || name === "meta.json") continue;
  const file = read(`${GUIDE}/${name}`, null);
  if (file?.items) Object.assign(guideRecords, file.items);
}

const catalogueBySlug = new Map(guideRows.map((row) => [row.slug, row]));
const recordBySlug = guideRecords;
const selectionOrder = new Map(selection.slugs.map((slug, index) => [slug, index]));

const groups = groupFile.groups;
const errors = validateGroups(
  groups,
  guideRows.map((row) => row.slug),
);
if (errors.length) {
  throw new Error(`the Collection grouping is invalid:\n  ${errors.join("\n  ")}`);
}

for (const group of groups) {
  for (const experienceSlug of group.slugs) {
    const row = catalogueBySlug.get(experienceSlug);
    const record = recordBySlug[experienceSlug];
    if (!row || !record) {
      throw new Error(`${group.slug}: ${experienceSlug} has no catalogue row or shard record`);
    }
    if (!record.source?.url || !record.stats) {
      throw new Error(`${group.slug}: ${experienceSlug} is missing its source or stats`);
    }
  }
  for (const trail of group.basisTrails ?? []) {
    const present = group.slugs.some((experienceSlug) =>
      (recordBySlug[experienceSlug]?.trails ?? []).some((entry) => entry.name === trail),
    );
    if (!present) {
      throw new Error(`${group.slug}: basis trail "${trail}" is not recorded at any member Experience`);
    }
  }
}

/** 16 stable buckets, mirroring `bucketOf` in `src/lib/collections.ts`. */
function bucketOf(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
}

const generated = guideMeta.generated ?? guideCatalog.generated ?? "unknown";
const records = [];
const catalog = [];

for (const group of groups) {
  const rows = orderExperiences(
    group.slugs.map((slug) => catalogueBySlug.get(slug)),
    selectionOrder,
  );
  const full = rows.map((row) => recordBySlug[row.slug]);
  const bounds = boundsOf(rows);
  const center = centerOf(rows);
  const span = round(spanKm(rows), 1);
  const counts = kindCounts(rows);
  const photos = [];
  const seenPhotos = new Set();
  for (const record of full) {
    for (const photo of record.photos ?? []) {
      if (!photo?.url || seenPhotos.has(photo.url)) continue;
      seenPhotos.add(photo.url);
      photos.push(photo);
      if (photos.length >= 6) break;
    }
    if (photos.length >= 6) break;
  }
  const prose = describeCollection({
    experiences: rows,
    where: group.where,
    scope: group.scope,
    basisTrails: group.basisTrails ?? [],
  });
  const record = {
    slug: group.slug,
    title: group.title,
    scope: group.scope,
    where: group.where,
    countries: group.countries,
    summary: prose.summary,
    description: prose.description,
    center,
    bounds,
    hue: collectionHue(group.scope, group.slug),
    spanKm: span,
    experiences: rows,
    photos,
    ...(group.basisTrails ? { basisTrails: group.basisTrails } : {}),
    stats: {
      experiences: rows.length,
      places: rows.reduce((sum, row) => sum + (row.placeCount ?? 0), 0),
      trails: rows.reduce((sum, row) => sum + (row.trailCount ?? 0), 0),
      photos: full.filter((item) => (item.photos ?? []).length > 0).length,
      countries: group.countries.length,
      sourced: rows.length,
    },
    source: "generated",
    generated,
  };
  records.push(record);

  catalog.push({
    slug: record.slug,
    title: record.title,
    scope: record.scope,
    where: record.where,
    countries: record.countries,
    lat: center.lat,
    lon: center.lon,
    experienceCount: rows.length,
    countryCount: group.countries.length,
    placeCount: record.stats.places,
    trailCount: record.stats.trails,
    kinds: counts,
    hue: record.hue,
    ...(photos[0]
      ? {
          photo: {
            url: photos[0].url,
            credit: photos[0].credit,
            licence: photos[0].licence,
            ...(photos[0].max ? { max: photos[0].max } : {}),
          },
        }
      : {}),
    experienceNames: rows.map((row) => row.name),
    experienceSlugs: rows.map((row) => row.slug),
  });
}

const shards = new Map();
for (const record of records) {
  const key = bucketOf(record.slug);
  const list = shards.get(key) ?? [];
  list.push(record);
  shards.set(key, list);
}

rmSync(join(root, OUT), { recursive: true, force: true });
mkdirSync(join(root, OUT), { recursive: true });

for (const [key, list] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  list.sort((a, b) => a.slug.localeCompare(b.slug));
  const items = Object.fromEntries(list.map((record) => [record.slug, record]));
  writeFileSync(
    join(root, OUT, `${key}.json`),
    `${JSON.stringify({ generated, items })}\n`,
  );
}

writeFileSync(
  join(root, OUT, "catalog.json"),
  `${JSON.stringify({ generated, count: catalog.length, items: catalog })}\n`,
);

const byScope = {};
for (const record of records) byScope[record.scope] = (byScope[record.scope] ?? 0) + 1;

writeFileSync(
  join(root, OUT, "meta.json"),
  `${JSON.stringify(
    {
      generated,
      total: records.length,
      byScope,
      experiences: records.reduce((sum, record) => sum + record.experiences.length, 0),
      places: records.reduce((sum, record) => sum + record.stats.places, 0),
      trails: records.reduce((sum, record) => sum + record.stats.trails, 0),
      countries: new Set(records.flatMap((record) => record.countries)).size,
      shards: shards.size,
      inputs: {
        guideExperiences: guideRows.length,
        groups: groups.length,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `collections: ${records.length} wide groups · ${records.reduce((sum, record) => sum + record.experiences.length, 0)} Experiences · ` +
    `avg ${round(records.reduce((sum, record) => sum + record.experiences.length, 0) / records.length, 1)} each · ` +
    Object.entries(byScope)
      .map(([id, count]) => `${id} ${count}`)
      .join(" · "),
);
console.log(
  `largest: ${[...records]
    .sort((a, b) => b.experiences.length - a.experiences.length || a.title.localeCompare(b.title))
    .slice(0, 3)
    .map((record) => `${record.title} ${record.experiences.length}`)
    .join(" · ")}`,
);
