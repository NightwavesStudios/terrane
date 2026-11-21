#!/usr/bin/env node
/**
 * Generate experiences from the committed geographic data.
 *
 * An experience is a small group of destinations that belong together on the
 * ground, not a hand-written itinerary. The generator reads the same atlas,
 * reach, detail and trail-link records the rest of the app uses, clusters them,
 * classifies the cluster with recorded facts, and writes committed shards under
 * `src/data/experience-index/` exactly like the place index.
 *
 * There is no clock and no network here: the same commit produces the same
 * files, so `npm run build` can regenerate them and `validate-data.mjs` can
 * treat them as ordinary input. Practical POIs are deliberately absent — they
 * are loaded per page from the cell store, which keeps the POI mirror out of the
 * build and the experience text free of claims about facilities nobody recorded.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { destinationMeta, readDestinations, shardOf } from "./lib/destinations.mjs";
import {
  CATEGORY_IDS,
  buildCandidates,
  classifyCluster,
  createIndex,
  describeExperience,
  distanceOf,
  durationBasis,
  durationFor,
  expandCluster,
  experienceHue,
  labelFor,
  orderStops,
  slugify,
  spanKm,
  titleFor,
} from "./lib/experiences.mjs";

const root = process.cwd();
const OUT = "src/data/experience-index";

const MIN_STOPS = 3;
const MAX_STOPS = 8;
const CORRIDOR_KM = 40;
const WIDE_CORRIDOR_KM = 70;
const MAX_SPAN_KM = 120;
const GLOBAL_CAP = 700;
const HEADLINE_CATEGORY_CAP = 140;
const FILL_CATEGORY_CAP = 200;
const COUNTRY_HEADLINE_CAP = 6;
const COUNTRY_CAP = 18;
const RAW_CAP = 8000;

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
};

/** Merge every generated shard's `items`, skipping the index's own files. */
function readShards(dir, skip = []) {
  const out = {};
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith(".json") || skip.includes(name)) continue;
    const file = read(join(dir, name), null);
    if (file?.items) Object.assign(out, file.items);
  }
  return out;
}

const details = readShards("src/data/place-details", ["place-details-summary.json"]);
const trailLinks = readShards("src/data/trail-links", ["trail-links-summary.json"]);
const detailSummary = read("src/data/place-details-summary.json", {});
const trailSummary = read("src/data/trail-links-summary.json", {});
const destinations = readDestinations();

const candidates = buildCandidates(destinations, details, trailLinks);
const index = createIndex(candidates);

const usedSlugs = new Set();
const usedTitles = new Set();
const usedDestinations = new Set();

function titledFor(category, members, anchor) {
  const base = titleFor(category, members, anchor);
  let title = base;
  if (usedTitles.has(title)) {
    const withAnchor = `${base} — ${anchor.name}`.slice(0, 120);
    title = withAnchor;
    let n = 2;
    while (usedTitles.has(title)) {
      title = `${withAnchor} (${n})`;
      n += 1;
    }
  }
  usedTitles.add(title);
  return title;
}

function uniqueSlug(title) {
  const base = slugify(title) || "experience";
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let n = 2;
  while (usedSlugs.has(`${base}-${n}`)) n += 1;
  const slug = `${base}-${n}`;
  usedSlugs.add(slug);
  return slug;
}

function majority(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value)[0];
}

