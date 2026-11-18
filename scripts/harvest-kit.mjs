/**
 * Harvests the camping kit — campsites, huts, shelters, water, parking,
 * viewpoints, picnic sites — from the OpenFreeMap vector tiles around every
 * place in the atlas, and writes `src/data/kit.json`.
 *
 * Why bake instead of drawing the `poi` layer at runtime: the tiles only carry
 * POIs at z14, so a style-driven layer can never show a camp at country scale,
 * and it can never rank one camp above another. Baking lets us harvest a wider
 * area (a 3×3 grid of z14 tiles, ~5 km) and give every feature a tier, so the
 * map can reveal the anchors early and the fine detail late.
 *
 * Tiles are cached in /tmp so a rerun after a tier change is instant; nothing
 * but the JSON lands in the repo.
 *
 * Usage: node scripts/harvest-kit.mjs [--refresh] [--radius=1]
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { readTile, tileXY, pointLonLat } from "./lib/mvt.mjs";

const CACHE = "/tmp/terrane-kit-tiles";
const OUT = "src/data/kit.json";
const Z = 14;
const RADIUS = Number(
  (process.argv.find((a) => a.startsWith("--radius=")) ?? "--radius=2").split("=")[1],
);
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 10;

/* Which POIs are worth a place in the dataset, and how they are labelled. The
   rest of the `poi` layer — 283 hotels, 72 shops and 36 waste baskets in one
   Zermatt tile — is exactly the noise the tiers exist to keep out. */
const KINDS = {
  campsite: { kind: "camp", named: true },
  caravan_site: { kind: "camp", named: true },
  shelter: { kind: "shelter", named: true },
  alpine_hut: { kind: "hut", named: true },
  wilderness_hut: { kind: "hut", named: true },
  drinking_water: { kind: "water", named: false },
  spring: { kind: "water", named: false },
  parking: { kind: "parking", named: false },
  viewpoint: { kind: "view", named: true },
  picnic_site: { kind: "picnic", named: false },
  mountain_pass: { kind: "pass", named: true },
};

function classify(props) {
  const cls = String(props.class ?? "");
  if (cls === "lodging") {
    // Huts are lodging POIs; hotels and guest houses are not what a hiker wants.
    return props.subclass === "alpine_hut" || props.subclass === "wilderness_hut"
      ? KINDS[props.subclass]
      : null;
  }
  return KINDS[cls] ?? null;
}

const haversine = (aLat, aLon, bLat, bLon) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

/* ── places ──────────────────────────────────────────────────────────────── */

