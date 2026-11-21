#!/usr/bin/env node
/**
 * Build the curated Experience catalogue.
 *
 * This is deliberately not the collection generator. A collection groups places;
 * an Experience is one destination selected for the editorial catalogue. The
 * selection lives in `src/data/guide-selection.json` and is the only source of
 * membership: adding a slug is an editorial decision, not a threshold in a
 * ranking script.
 *
 * The prose is grounded in the committed records — the Wikidata description,
 * protected area, range, elevation, credited Commons photographs, named trails
 * and neighbouring destinations — and never claims access, closures, facilities
 * or a route. No network and no clock: the same inputs produce the same files.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { destinationMeta, readDestinations } from "./lib/destinations.mjs";

const root = process.cwd();
const OUT = "src/data/guide-index";
const SELECTION = "src/data/guide-selection.json";
const ASSOCIATION_KM = 30;
const MAX_ASSOCIATED = 12;
const MAX_TRAILS = 5;
const MAX_PHOTOS = 6;

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
};

function readShards(dir, skip = []) {
  const out = {};
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith(".json") || skip.includes(name)) continue;
    const file = read(join(dir, name), null);
    if (file?.items) Object.assign(out, file.items);
  }
  return out;
}

const RAD = Math.PI / 180;
function kmBetween(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * RAD;
  const dLon = (bLon - aLon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function sentence(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const clean = text.endsWith(".") ? text : `${text}.`;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function short(value, limit = 240) {
  const text = String(value ?? "").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" ")))}…`;
}

const KIND_WORDS = [
  [/\bwaterfalls?\b|\bfalls\b|\bcascades?\b/i, "waterfall"],
  [/\blakes?\b|\blochs?\b|reservoir/i, "lake"],
  [/\bvolcan(?:o|oes)\b|\bglaciers?\b|\bmountains?\b|\bpeaks?\b|\bsummits?\b|\bmassifs?\b|\branges?\b/i, "peak"],
  [/\bislands?\b|\bbeaches?\b|\bcoasts?\b|\bbays?\b/i, "coast"],
  [/\bnational parks?\b|\bstate parks?\b|\bprovincial parks?\b|\bnature reserves?\b|\bprotected areas?\b|\breserves?\b/i, "park"],
  [/\bcanyons?\b|\bgorge?s?\b|\bvalleys?\b|\bdeserts?\b|\bcaves?\b|\bsprings?\b/i, "landmark"],
];

function kindOf(destination, detail) {
  /* The record's own type leads. A national park whose description mentions
     waterfalls is still a park, and Mount Hood is a peak even though the text
     around it mentions falls. Only landmark rows are classified by name/words. */
  if (destination.type === "park" || destination.cat === "park" || destination.cat === "reserve") {
    return "park";
  }
  const name = destination.name;
  if (/\bwaterfalls?\b|\bfalls\b|\bcascades?\b/i.test(name)) return "waterfall";
  if (/\blakes?\b|\blochs?\b|reservoir/i.test(name)) return "lake";
  if (/\bcanyons?\b|\bgorge?s?\b|\bvalleys?\b|\bdeserts?\b|\bcaves?\b/i.test(name)) {
    return "landmark";
  }
  if (/\bislands?\b|\bbeaches?\b|\bcoasts?\b|\bbays?\b/i.test(name)) return "coast";
  if (["peak", "volcano", "glacier", "range"].includes(destination.cat)) return "peak";
  if (destination.cat === "waterfall") return "waterfall";
  if (destination.cat === "lake") return "lake";
  if (["island", "beach"].includes(destination.cat)) return "coast";
  if (destination.type === "peak") return "peak";

  const text = `${name} ${detail.desc ?? ""}`;
  for (const [pattern, kind] of KIND_WORDS) if (pattern.test(text)) return kind;
  return "landmark";
}

/** IUCN prefixes are metadata, not prose. */
function protectedLabel(name) {
  return String(name ?? "")
    .replace(/^IUCN category [IVX]+:\s*/i, "")
    .trim();
}

const BASE_HUE = {
  park: 143,
  peak: 206,
  waterfall: 190,
  lake: 184,
  coast: 34,
  landmark: 220,
};

function guideHue(kind, slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return (BASE_HUE[kind] ?? 206) + (Math.abs(hash) % 30) - 15;
}

function bucketOf(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return "0123456789abcdef"[Math.abs(hash) % 16];
}

const selection = read(SELECTION, null);
if (!selection?.slugs?.length) {
  throw new Error(`${SELECTION} is missing or has no slugs; the curated catalogue needs an editorial selection`);
}

const destinations = readDestinations();
const bySlug = new Map(destinations.map((destination) => [destination.slug, destination]));
const details = readShards("src/data/place-details", ["place-details-summary.json"]);
const trailLinks = readShards("src/data/trail-links", ["trail-links-summary.json"]);
const detailSummary = read("src/data/place-details-summary.json", {});
const trailSummary = read("src/data/trail-links-summary.json", {});

