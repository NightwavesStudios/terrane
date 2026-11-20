#!/usr/bin/env node
/**
 * Data validation, run before every build.
 *
 * The map is only as good as the files behind it, and a dataset that silently
 * loses a category looks exactly like a category nobody mapped. These checks turn
 * that into a build failure instead of a blank layer.
 *
 * The duplicate check uses a ~55 m grid hash, not O(n²): 24,000 destinations is
 * 300 million pairs otherwise.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readCurated } from "./lib/curated.mjs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

const categoriesFile = read("src/data/categories.json");
const categories = categoriesFile.categories;
const ids = new Set(categories.map((c) => c.id));
const families = new Set(categoriesFile.families.map((f) => f.id));
const atlas = read("src/data/atlas.json");
const reach = read("src/data/reach.json");
const reachMore = read("src/data/reach-more.json");
const curated = readCurated();
const stats = read("src/data/poi-stats.json");
const manifest = read("src/data/manifest.json");
const merges = read("src/data/atlas-merges.json");
const trailStats = read("src/data/trail-stats.json", { segments: 0 });
const trailLinks = read("src/data/trail-links.json", { radiusKm: 0, items: {} });

const coordOk = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

/* ── categories ── */
check("category ids are unique", ids.size === categories.length, `${ids.size}/${categories.length}`);
check(
  "every category has a known family",
  categories.every((c) => families.has(c.family)),
  categories.filter((c) => !families.has(c.family)).map((c) => c.id).join(",") || "ok",
);
check(
  "destination categories carry a colour",
  categories.filter((c) => c.family === "destination").every((c) => /^#[0-9a-f]{6}$/i.test(c.colour)),
  "ok",
);
check(
  "practical categories carry an icon and a zoom floor",
  categories
    .filter((c) => c.family === "practical")
    .every((c) => c.icon && Number.isFinite(c.minzoom)),
  "ok",
);

/* ── atlas ── */
check("atlas is a non-empty array", Array.isArray(atlas) && atlas.length > 0, `${atlas.length}`);
check(
  "atlas rows have the required fields",
  atlas.every(
    (r) =>
      typeof r.slug === "string" &&
      typeof r.name === "string" &&
      typeof r.country === "string" &&
      r.country.length > 0 &&
      ids.has(r.type) &&
      coordOk(r.lat, r.lon),
  ),
  "slug, name, country, known type, coordinates",
);
check("atlas slugs are unique", new Set(atlas.map((r) => r.slug)).size === atlas.length, `${atlas.length}`);

/* ── reach ── */
for (const [label, file] of [
  ["reach", reach],
  ["reach-more", reachMore],
]) {
  const itemsOk = file.items.every(
    (r) =>
      Array.isArray(r) &&
      r.length >= 5 &&
      Number.isInteger(r[2]) &&
      r[2] >= 0 &&
      r[2] < file.kinds.length &&
      Number.isInteger(r[3]) &&
      r[3] >= 1 &&
      r[3] <= 4 &&
      typeof r[4] === "string" &&
      r[4].length > 0 &&
      coordOk(r[0], r[1]),
  );
  check(`${label} rows are valid`, itemsOk, `${file.items.length} rows`);
  check(
    `${label} kinds are categories`,
    file.kinds.every((k) => ids.has(k)),
    file.kinds.filter((k) => !ids.has(k)).join(",") || "ok",
  );
  const tiers = new Set(file.items.map((r) => r[3]));
  const expected = label === "reach" ? [1, 2] : [3, 4];
  check(
    `${label} carries only its own tiers`,
    expected.every((t) => tiers.has(t)) && [...tiers].every((t) => expected.includes(t)),
    [...tiers].join(","),
  );
}

/* ── mapped POI stats ── */
const kindSum = Object.values(stats.byKind).reduce((a, b) => a + b, 0);
check("POI totals add up", stats.total === stats.places + stats.parkingPlaces, `${stats.total}`);
check("POI categories add up", kindSum === stats.total, `${kindSum}/${stats.total}`);
check(
  "POI kinds are categories",
  Object.keys(stats.byKind).every((k) => ids.has(k)),
  Object.keys(stats.byKind).filter((k) => !ids.has(k)).join(",") || "ok",
);

/* ── coverage: a category with nothing behind it is a broken layer ── */
const records = {};
for (const r of atlas) records[r.type] = (records[r.type] || 0) + 1;
for (const r of curated) records[r.cat] = (records[r.cat] || 0) + 1;
for (const r of reach.items) records[reach.kinds[r[2]]] = (records[reach.kinds[r[2]]] || 0) + 1;
for (const r of reachMore.items) records[reachMore.kinds[r[2]]] = (records[reachMore.kinds[r[2]]] || 0) + 1;
for (const [k, v] of Object.entries(stats.byKind)) records[k] = (records[k] || 0) + v;
records.trail = trailStats.segments ?? 0;
const empty = categories.filter((c) => !records[c.id]);
check("every category has records", empty.length === 0, empty.map((c) => c.id).join(",") || "all present");

/* ── duplicates across the destination sources, ~55 m ── */
const scale = 111_320 / 55;
const seen = new Set();
let dupes = 0;
for (const r of [
  ...atlas.map((x) => [x.type, x.lat, x.lon]),
  ...curated.map((x) => [x.cat, x.lat, x.lon]),
  ...reach.items.map((x) => [reach.kinds[x[2]], x[0], x[1]]),
  ...reachMore.items.map((x) => [reachMore.kinds[x[2]], x[0], x[1]]),
]) {
  const key = `${r[0]}|${Math.round(r[1] * scale)}|${Math.round(r[2] * scale)}`;
  if (seen.has(key)) dupes += 1;
  else seen.add(key);
}
const destinationRows = atlas.length + curated.length + reach.items.length + reachMore.items.length;
const dupeRate = dupes / Math.max(1, destinationRows);
check("cross-source duplicate rate under 1%", dupeRate < 0.01, `${dupes} pairs`);

/* ── hard rule: one place, one row ──
   The 55 m rate above tolerates a small number of collisions; this one does not.
   Every destination pair closer than 50 m in the same category must be a documented
   merge, or the build stops. */
const haversine = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const labelled = [
  ...atlas.map((x) => [x.type, x.lat, x.lon, x.slug]),
  ...curated.map((x) => [x.cat, x.lat, x.lon, x.slug]),
  ...reach.items.map((x) => [reach.kinds[x[2]], x[0], x[1], x[4]]),
  ...reachMore.items.map((x) => [reachMore.kinds[x[2]], x[0], x[1], x[4]]),
];
const CELL_DEG = 0.0005; // ~55 m of latitude; longitude is wider away from the equator
const grid = new Map();
const tooClose = [];
for (const row of labelled) {
  const gy = Math.floor(row[1] / CELL_DEG);
  const gx = Math.floor(row[2] / CELL_DEG);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (const other of grid.get(`${gy + dy}/${gx + dx}`) ?? []) {
        if (other[0] !== row[0]) continue;
        if (haversine(other[1], other[2], row[1], row[2]) < 50) {
          tooClose.push(`${other[3]} / ${row[3]}`);
        }
      }
    }
  }
  const key = `${gy}/${gx}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(row);
}
check(
  "no two destination rows within 50 m",
  tooClose.length === 0,
  tooClose.slice(0, 4).join(" · ") || "0 pairs",
);

/* ── the merge decisions are in the data, not just in a commit message ── */
const atlasWd = new Set(atlas.map((r) => r.wd));
const curatedSlugs = new Set(curated.map((r) => r.slug));
check(
  "editorial entries are frozen",
  curated.length <= 68,
  `${curated.length} rows (ceiling 68)`,
);
check(
  "every hand-written row has provenance",
  curated.every((r) => r.src === "editorial" && r.srcId === r.slug),
  "src + srcId",
);

const mergesApplied = merges.every(
  (m) =>
    (atlasWd.has(m.keep) || curatedSlugs.has(m.keep)) &&
    m.drop.every((d) => !atlasWd.has(d) && !curatedSlugs.has(d)) &&
    m.drop.every((d) => {
      const row = atlas.find((r) => r.wd === m.keep);
      return !row || (row.also ?? []).some((a) => a.id === d);
    }),
);
check("documented merges are applied", mergesApplied, `${merges.length} merges`);

/* ── manifest matches the files ── */
const destinations = destinationRows;
const registry = read("src/data/sources.json", { sources: [] });
const agencyRecords = (registry.sources ?? [])
  .filter((s) => s.family === "points" && s.id !== "osm")
  .reduce((sum, s) => {
    try {
      return sum + (read(`data/sources/${s.id}.json`, null)?.placed ?? 0);
    } catch {
      return sum;
    }
  }, 0);
const mapped = stats.places + stats.parkingPlaces + agencyRecords;
check("manifest totals match", manifest.totals.all === destinations + mapped, `${manifest.totals.all}`);
check("manifest destination count matches", manifest.totals.destinations === destinations, `${destinations}`);
check("manifest mapped count matches", manifest.totals.mapped === mapped, `${mapped}`);
check("manifest categories match", manifest.categories === categories.length, `${manifest.categories}`);
check("trail network has records", (trailStats.segments ?? 0) > 0, `${trailStats.segments ?? 0} segments`);

/* ── trail geometry ──
   The 288 MB of cells are gitignored, so a checkout cannot re-measure them.
   `scripts/trail-quality.mjs` writes this block from the cells the data job just
   built; the build gate checks the recorded result, not a stale count. */
const trailQuality = trailStats.quality;
check("trail quality block is recorded", Boolean(trailQuality), "reports/trail-quality.json");
if (trailQuality) {
  check(
    "no trail segment lies outside its tile",
    trailQuality.outOfTile === 0,
    `${trailQuality.outOfTile ?? "?"} outside`,
  );
  check(
    "trail chord rate is under 0.01%",
    trailQuality.chordRate <= 0.0001,
    `${trailQuality.chords ?? "?"} chords (${((trailQuality.chordRate ?? 0) * 100).toFixed(3)}%)`,
  );
  check(
    "trail duplicate rate is under 0.5%",
    trailQuality.duplicateRate < 0.005,
    `${trailQuality.duplicateCopies ?? "?"} copies (${((trailQuality.duplicateRate ?? 0) * 100).toFixed(2)}%)`,
  );
  check(
    "trail distances match their geometry",
    trailQuality.distanceMismatchRate < 0.05,
    `${trailQuality.distanceMismatch ?? "?"} mismatches`,
  );
  check(
    "trail cells stay under the wire limit",
    trailQuality.maxCellBytes <= 12_000_000,
    `${trailQuality.maxCellBytes ?? "?"} bytes`,
  );
  const qualitySegments = Object.values(trailQuality.bySource ?? {}).reduce(
    (sum, row) => sum + (row.segments ?? 0),
    0,
  );
  check(
    "trail quality source counts add up",
    qualitySegments === trailStats.segments,
    `${qualitySegments}/${trailStats.segments}`,
  );
}

const linkRows = Object.values(trailLinks.items ?? {}).flat();
check(
  "trail links use the 10 km radius",
  trailLinks.radiusKm === 10,
  `${trailLinks.radiusKm} km`,
);
check(
  "trail links stay within their radius and cap",
  linkRows.every((row) => row.km <= 10.01) &&
    Object.values(trailLinks.items ?? {}).every((rows) => rows.length <= 6),
  `${linkRows.length} links`,
);
check(
  "every trail link names a trail",
  linkRows.every((row) => typeof row.name === "string" && row.name.length > 0),
  `${linkRows.length} links`,
);

const licenceMissing = (registry.sources ?? []).filter(
  (s) => !s.licence || !s.licenceUrl || !s.attribution || !s.terms,
);
check(
  "every source carries licence and attribution metadata",
  licenceMissing.length === 0,
  licenceMissing.map((s) => s.id).join(",") || "all present",
);

const failed = checks.filter((c) => !c.ok);
const result = {
  ok: failed.length === 0,
  checks,
};
manifest.validation = result;
writeFileSync(join(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

for (const c of checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