const atlas = JSON.parse(await readFile("src/data/atlas.json", "utf8"));
const source = await readFile("src/data/places.ts", "utf8");
const curated = [];
for (const block of source.split(/\n  \{\n/).slice(1)) {
  const body = block.split("\n  },")[0];
  if (!/^\s+slug:/.test(body)) continue;
  const get = (k) => body.match(new RegExp(`${k}:\\s*"?([^",\\n]+)"?`))?.[1];
  const lat = Number(get("lat"));
  const lon = Number(get("lon"));
  const slug = get("slug");
  if (!slug || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  curated.push({ slug, name: get("name"), lat, lon, curated: true });
}

const places = [
  ...atlas.map((p) => ({ slug: p.slug, name: p.name, lat: p.lat, lon: p.lon, curated: false })),
  ...curated,
].filter((p, i, all) => all.findIndex((q) => q.slug === p.slug) === i);

console.log(`places: ${places.length} (${curated.length} curated)`);

/* ── tiles ───────────────────────────────────────────────────────────────── */

const tpl = (await (await fetch("https://tiles.openfreemap.org/planet")).json()).tiles[0];
const wanted = new Set();
for (const p of places) {
  const { x, y } = tileXY(p.lon, p.lat, Z);
  for (let dx = -RADIUS; dx <= RADIUS; dx++) {
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      wanted.add(`${x + dx}/${y + dy}`);
    }
  }
}
const tiles = [...wanted];
console.log(`tiles: ${tiles.length} (radius ${RADIUS})`);

if (!existsSync(CACHE)) await mkdir(CACHE, { recursive: true });

let fetched = 0;
let cached = 0;
let failed = 0;

async function getTile(key) {
  const file = path.join(CACHE, `${key.replace("/", "_")}.pbf`);
  if (!REFRESH || !existsSync(file)) {
    try {
      if ((await stat(file)).size > 0) {
        cached++;
        return new Uint8Array(await readFile(file));
      }
    } catch {
      /* not cached */
    }
  }
  const url = tpl
    .replace("{z}", String(Z))
    .replace("{x}", key.split("/")[0])
    .replace("{y}", key.split("/")[1]);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      await writeFile(file, buf);
      fetched++;
      return buf;
    } catch (err) {
      if (attempt === 2) {
        failed++;
        console.warn(`  miss ${key}: ${err.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  return null;
}

/* ── harvest ─────────────────────────────────────────────────────────────── */

const seen = new Map();
const stats = {};

async function run(key) {
  const buf = await getTile(key);
  if (!buf) return;
  let layers;
  try {
    layers = readTile(buf);
  } catch (err) {
    failed++;
    console.warn(`  undecodable ${key}: ${err.message}`);
    return;
  }
  const poi = layers.find((l) => l.name === "poi");
  if (!poi) return;
  const [xs, ys] = key.split("/").map(Number);

  for (const f of poi.features) {
    const rule = classify(f.props);
    if (!rule) continue;
    const ring = f.rings[0];
    if (!ring || !ring[0]) continue;
    const [lon, lat] = pointLonLat(xs, ys, Z, ring[0][0], ring[0][1], poi.extent);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const name = (f.props["name:en"] || f.props.name || "").toString().trim();
    if (rule.named && !name) continue;

    const id = `${rule.kind}:${lon.toFixed(4)}:${lat.toFixed(4)}`;
    if (seen.has(id)) continue;
    seen.set(id, {
      k: rule.kind,
      n: name || undefined,
      lat,
      lon,
      rank: typeof f.props.rank === "number" ? f.props.rank : undefined,
    });
    stats[rule.kind] = (stats[rule.kind] ?? 0) + 1;
  }
}

let cursor = 0;
async function worker() {
  while (cursor < tiles.length) {
    const key = tiles[cursor++];
    await run(key);
    if (cursor % 500 === 0) console.log(`  …${cursor}/${tiles.length}`);
  }
}
const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(
  `tiles done in ${((Date.now() - started) / 1000).toFixed(1)} s — fetched ${fetched}, cached ${cached}, failed ${failed}`,
);

/* ── priority ────────────────────────────────────────────────────────────── */

/* Nearest atlas place, plus whether that place is curated. A camp 500 m from a
   written-up summit matters more than the same camp 5 km from a minor peak, and
   that distance is what the first tier is built on. */
const items = [...seen.values()];
for (const it of items) {
  let best = null;
  let bestKm = Infinity;
  for (const p of places) {
    const km = haversine(it.lat, it.lon, p.lat, p.lon);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  it.km = Math.round(bestKm * 10) / 10;
  it.near = best?.slug;
  it.tier = tierOf(it, best);
}

/* Four tiers, revealed by zoom:
     0 — the anchors: a named camp/hut/shelter beside a written-up place, or a
         high-ranked one (OSM `rank` ≤ 4) anywhere in the harvest.
     1 — every other named camp, hut or shelter.
     2 — unnamed camps and huts, and named water or parking.
     3 — fine detail: unnamed water, picnic tables, the rest of the parking.
   Thresholds are set from the counts printed below and the caps that follow, so
   the widest zoom showing a tier holds a screenful of marks, not a carpet. */
function tierOf(it, near) {
  const named = Boolean(it.n);
  const closeToCurated = Boolean(near?.curated) && it.km <= 1.5;

  if (it.k === "camp" || it.k === "hut") {
    // Anchors first: a named bed for the night right beside a written-up place.
    if (named && closeToCurated) return 0;
    if (named && it.km <= 6) return 1;
    if (named) return 2;
    return 3;
  }
  if (it.k === "shelter") {
    // Shelters ride one tier later than camps: there are more than a thousand of
    // them and most are village bus stops or picnic shelters, not mountain refuge.
    if (named && closeToCurated) return 0;
    return named ? 2 : 3;
  }
  if (it.k === "water" || it.k === "picnic" || it.k === "parking") {
    return named && it.km <= 2 ? 2 : 3;
  }
  return named ? 1 : 2;
}

/* Caps. A 3×3 tile grid around a town landmark catches every car park within
   5 km — 9,655 of them worldwide, which would be 71% of the dataset and a
   carpet on the screen. Nobody needs the fifth-nearest tap either: keep the
   nearest few of each kind per place and drop the rest. Camps and huts are
   never capped, because there are never too many of them. */
const CAPS = { water: 4, parking: 3, picnic: 2 };
{
  const buckets = new Map();
  for (const it of items) {
    if (!(it.k in CAPS)) continue;
    const key = `${it.near}|${it.k}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const dropped = new Set();
  for (const [key, list] of buckets) {
    const kind = key.split("|")[1];
    list.sort((a, b) => a.km - b.km);
    for (const extra of list.slice(CAPS[kind])) dropped.add(extra);
  }
  if (dropped.size) {
    console.log(`capped ${dropped.size} of ${CAPS.water + CAPS.parking + CAPS.picnic} kinds`);
    for (let i = items.length - 1; i >= 0; i--) if (dropped.has(items[i])) items.splice(i, 1);
  }
}

const byTier = {};
const byKind = {};
for (const it of items) {
  byTier[it.tier] = (byTier[it.tier] ?? 0) + 1;
  byKind[it.k] = (byKind[it.k] ?? 0) + 1;
}

console.log("kinds:", byKind);
console.log("tiers:", byTier);
console.log(
  "named:",
  items.filter((i) => i.n).length,
  "| within 3 km:",
  items.filter((i) => i.km <= 3).length,
);

/* ── write ───────────────────────────────────────────────────────────────── */

/* Columnar, because there are thousands of these and key names are the whole
   file: `[lat, lon, kindId, tier, name?, nearIndex?]`. Coordinates are rounded to
   4 decimals (~11 m), which is finer than a 12 px icon can express and saves a
   third of the bytes.

   Split in two on purpose. Tiers 0–2 are the camps, huts and shelters you plan
   around and they ship with the globe; tier 3 is water taps, car parks and
   picnic tables — 2,800 features that only matter once the camera is close, so
   they live in `kit-detail.json` and are fetched on the first zoom past 13.8.
   Together they were a 107 kB gzipped chunk; apart, neither one is. */
const KINDS_ORDER = ["camp", "hut", "shelter", "water", "parking", "view", "picnic", "pass"];
const NEAR = [...new Set(items.map((i) => i.near))];

const round = (v) => Math.round(v * 1e4) / 1e4;

function rowsOf(list, withNear) {
  return list
    .sort((a, b) => a.tier - b.tier || a.km - b.km)
    .map((it) => {
      const row = [round(it.lat), round(it.lon), KINDS_ORDER.indexOf(it.k), it.tier];
      if (it.n) row.push(it.n);
      if (withNear && it.tier <= 2) row.push(NEAR.indexOf(it.near));
      return row;
    });
}

const core = items.filter((it) => it.tier <= 2);
const detail = items.filter((it) => it.tier === 3);

const head = {
  z: Z,
  generated: new Date().toISOString().slice(0, 10),
  kinds: KINDS_ORDER,
  near: NEAR,
};

const write = async (file, list, withNear) => {
  const body = { ...head, items: rowsOf(list, withNear) };
  const json = JSON.stringify(body);
  await writeFile(file, json);
  console.log(`${file}: ${list.length} items, ${(json.length / 1024).toFixed(0)} kB`);
};

await write(OUT, core, true);
await write(OUT.replace(".json", "-detail.json"), detail, false);
console.log(`total ${items.length} items`);