const generated =
  [detailSummary.generated, trailSummary.generated, destinationMeta()]
    .filter(Boolean)
    .sort()
    .at(-1) ?? "unknown";

const seen = new Set();
const missing = [];
const records = [];
const catalog = [];

function protectedOf(detail) {
  return detail?.protected?.name ?? null;
}

function rangeOf(detail) {
  return detail?.range?.name ?? null;
}

function countryOf(destination, detail) {
  if (destination.country) return destination.country;
  const near = detail?.nearestPark?.slug ? bySlug.get(detail.nearestPark.slug) : null;
  return near?.country ?? null;
}

function regionOf(destination, detail) {
  return destination.region ?? detail?.range?.name ?? null;
}

function photosOf(detail) {
  const out = [];
  const used = new Set();
  for (const photo of detail?.img ?? []) {
    if (!photo?.url || !photo.credit || !photo.licence || !photo.page) continue;
    if (used.has(photo.page)) continue;
    used.add(photo.page);
    out.push({
      url: photo.url,
      ...(photo.w ? { w: photo.w } : {}),
      ...(photo.h ? { h: photo.h } : {}),
      ...(photo.max ? { max: photo.max } : {}),
      credit: photo.credit,
      licence: photo.licence,
      ...(photo.licenceUrl ? { licenceUrl: photo.licenceUrl } : {}),
      page: photo.page,
    });
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

function trailsOf(slug) {
  return [...(trailLinks[slug] ?? [])]
    .filter((trail) => trail?.name)
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name))
    .slice(0, MAX_TRAILS)
    .map((trail) => ({
      name: trail.name,
      km: round(trail.km ?? 0, 1),
      ...(trail.difficulty && !/^unknown$/i.test(trail.difficulty)
        ? { difficulty: trail.difficulty }
        : {}),
      ...(trail.src ? { src: trail.src } : {}),
    }));
}

function nearbyFor(destination) {
  const near = [];
  for (const candidate of destinations) {
    if (candidate.slug === destination.slug) continue;
    const km = kmBetween(destination.lat, destination.lon, candidate.lat, candidate.lon);
    if (km > ASSOCIATION_KM) continue;
    if (!details[candidate.slug]?.wiki) continue;
    near.push({
      slug: candidate.slug,
      name: candidate.name,
      cat: candidate.cat ?? candidate.type ?? "landmark",
      lat: candidate.lat,
      lon: candidate.lon,
      km: round(km, 1),
    });
  }
  return near
    .sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
    .slice(0, MAX_ASSOCIATED);
}