function galleryFor(members) {
  const out = [];
  const seen = new Set();
  for (const member of [...members].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  )) {
    for (const photo of member.photos) {
      if (seen.has(photo.url)) continue;
      seen.add(photo.url);
      out.push(photo);
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function buildRecord(seed, members, category) {
  const stops = orderStops(members);
  const anchor = stops[0];
  const distanceKm = distanceOf(stops);
  const duration = durationFor(category, distanceKm, stops.length);
  const gallery = galleryFor(members);
  const title = titledFor(category, members, anchor);
  const slug = uniqueSlug(title);
  const label = labelFor(anchor);
  const prose = describeExperience({
    category,
    members,
    stops,
    distanceKm,
    duration,
    label,
  });

  const lats = members.map((member) => member.lat);
  const lons = members.map((member) => member.lon);
  const elevations = members
    .map((member) => member.elev)
    .filter((value) => Number.isFinite(value) && value > 0);
  const trailCount = members.reduce(
    (sum, member) => sum + member.trailLinks.length,
    0,
  );

  const record = {
    slug,
    title,
    category,
    summary: prose.summary,
    description: prose.description,
    country: majority(members.map((member) => member.country)),
    region: majority(members.map((member) => member.region)),
    center: {
      lat: Math.round(((Math.min(...lats) + Math.max(...lats)) / 2) * 1e4) / 1e4,
      lon: Math.round(((Math.min(...lons) + Math.max(...lons)) / 2) * 1e4) / 1e4,
    },
    bounds: [
      Math.round(Math.min(...lons) * 1e3) / 1e3,
      Math.round(Math.min(...lats) * 1e3) / 1e3,
      Math.round(Math.max(...lons) * 1e3) / 1e3,
      Math.round(Math.max(...lats) * 1e3) / 1e3,
    ],
    hue: experienceHue(category, slug),
    distanceKm,
    durationHours: duration.hours,
    durationBasis: durationBasis(category),
    days: duration.days,
    stops: stops.map((stop) => ({
      slug: stop.slug,
      name: stop.name,
      cat: stop.cat,
      lat: stop.lat,
      lon: stop.lon,
      index: stop.index,
      legKm: stop.legKm,
      ...(Number.isFinite(stop.elev) && stop.elev > 0
        ? { elevation: Math.round(stop.elev) }
        : {}),
      ...(stop.country ? { country: stop.country } : {}),
      ...(stop.region ? { region: stop.region } : {}),
      ...(stop.photos[0] ? { photo: stop.photos[0] } : {}),
      trails: [...stop.trailLinks]
        .filter((trail) => trail?.name)
        .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name))
        .slice(0, 3)
        .map((trail) => ({
          name: trail.name,
          km: trail.km,
          ...(trail.difficulty ? { difficulty: trail.difficulty } : {}),
          ...(trail.src ? { src: trail.src } : {}),
        })),
    })),
    photos: gallery,
    stats: {
      stops: stops.length,
      peaks: members.filter((member) => member.cat === "peak" || member.cat === "volcano")
        .length,
      parks: members.filter((member) => member.cat === "park" || member.cat === "reserve")
        .length,
      trails: trailCount,
      photos: gallery.length,
      ...(elevations.length
        ? {
            elevationMin: Math.round(Math.min(...elevations)),
            elevationMax: Math.round(Math.max(...elevations)),
          }
        : {}),
    },
    source: "generated",
    generated: generatedDate,
  };

  const catalog = {
    slug,
    title,
    category,
    country: record.country,
    region: record.region,
    lat: record.center.lat,
    lon: record.center.lon,
    stopCount: stops.length,
    distanceKm,
    durationHours: duration.hours,
    days: duration.days,
    hue: record.hue,
    ...(gallery[0]
      ? {
          photo: {
            url: gallery[0].url,
            credit: gallery[0].credit,
            licence: gallery[0].licence,
            ...(gallery[0].max ? { max: gallery[0].max } : {}),
          },
        }
      : {}),
    stopNames: stops.map((stop) => stop.name),
  };

  return { record, catalog };
}

const generatedDate =
  [detailsMetaGenerated(), trailSummary.generated, destinationMeta()]
    .filter(Boolean)
    .sort()
    .at(-1) ?? "unknown";

function detailsMetaGenerated() {
  return detailSummary.generated ?? null;
}

/* Phase one: build every possible cluster. The caps are applied afterwards, so
   a category cannot starve the others just because its seeds score higher. A
   destination is claimed here, once, and never joins a second route. */
const clusters = [];
let rejected = 0;

for (const seed of candidates) {
  if (clusters.length >= RAW_CAP) break;
  if (usedDestinations.has(seed.slug)) continue;

  let members = expandCluster(seed, index, usedDestinations, {
    maxStops: MAX_STOPS,
    corridorKm: CORRIDOR_KM,
    maxSpanKm: MAX_SPAN_KM,
  });

  let category = members.length >= MIN_STOPS ? classifyCluster(members) : null;
  if (
    members.length < MAX_STOPS &&
    (category === null ||
      category === "park" ||
      category === "weekend" ||
      category === "camping")
  ) {
    members = expandCluster(seed, index, usedDestinations, {
      initial: members,
      maxStops: MAX_STOPS,
      corridorKm: WIDE_CORRIDOR_KM,
      maxSpanKm: MAX_SPAN_KM,
    });
    category = members.length >= MIN_STOPS ? classifyCluster(members) : null;
  }

  if (!category || members.length < MIN_STOPS) {
    rejected += 1;
    continue;
  }
  if (spanKm(members) > MAX_SPAN_KM) {
    rejected += 1;
    continue;
  }

  for (const member of members) usedDestinations.add(member.slug);
  clusters.push({ seed, members, category });
}

