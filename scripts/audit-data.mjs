#!/usr/bin/env node
/**
 * Data audit.
 *
 * Measures what the map is actually made of before any of it is changed: how many
 * records each source holds, how they are distributed by country and by z6 cell,
 * where the same thing appears twice, and how old each file is.
 *
 * It is deliberately read-only. `reports/data-audit.md` is the human table and
 * `reports/data-audit.json` is the same numbers for scripts and gates.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readCurated } from "./lib/curated.mjs";

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const exists = (p) => existsSync(join(root, p));
const mtime = (p) => (exists(p) ? statSync(join(root, p)).mtime.toISOString().slice(0, 10) : "missing");

const categories = read("src/data/categories.json").categories;
const catById = new Map(categories.map((c) => [c.id, c]));
const atlas = read("src/data/atlas.json");
const reach = read("src/data/reach.json");
const reachMore = read("src/data/reach-more.json");
const curated = readCurated();
const stats = read("src/data/poi-stats.json");

/* ── one flat list of destinations, so cross-source duplicates are visible ── */
const destinations = [
  ...atlas.map((r) => ({
    src: "atlas",
    cat: r.type,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    country: r.country,
  })),
  ...curated.map((r) => ({
    src: "editorial",
    cat: r.cat,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    country: r.country,
  })),
  ...reach.items.map((r) => ({
    src: "wikidata",
    cat: reach.kinds[r[2]],
    name: r[4],
    lat: r[0],
    lon: r[1],
    country: null,
  })),
  ...reachMore.items.map((r) => ({
    src: "wikidata",
    cat: reachMore.kinds[r[2]],
    name: r[4],
    lat: r[0],
    lon: r[1],
    country: null,
  })),
];

const counts = (rows) => {
  const out = {};
  for (const r of rows) out[r.cat] = (out[r.cat] || 0) + 1;
  return out;
};

/* ── distribution by country (atlas only: it is the source with a country) ── */
const byCountry = {};
for (const r of atlas) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
const countryCounts = Object.values(byCountry).sort((a, b) => a - b);
const median = countryCounts[Math.floor(countryCounts.length / 2)] ?? 0;

/* ── z6 cell density, the unit the map and the caps use ── */
const CELL = 6;
const n = 2 ** CELL;
const cellOf = (lat, lon) => {
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return `${CELL}/${x}/${y}`;
};
const cells = new Map();
for (const r of destinations) {
  const k = cellOf(r.lat, r.lon);
  cells.set(k, (cells.get(k) || 0) + 1);
}
const cellCounts = [...cells.values()].sort((a, b) => a - b);
const cellMedian = cellCounts[Math.floor(cellCounts.length / 2)] ?? 0;
const cellTop = [...cells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

/* ── duplicate pairs inside the destination set (grid hash, no O(n²)) ── */
function duplicates(metres) {
  const scale = 111_320 / metres;
  const seen = new Map();
  let dupes = 0;
  const examples = [];
  for (const r of destinations) {
    const key = `${r.cat}|${Math.round(r.lat * scale)}|${Math.round(r.lon * scale)}`;
    const hit = seen.get(key);
    if (hit) {
      dupes += 1;
      if (examples.length < 5) examples.push(`${hit.name} / ${r.name} (${r.src})`);
    } else seen.set(key, r);
  }
  return { dupes, examples };
}
const dup50 = duplicates(50);
const dup110 = duplicates(110);

/* ── the Georgia box, the case that looked wrong ── */
const inGeorgia = (lat, lon) => lat > 30 && lat < 36 && lon > -86 && lon < -80;
const georgia = {
  atlas: destinations.filter((r) => r.src === "atlas" && inGeorgia(r.lat, r.lon)).length,
  curated: destinations.filter((r) => r.src === "editorial" && inGeorgia(r.lat, r.lon)).length,
  wikidata: destinations.filter((r) => r.src === "wikidata" && inGeorgia(r.lat, r.lon)).length,
};
const atlantaCell = cellOf(33.75, -84.39);
const georgiaCell = cells.get(atlantaCell) ?? 0;

const totalMapped = stats.places + stats.parkingPlaces;
const sources = [
  {
    name: "OpenStreetMap world POIs",
    records: totalMapped,
    files: stats.files,
    updated: stats.day,
    note: `${stats.extracts} extracts, ${stats.countries} countries`,
  },
  {
    name: "Wikidata destinations",
    records: atlas.length + reach.items.length + reachMore.items.length,
    files: 3,
    updated: [mtime("src/data/atlas.json"), mtime("src/data/reach.json"), mtime("src/data/reach-more.json")]
      .sort()
      .at(-1),
    note: `${atlas.length} atlas + ${curated.length} hand-written + ${reach.items.length + reachMore.items.length} reach`,
  },
  {
    name: "Hand-written field entries",
    records: curated.length,
    files: 1,
    updated: mtime("src/data/places.ts"),
    note: "one row with a page each; frozen, not growing",
  },
  ...(() => {
    const dir = join(root, "data", "sources");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => JSON.parse(readFileSync(join(dir, n), "utf8")))
      .filter((m) => m.placed > 0)
      .map((m) => ({
        name: m.name,
        records: m.placed,
        files: 1,
        updated: m.updated,
        note: `${m.family} · ${m.licence}`,
      }));
  })(),
].filter((s) => s.records > 0);

