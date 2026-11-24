#!/usr/bin/env node
/**
 * Settle a deep view and dump the DEM ledger as text.
 *
 * The question this answers: of the elevation tiles MapLibre asked for, which
 * were answered by their own level and which by a coarser surface standing in?
 * A mixed answer on screen is the terrain seam, so the check is a table of
 * states, not a screenshot — no pixel capture is involved anywhere here.
 *
 * Usage
 *   npm run build:bench              # dist with the bench globals compiled in
 *   npm run bench:serve &            # or let this script serve it (default)
 *   npm run bench:ledger -- --zoom 11
 *   npm run bench:deep               # z9, z10, z11 in one pass, fails on a seam
 *
 * Playwright is not a dependency of the app: install it where this runs
 * (`npm i -D playwright && npx playwright install chromium`), or point
 * CHROME_PATH at any Chromium. `--swiftshader` is for machines with no GPU:
 * it is slower and its timings are not comparable to a hardware run.
 */

import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const next = args[at + 1];
  return next && !next.startsWith("--") ? next : true;
};
const num = (name, fallback) => {
  const value = flag(name, undefined);
  return value === undefined ? fallback : Number(value);
};

const DIST = resolve(String(flag("dist", "dist")));
const OUT = resolve(String(flag("out", "bench-samples")));
const PORT = num("port", 3111);
const LAT = num("lat", 36.126);
const LON = num("lon", -81.768);
const PITCH = num("pitch", 62);
const TIMEOUT_MS = num("timeout", 240) * 1000;
const BOOT_TIMEOUT_MS = 45_000;
const SWIFTSHADER = Boolean(flag("swiftshader", false));
const CHECK = Boolean(flag("check", false));
const ZOOMS = CHECK
  ? [9, 10, 11]
  : String(flag("zoom", "11"))
      .split(",")
      .map(Number);
const TAG = String(flag("tag", CHECK ? "deep" : `z${ZOOMS[0]}`));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".pbf": "application/x-protobuf",
  ".txt": "text/plain; charset=utf-8",
};

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.includes("..")) {
      res.writeHead(403).end();
      return;
    }
    if (path === "/" || path.endsWith("/")) path = join(path, "index.html");
    const file = join(DIST, path);
    const stream = createReadStream(file);
    stream.on("error", () => {
      /* Single-page app: an unknown path is the app, not a 404. */
      const shell = createReadStream(join(DIST, "index.html"));
      shell.on("error", () => res.writeHead(404).end("not found"));
      shell.on("open", () => res.writeHead(200, { "content-type": MIME[".html"] }));
      shell.pipe(res);
    });
    stream.on("open", () => {
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    });
    stream.pipe(res);
  });
  return new Promise((done) => {
    server.listen(PORT, "127.0.0.1", () => done(server));
  });
}

/** Everything the page knows about the DEM work, read in one synchronous pass. */
const snapshotInPage = () => {
  const scope = window;
  const ledger = Array.isArray(scope.__demLedger) ? scope.__demLedger : null;
  let loaded = null;
  let hasSource = false;
  try {
    const source = scope.__terraneMap?.getSource("relief");
    hasSource = Boolean(source);
    loaded = source ? source.loaded() : null;
  } catch {
    loaded = null;
  }
  return {
    at: Math.round(performance.now()),
    loaded,
    hasSource,
    firstFrame: scope.__terraneFirstFrame?.ms ?? null,
    projection: scope.__terraneFirstFrame?.projection ?? null,
    frames: scope.__terraneFrames ?? null,
    ledger: ledger
      ? ledger.map((entry) => ({
          z: entry.z,
          x: entry.x,
          y: entry.y,
          state: entry.state,
          phase: entry.phase,
          ms: entry.ms,
          at: entry.at,
        }))
      : null,
  };
};

/** Playwright has no default timeout on evaluate: a page that has stopped
 *  executing (a wedged renderer, not a crashed one) answers nothing and the
 *  poll hangs forever. That is a result, not a wait. */
