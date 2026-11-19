#!/usr/bin/env node
/**
 * Destination band report.
 *
 * Reads the same `src/data/bands.json` the map uses and reproduces the cell quotas
 * from `src/data/rank.ts` and the reach caps from `src/map/destinations.ts`, so the
 * sizes and reveal steps can be checked without a browser. It is analysis only: it
 * writes `reports/dot-bands.{md,json}` and never touches the data files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readCurated } from "./lib/curated.mjs";

const bandsFile = JSON.parse(readFileSync("src/data/bands.json", "utf8"));
const BANDS = bandsFile.bands;
const atlas = JSON.parse(readFileSync("src/data/atlas.json", "utf8"));
const reach = JSON.parse(readFileSync("src/data/reach.json", "utf8"));
const more = JSON.parse(readFileSync("src/data/reach-more.json", "utf8"));
const curated = readCurated();

/** Mirrors `REACH_COHORT` in `src/map/destinations.ts`. */
const REACH_COHORT = {
  1: { band: 3, overflow: 4, cell: 6, per: 3 },
  2: { band: 3, overflow: 4, cell: 6, per: 3 },
  3: { band: 4, overflow: 6, cell: 7, per: 16 },
  4: { band: 5, overflow: 6, cell: 9, per: 10 },
};

function importance(p) {
  const type = p.type ?? "landmark";
  if (type === "peak") return Math.min(1, Math.max(0, (p.elevation ?? 0) / 5000));
  if (type === "park") return 0.62;
  if (type === "landmark") return 0.55;
  return 0.4;
}

function cellOf(lat, lon, zoom) {
  const cells = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * cells);
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * cells,
  );
  return `${x}/${y}`;
}

const places = [
  ...curated.map((p) => ({ ...p, elevation: p.elevation ?? 0 })),
  ...atlas.map((p) => ({ ...p })),
];

const ranked = [...places].sort(
  (a, b) => importance(b) - importance(a) || a.name.localeCompare(b.name),
);

/** Mirrors `rankPlaces` in `src/data/rank.ts`. */
function assignAtlas(rows) {
  const c4 = new Map();
  const c5 = new Map();
  const c6 = new Map();
  return rows.map((p) => {
    const k4 = cellOf(p.lat, p.lon, 4);
    const k5 = cellOf(p.lat, p.lon, 5);
    const k6 = cellOf(p.lat, p.lon, 6);
    let band = 3;
    if ((c4.get(k4) ?? 0) < 1) {
      c4.set(k4, (c4.get(k4) ?? 0) + 1);
      band = 0;
    } else if ((c5.get(k5) ?? 0) < 2) {
      c5.set(k5, (c5.get(k5) ?? 0) + 1);
      band = 1;
    } else if ((c6.get(k6) ?? 0) < 6) {
      c6.set(k6, (c6.get(k6) ?? 0) + 1);
      band = 2;
    }
    return { ...p, band };
  });
}

function assignReach(items) {
  const used = new Map();
  return items.map((r) => {
    const tier = r[3];
    const cohort = REACH_COHORT[tier] ?? REACH_COHORT[3];
    const key = `${cohort.band}:${cellOf(r[0], r[1], cohort.cell)}`;
    const seen = (used.get(key) ?? 0) + 1;
    used.set(key, seen);
    return {
      name: String(r[4]),
      lat: r[0],
      lon: r[1],
      band: seen <= cohort.per ? cohort.band : cohort.overflow,
    };
  });
}

const rows = [
  ...assignAtlas(ranked).map((p) => ({
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    band: p.band,
  })),
  ...assignReach(reach.items),
  ...assignReach(more.items),
];

const counts = BANDS.map((b) => rows.filter((r) => r.band === b.band).length);
const byBand = BANDS.map((b, i) => ({
  band: b.band,
  dot: b.dot,
  label: b.label,
  scale: b.scale,
  opacity: b.opacity,
  count: counts[i],
  cumulative: counts.slice(0, i + 1).reduce((a, n) => a + n, 0),
}));

const cell6 = new Map();
for (const r of rows) {
  const k = cellOf(r.lat, r.lon, 6);
  if (!cell6.has(k)) cell6.set(k, BANDS.map(() => 0));
  cell6.get(k)[r.band] += 1;
}
const band2Max = Math.max(...[...cell6.values()].map((v) => v[2]));

