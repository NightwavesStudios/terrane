#!/usr/bin/env node
/**
 * Source coverage, not place counts.
 *
 * For every source in `src/data/sources.json` this answers: what did we fetch,
 * what did we place, what did we reject and why, how old is it, and did it pass
 * its published gate? A source that returns zero is a failure, not an empty layer.
 *
 * `npm run coverage` writes `reports/coverage.{md,json}` and `public/coverage.json`.
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
  if (!gateOk) problems.push(`gate ${gateField} ${gateValue ?? 0} < ${source.gate?.min}`);
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

const totals = {
  sources: rows.length,
  ok: rows.filter((r) => r.status === "ok").length,
  attention: rows.filter((r) => r.status !== "ok").length,
  points: rows.filter((r) => r.family === "points").reduce((a, r) => a + r.placed, 0),
  trails: merge.trails?.segments ?? rows.filter((r) => r.family === "trails").reduce((a, r) => a + r.placed, 0),
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
  `- Trails: ${(merge.trails?.input ?? 0).toLocaleString()} lines, ${(merge.trails?.segments ?? 0).toLocaleString()} segments, ${(merge.trails?.cells ?? 0).toLocaleString()} cells.`,
  "",
].join("\n");
writeFileSync(join(root, "reports", "coverage.md"), md);

console.log(
  `coverage: ${totals.ok}/${totals.sources} sources ok · ${totals.points.toLocaleString()} points · ${totals.trails.toLocaleString()} trail segments · ${totals.unaccounted} unaccounted`,
);
for (const r of rows.filter((x) => x.status !== "ok")) {
  console.log(`  ${r.status.toUpperCase()} ${r.id}: ${r.problems.join("; ")}`);
}

// A strict run fails on things that are never allowed: an unaccounted row, a
// missing source, or a source that silently returned zero. A published gate miss
// (for example a regional sample before the global route run) is reported as
// attention, not hidden and not treated as a successful run.
const silentZero = rows.some((r) => r.id !== "osm" && !r.fetched);
if (strict && (totals.unaccounted > 0 || report.gaps.missing.length > 0 || silentZero)) {
  process.exit(1);
}
