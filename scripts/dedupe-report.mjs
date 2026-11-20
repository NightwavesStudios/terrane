#!/usr/bin/env node
/**
 * Find destination pairs that describe the same place and say whether the pair
 * has a reviewed merge decision.
 *
 * The map's cells dedupe every harvested point in `merge-sources.py`. Destinations
 * are atlas and Wikidata rows and need a different rule: same category, within
 * 50 m, and a matching name. This report is generated on every data run so a new
 * duplicate is visible before it reaches the atlas, instead of living only in a
 * commit message.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
};

const atlas = read("src/data/atlas.json", []);
const reach = read("src/data/reach.json", { items: [], kinds: [] });
const reachMore = read("src/data/reach-more.json", { items: [], kinds: [] });
const reviewed = read("src/data/atlas-merges.json", []);

const norm = (value) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const rows = [
  ...atlas.map((r) => ({ id: r.wd, src: "atlas", cat: r.type, name: r.name, lat: r.lat, lon: r.lon })),
  ...reach.items.map((r) => ({ id: r[4], src: "wikidata", cat: reach.kinds[r[2]], name: r[4], lat: r[0], lon: r[1] })),
  ...reachMore.items.map((r) => ({ id: r[4], src: "wikidata", cat: reachMore.kinds[r[2]], name: r[4], lat: r[0], lon: r[1] })),
];

const metres = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const reviewedPairs = new Set(
  reviewed.flatMap((merge) => merge.drop.map((drop) => [merge.keep, drop].sort().join("|"))),
);
const pairs = [];
for (let i = 0; i < rows.length; i += 1) {
  for (let j = i + 1; j < rows.length; j += 1) {
    const a = rows[i];
    const b = rows[j];
    if (a.cat !== b.cat || metres(a, b) > 50) continue;
    const na = norm(a.name);
    const nb = norm(b.name);
    if (na && nb && na !== nb) continue;
    const key = [a.id, b.id].sort().join("|");
    pairs.push({ a, b, metres: Math.round(metres(a, b)), reviewed: reviewedPairs.has(key) });
  }
}

mkdirSync(join(root, "reports"), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  definition: "Same category, named (or one unnamed), within 50 m. A pair is accepted only when it has a reviewed merge decision.",
  total: pairs.length,
  reviewed: pairs.filter((p) => p.reviewed).length,
  unreviewed: pairs.filter((p) => !p.reviewed).length,
  pairs,
};
writeFileSync(join(root, "reports/dedupe.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  join(root, "reports/dedupe.md"),
  [
    "# Destination dedupe review",
    "",
    `${pairs.length} pairs within 50 m · ${report.reviewed} reviewed · ${report.unreviewed} need review`,
    "",
    ...pairs.map(
      (p) =>
        `- ${p.reviewed ? "reviewed" : "NEEDS REVIEW"} · ${p.a.name} (${p.a.id}) ↔ ${p.b.name} (${p.b.id}) · ${p.metres} m`,
    ),
    "",
  ].join("\n"),
);
console.log(
  `dedupe: ${pairs.length} pairs within 50 m · ${report.reviewed} reviewed · ${report.unreviewed} unreviewed`,
);
if (!existsSync(join(root, "reports/dedupe.md"))) process.exit(1);