function continent(lat, lon) {
  if (lat < -60) return "Antarctica";
  if (lon >= 110 && lat <= -10) return "Oceania";
  if (lon <= -25 && lat >= 13) return "North America";
  if (lon <= -25 && lat < 13) return "South America";
  if (lat >= 35 && lon >= -25 && lon < 60) return "Europe";
  if (lat <= 37 && lon >= -20 && lon < 55) return "Africa";
  return "Asia";
}

const world = rows.filter((r) => r.band === 0);
const continents = {};
for (const r of world) {
  const c = continent(r.lat, r.lon);
  continents[c] = (continents[c] ?? 0) + 1;
}

/** Visible hemisphere from the opening camera (lat 20, lon 10). */
function hemisphere(lat, lon) {
  const rad = Math.PI / 180;
  const a = [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
  const b = [Math.cos(20 * rad) * Math.cos(10 * rad), Math.cos(20 * rad) * Math.sin(10 * rad), Math.sin(20 * rad)];
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] > 0;
}
const worldVisible = world.filter((r) => hemisphere(r.lat, r.lon)).length;

/**
 * A 1200×800 viewport at a zoom. Longitude degrees per pixel are constant, so the
 * box is 1200 × d wide and 800 × d tall at the Mercator scale (a slight
 * overestimate away from the equator, which is the safe direction for a cap).
 */
function viewport(z, lat, lon) {
  const d = 360 / (256 * 2 ** z);
  const lonHalf = 600 * d;
  const latHalf = 400 * d;
  const inside = rows.filter(
    (r) =>
      r.lat >= lat - latHalf &&
      r.lat <= lat + latHalf &&
      r.lon >= lon - lonHalf &&
      r.lon <= lon + lonHalf &&
      BANDS[r.band].dot <= z &&
      (z >= 6.6 || r.band < 4),
  );
  return {
    z,
    lat,
    lon,
    dots: inside.length,
    labels: inside.filter((r) => BANDS[r.band].label <= z).length,
    bands: BANDS.filter((b) => b.dot <= z).map((b) => b.band),
  };
}

const viewports = [
  { name: "Europe", ...viewport(3.5, 46, 10) },
  { name: "Alps", ...viewport(5.5, 46.5, 8) },
  { name: "Alps", ...viewport(7.5, 46.5, 8) },
  { name: "Alps", ...viewport(9.2, 46.5, 8) },
  { name: "Georgia", ...viewport(5, 34.7, -84.2) },
  { name: "Georgia", ...viewport(7.5, 34.7, -84.2) },
  { name: "Himalaya", ...viewport(3, 28, 86) },
];

const gaps = BANDS.slice(1).map((b, i) => Number((b.dot - BANDS[i].dot).toFixed(1)));
const report = {
  generatedAt: new Date().toISOString(),
  byBand,
  band2Max,
  worldVisible,
  continents,
  viewports,
  gaps,
};
writeFileSync("reports/dot-bands.json", `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  "# Destination bands",
  "",
  "Generated by `npm run bands` from `src/data/bands.json` and the destination data.",
  "",
  "| band | dot z | label z | count | cumulative | radius × |",
  "| --- | --- | --- | --- | --- | --- |",
  ...byBand.map(
    (b) => `| ${b.band} | ${b.dot} | ${b.label} | ${b.count} | ${b.cumulative} | ${b.scale} |`,
  ),
  "",
  `Band starts every ${gaps.join(", ")} zoom levels (max ${Math.max(...gaps)}).`,
  `Worst z6 cell in band 2: ${band2Max} dots.`,
  "",
  "## World band spread",
  "",
  `Visible hemisphere from the opening camera: ${worldVisible} dots.`,
  "",
  "| continent | dots |",
  "| --- | --- |",
  ...Object.entries(continents)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `| ${name} | ${n} |`),
  "",
  "## 1200×800 viewports",
  "",
  "| viewport | z | dots | labels | bands active |",
  "| --- | --- | --- | --- | --- |",
  ...viewports.map(
    (v) => `| ${v.name} | ${v.z} | ${v.dots} | ${v.labels} | ${v.bands.join(", ")} |`,
  ),
  "",
];
writeFileSync("reports/dot-bands.md", `${lines.join("\n")}\n`);

console.log(lines.slice(2).join("\n"));
