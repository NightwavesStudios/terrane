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
import { execFileSync } from "node:child_process";
import { cpus } from "node:os";
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
/** How long the browser gets to exit before it is called wedged. Slow exits
 *  are themselves a result on a software rasteriser; the default is a bound,
 *  not a verdict. */
const CLOSE_WAIT_MS = num("close-wait", 15) * 1000;
const BOOT_TIMEOUT_MS = 45_000;
const SWIFTSHADER = Boolean(flag("swiftshader", false));
const CHECK = Boolean(flag("check", false));
/** Replace every DEM tile with a 4×4 plate (bench build only). Same tile count,
 *  same terrain mesh, no fetch/decode/encode: the control for “is this the
 *  rasteriser or our DEM work”. */
const DEM_CONTROL = Boolean(flag("demcontrol", false));
/** Load the app again in the probe tab. Slower, but it separates “this page's
 *  renderer is wedged” from “this browser can no longer run this app at all”. */
const PROBE_APP = Boolean(flag("probe-app", false));
/** Probe once more after the deep page has closed, before the browser is asked
 *  to exit: proves whether a slow close is a dead browser or a shutdown that
 *  will not finish. */
const PROBE_CLOSE = Boolean(flag("probe-close", false));
const ZOOMS = CHECK
  ? [9, 10, 11]
  : String(flag("zoom", "11"))
      .split(",")
      .map(Number);
const TAG = String(flag("tag", CHECK ? "deep" : `z${ZOOMS[0]}`));

const urlFor = (zoom) =>
  `http://127.0.0.1:${PORT}/?at=${LAT},${LON},${zoom}${DEM_CONTROL ? "&demcontrol=1" : ""}`;

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

const PROBE_WAIT_MS = 8000;
const CORES = cpus().length;

/** Which rasteriser this browser is really using. A headless run on a machine
 *  with no GPU renders through SwiftShader even without `--swiftshader`, so the
 *  name belongs in the dump rather than in an assumption. */
const gpuNameInPage = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return null;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return String(name);
};

/** What a fresh page in the same browser can still do.
 *
 *  Runs INSIDE the probe tab: script answering at all means its renderer's main
 *  thread is fine; a WebGL context plus a synchronous 1×1 readback means the
 *  browser's one shared GPU process is still drawing. Both are things the
 *  wedged page cannot tell us, because asking it anything is what stopped. */