for (let index = 0; index < selection.slugs.length; index += 1) {
  const slug = selection.slugs[index];
  if (seen.has(slug)) {
    missing.push(`${slug} (duplicate in selection)`);
    continue;
  }
  seen.add(slug);

  const destination = bySlug.get(slug);
  const detail = details[slug];
  if (!destination) {
    missing.push(`${slug} (no destination record)`);
    continue;
  }
  if (!detail?.wiki || !/^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/\S+$/i.test(detail.wiki)) {
    missing.push(`${slug} (no Wikipedia source)`);
    continue;
  }

  const kind = kindOf(destination, detail);
  const photos = photosOf(detail);
  const trails = trailsOf(slug);
  const associated = nearbyFor(destination);
  const country = countryOf(destination, detail);
  const region = regionOf(destination, detail);
  const where = [region, country].filter(Boolean).join(", ");
  const protectedArea = protectedOf(detail);
  const range = rangeOf(detail);
  const elevation =
    Number.isFinite(detail.elev) && detail.elev > 0
      ? Math.round(detail.elev)
      : Number.isFinite(destination.elevation) && destination.elevation > 0
        ? Math.round(destination.elevation)
        : null;

  const description = detail.desc
    ? sentence(detail.desc)
    : `${destination.name} is a ${kind}${where ? ` in ${where}` : ""}.`;

  const overview = [description];
  const context = [
    protectedArea
      ? `The record places it inside a protected area (${protectedLabel(protectedArea).toLowerCase()}).`
      : "",
    range ? `It is recorded in the ${range}.` : "",
    elevation ? `Its recorded elevation is ${elevation.toLocaleString("en-US")} m.` : "",
  ].filter(Boolean);
  if (context.length) overview.push(context.join(" "));

  const relation = [];
  if (associated.length) {
    relation.push(
      `${associated.length} other catalogued destination${associated.length === 1 ? "" : "s"} lie within ${ASSOCIATION_KM} km, including ${associated
        .slice(0, 3)
        .map((place) => place.name)
        .join(", ")}.`,
    );
  }
  if (trails.length) {
    relation.push(
      `${trails.length} named trail${trails.length === 1 ? " is" : "s are"} recorded within 10 km, including ${trails
        .slice(0, 3)
        .map((trail) => trail.name)
        .join(", ")}.`,
    );
  }
  if (photos.length) {
    relation.push(
      `${photos.length} credited photograph${photos.length === 1 ? " is" : "s are"} available on Wikimedia Commons.`,
    );
  }
  if (relation.length) overview.push(relation.join(" "));

  const reasons = [description];
  if (protectedArea) reasons.push(`Protected area: ${protectedLabel(protectedArea)}.`);
  if (range) reasons.push(`Part of the ${range}.`);
  if (elevation) reasons.push(`A recorded high point of ${elevation.toLocaleString("en-US")} m.`);
  if (trails.length) {
    reasons.push(
      `${trails.length} named trail${trails.length === 1 ? "" : "s"} within 10 km: ${trails
        .map((trail) => trail.name)
        .join(", ")}.`,
    );
  }
  if (associated.length) {
    reasons.push(
      `${associated.length} other catalogued place${associated.length === 1 ? "" : "s"} within ${ASSOCIATION_KM} km.`,
    );
  }
  if (photos.length) {
    reasons.push(
      `${photos.length} credited Wikimedia Commons photograph${photos.length === 1 ? "" : "s"}.`,
    );
  }
  if (reasons.length < 3) {
    reasons.push("Selected for the curated catalogue of significant destinations.");
  }

  const contextLine =
    range && description.length < 120 && !description.includes(range)
      ? ` In the ${range}.`
      : "";
  const summary = short(`${description}${contextLine}`);

  const lats = [destination.lat, ...associated.map((place) => place.lat)];
  const lons = [destination.lon, ...associated.map((place) => place.lon)];
  const pad = 0.02;
  const bounds = [
    round(Math.min(...lons) - pad, 3),
    round(Math.min(...lats) - pad, 3),
    round(Math.max(...lons) + pad, 3),
    round(Math.max(...lats) + pad, 3),
  ];

  const photo = photos[0];
  const record = {
    slug,
    name: destination.name,
    kind,
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
    center: { lat: round(destination.lat, 4), lon: round(destination.lon, 4) },
    bounds,
    hue: guideHue(kind, slug),
    summary,
    overview,
    reasons,
    associated,
    trails,
    ...(photo ? { photo } : {}),
    photos,
    source: { label: "Wikipedia", url: detail.wiki },
    ...(detail.commons ? { commons: detail.commons } : {}),
    ...(detail.site && /^https?:\/\//i.test(detail.site) ? { official: detail.site } : {}),
    stats: {
      places: associated.length,
      trails: trails.length,
      photos: photos.length,
      ...(elevation ? { elevation } : {}),
    },
    rank: index + 1,
    sourceType: "curated",
    generated,
  };
  records.push(record);

  catalog.push({
    slug,
    name: destination.name,
    kind,
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
    lat: record.center.lat,
    lon: record.center.lon,
    hue: record.hue,
    summary,
    placeCount: associated.length,
    trailCount: trails.length,
    ...(photo
      ? {
          photo: {
            url: photo.url,
            credit: photo.credit,
            licence: photo.licence,
            ...(photo.max ? { max: photo.max } : {}),
          },
        }
      : {}),
    associatedNames: associated.slice(0, 6).map((place) => place.name),
  });
}

if (missing.length) {
  throw new Error(`the curated selection has unresolved entries:\n  ${missing.join("\n  ")}`);
}
if (!records.length) throw new Error("the curated catalogue is empty");

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
  writeFileSync(join(root, OUT, `${key}.json`), `${JSON.stringify({ generated, items })}\n`);
}

writeFileSync(
  join(root, OUT, "catalog.json"),
  `${JSON.stringify({ generated, count: catalog.length, items: catalog })}\n`,
);

const kinds = {};
for (const record of records) kinds[record.kind] = (kinds[record.kind] ?? 0) + 1;

writeFileSync(
  join(root, OUT, "meta.json"),
  `${JSON.stringify(
    {
      generated,
      total: records.length,
      selection: selection.slugs.length,
      kinds,
      countries: new Set(records.map((record) => record.country).filter(Boolean)).size,
      associated: records.reduce((sum, record) => sum + record.associated.length, 0),
      trails: records.reduce((sum, record) => sum + record.trails.length, 0),
      photos: records.reduce((sum, record) => sum + record.photos.length, 0),
      shards: shards.size,
      inputs: {
        destinations: destinations.length,
        withDetails: Object.keys(details).length,
        withTrails: Object.keys(trailLinks).length,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `experiences: ${records.length.toLocaleString()} curated destinations · ${shards.size} shards · ` +
    `${records.reduce((sum, record) => sum + record.associated.length, 0)} associated places · ` +
    Object.entries(kinds)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(" · "),
);
