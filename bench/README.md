# DEM ledger

Text evidence for terrain-tile selection: which level each elevation tile was
answered from, at a settled camera. A tile drawn at the camera's level or one
deeper that was answered by a coarser surface is the mixed-resolution edge the
terrain seam is built on, so the check asserts those two levels are native and
nothing else.

No screenshots. The page keeps a per-request ledger in `window.__demLedger`
(bench builds only), and this harness reads it while the view settles, writing
the latest read to disk every 250 ms so a renderer that dies mid-settle still
leaves its last state behind.

## Setup

```bash
npm ci
npm i -D playwright && npx playwright install chromium   # or export CHROME_PATH=...
```

Playwright is deliberately not a dependency of the app; the harness is the only
thing that needs it. On a machine with no GPU, add `--swiftshader` (much slower,
timings not comparable to hardware).

## Run

```bash
VITE_BENCH=1 npx vite build        # the bench globals are compiled out of a normal build
npm run bench:deep                 # z9, z10 and z11, exits 1 on a seam
npm run bench:ledger -- --zoom 12.49 --lat 36.126 --lon -81.768 --pitch 65.5
```

`npm run bench:deep` serves `dist/` itself on a loopback port, so it does not
need a dev server. It prints a per-level table and the rasteriser it measured,
for example:

```
z11: 53/53 settled, loaded true, on-screen native true, 0 open, first frame 2164 ms, wall 12.4 s
  z9: done:native ×7
  z10: done:native ×10, reuse:native:from10 ×3
  z11: done:native ×13, reuse:native:from11 ×5
  z12: done:native ×6, reuse:native:from12 ×2
```

Dumps land in `bench-samples/` (`ledger-z11-live.json` is the rolling read,
`ledger-z11.json` the final one). Both are ignored by git.

## When a page stops answering

A page that ignores `evaluate` is not automatically a wedged renderer, so the
harness probes the browser around it before calling it one:

- `browser:` — still connected? CPU per process over a one-second window.
- `second page:` — a fresh tab in the same browser: did it open, did script run
  in it, and did a synchronous 1×1 WebGL readback complete? Script answering
  means the browser and a new renderer are fine; the readback answering means
  the shared GPU process is fine too.
- `⇒` — the verdict that follows from those three.
- `rasteriser:` — the WebGL renderer string, so "it was SwiftShader" is a
  measurement rather than an assumption.

`--probe-app` also loads the deep view in the probe tab (does a fresh page still
settle?), `--probe-close` probes once after the deep page has closed and before
the browser is asked to exit (is a slow close a dead browser or just a slow
shutdown?), and `--close-wait <s>` sets how long the browser gets to exit
(default 15). A close that misses the deadline is a warning, not a failed
check: the ledger it reports had already settled, so the exit code stays about
the DEM selection.

What this looks like on a 2-vCPU box with no GPU: at z11 the software
rasteriser uses 0.9–2.0 s of CPU per second, and with only two cores the
renderer plus GPU process consume almost both. Under that load CDP and a new
tab can miss an 8 s deadline while the browser is still connected, and the
browser can take 15–20 s to exit; given the time it does exit. That is CPU
starvation from software rendering, not a page deadlock, and it is why the
probe reports process CPU and the renderer name instead of only a timeout.

`--demcontrol` replaces every DEM tile with a 4×4 plate (bench build only):
same tile count and terrain mesh, no fetch, decode or encode. Run the same view
with and without it before blaming the DEM pipeline for a stall.

## What the states mean

- `done:native` — fetched and decoded at its own level.
- `reuse:native:from<z>` — an identical request already answered at the same
  level; the bitmap was copied.
- `done:resample` / `ancestor:from<z>` — a coarser surface, upsampled or
  cropped. Only legitimate at levels *behind* the camera.
- `queued` — the request has not finished. The dump keeps its `phase` field so
  a wedged request says which await it was sitting in.