clusters.sort(
  (a, b) =>
    b.seed.score - a.seed.score ||
    a.seed.name.localeCompare(b.seed.name) ||
    a.seed.slug.localeCompare(b.seed.slug),
);

/* Phase two: choose the routes. Pass one spreads the set by country and gives
   each category a fair share; pass two fills the remaining global slots. */
const countryCounts = new Map();
const categoryCounts = new Map();
const records = [];
const catalog = [];
const selected = new Set();

const clustersByCategory = new Map();
for (const cluster of clusters) {
  const list = clustersByCategory.get(cluster.category) ?? [];
  list.push(cluster);
  clustersByCategory.set(cluster.category, list);
}

for (const pass of [0, 1]) {
  const countryCap = pass === 0 ? COUNTRY_HEADLINE_CAP : COUNTRY_CAP;
  const categoryCap = pass === 0 ? HEADLINE_CATEGORY_CAP : FILL_CATEGORY_CAP;
  const cursors = new Map([...clustersByCategory.keys()].map((id) => [id, 0]));
  let progress = true;
  /* One route per category per round, so a category cannot be crowded out by
     another category's supply. Country caps still decide which routes appear. */
  while (progress && records.length < GLOBAL_CAP) {
    progress = false;
    for (const id of CATEGORY_IDS) {
      if (records.length >= GLOBAL_CAP) break;
      if ((categoryCounts.get(id) ?? 0) >= categoryCap) continue;
      const list = clustersByCategory.get(id);
      if (!list) continue;

      let cursor = cursors.get(id) ?? 0;
      let chosen = null;
      while (cursor < list.length) {
        const cluster = list[cursor];
        cursor += 1;
        if (selected.has(cluster.seed.slug)) continue;
        const country = majority(cluster.members.map((member) => member.country)) ?? "other";
        if ((countryCounts.get(country) ?? 0) >= countryCap) continue;
        chosen = { cluster, country };
        break;
      }
      cursors.set(id, cursor);
      if (!chosen) continue;

      const built = buildRecord(
        chosen.cluster.seed,
        chosen.cluster.members,
        chosen.cluster.category,
      );
      if (!built) continue;

      selected.add(chosen.cluster.seed.slug);
      countryCounts.set(chosen.country, (countryCounts.get(chosen.country) ?? 0) + 1);
      categoryCounts.set(id, (categoryCounts.get(id) ?? 0) + 1);
      records.push(built.record);
      catalog.push(built.catalog);
      progress = true;
    }
  }
}

const shards = new Map();
for (const record of records) {
  const key = shardOf(record.slug);
  const list = shards.get(key) ?? [];
  list.push(record);
  shards.set(key, list);
}

rmSync(join(root, OUT), { recursive: true, force: true });
mkdirSync(join(root, OUT), { recursive: true });

const byCategory = {};
for (const id of [...categoryCounts.keys()].sort()) {
  byCategory[id] = categoryCounts.get(id);
}

for (const [key, list] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  list.sort((a, b) => a.slug.localeCompare(b.slug));
  const items = Object.fromEntries(list.map((record) => [record.slug, record]));
  writeFileSync(
    join(root, OUT, `${key}.json`),
    `${JSON.stringify({ generated: generatedDate, items })}\n`,
  );
}

writeFileSync(
  join(root, OUT, "catalog.json"),
  `${JSON.stringify({ generated: generatedDate, count: catalog.length, items: catalog })}\n`,
);

writeFileSync(
  join(root, OUT, "meta.json"),
  `${JSON.stringify(
    {
      generated: generatedDate,
      total: records.length,
      byCategory,
      stops: records.reduce((sum, record) => sum + record.stops.length, 0),
      countries: new Set(records.map((record) => record.country).filter(Boolean)).size,
      shards: shards.size,
      clusters: {
        total: clusters.length,
        byCategory: clusters.reduce((out, cluster) => {
          out[cluster.category] = (out[cluster.category] ?? 0) + 1;
          return out;
        }, {}),
      },
      inputs: {
        destinations: destinations.length,
        withDetails: Object.keys(details).length,
        withTrails: Object.keys(trailLinks).length,
        trailLinkedDestinations: trailSummary.linkedDestinations ?? 0,
      },
      rejectedSeeds: rejected,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `experiences: ${records.length.toLocaleString()} routes · ${shards.size} shards · ` +
    Object.entries(byCategory)
      .map(([id, count]) => `${id} ${count}`)
      .join(" · "),
);
