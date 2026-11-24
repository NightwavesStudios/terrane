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
need a dev server. It prints a per-level table, for example:

```
z11: 53/53 settled, loaded true, on-screen native true, 0 open, first frame 2164 ms, wall 12.4 s
  z9: done:native ×7
  z10: done:native ×10, reuse:native:from10 ×3
  z11: done:native ×13, reuse:native:from11 ×5
  z12: done:native ×6, reuse:native:from12 ×2
```

Dumps land in `bench-samples/` (`ledger-z11-live.json` is the rolling read,
`ledger-z11.json` the final one). Both are ignored by git.

## What the states mean

- `done:native` — fetched and decoded at its own level.
- `reuse:native:from<z>` — an identical request already answered at the same
  level; the bitmap was copied.
- `done:resample` / `ancestor:from<z>` — a coarser surface, upsampled or
  cropped. Only legitimate at levels *behind* the camera.
- `queued` — the request has not finished. The dump keeps its `phase` field so
  a wedged request says which await it was sitting in.
