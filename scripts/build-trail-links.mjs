#!/usr/bin/env node
/**
 * Geographic relationships between destinations and trails.
 *
 * The Place page already answers "what is within 30 km" from the bundled
 * destination set. This adds the other half: for every destination with a page,
 * the nearest up to six named trails from the repaired z7 cells, within 10 km.
 * The result is small, committed, and used by `/place/:slug` without a runtime
 * request or a spatial database.
 *
 * Run after `scripts/merge-sources.py`; a fresh checkout keeps the committed
 * JSON and does not need the 288 MB cell mirror.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { readDestinations, shardOf } from "./lib/destinations.mjs";

const root = process.cwd();
const CELL = 7;
const RADIUS_KM = 10;
const MAX_LINKS = 6;
const GRID_DEG = 0.25;

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

const norm = (value) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(trail|route|path|track|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const rad = (value) => (value * Math.PI) / 180;
const km = (aLat, aLon, bLat, bLon) => {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

function pointSegmentKm(lat, lon, a, b) {
  const lat0 = (lat + a[1] + b[1]) / 3;
  const x = (value) => value * 111.32 * Math.cos(rad(lat0));
  const y = (value) => value * 110.54;
  const px = x(lon);
  const py = y(lat);
  const ax = x(a[0]);
  const ay = y(a[1]);
  const bx = x(b[0]);
  const by = y(b[1]);
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceKm(lat, lon, coords) {
  let best = Infinity;
  if (coords.length === 1) return km(lat, lon, coords[0][1], coords[0][0]);
  for (let i = 1; i < coords.length; i += 1) {
    best = Math.min(best, pointSegmentKm(lat, lon, coords[i - 1], coords[i]));
    if (best === 0) break;
  }
  return best;
}

const grid = new Map();
const trails = [];
const dir = join(root, "public", "trails", String(CELL));
if (existsSync(dir)) {
  for (const x of readdirSync(dir)) {
    const xDir = join(dir, x);
    if (!statSync(xDir).isDirectory()) continue;
    for (const name of readdirSync(xDir)) {
      if (!name.endsWith(".json")) continue;
      const cell = read(join(xDir, name), null);
      if (!cell?.items) continue;
      for (const row of cell.items) {
        const nameValue = String(row[1] ?? "").trim();
        const coords = row[5];
        if (!nameValue || !Array.isArray(coords) || coords.length < 2) continue;
        const trail = {
          name: nameValue,
          coords,
          src: cell.sources?.[row[0]] ?? "osm",
          difficulty: row[2] || "",
          distance: Number(row[3]) || 0,
        };
        const index = trails.push(trail) - 1;
        const lons = coords.map((p) => p[0]);
        const lats = coords.map((p) => p[1]);
        const x0 = Math.floor(Math.min(...lons) / GRID_DEG);
        const x1 = Math.floor(Math.max(...lons) / GRID_DEG);
        const y0 = Math.floor(Math.min(...lats) / GRID_DEG);
        const y1 = Math.floor(Math.max(...lats) / GRID_DEG);
        for (let gx = x0; gx <= x1; gx += 1) {
          for (let gy = y0; gy <= y1; gy += 1) {
            const key = `${gx}:${gy}`;
            const list = grid.get(key);
            if (list) list.push(index);
            else grid.set(key, [index]);
          }
        }
      }
    }
  }
}

const destinations = readDestinations();

const items = {};
let linked = 0;
for (const place of destinations) {
  if (!place.slug || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
  const gx = Math.floor(place.lon / GRID_DEG);
  const gy = Math.floor(place.lat / GRID_DEG);
  const candidates = new Set();
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (const index of grid.get(`${gx + dx}:${gy + dy}`) ?? []) candidates.add(index);
    }
  }
  const best = new Map();
  for (const index of candidates) {
    const trail = trails[index];
    const distance = distanceKm(place.lat, place.lon, trail.coords);
    if (distance > RADIUS_KM) continue;
    const key = norm(trail.name) || trail.name.toLowerCase();
    const current = best.get(key);
    if (!current || distance < current.km) best.set(key, { trail, km: distance });
  }
  if (!best.size) continue;
  items[place.slug] = [...best.values()]
    .sort((a, b) => a.km - b.km)
    .slice(0, MAX_LINKS)
    .map(({ trail, km: distance }) => ({
      name: trail.name,
      km: Math.round(distance * 10) / 10,
      src: trail.src,
      difficulty: trail.difficulty,
    }));
  linked += 1;
}

const stats = read("src/data/trail-stats.json", {}) ?? {};
const generated = stats.updated ?? "unknown";
const shards = new Map();
for (const [slug, list] of Object.entries(items)) {
  const key = shardOf(slug);
  const shard = shards.get(key) ?? {};
  shard[slug] = list;
  shards.set(key, shard);
}

const outDir = join(root, "src/data/trail-links");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [key, shard] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  writeFileSync(
    join(outDir, `${key}.json`),
    `${JSON.stringify({ generated, radiusKm: RADIUS_KM, items: shard })}\n`,
  );
}
writeFileSync(
  join(root, "src/data/trail-links-summary.json"),
  `${JSON.stringify({
    generated,
    radiusKm: RADIUS_KM,
    linkedDestinations: linked,
    destinations: destinations.length,
    shards: shards.size,
  }, null, 2)}\n`,
);
rmSync(join(root, "src/data/trail-links.json"), { force: true });
console.log(
  `trail links: ${linked}/${destinations.length} destinations · ${Object.values(items).reduce((sum, list) => sum + list.length, 0)} links · ${shards.size} shards`,
);
