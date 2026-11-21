#!/usr/bin/env node
/**
 * Generate experiences from the committed geographic data.
 *
 * An experience is a collection of remarkable places in one region — peaks, a
 * park and its lakes, a valley with named trails — not a hand-written itinerary.
 * The generator reads the same atlas, detail and trail-link records the rest of
 * the app uses, groups places that belong together on the ground, classifies the
 * group from recorded facts, and writes committed shards under
 * `src/data/experience-index/` exactly like the place index.
 *
 * A place is only eligible when its detail record has a Wikipedia URL. That is
 * the verification rule: every stop on every page has a Terrane page and an
 * external reference. There is no walking model, no day plan and no
 * distance-between-stops claim, because the data does not record a route.
 *
 * There is no clock and no network here: the same commit produces the same
 * files. Practical POIs are deliberately absent — they are loaded per page from
 * the cell store, which keeps the POI mirror out of the build and the experience
 * text free of claims about facilities nobody recorded.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { destinationMeta, readDestinations } from "./lib/destinations.mjs";
import {
  buildCandidates,
  classifyCluster,
  collectionOrder,
  createIndex,
  describeCollection,
  expandCluster,
  experienceHue,
  isVerifiedCandidate,
  labelFor,
  round,
  slugify,
  spanKm,
} from "./lib/experiences.mjs";

const root = process.cwd();
const OUT = "src/data/experience-index";

const MIN_STOPS = 3;
const MAX_STOPS = 8;
const CORRIDOR_KM = 40;
const WIDE_CORRIDOR_KM = 70;
const MAX_SPAN_KM = 120;
/* The set is deliberately small: a collection earns its place by being
   verifiable, not by filling a grid. */
const GLOBAL_CAP = 220;
const COUNTRY_CAP = 6;
const CATEGORY_CAP = 80;
const GEORGIA_MIN = 3;
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

/* Verification has two halves. The record must carry a Wikipedia URL, and that
   URL must have been fetched and confirmed to land on a real article by
   `scripts/check-experience-sources.mjs`. The artifact is committed, so the
   normal build stays offline; a missing artifact is a build failure, never a
   silent fallback to format-only checks. */
const sourceChecks = read("src/data/experience-sources.json", null);
if (!sourceChecks?.urls || !sourceChecks.counts) {
  throw new Error(
    "src/data/experience-sources.json is missing; run `npm run sources:check` before building",
  );
}
const sourceStatus = (url) => sourceChecks.urls[url]?.status;
const isLiveSource = (url) => sourceStatus(url) === "verified";

const allCandidates = buildCandidates(destinations, details, trailLinks);
const candidates = allCandidates.filter(
  (candidate) => isVerifiedCandidate(candidate) && isLiveSource(candidate.wiki),
);
if (candidates.length === 0) {
  throw new Error("no candidate has a verified-live source; rerun the source check");
}

/** A photo ships only when its Commons file page was confirmed live. */
const shippedPhotos = (member) =>
  member.photos.filter(
    (photo) => typeof photo.page === "string" && isLiveSource(photo.page),
  );
const index = createIndex(candidates);

/** 16 stable buckets, so one prefix ("exploring…") cannot put the whole set in
    one file. Mirrors `bucketOf` in `src/lib/experiences.ts`. */
function bucketOf(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
}

const usedSlugs = new Set();
const usedTitles = new Set();
const usedDestinations = new Set();