const missing = categories.filter((c) => !counts(destinations)[c.id] && !stats.byKind[c.id]);

const report = {
  generatedAt: new Date().toISOString(),
  sources,
  totals: {
    destinations: destinations.length,
    mapped: totalMapped,
    all: destinations.length + totalMapped,
    categories: categories.length,
    categoryRecords: counts(destinations),
    mappedByKind: stats.byKind,
  },
  countries: {
    atlas: Object.keys(byCountry).length,
    mapped: stats.countries,
    medianRowsPerCountry: median,
    withOneRow: countryCounts.filter((v) => v === 1).length,
    withTwoOrFewer: countryCounts.filter((v) => v <= 2).length,
    maxRows: countryCounts.at(-1) ?? 0,
  },
  density: {
    cellZoom: CELL,
    cells: cells.size,
    medianPerCell: cellMedian,
    maxPerCell: cellCounts.at(-1) ?? 0,
    topCells: cellTop,
    georgiaBox: georgia,
    georgiaCell,
  },
  duplicates: {
    within50m: dup50.dupes,
    within110m: dup110.dupes,
    examples: dup50.examples,
  },
  coverage: {
    categoriesWithoutRecords: missing.map((c) => c.id),
    note: "OSM completeness follows mapping effort, not ground truth; Europe is densest.",
  },
  freshness: {
    poiCoverageReport: exists("reports/poi-coverage.md") ? "present" : "missing",
    scheduledUpdate: "GitHub Actions: daily RIDB, weekly OSM points, monthly trails; see .github/workflows",
  },
};

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports/data-audit.json"), `${JSON.stringify(report, null, 2)}\n`);

const row = (cells) => `| ${cells.join(" | ")} |`;
const md = [
  "# Data audit",
  "",
  `Generated ${report.generatedAt}. Read-only: \`npm run audit\`.`,
  "",
  "## Sources",
  "",
  "| Source | Records | Updated | Note |",
  "| --- | ---: | --- | --- |",
  ...sources.map((s) => row([s.name, s.records.toLocaleString(), s.updated, s.note])),
  "",
  "## One set, by category",
  "",
  "| Category | Destinations | Mapped |",
  "| --- | ---: | ---: |",
  ...categories.map((c) => row([c.label, (report.totals.categoryRecords[c.id] || 0).toLocaleString(), (stats.byKind[c.id] || 0).toLocaleString()])),
  "",
  "## Distribution",
  "",
  row(["Measure", "Value"]),
  row(["---", "---:"]),
  row(["Destination countries", report.countries.atlas]),
  row(["Rows per country, median", report.countries.medianRowsPerCountry]),
  row(["Countries with one row", report.countries.withOneRow]),
  row(["Countries with two or fewer", report.countries.withTwoOrFewer]),
  row(["Rows in the fullest country", report.countries.maxRows]),
  row(["Populated z6 cells", report.density.cells]),
  row(["Destinations per cell, median", report.density.medianPerCell]),
  row(["Destinations per cell, max", report.density.maxPerCell]),
  row(["Georgia box: atlas / hand-written / Wikidata", `${georgia.atlas} / ${georgia.curated} / ${georgia.wikidata}`]),
  row(["Georgia (Atlanta) cell", georgiaCell]),
  "",
  "### Fullest cells",
  "",
  row(["Cell", "Destinations"]),
  row(["---", "---:"]),
  ...cellTop.map(([k, v]) => row([k, v])),
  "",
  "## Duplicates",
  "",
  `- Same category within 50 m: **${dup50.dupes}**`,
  `- Same category within 110 m: **${dup110.dupes}**`,
  ...(dup50.examples.length ? ["", "Examples:", ...dup50.examples.map((e) => `- ${e}`)] : []),
  "",
  "## Coverage and freshness",
  "",
  `- Categories with no records: ${missing.length ? missing.map((c) => c.id).join(", ") : "none"}`,
  `- ${report.coverage.note}`,
  `- ${report.freshness.scheduledUpdate}`,
  "",
].join("\n");
writeFileSync(join(root, "reports/data-audit.md"), md);

console.log(`wrote reports/data-audit.{md,json}`);
console.log(
  `destinations ${destinations.length} · mapped ${totalMapped.toLocaleString()} · countries ${report.countries.atlas} (median ${median})`,
);
console.log(
  `cells ${cells.size} (median ${cellMedian}, max ${cellCounts.at(-1) ?? 0}) · Georgia box ${georgia.atlas}/${georgia.curated}/${georgia.wikidata} · dupes ≤50 m ${dup50.dupes}`,
);
