#!/usr/bin/env node
/**
 * Source coverage, not place counts.
 *
 * For every source in `src/data/sources.json` this answers: what did we fetch,
 * what did we place, what did we reject and why, how old is it, and did it pass
 * its published gate? A source that returns zero is a failure, not an empty layer.
 *
 * `npm run data:coverage` writes `reports/coverage.{md,json}` and `public/coverage.json`.
 * `--strict` exits non-zero; CI uses it, local runs can inspect first.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const read = (p, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, p), "utf8"));
  } catch {
    return fallback;
  }
};
const exists = (p) => existsSync(join(root, p));
const day = (p) => (exists(p) ? statSync(join(root, p)).mtime.toISOString().slice(0, 10) : null);

const registry = read("src/data/sources.json", { sources: [] });
const poiStats = read("src/data/poi-stats.json", {});
const merge = read("reports/merge.json", {});
const manifest = read("src/data/manifest.json", { days: {} });
const poiCoverage = read("reports/poi-coverage.json", null);
const trailStats = read("src/data/trail-stats.json", null);
// The last published report, read before this run overwrites it. The strict gate
// compares against it so a truncated run can never look like a complete one.
const previous = read("reports/coverage.json", null);

const ageDays = (date) =>
  date ? Math.floor((Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000) : null;

const rows = [];
for (const source of registry.sources ?? []) {
  const file = `data/sources/${source.id}.json`;
  const rec = read(file);
  if (!rec) {
    rows.push({
      id: source.id,
      name: source.name,
      family: source.family,
      licence: source.licence,
      coverage: source.coverage,
      cadence: source.cadence,
      expected: source.expected,
      status: "missing",
      fetched: 0,
      placed: 0,
      rejected: {},
      unaccounted: 0,
      ageDays: null,
      stale: true,
      gate: source.gate ?? null,
      gateOk: false,
      problems: [`no manifest at ${file}`],
    });
    continue;
  }

  const rejected = rec.rejected ?? {};
  const rejectedTotal = Object.values(rejected).reduce((a, b) => a + b, 0);
  const unaccounted = rec.fetched - rec.placed - rejectedTotal;
  const age = ageDays(rec.updated);
  const limit = source.family === "trails" ? 35 : 8;
  const gateField = source.gate?.field ?? "fetched";
  const gateValue =
    gateField === "raw" ? rec.raw : gateField === "total" ? rec.fetched : rec.fetched;
  const gateOk = rec.fetched > 0 && (source.gate?.min == null || gateValue >= source.gate.min);
  const rejectedSerious = Object.entries(rejected)
    .filter(([reason]) => !["no_coord", "not_relevant", "no_geometry"].includes(reason))
    .reduce((a, [, n]) => a + n, 0);
  const rejectRate = rec.fetched ? rejectedSerious / rec.fetched : 0;
  const problems = [];
  if (unaccounted !== 0) problems.push(`${unaccounted} unaccounted records`);
  if (!gateOk) {
    // A source that returned nothing fails its gate however large its raw feed was,
    // so say that instead of printing a comparison that is arithmetically true.
    problems.push(
      rec.fetched
        ? `gate ${gateField} ${gateValue ?? 0} < ${source.gate?.min}`
        : `fetched 0 (gate ${gateField} ≥ ${source.gate?.min ?? 0})`,
    );
  }
  if (rejectRate >= 0.02) problems.push(`${(rejectRate * 100).toFixed(1)}% rejected`);
  if (age == null || age > limit) problems.push(`stale ${age}d > ${limit}d`);

  rows.push({
    id: source.id,
    name: source.name,
    family: source.family,
    licence: source.licence,
    coverage: source.coverage,
    cadence: source.cadence,
    expected: source.expected,
    status: problems.length ? "attention" : "ok",
    updated: rec.updated,
    fetchedAt: rec.fetchedAt,
    raw: rec.raw,
    fetched: rec.fetched,
    placed: rec.placed,
    rejected,
    rejectedTotal,
    unaccounted,
    ageDays: age,
    stale: age == null || age > limit,
    gate: source.gate ?? null,
    gateOk,
    rejectRate,
    problems,
    bytes: rec.bytes ?? null,
  });
}

// OSM is written by the bulk harvest, not an adapter, so its manifest is the
// generated POI coverage / stats rather than data/sources/osm.json.
const osm = rows.find((r) => r.id === "osm");
if (osm) {
  const total = poiStats.total ?? poiStats.places ?? 0;
  const cars = poiStats.parkingPlaces ?? 0;
  const date = poiStats.day ?? null;
  const age = ageDays(date);
  const rejected = poiCoverage?.duplicates ?? {};
  osm.fetched = total;
  osm.placed = total;
  osm.raw = poiCoverage?.features?.extracted
    ? Object.values(poiCoverage.features.extracted).reduce((a, b) => a + b, 0)
    : total;
  osm.rejected = rejected;
  osm.rejectedTotal = Object.values(rejected).reduce((a, b) => a + b, 0);
  osm.unaccounted = 0;
  osm.updated = date;
  osm.ageDays = age;
  osm.stale = age == null || age > 8;
  osm.gateOk = total > 0 && total >= (osm.gate?.min ?? 0);
  osm.status = osm.gateOk && !osm.stale ? "ok" : "attention";
  osm.problems = [];
  if (!osm.gateOk) osm.problems.push(`total ${total} < ${osm.gate?.min}`);
  if (osm.stale) osm.problems.push(`stale ${age}d`);
  osm.files = poiStats.files ?? null;
  osm.extracts = poiStats.extracts ?? null;
  osm.countries = poiStats.countries ?? null;
  osm.parking = cars;
}

const placedTrails = rows.filter((r) => r.family === "trails").reduce((a, r) => a + r.placed, 0);
const diskTrails = trailStats?.segments ?? 0;
// A `--points-only` merge leaves `merge.trails` null while the trail cells are
// still on disk, so reporting zero there would be a lie. Carry the last full
// merge's count forward instead, and say in the report that it was carried.
const trailSegments = merge.trails?.segments ?? (diskTrails || placedTrails);
// merge-sources writes the carried value into merge.json with `carried_from`, so a
// points-only run is distinguishable from a real trail rebuild by that field as
// well as by a null trail block.
const trailsCarriedForward =
  (merge.trails?.segments == null || Boolean(merge.trails?.carried_from)) && trailSegments > 0;

const totals = {
  sources: rows.length,
  ok: rows.filter((r) => r.status === "ok").length,
  attention: rows.filter((r) => r.status !== "ok").length,
  points: rows.filter((r) => r.family === "points").reduce((a, r) => a + r.placed, 0),
  trails: trailSegments,
  rejected: rows.reduce((a, r) => a + (r.rejectedTotal ?? 0), 0),
  unaccounted: rows.reduce((a, r) => a + Math.max(0, r.unaccounted ?? 0), 0),
};

const pointsBySource = Object.fromEntries(
  rows.filter((r) => r.family === "points").map((r) => [r.id, r.placed]),
);
const trailsBySource = Object.fromEntries(
  rows.filter((r) => r.family === "trails").map((r) => [r.id, r.placed]),
);

const report = {
  generatedAt: new Date().toISOString(),
  strict,
  definition:
    "Coverage is measured against the union of open sources Terrane ingests, not against a non-existent global census. A missing source, a zero source, an unaccounted row or a stale source is a gap.",
  totals,
  merge: merge.points ?? null,
  trailMerge: merge.trails ?? null,
  trailSource: trailsCarriedForward ? "carried-forward" : merge.trails ? "merge" : "none",
  sources: rows,
  mapped: { pointsBySource, trailsBySource },
  gaps: {
    unknown: [
      "private and commercial campgrounds",
      "informal/dispersed sites nobody has mapped",
      "closures and seasonal status",
      "trails on private land",
      "countries with no open inventory",
      "RIDB records without coordinates",
      "OSM mapping-effort gaps",
      "camping/hut multipolygons counted but not placed",
    ],
    stale: rows.filter((r) => r.stale).map((r) => r.id),
    missing: rows.filter((r) => r.status === "missing").map((r) => r.id),
    attention: rows.filter((r) => r.status === "attention").map((r) => r.id),
  },
  manifest: { days: manifest.days ?? {} },
};

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports", "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(root, "public", "coverage.json"), `${JSON.stringify(report)}\n`);

const line = (cells) => `| ${cells.join(" | ")} |`;
const md = [
  "# Source coverage",
  "",
  `Generated ${report.generatedAt}. ${strict ? "Strict run." : "Inspect run."}`,
  "",
  report.definition,
  "",
  "| Source | Family | Fetched | Placed | Rejected | Unaccounted | Age | Status |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...rows.map((r) =>
    line([
      r.name,
      r.family,
      (r.fetched ?? 0).toLocaleString(),
      (r.placed ?? 0).toLocaleString(),
      (r.rejectedTotal ?? 0).toLocaleString(),
      (r.unaccounted ?? 0).toLocaleString(),
      r.ageDays == null ? "—" : `${r.ageDays}d`,
      r.status,
    ]),
  ),
  "",
  "## Gates",
  "",
  "| Source | Gate | Result | Problems |",
  "| --- | --- | --- | --- |",
  ...rows.map((r) =>
    line([
      r.id,
      r.gate ? `${r.gate.field} ≥ ${r.gate.min.toLocaleString()}` : "—",
      r.gateOk ? "pass" : "FAIL",
      r.problems.join("; ") || "—",
    ]),
  ),
  "",
  "## What is not in any source",
  "",
  ...report.gaps.unknown.map((g) => `- ${g}`),
  "",
  "## Merge",
  "",
  `- Points: ${(merge.points?.input ?? 0).toLocaleString()} in, ${(merge.points?.kept ?? 0).toLocaleString()} kept, ${(merge.points?.merged ?? 0).toLocaleString()} merged, ${(merge.points?.replaced_osm ?? 0).toLocaleString()} OSM rows replaced by agency rows.`,
  trailsCarriedForward
    ? `- Trails: ${trailSegments.toLocaleString()} segments and ${(trailStats?.cells ?? merge.trails?.cells ?? 0).toLocaleString()} cells carried forward unchanged from the last full merge — this run merged points only, so trails were not rebuilt (not zero).`
    : merge.trails
      ? `- Trails: ${(merge.trails.input ?? 0).toLocaleString()} lines, ${(merge.trails.segments ?? 0).toLocaleString()} segments, ${(merge.trails.cells ?? 0).toLocaleString()} cells.`
      : "- Trails: no trail cells on disk and no full merge recorded — unknown, not zero.",
  "",
].join("\n");
writeFileSync(join(root, "reports", "coverage.md"), md);

console.log(
  `coverage: ${totals.ok}/${totals.sources} sources ok · ${totals.points.toLocaleString()} points · ${totals.trails.toLocaleString()} trail segments · ${totals.unaccounted} unaccounted`,
);
for (const r of rows.filter((x) => x.status !== "ok")) {
  console.log(`  ${r.status.toUpperCase()} ${r.id}: ${r.problems.join("; ")}`);
}

// A strict run fails on anything that would make the published numbers wrong:
// an unaccounted row, a missing source, any source below its published gate or
// returning zero — OSM included, since it is 99% of the points — or a total that
// has collapsed to a fraction of the last known-good report. A truncated harvest
// must never publish green; a partial store must never replace a whole one.
const belowGate = rows.filter((r) => !r.gateOk).map((r) => r.id);
const zeroSources = rows.filter((r) => !r.fetched).map((r) => r.id);
const lastPoints = previous?.totals?.points ?? 0;
const lastTrails = previous?.totals?.trails ?? 0;
const regressions = [];
if (lastPoints && totals.points < lastPoints * 0.9) {
  regressions.push(
    `points ${totals.points.toLocaleString()} < 90% of last known-good ${lastPoints.toLocaleString()}`,
  );
}
if (lastTrails && totals.trails < lastTrails * 0.9) {
  regressions.push(
    `trails ${totals.trails.toLocaleString()} < 90% of last known-good ${lastTrails.toLocaleString()}`,
  );
}
const failures = [
  ...(totals.unaccounted > 0 ? [`${totals.unaccounted} unaccounted records`] : []),
  ...report.gaps.missing.map((id) => `${id}: missing source`),
  ...belowGate.map((id) => {
    const row = rows.find((r) => r.id === id);
    return `${id}: below its published gate (${(row?.problems ?? []).join("; ")})`;
  }),
  ...zeroSources.map((id) => `${id}: returned zero records`),
  ...regressions,
];
if (strict && failures.length) {
  for (const failure of failures) console.error(`  STRICT FAIL ${failure}`);
  process.exit(1);
}