const secondPageProbe = () => {
  const t0 = performance.now();
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  let renderer = null;
  let readMs = null;
  let glError = null;
  if (gl) {
    try {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const drewAt = performance.now();
      gl.clearColor(0, 1, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      /* A readback is a synchronous round trip to the GPU process. A GPU that
         has stopped answering hangs HERE, on a thread that already answered. */
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      readMs = Math.round(performance.now() - drewAt);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (err) {
      glError = String(err);
    }
  }
  return {
    answerMs: Math.round(performance.now() - t0),
    webgl: gl ? (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext ? "webgl2" : "webgl1") : null,
    renderer,
    readMs,
    glError,
  };
};

/** Load the deep view in the probe tab and wait for it to settle. */
async function probeAppIn(page, zoom) {
  const started = Date.now();
  await page.goto(urlFor(zoom), { waitUntil: "load", timeout: 30_000 });
  for (;;) {
    let state;
    try {
      state = await withTimeout(
        page.evaluate(() => {
          const ledger = Array.isArray(window.__demLedger) ? window.__demLedger : null;
          return {
            firstFrame: window.__terraneFirstFrame?.ms ?? null,
            ledger: ledger ? ledger.length : null,
            open: ledger ? ledger.filter((entry) => entry.state === "queued").length : null,
            loaded: (() => {
              try {
                return window.__terraneMap?.getSource("relief")?.loaded() ?? null;
              } catch {
                return null;
              }
            })(),
          };
        }),
        PROBE_WAIT_MS,
        "the app in the second page",
      );
    } catch (err) {
      return { failed: String(err).split("\n")[0], ms: Date.now() - started };
    }
    const settled = state.ledger !== null && state.open === 0 && state.loaded === true;
    if (settled) return { ...state, ms: Date.now() - started };
    if (Date.now() - started > 30_000) return { ...state, ms: Date.now() - started, timedOut: true };
    await page.waitForTimeout(500);
  }
}

/** Per-process CPU over one second, sampled through CDP.
 *
 *  A renderer at 0 ms/s has its main thread blocked off-CPU; one near 1000 ms/s
 *  is spinning. The gpu-process row is the one that says whether a rasteriser
 *  is still working through a queue. */
async function processTable(browser) {
  let cdp = null;
  try {
    cdp = await withTimeout(browser.newBrowserCDPSession(), 4000, "a CDP session");
  } catch (err) {
    return { error: String(err).split("\n")[0] };
  }
  try {
    const read = async () => {
      const { processInfo } = await withTimeout(cdp.send("SystemInfo.getProcessInfo"), 4000, "the process list");
      return processInfo;
    };
    const before = await read();
    const sampledAt = Date.now();
    await new Promise((done) => setTimeout(done, 1000));
    const after = await read();
    const windowMs = Math.max(1, Date.now() - sampledAt);
    const previous = new Map(before.map((entry) => [entry.id, entry.cpuTime]));
    return after
      .map((entry) => ({
        type: entry.type,
        cpuMsPerSec: Math.round(((entry.cpuTime - (previous.get(entry.id) ?? entry.cpuTime)) * 1000 * 1000) / windowMs),
      }))
      .sort((a, b) => b.cpuMsPerSec - a.cpuMsPerSec);
  } catch (err) {
    return { error: String(err).split("\n")[0] };
  } finally {
    /* Even detaching has to be bounded: this is a browser that may be wedged. */
    await withTimeout(cdp.detach(), 3000, "the CDP session").catch(() => {});
  }
}

/** Ask the browser around the wedged page what is still working.
 *
 *  Three failures look identical from the deep page alone (it answers nothing),
 *  and they have different owners: its renderer wedged (main thread blocked;
 *  browser process and other tabs fine), the shared GPU/SwiftShader process
 *  wedged (script runs, drawing does not), or the browser process is gone (no
 *  new tabs at all). Each step below is separately timeout-guarded so a probe
 *  that hangs is itself an answer instead of a second hang. */
async function probeBrowser(browser, zoom) {
  const probe = { connected: browser.isConnected(), pages: null, processes: null, secondPage: null, app: null };
  if (!probe.connected) return probe;
  probe.pages = browser.contexts().flatMap((context) => context.pages().map((page) => page.url()));

  probe.processes = await processTable(browser);

  let page = null;
  const openedAt = Date.now();
  try {
    page = await withTimeout(browser.newPage({ viewport: { width: 480, height: 320 } }), PROBE_WAIT_MS, "a second page");
    const openedMs = Date.now() - openedAt;
    const answer = await withTimeout(page.evaluate(secondPageProbe), PROBE_WAIT_MS, "script in a second page");
    probe.secondPage = { openedMs, ...answer };
    if (PROBE_APP) {
      /* Separate from the page probe: the tab answering and the app in it
         settling are different questions, and one failing must not erase the
         other's answer. */
      try {
        probe.app = await probeAppIn(page, zoom);
      } catch (err) {
        probe.app = { failed: String(err).split("\n")[0] };
      }
    }
  } catch (err) {
    /* Only the tab that never opened, or the script that never ran, lands here. */
    probe.secondPage = { ...(probe.secondPage ?? { openedMs: Date.now() - openedAt }), failed: String(err).split("\n")[0] };
  } finally {
    if (page) await withTimeout(page.close(), 5000, "closing the second page").catch(() => {});
  }
  return probe;
}

function describeProbe(probe) {
  const lines = [];
  if (!probe.connected) {
    lines.push("  browser: DISCONNECTED — the browser process itself is gone");
    return lines;
  }
  const processes = probe.processes;
  const rows = Array.isArray(processes) ? processes : null;
  const cpu = rows
    ? rows
        .filter((entry) => entry.type !== "browser")
        .slice(0, 3)
        .map((entry) => `${entry.type} ${entry.cpuMsPerSec} ms/s`)
        .join(", ")
    : `unavailable: ${processes?.error ?? "?"}`;
  lines.push(`  browser: still connected, ${probe.pages?.length ?? "?"} page(s); CPU in a 1 s window: ${cpu || "none"}`);
  const second = probe.secondPage;
  if (!second) lines.push("  second page: not attempted");
  else if (second.failed) {
    const gpu = rows?.find((entry) => entry.type === "gpu-process");
    const load = gpu ? `, GPU ${gpu.cpuMsPerSec} ms/s on ${CORES} cores` : "";
    lines.push(
      second.openedMs != null
        ? `  second page: opened in ${second.openedMs} ms, then ${second.failed}`
        : `  second page: ${second.failed}`,
    );
    lines.push(
      probe.connected
        ? `  ⇒ the browser is connected but nothing in it ran within the deadline${load}: a browser-wide stall, not only this page's main thread`
        : "  ⇒ the browser process itself is gone",
    );
  } else {
    const draw =
      second.readMs != null
        ? `1×1 readback ${second.readMs} ms`
        : `no readback${second.glError ? ` — ${second.glError}` : ""}`;
    lines.push(
      `  second page: opened in ${second.openedMs} ms, script answered in ${second.answerMs} ms; ` +
        `${second.webgl ?? "no webgl"}${second.renderer ? ` (${second.renderer})` : ""}, ${draw}`,
    );
    if (second.readMs != null) {
      lines.push("  ⇒ the browser, its other renderers and its GPU process all still work: only the deep page's renderer is wedged");
    } else {
      lines.push("  ⇒ the browser and a fresh renderer work, but the shared GPU process does not draw: a GPU-process wedge");
    }
  }
  if (probe.app) {
    lines.push(
      probe.app.failed
        ? `  second page app: ${probe.app.failed}${probe.app.ms != null ? ` after ${probe.app.ms} ms` : ""}`
        : probe.app.timedOut
          ? `  second page app: did not settle in ${probe.app.ms} ms (${probe.app.open} open, first frame ${probe.app.firstFrame ?? "?"} ms)`
          : `  second page app: settled in ${probe.app.ms} ms, 0 open, first frame ${probe.app.firstFrame} ms`,
    );
  }
  return lines;
}

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
  let probe = null;
  let closeFailure = null;
  let cpuAtClose = null;
  let probeBeforeClose = null;
  let renderer = null;
  const started = Date.now();
  try {
    await page.goto(urlFor(zoom), {
      waitUntil: "load",
      timeout: 60_000,
    });
    let armed = false;
    for (;;) {
      try {
        sample = await withTimeout(page.evaluate(snapshotInPage), 8000, "the page");
      } catch (err) {
        crashed = String(err).split("\n")[0];
        /* The page stopped answering: ask the browser around it what still
           works, before this page is closed, so the answer describes the
           moment rather than a recovered state. */
        probe = await probeBrowser(browser, zoom);
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
      /* The plate control writes no ledger at all, so "no ledger" there means
         "nothing to be open", not "not started". */
      if (sample.loaded === true && open.length === 0 && (sample.ledger !== null || DEM_CONTROL)) break;
      if (Date.now() - started > TIMEOUT_MS) break;
      await page.waitForTimeout(250);
    }
    /* While the page is still open and has just settled: a GPU process still
       burning CPU here is a raster queue that has not drained, which is what
       makes the close hang (a sample taken after page.close() measures nothing
       — the browser is already tearing down and refuses CDP). */
    cpuAtClose = await processTable(browser);
    renderer = await withTimeout(page.evaluate(gpuNameInPage), 5000, "the GPU name").catch(() => null);
  } finally {
    /* A wedged renderer can make close() wait on the same dead main thread. If
       the page will not shut down, say so here: that is where a browser-level
       close hang starts, and swallowing it made the two look identical. */
    try {
      await withTimeout(page.close(), 8000, "the page");
    } catch (err) {
      closeFailure = String(err).split("\n")[0];
      console.log(`  page: ${closeFailure} — this renderer did not shut down`);
    }
  }

  /* Opt-in: the deep page is gone, the browser has not been asked to close
     yet. If this probe answers and close then stalls, the browser was alive
     at that moment and only its shutdown wedged. */
  if (PROBE_CLOSE && !crashed) probeBeforeClose = await probeBrowser(browser, zoom);

  const summary = summarise(sample ?? { ledger: [] }, zoom);
  const record = {
    tag: `z${zoom}`,
    camera: { lat: LAT, lon: LON, zoom, pitch: PITCH },
    wallMs: Date.now() - started,
    crashed,
    closeFailure,
    cpuAtClose,
    renderer,
    probe,
    probeBeforeClose,
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
  if (record.renderer) lines.push(`  rasteriser: ${record.renderer}`);
  if (record.crashed) lines.push(`  renderer: ${record.crashed}`);
  if (record.closeFailure) lines.push(`  page: ${record.closeFailure} (the renderer did not shut down)`);
  if (record.cpuAtClose) {
    const rows = Array.isArray(record.cpuAtClose) ? record.cpuAtClose : null;
    lines.push(
      `  cpu at settle: ${
        rows
          ? rows
              .filter((entry) => entry.type !== "browser")
              .slice(0, 3)
              .map((entry) => `${entry.type} ${entry.cpuMsPerSec} ms/s`)
              .join(", ") || "nothing running"
          : `unavailable: ${record.cpuAtClose.error ?? "?"}`
      }`,
    );
  }
  if (record.probe) lines.push(...describeProbe(record.probe));
  if (record.probeBeforeClose) {
    lines.push("  after the page closed, before asking the browser to exit:");
    lines.push(...describeProbe(record.probeBeforeClose).map((line) => `  ${line.trim()}`));
  }
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
/** Direct children of this process. The only long-lived one is the browser we
 *  launched, so this is a precise handle for it (no pattern matching). */
const browserChildren = () => {
  try {
    /* `ps` is itself a child of this process while it runs; filtering by
       command name keeps it out of the list of suspects. */
    return execFileSync("ps", ["-o", "pid=,comm=", "--ppid", String(process.pid)])
      .toString()
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/, 2))
      .filter(([pid, comm]) => pid && comm && !String(comm).startsWith("ps"))
      .map(([pid]) => Number(pid));
  } catch {
    return [];
  }
};
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
  /* A wedged browser can refuse to close, and Playwright waits for it without a
     deadline of its own. That is a browser-level wedge and worth saying out
     loud; the kill is by this process's own child PID, so nothing else is hit. */
  try {
    await withTimeout(browser.close(), CLOSE_WAIT_MS, "the browser");
  } catch (err) {
    const children = browserChildren();
    console.log(
      `  browser: warning — ${String(err).split("\n")[0]} — ` +
        (children.length
          ? `the browser process is still there (${children.join(", ")}); killing it so the run ends`
          : "no browser process is left; its exit event never reached the harness"),
    );
    for (const pid of children) {
      /* What the browser's own children are doing at the moment it refuses to
         exit: a GPU process still burning CPU is a rasteriser that never
         drained, not a page waiting on an answer. */
      try {
        const detail = execFileSync("ps", ["-o", "pid=,pcpu=,rss=,stat=,args=", "--ppid", String(pid)])
          .toString()
          .trim();
        const rows = detail ? detail.split("\n").map((line) => `    ${line.trim().slice(0, 150)}`) : [];
        console.log(`  browser ${pid} children:${rows.length ? "" : " none"}`);
        for (const row of rows) console.log(row);
      } catch {
        /* no process to describe */
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
    /* Not a band failure: the ledger had already settled, every on-screen tile
       was native, and this is the browser's shutdown. The exit code is about
       the DEM selection; the warning says the browser had to be killed. */
  }
  server.close();
}
process.exit(failed ? 1 : 0);