function titledFor(anchor) {
  const base = `Exploring ${labelFor(anchor)}`;
  let title = base;
  if (usedTitles.has(title)) {
    const qualifier =
      [anchor.region, anchor.country].find((value) => value && !base.includes(value)) ??
      anchor.name;
    title = `${base}, ${qualifier}`.slice(0, 120);
    let n = 2;
    while (usedTitles.has(title)) {
      title = `${base}, ${qualifier} (${n})`;
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
  for (const member of collectionOrder(members)) {
    for (const photo of shippedPhotos(member)) {
      if (seen.has(photo.url)) continue;
      seen.add(photo.url);
      out.push(photo);
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function trailsFor(member) {
  return [...member.trailLinks]
    .filter((trail) => trail?.name)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((trail) => ({
      name: trail.name,
      km: trail.km,
      ...(trail.difficulty ? { difficulty: trail.difficulty } : {}),
      ...(trail.src ? { src: trail.src } : {}),
    }));
}

function buildRecord(members, category) {
  const stops = collectionOrder(members);
  const anchor = stops[0];
  const gallery = galleryFor(members);
  const title = titledFor(anchor);
  const slug = uniqueSlug(title);
  const label = labelFor(anchor);
  const country = majority(members.map((member) => member.country));
  const span = round(spanKm(members), 1);
  const trailCount = members.reduce(
    (sum, member) => sum + member.trailLinks.length,
    0,
  );
  const prose = describeCollection({
    members,
    label,
    country,
    span,
    trailCount,
    photoCount: members.filter((member) => shippedPhotos(member).length > 0).length,
  });

  const lats = members.map((member) => member.lat);
  const lons = members.map((member) => member.lon);
  const elevations = members
    .map((member) => member.elev)
    .filter((value) => Number.isFinite(value) && value > 0);

  const stopRecords = stops.map((stop) => ({
    slug: stop.slug,
    name: stop.name,
    cat: stop.cat,
    lat: stop.lat,
    lon: stop.lon,
    ...(Number.isFinite(stop.elev) && stop.elev > 0
      ? { elevation: Math.round(stop.elev) }
      : {}),
    ...(stop.country ? { country: stop.country } : {}),
    ...(stop.region ? { region: stop.region } : {}),
    ...(stop.desc ? { note: stop.desc } : {}),
    source: { label: "Wikipedia", url: stop.wiki },
    ...(shippedPhotos(stop)[0] ? { photo: shippedPhotos(stop)[0] } : {}),
    trails: trailsFor(stop),
  }));

  const record = {
    slug,
    title,
    category,
    summary: prose.summary,
    description: prose.description,
    country,
    region: majority(members.map((member) => member.region)),
    center: {
      lat: round((Math.min(...lats) + Math.max(...lats)) / 2, 4),
      lon: round((Math.min(...lons) + Math.max(...lons)) / 2, 4),
    },
    bounds: [
      round(Math.min(...lons), 3),
      round(Math.min(...lats), 3),
      round(Math.max(...lons), 3),
      round(Math.max(...lats), 3),
    ],
    hue: experienceHue(category, slug),
    spanKm: span,
    stops: stopRecords,
    photos: gallery,
    stats: {
      stops: stopRecords.length,
      peaks: members.filter(
        (member) => member.cat === "peak" || member.cat === "volcano",
      ).length,
      parks: members.filter(
        (member) => member.cat === "park" || member.cat === "reserve",
      ).length,
      trails: trailCount,
      photos: stopRecords.filter((stop) => stop.photo).length,
      sourced: stopRecords.filter((stop) => stop.source?.url).length,
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
    stopCount: stopRecords.length,
    spanKm: span,
    hue: record.hue,
    sourceCount: record.stats.sourced,
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
    stopNames: stopRecords.map((stop) => stop.name),
  };

  return { record, catalog };
}

function detailsMetaGenerated() {
  return detailSummary.generated ?? null;
}

const generatedDate =
  [detailsMetaGenerated(), trailSummary.generated, destinationMeta()]
    .filter(Boolean)
    .sort()
    .at(-1) ?? "unknown";

/* Phase one: build every possible collection. A destination is claimed here,
   once, and never joins a second collection, so pages stay distinct. */
const clusters = [];
let rejected = 0;

for (const seed of candidates) {
  if (clusters.length >= RAW_CAP) break;
  if (usedDestinations.has(seed.slug)) continue;

  let members = expandCluster(seed, index, usedDestinations, {
    maxStops: MAX_STOPS,
    corridorKm: CORRIDOR_KM,
    maxSpanKm: MAX_SPAN_KM,
    country: seed.country ?? null,
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
      country: seed.country ?? null,
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

/* Phase two: choose the set. One collection per country first (so the map is
   not an Alps map), then extra Georgia collections, then fill by score under a
   country cap. Every selected cluster is already verified stop by stop. */
const chosen = [];
const chosenSeeds = new Set();
const countryCounts = new Map();
const categoryCounts = new Map();

const countryOf = (cluster) => cluster.seed.country ?? "other";

function take(cluster) {
  if (chosenSeeds.has(cluster.seed.slug)) return false;
  chosenSeeds.add(cluster.seed.slug);
  chosen.push(cluster);
  const country = countryOf(cluster);
  countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  categoryCounts.set(
    cluster.category,
    (categoryCounts.get(cluster.category) ?? 0) + 1,
  );
  return true;
}

for (const cluster of clusters) {
  if ((countryCounts.get(countryOf(cluster)) ?? 0) === 0) take(cluster);
}

for (const cluster of clusters) {
  if (countryOf(cluster) === "Georgia" && (countryCounts.get("Georgia") ?? 0) < GEORGIA_MIN) {
    take(cluster);
  }
}

for (const cluster of clusters) {
  if (chosen.length >= GLOBAL_CAP) break;
  const country = countryOf(cluster);
  if ((countryCounts.get(country) ?? 0) >= COUNTRY_CAP) continue;
  if ((categoryCounts.get(cluster.category) ?? 0) >= CATEGORY_CAP) continue;
  take(cluster);
}

const records = [];
const catalog = [];
for (const cluster of chosen) {
  const built = buildRecord(cluster.members, cluster.category);
  records.push(built.record);
  catalog.push(built.catalog);
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

const byCategory = {};
for (const [id, count] of [...categoryCounts.entries()].sort()) {
  byCategory[id] = count;
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
      countries: new Set(records.map((record) => record.country).filter(Boolean)).size,
      georgia: records.filter((record) => record.country === "Georgia").length,
      stops: records.reduce((sum, record) => sum + record.stops.length, 0),
      sourcedStops: records.reduce((sum, record) => sum + record.stats.sourced, 0),
      photos: records.reduce((sum, record) => sum + record.stats.photos, 0),
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
        candidatesWithSourceUrl: allCandidates.filter(isVerifiedCandidate).length,
        verifiedCandidates: candidates.length,
        withDetails: Object.keys(details).length,
        withTrails: Object.keys(trailLinks).length,
        trailLinkedDestinations: trailSummary.linkedDestinations ?? 0,
      },
      sourceChecks: {
        generated: sourceChecks.generated,
        urls: sourceChecks.counts.urls,
        verified: sourceChecks.counts.verified,
        dead: sourceChecks.counts.dead,
        unreachable: sourceChecks.counts.unreachable,
      },
      rejectedSeeds: rejected,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `experiences: ${records.length.toLocaleString()} collections · ${shards.size} shards · ` +
    `${records.reduce((sum, record) => sum + record.stops.length, 0)} sourced places · ` +
    `Georgia ${records.filter((record) => record.country === "Georgia").length} · ` +
    Object.entries(byCategory)
      .map(([id, count]) => `${id} ${count}`)
      .join(" · "),
);