const withTimeout = (work, ms, label) =>
  Promise.race([
    work,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} did not answer within ${ms} ms`)), ms);
      timer.unref?.();
    }),
  ]);

const ON_SCREEN = (zoom, z) => z === zoom || z === zoom + 1;

function summarise(sample, zoom) {
  const ledger = sample.ledger ?? [];
  const open = ledger.filter((entry) => entry.state === "queued");
  const byLevel = {};
  for (const entry of ledger) {
    const level = (byLevel[entry.z] ??= {});
    level[entry.state] = (level[entry.state] ?? 0) + 1;
  }
  const onScreen = ledger.filter((entry) => ON_SCREEN(zoom, entry.z));
  const violations = onScreen.filter((entry) => !/native/.test(entry.state));
  return { open, byLevel, onScreen, violations, total: ledger.length };
}

async function runZoom(browser, zoom) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const out = join(OUT, `ledger-${TAG === "deep" ? `z${zoom}` : TAG}-live.json`);
  let sample = null;
  let crashed = null;
  const started = Date.now();
  try {
    await page.goto(`http://127.0.0.1:${PORT}/?at=${LAT},${LON},${zoom}`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    let armed = false;
    for (;;) {
      try {
        sample = await withTimeout(page.evaluate(snapshotInPage), 8000, "the page");
      } catch (err) {
        crashed = String(err).split("\n")[0];
        break;
      }
      /* The bench globals only exist once the map has mounted and asked for
         its first tile; a `load` event is earlier than that. Waiting is the
         difference between "not started" and "not built for the bench". */
      armed ||= sample.ledger !== null || sample.hasSource;
      if (!armed) {
        if (Date.now() - started > BOOT_TIMEOUT_MS) {
          crashed = "no bench globals after boot — build with VITE_BENCH=1";
          break;
        }
        await page.waitForTimeout(250);
        continue;
      }
      /* The last good read is on disk before the renderer can die on us: a
         software rasteriser does that here, and the dump before the crash is
         the evidence. */
      writeFileSync(out, JSON.stringify({ ...sample, tag: `z${zoom}` }, null, 1));
      const open = (sample.ledger ?? []).filter((entry) => entry.state === "queued");
      if (sample.loaded === true && open.length === 0 && sample.ledger) break;
      if (Date.now() - started > TIMEOUT_MS) break;
      await page.waitForTimeout(250);
    }
  } finally {
    await page.close().catch(() => {});
  }

  const summary = summarise(sample ?? { ledger: [] }, zoom);
  const record = {
    tag: `z${zoom}`,
    camera: { lat: LAT, lon: LON, zoom, pitch: PITCH },
    wallMs: Date.now() - started,
    crashed,
    at: sample?.at ?? null,
    loaded: sample?.loaded ?? null,
    firstFrame: sample?.firstFrame ?? null,
    projection: sample?.projection ?? null,
    total: summary.total,
    settled: summary.total - summary.open.length,
    open: summary.open.length,
    byLevel: summary.byLevel,
    violations: summary.violations.map((entry) => `${entry.z}/${entry.x}/${entry.y}:${entry.state}`),
    ledger: sample?.ledger ?? [],
  };
  const final = join(OUT, `ledger-z${zoom}${TAG === "deep" ? "" : `-${TAG}`}.json`);
  writeFileSync(final, JSON.stringify(record, null, 1));
  return record;
}

function describe(record) {
  const lines = [];
  lines.push(
    `z${record.camera.zoom}: ${record.settled}/${record.total} settled, loaded ${record.loaded}` +
      `, on-screen native ${record.total ? record.violations.length === 0 : false}` +
      `, ${record.open} open, first frame ${record.firstFrame ?? "?"} ms, wall ${(record.wallMs / 1000).toFixed(1)} s`,
  );
  if (record.crashed) lines.push(`  renderer: ${record.crashed}`);
  for (const [level, states] of Object.entries(record.byLevel).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const text = Object.entries(states)
      .map(([state, count]) => `${state} ×${count}`)
      .join(", ");
    lines.push(`  z${level}: ${text}`);
  }
  const open = record.ledger.filter((entry) => entry.state === "queued");
  for (const entry of open) {
    lines.push(`  OPEN z${entry.z}/${entry.x}/${entry.y} phase=${entry.phase} since ${entry.at} ms`);
  }
  for (const violation of record.violations) lines.push(`  SEAM ${violation}`);
  return lines.join("\n");
}

const server = await serve();
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "playwright is not installed.\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "  or set CHROME_PATH to an existing Chromium binary.",
  );
  server.close();
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    ...(SWIFTSHADER
      ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
  ],
});

let failed = false;
try {
  for (const zoom of ZOOMS) {
    const record = await runZoom(browser, zoom);
    console.log(describe(record));
    if (record.violations.length > 0) failed = true;
    if (record.crashed) failed = true;
    if (record.loaded !== true || record.open > 0) failed = true;
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
process.exit(failed ? 1 : 0);
