#!/usr/bin/env node
/**
 * Trail quality gate.
 *
 * The old validator only asked whether the trail folder had segments. That is
 * how 39% of the store shipped with >200 m vertex jumps and 11,474 segments
 * outside their own tile. This reads the cells that are actually on disk and
 * measures the geometry:
 *
 *   - no coordinate outside its z7 tile;
 *   - no "chord": a >2 km segment that is also >6x the line's median spacing;
 *   - few exact duplicate geometries;
 *   - distance_m matches the geometry;
 *   - no cell over the 12 MB wire limit.
 *
 * `--strict` exits non-zero. The monthly trail workflow runs it before upload;
 * `validate-data.mjs` checks the committed quality block in a checkout that has
 * no 288 MB cell mirror.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const CELL = 7;
const LIMIT = 12_000_000;

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

const radians = (value) => (value * Math.PI) / 180;
const metres = (a, b) => {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

function tileBounds(z, x, y) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const lat = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { west, east, north: lat(y), south: lat(y + 1) };
}

function cellsOnDisk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const x of readdirSync(dir)) {
    const xDir = join(dir, x);
    if (!statSync(xDir).isDirectory()) continue;
    for (const name of readdirSync(xDir)) {
      if (!name.endsWith(".json")) continue;
      const y = Number(name.slice(0, -5));
      if (!Number.isInteger(y)) continue;
      out.push({ x: Number(x), y, path: join(xDir, name) });
    }
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const cells = cellsOnDisk(join(root, "public", "trails", String(CELL)));
const bySource = new Map();
const byCountry = new Map();
const geomCounts = new Map();
const worst = [];
let segments = 0;
let points = 0;
let bytes = 0;
let maxCellBytes = 0;
let emptyCells = 0;
let outOfTile = 0;
let invalidCoords = 0;
let under2 = 0;
let distanceMismatch = 0;
let chords = 0;
let maxJumpKm = 0;

for (const cell of cells) {
  const size = statSync(cell.path).size;
  bytes += size;
  maxCellBytes = Math.max(maxCellBytes, size);
  const data = read(cell.path, null);
  if (!data || !Array.isArray(data.items)) continue;
  const bounds = tileBounds(CELL, cell.x, cell.y);
  if (!data.items.length) {
    emptyCells += 1;
    continue;
  }
  for (const row of data.items) {
    const src = data.sources?.[row[0]] ?? "osm";
    const coords = row[5];
    if (!Array.isArray(coords) || coords.length < 2) {
      under2 += 1;
      continue;
    }
    segments += 1;
    points += coords.length;
    const lengths = [];
    let badCoord = false;
    let cellOutside = false;
    let lineMax = 0;
    for (let i = 0; i < coords.length; i += 1) {
      const [lon, lat] = coords[i] ?? [];
      if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        badCoord = true;
        continue;
      }
      // A clipped vertex can land a few centimetres outside after the Web
      // Mercator round-trip; that is not a real out-of-tile segment.
      if (lon < bounds.west - 1e-4 || lon > bounds.east + 1e-4) cellOutside = true;
      if (lat < bounds.south - 1e-4 || lat > bounds.north + 1e-4) cellOutside = true;
      if (i > 0) {
        const length = metres(coords[i - 1], coords[i]);
        lengths.push(length);
        lineMax = Math.max(lineMax, length);
      }
    }
    if (badCoord) {
      invalidCoords += 1;
      continue;
    }
    if (cellOutside) outOfTile += 1;
    const med = median(lengths);
    const lineChords = lengths.filter((length) => length > 2000 && length > med * 6).length;
    chords += lineChords;
    maxJumpKm = Math.max(maxJumpKm, lineMax / 1000);
    if (lineChords) {
      worst.push({
        cell: `${CELL}/${cell.x}/${cell.y}`,
        src,
        name: row[1] ?? "",
        chords: lineChords,
        maxJumpKm: Math.round((lineMax / 1000) * 10) / 10,
      });
    }

    const geometryLength = lengths.reduce((sum, length) => sum + length, 0);
    const distance = Number(row[3]) || 0;
    if (distance > 0 && Math.abs(distance - geometryLength) / Math.max(geometryLength, 1) > 0.05) {
      distanceMismatch += 1;
    }

    const key = JSON.stringify(coords);
    const count = (geomCounts.get(key) ?? 0) + 1;
    geomCounts.set(key, count);

    const source = bySource.get(src) ?? { segments: 0, points: 0, km: 0, bytes: 0 };
    source.segments += 1;
    source.points += coords.length;
    source.km += geometryLength / 1000;
    source.bytes += JSON.stringify(row).length;
    bySource.set(src, source);

    // row[6] is the OSM network or the managing agency, not a country. Falling
    // back to it put "lwn" and club names in the country tally.
    const country = row[7] || "Unspecified";
    const place = byCountry.get(country) ?? { segments: 0, km: 0 };
    place.segments += 1;
    place.km += geometryLength / 1000;
    byCountry.set(country, place);
  }
}

let duplicateCopies = 0;
for (const count of geomCounts.values()) if (count > 1) duplicateCopies += count - 1;

const quality = {
  checkedCells: cells.length,
  emptyCells,
  segments,
  points,
  bytes,
  maxCellBytes,
  outOfTile,
  invalidCoords,
  under2,
  chords,
  chordRate: segments ? chords / segments : 0,
  duplicateCopies,
  duplicateRate: segments ? duplicateCopies / segments : 0,
  distanceMismatch,
  distanceMismatchRate: segments ? distanceMismatch / segments : 0,
  maxJumpKm: Math.round(maxJumpKm * 10) / 10,
  bySource: Object.fromEntries(
    [...bySource.entries()].map(([id, value]) => [
      id,
      {
        segments: value.segments,
        points: value.points,
        km: Math.round(value.km * 10) / 10,
        bytes: value.bytes,
      },
    ]),
  ),
  byCountry: Object.fromEntries(
    [...byCountry.entries()]
      .sort((a, b) => b[1].segments - a[1].segments)
      .map(([country, value]) => [
        country,
        { segments: value.segments, km: Math.round(value.km * 10) / 10 },
      ]),
  ),
  worstChordExamples: worst.sort((a, b) => b.maxJumpKm - a.maxJumpKm).slice(0, 8),
};

mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports/trail-quality.json"), `${JSON.stringify(quality, null, 2)}\n`);
writeFileSync(
  join(root, "reports/trail-quality.md"),
  [
    "# Trail quality",
    "",
    `Cells: ${quality.checkedCells.toLocaleString()} (${emptyCells.toLocaleString()} empty) · segments: ${segments.toLocaleString()} · points: ${points.toLocaleString()} · ${(bytes / 1e6).toFixed(1)} MB`,
    "",
    "| Check | Value | Limit |",
    "| --- | ---: | ---: |",
    `| Outside its tile | ${outOfTile} | 0 |`,
    `| Chord segments | ${chords} (${(quality.chordRate * 100).toFixed(3)}%) | ≤ 0.01% |`,
    `| Exact duplicate copies | ${duplicateCopies} (${(quality.duplicateRate * 100).toFixed(2)}%) | < 0.5% |`,
    `| Distance mismatch | ${distanceMismatch} (${(quality.distanceMismatchRate * 100).toFixed(2)}%) | < 5% |`,
    `| Max cell | ${(maxCellBytes / 1e6).toFixed(2)} MB | ≤ 12 MB |`,
    `| Invalid coordinates | ${invalidCoords} | 0 |`,
    `| Lines under 2 points | ${under2} | 0 |`,
    "",
    "## By source",
    "",
    "| Source | Segments | km |",
    "| --- | ---: | ---: |",
    ...Object.entries(quality.bySource).map(
      ([id, value]) => `| ${id} | ${value.segments.toLocaleString()} | ${value.km.toLocaleString()} |`,
    ),
    "",
    "## Worst chords",
    "",
    ...(worst.length
      ? worst
          .sort((a, b) => b.maxJumpKm - a.maxJumpKm)
          .slice(0, 8)
          .map(
            (item) =>
              `- ${item.cell} · ${item.src} · ${item.name || "unnamed"} · ${item.maxJumpKm} km`,
          )
      : ["- none"]),
    "",
  ].join("\n"),
);

const statsPath = join(root, "src", "data", "trail-stats.json");
const stats = read(statsPath, {}) ?? {};
stats.cells = cells.length - emptyCells;
stats.checkedCells = cells.length;
stats.emptyCells = emptyCells;
stats.segments = segments;
stats.bytes = bytes;
stats.max_cell_bytes = maxCellBytes;
stats.bySource = Object.fromEntries(
  Object.entries(quality.bySource).map(([id, value]) => [id, value.segments]),
);
stats.byCountry = Object.fromEntries(
  Object.entries(quality.byCountry).map(([country, value]) => [country, value.segments]),
);
stats.quality = quality;
writeFileSync(statsPath, `${JSON.stringify(stats, null, 1)}\n`);

console.log(
  `trail quality: ${segments.toLocaleString()} segments · ${outOfTile} outside tile · ${chords} chords · ${duplicateCopies} duplicate copies · max ${(maxCellBytes / 1e6).toFixed(1)} MB`,
);

const failures = [];
if (!cells.length) failures.push("no trail cells were found");
if (!segments) failures.push("no trail segments were found");
if (outOfTile > 0) failures.push(`${outOfTile} segments outside their tile`);
if (quality.chordRate > 0.0001) failures.push(`${chords} chord segments`);
if (quality.duplicateRate >= 0.005) failures.push(`${duplicateCopies} duplicate copies`);
if (quality.distanceMismatchRate >= 0.05) failures.push(`${distanceMismatch} distance mismatches`);
if (maxCellBytes > LIMIT) failures.push(`cell ${maxCellBytes} over ${LIMIT} bytes`);
if (invalidCoords > 0) failures.push(`${invalidCoords} invalid rows`);
if (under2 > 0) failures.push(`${under2} lines under two points`);
if (strict && failures.length) {
  for (const failure of failures) console.error(`  STRICT FAIL ${failure}`);
  process.exit(1);
}
if (failures.length) for (const failure of failures) console.error(`  attention ${failure}`);
