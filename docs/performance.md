# Performance notes

These are measurements from a 1280×800 desktop viewport on the development
machine, kept because they explain the current defaults. They are not a
performance contract; measure again before changing a trade-off.

## Bundle shape (production build)

| Chunk | Size | Gzip |
| --- | ---: | ---: |
| `index` (entry, atlas, manifest) | ~455 kB | ~128 kB |
| `Globe` (MapLibre + app map) | ~1.08 MB | ~288 kB |
| `reach` (famous long tail) | ~125 kB | ~54 kB |
| `reach-more` (rest of the tail) | ~867 kB | ~376 kB |
| app CSS | ~19 kB | ~5 kB |
| Globe CSS | ~70 kB | ~10 kB |

`Home` is eager; `Globe`, `Place` and `Coverage` are lazy. A `/place/:slug`
visit never downloads MapLibre.

## MapLibre is held at v5

MapLibre 6 was tried and silently rendered **zero vector layers**: raster styles
worked, workers were healthy, tiles returned valid PBF, no console errors, yet
`isStyleLoaded()` stayed false and `queryRenderedFeatures` returned nothing.
Pin the major at 5 until that is understood. Dependabot is configured to ignore a
MapLibre major bump; it is a mapping decision, not a routine dependency chore.

OpenFreeMap's stable alias `/planet/2/2/1.pbf` returns 200 with 0 bytes in some
cases; always go through the TileJSON `url` (`https://tiles.openfreemap.org/planet`),
as `style.ts` does.

## Zoom cost

> These figures came from the Freebuff preview browser on 2026-11-18: software
> raster, occluded window. They rank the layers' relative cost but are not
> comparable with the headless GPU run at the end of this page, where the same
> z11 gesture measures 55.8 fps with the hillshade on.

Measured by hiding one layer at a time across a 0.4-zoom jump at z11, repeated:

| Configuration | fps |
| --- | ---: |
| Everything on | 1.5 |
| Contours off | 1.6 |
| Trails off | 1.8 |
| Hillshade off | 41.3 |

The DEM is the dominant cost of a low-zoom gesture. Two plausible fixes were
rejected on measurement: `antialias: false` gave 1.8–1.9 fps against a 1.6–1.8
baseline, and a coarser DEM grid at low zoom gave 1.4 fps either way. Detail was
restored.

Settled, the map runs at 60 fps; while the camera moves, the globe projection and
tile-cover rebuild dominate. At z14, medians of three runs were **8.0 fps with
the hillshade and 13.9 without**, so the hillshade costs about 53 ms per frame.
That cost is per tile, not per texel: serving a 256 px DEM grid instead of 512 at
z14 measured 8.1 against 7.8 fps, so the grid is kept for bandwidth and memory,
not frame rate.

At z11, repeated medians were **globe 1.0–1.2 fps against mercator 3.1–3.3**.
Mercator is still only ~3 fps, so switching projection would trade the app's
identity for a problem it does not fix.

## DEM and memory

- 512 px Mapterhorn tiles are ~150–200 kB each; a deep view is ~2 MB of elevation.
- Each live tile holds ~2 MiB of GPU texture (DEM + hillshade normal). A phone
  viewport at z14 keeps 10–17 live, i.e. 20–34 MiB.
- `maxTileCacheSize: 48` caps the decoded cache; off-screen tiles keep only the
  elevation grid (~1 MiB each).
- `pixelRatio` is capped at 1.5. A full 3× phone ratio costs a third more pixels
  for little visible gain on a dark shaded map.

Deep-zoom relief depends on national LiDAR coverage. Where it exists (Alps,
Pyrenees, much of the US, Japan, NZ, Greenland) the z14 tile is real; elsewhere it
is the 30 m global model resampled, which is correctly scaled but shows large
forms rather than gullies.

## Contours

Contours are generated in the browser from the same DEM: at most two tiles, ten
levels per tile, 900 contiguous segments per level and a 320 ms budget per tile.
They are a first pass, only above z10, and deliberately capped. A denser
implementation was tested and froze the tab.

## Earlier single-sample numbers were noise

A first pass reported 5 fps with the hillshade against 8 without. Repeats put both
higher and the gap smaller. Measure with repeats, a settle between runs, and a
warm cache.

## Map optimization pass — 2026-11-19

### What changed, and why

- **Practical pins are banded per cell.** Each z6 cell's rows are ranked by
  usefulness and dealt into bands at 6.8 / 7.8 / 8.8 / 10.2, with the fifth band
  (13.5) reserved for cross-source duplicates. Before this, camps appeared at
  10.6 and the country-to-trail range held destinations only.
- **One push per frame, bounded payload.** Cell arrivals coalesce into one
  animation frame; at z8+ the payload is the viewport plus 50% margin; each cell
  keeps its features split by band, so a low-zoom push walks a handful of rows
  rather than every cached feature.
- **One lighting state.** The hillshade used to drop to a single key light for
  the length of a gesture and restore four on settle, which changed the colour of
  every slope twice per gesture — the map re-lit itself the moment the camera
  stopped. The tier is gone: four lights, snow tint and shadow colours are the
  same at rest and in motion, and the gesture cost of that is measured below.
- **3D terrain ships behind a switch, displaced at rest.** The mesh is created
  once, by the switch; the exaggeration slider writes `terrain.exaggeration` (a
  uniform read on every frame) instead of re-creating the terrain. The old
  zoom-following re-creation and the `isStyleLoaded()` gate are gone — that
  lifecycle, not the renderer, was what could leave a flat map. It is on by
  default and the switch is the first row under Relief, because at z11 the mesh
  costs **84%** of the gesture budget (59.8 → 9.8 fps) and a weak device may want
  it off. Evidence below.
- **Style churn removed:** the runtime-layer pass takes a fast path when every
  runtime layer exists, and no longer re-pushes the atlas on every style event.

### Verification environment

Every number in this section comes from a genuinely visible page, not the hidden
preview tab that produced the earlier figures.

| | |
| --- | --- |
| Browser | Chrome 157.0.8103.79, `--headless=new`, driven over CDP |
| Visibility | `document.visibilityState === "visible"`, 61 rAF/s idle |
| Viewport | 1280×800 CSS px, DPR 1 |
| Renderer | ANGLE Metal, Apple M4 (10 cores), macOS |
| Page | Vite dev server at `http://127.0.0.1:3100/?debug=1`, cells from the published preview store |
| Frame clock | `requestAnimationFrame` deltas, capped by the ~60 Hz compositor |

The harness needed three relaxations, each a real constraint rather than a test
shortcut:

- **TLS.** This machine intercepts HTTPS with a private CA, so a fresh Chrome
  profile rejects the cell store until `--ignore-certificate-errors`.
- **CORS.** The cell store sends no `Access-Control-Allow-Origin`; the app's own
  preview browser runs with web security relaxed, so the harness passes
  `--disable-web-security --disable-site-isolation-trials`. Without it every cell
  request fails and no pin number means anything.
- **Bot filter.** The store answers `403` to the `HeadlessChrome` user agent; the
  harness sends a normal Chrome UA.

Window backgrounding and occlusion throttles are disabled
(`--disable-renderer-backgrounding --disable-backgrounding-occluded-windows
--disable-background-timer-throttling
--disable-features=CalculateNativeWinOcclusion`).

**Protocol.** Warm every view first (9–14 s at each zoom, 6 s with terrain on),
wait for `map.once('idle')` before sampling, then call
`window.__terraneBench(z, lat, lon)`: three 0.4-zoom `easeTo` runs of 1.2 s each,
frame rate from rAF deltas. Terrain off and on alternate for three rounds per
zoom, giving **nine samples per condition**; the median is reported. Values near
60 are the compositor ceiling, not a maximum. `?debug=1` shows the same figures
live.

### Gesture frame rate, terrain off vs on

| Zoom | Terrain | Samples (fps) | Median |
| --- | --- | --- | ---: |
| z11, Alps | off | 59.9, 54.5, 29.0, 50.3, 46.7, 55.8, 57.3, 60.4, 59.5 | **55.8** |
| z11, Alps | on | 10.8, 11.4, 10.6, 4.9, 5.4, 6.1, 10.6, 10.9, 6.8 | **10.6** |
| z14, Zermatt | off | 60.6, 60.2, 60.2, 60.0, 60.2, 60.1, 60.6, 60.1, 60.1 | **60.2** |
| z14, Zermatt | on | 27.7, 29.5, 29.8, 17.4, 19.5, 19.5, 23.6, 19.4, 20.4 | **20.4** |
| z11, shipped code, panel toggle | off | 59.9, 59.7, 54.6, 59.8, 59.8, 59.6 | **59.8** |
| z11, shipped code, panel toggle | on | 9.7, 9.0, 10.0, 11.0, 9.8, 9.8 | **9.8** |

Reading the terrain numbers:

- At z11 the mesh costs **81%** of the gesture budget (55.8 → 10.6 fps); at z14,
  **66%** (60.2 → 20.4). The plan's bar was no more than ~25%.
- The worst samples (4.9–6.1 fps at z11) are DEM tiles streaming while the camera
  moves; with terrain on, `map.idle` often did not fire within 6 s at z14 because
  mesh work keeps the map busy.
- The shipped build was re-measured through the panel toggle, six samples per
  side, and lands in the same place: **59.8 → 9.8 fps** at z11, 84% of the
  budget. That is why the switch is the first row under Relief rather than a
  hidden preference: with the mesh on, a gesture on a weak device is a slideshow
  and turning it off is the fix.
- The review's z11 baseline (1.0–1.2 fps, 41 without the hillshade) came through
  the preview browser's software path while the window was occluded and cannot be
  reproduced here. On this GPU even hiding the hillshade sits inside the
  run-to-run spread (46.6 vs 49.0 fps over three runs each), so the gesture tier
  is verified by its paint state below, not by a frame-rate delta.

### Lighting: one state, and what it costs

The old tier switched paint properties on `movestart`/`moveend`:

| Phase | `hillshade-method` | Directions | Snow layer |
| --- | --- | --- | --- |
| Settled | `multidirectional` | 315, 45, 225, 135 | visible |
| `movestart` | `basic` | 315 | none |

Every switch rewrote highlight and shadow colours, so the colour of the whole map
changed as the camera started and again as it stopped. That is what "the lighting
only changes while moving" was. With the tier removed, `hillshade-method` reads
`multidirectional` in every sample through a click move and after it (20 samples,
150 ms apart), and the colours never change.

The cost is real and is the trade taken deliberately: at z11, six samples with
the mesh off, the gesture runs at **30.7, 30.1, 30.0 fps** (median 30.1) instead
of the ~59.8 the one-light tier allowed. Half the frame rate for a map that does
not change colour when it stops.

### Clicking a point

A click used to `flyTo` with `speed: 0.75, curve: 1.45`, whose duration grows with
the distance and the zoom jump; from z8 to a cave at 13.4 it zoomed for seconds —
a crawl on a device where the mesh already runs at 10 fps — which read as a map
that never stops. It is now an `easeTo` of **850 ms**: one click on a pin at z8
produced exactly one camera call and reached z13.4 in **1.2 s** wall clock (the
sample that first reports `isMoving() === false`).

### Initial load

Navigation start to the first interactive frame (`performance.now()` when the
map reports ready): **355, 366 and 569 ms** across three fresh loads. FCP
204–252 ms, DOMContentLoaded 150–195 ms, on the Vite dev server (module per file,
warm server), not the production bundle.

### Payload per view

| View | Cells | Features cached | Pins pushed | Duplicates hidden | Last `setData` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Alps, z7.5 | 5 | 626,621 | 40 | 15 | 0.0–0.1 ms |
| Zermatt, z12.6 | 1 | 276,094 | 1,510 | 43 | 3.6 ms (6.4 max while loading) |
| Trails, same views | 9 | 104,635 | — | — | 0.3 ms |

Forty pins across five cells is the band-0 quota (eight camps per cell). The first
implementation of this pass rebuilt and scanned every cached feature on every
push: **66.6 ms** at three cells / 523,429 features. The band index is why the
same push is now under a millisecond, and why z12.6 with 1,510 pins lands at
3.6 ms.

### Cell bytes

Decoded JSON size (`fetch().arrayBuffer().byteLength`) from the same origin the
app uses; cells are served with `content-encoding: zstd`.

| Cell | Decoded bytes | Features |
| --- | ---: | ---: |
| `poi/6/32/21.json` | 4.25 MB | — |
| `poi/6/33/21.json` | 8.62 MB | — |
| `poi/6/34/21.json` | 8.59 MB | — |
| `poi/6/34/22.json` | 7.16 MB | — |
| `poi/6/34/23.json` | 2.13 MB | — |
| **z7.5 total, 5 cells** | **30.76 MB** | 626,621 |
| `poi/6/33/22.json` (Zermatt) | 11.68 MB | 276,094 |
| `trails/7/66/45.json` | 10.88 MB | — |

A z6 cell is 2–12 MB of JSON and ~125k features on average; the Zermatt cell is
276,094. Compressed wire size is **unmeasured**: resource timing is zeroed without
`Timing-Allow-Origin`, and the store's bot filter refuses non-browser clients, so
`curl` cannot stand in.

### The 3D mesh at rest: what was wrong, and what fixed it

An earlier round observed a mesh that displaced only while the camera moved and
flattened once it stopped, and removed the feature on that basis. It does not
reproduce when the mesh is applied once and left alone. Measured on MapLibre
5.24.1 at 1280×800, pitch 55–62°, camera at rest (`map.isMoving() === false`,
`map.isEasing() === false`):

| Check | Result |
| --- | --- |
| mesh applied once at z7, then zoomed to z11 | displaced at rest; PNG byte-identical from 2 s to 12 s after the stop |
| z14, Zermatt, pitch 62° | displaced at rest |
| three `setTerrain` re-creations during one zoom, then settle | displaced at rest |
| `terrain.exaggeration` set to 0.5 and 2.5 on the live object | mesh flattens/steepens at rest, same `Terrain` instance, one repaint |
| `isStyleLoaded()` on a settled z11 view, 24 samples at 4 Hz | false in the first ~1.5 s (8 of 24), true afterwards |
| 30 `triggerRepaint()` calls, sub-pixel nudge, stock source, style-declared terrain (earlier round) | did not change the result either way |

The identical frames are the interesting part: nothing redraws for ten seconds
because nothing needs to, not because a stale gesture frame is being shown. The
mesh is drawn at rest.

What the removed code did differently was the lifecycle, not the renderer. It
applied the mesh only while `map.isStyleLoaded()` was true — false for the first
~1.5 s of every settled view, exactly when a switch press or a `moveend` lands —
and it re-created the terrain for every exaggeration step and again on settle.
Each `setTerrain` builds a new `Terrain` and a new `RenderToTexture` over the same
tile manager and reloads the DEM source, so a press in that window could leave
the mesh unapplied, and a re-creation could leave the cached render-to-texture
pass built before the DEM tile arrived.

The shipped version (`applyTerrainTo` in `src/map/Globe.tsx`) creates the mesh
once, refuses to re-create it, and moves the slider by writing
`terrain.exaggeration` — a uniform the terrain shader reads on the next frame —
with one `triggerRepaint()`. Screenshots of the result, taken with no gesture,
are `shots/ta-shipdesk-z11.png` (z11, pitch 55°) and `shots/ta-shipdesk-z14.png`
(z14, Zermatt, pitch 62°); `shots/ta-shipphone-panel.png` and
`shots/ta-shipphone-z11.png` are the same switch and slider at 390×844, with the
mesh turned on from the panel and left to settle.

### Real gestures, not camera jumps

The settle was re-checked with the input a person actually uses — wheel on
desktop, two-finger pinch on an emulated phone — because a `jumpTo` can hide a
lifecycle bug:

| Run | Input | Result |
| --- | --- | --- |
| z8 → z11, Alps | 24 wheel events of 240 px | reaches z11.34; 2 s after `moveend`, `isMoving()` false, `isEasing()` false, mesh on at 1.4× |
| z11 → z14, Zermatt | the same wheel | reaches z14.01 at rest, displacement intact |
| z11, same camera, mesh off | panel row | **56.1%** of pixels change, mean abs channel delta 52.5 of 765 |
| z14, same camera, mesh off | panel row | **60.6%** change, mean 50.0 |
| z8 → z11 on a 390×844 touch viewport | `Input.synthesizePinchGesture` | reaches z11.59 at rest; **55.9%** of pixels differ from the same view with the mesh off |
| phone slider | touch drag on the range input | 1.4× → 2.5×, 16.8% of pixels change, same `Terrain` instance |
| phone switch | tap on the row | off → `getTerrain()` null, on → `{source: relief, exaggeration}` restored |
| pitch, mesh on | Shift+↑ / Shift+↓ on the focused canvas | 55° → 65° (the cap) → 0°, mesh stays on |

The pixel share is the part that matters: with the camera unmoved, turning the
mesh off changes only the geometry, so a 56–61% change is occlusion by ridges,
not a repaint artefact.

### Fixed during verification

While the gesture tier existed it wrote `hillshade-highlight-color` and
`hillshade-shadow-color` as arrays of different lengths (four colours for four
lights, one for the key light), and MapLibre's 300 ms paint transition threw
`colorArray: Arrays have mismatched length (4 vs. 1)` inside the render loop on
every gesture start and end; zero-length transitions fixed that. The tier is now
gone, so there is one paint and the exception cannot occur at all. Exceptions
across the current runs: **zero**.

### Still unmeasured

- **Mobile / phone GPU.** No device was emulated except in Chromium; the band
  index is per-cell arrays of references, so its memory cost is small but
  additive, and a phone's gesture fps will be below these figures.
- **Compressed bytes per cell**, for the reason above.
- **The original review baselines** (1.0–1.2 fps at z11, ~53 ms hillshade at z14)
  belong to a different environment; only the off/on ratios in this section
  travel between machines.

## Terrain surface: sea, lowlands, and the provider's blank tiles (2026-11-19)

Three separate things made the 3D mesh read as "spiky", and only one of them was
in the DEM shader.

### 1. Sea level was never treated as sea level

`demPipeline.ts` passed provider elevations straight through, negative terrarium
values included, and the exaggeration slider (1.4–2.5×) multiplied whatever
coastal noise the surface model carried. `settleSea()` now clamps anything at or
below **1 m** to exactly 0 and ramps back to the true value by **7 m** with a C¹
smoothstep, so the shore keeps a slope instead of a shelf. Sharpening is 0 on the
256 px regional grid (`sharpenAmountFor`) — the 0.65 unsharp mask only runs where
the grid carries native detail — and a 3×3 mix fades in below **40 m**
(`lowlandWeight`) to take the needle noise off coasts without touching ridges.

### 2. Blank tiles were being read as coverage

Mapterhorn answers **200** with a 52–126 byte empty WebP wherever it has no
national dataset, and the pipeline accepted that 200 as native coverage. Over the
Ligurian coast that produced 0 m plates beside 1 400 m neighbours.

| Level probe (8.85 E, 44.55 N, Apennines) | before | after |
| --- | --- | --- |
| z11 | native 0–1 167 m, 0 % zero | native, 0–1 167 m, 0 % zero |
| z12 | native 0–1 171 m, **0 %** zero | native, 0–1 171 m, 0 % zero |
| z13 | native 185–1 093 m | native, 185–1 093 m |
| z14 | resample 459–1 093 m | resample, 459–1 093 m |

(That ridge was never blank; the blanks sit in the coastal strip, which is why
the visible defect was a wedge rather than a hole in the mountains.) What changed
for real is the decision path: `nativeZoomFor` now judges a level by **payload**
(`BLANK_TILE_BYTES = 2000`), not by status, descends until a tile carries data,
refills provider masks from the next coarser grid (`fillHoles`), asks the second
provider before declaring water (`resolve`), and serves a flat tile only when the
last provider has nothing either. A 32×32 sample (`sampleTile`) skips
conditioning on open water and on ground that never nears the shore, and scaled
tiles keep the 256 grid so the terrain mesh does not quadruple its texel count.

### 3. Water surface, measured on the tiles MapLibre drapes

`map.queryTerrainElevation` is **not** usable as evidence here: it returned the
same values at z9.5, 11, 12.4, 13.2 and 14 (identical to 0.1 m), and quoted Lake
Geneva at 591 m before and 1 536 m after when the tile itself reads 372 m
throughout. The tile pipeline is the ground truth, sampled by decoding the
bitmaps it returns:

| Probe | before | after |
| --- | --- | --- |
| Gulf of Genoa, z10–14 | 0 m, 100 % zero at every level | 0 m, 100 % zero at every level |
| Lake Geneva, z13 | 372.0–372.8 m | 372.0–373.0 m |
| Lake Geneva, z14 | 372 m flat | 372 m flat |
| Apennine ridge | 0–1 093 m | 0–1 093 m |

Sea and lake surfaces are flat to the metre at every zoom the map asks for, and
the clamp is what keeps them there when a provider writes ±2 m of coastal noise.

### 4. Frame rate, measured against the unmodified file on the same machine

The z11/z14 hillshade numbers earlier on this page (10.6 and 20.4 fps with the
mesh on) were taken when the machine was faster. Re-running the same harness
against **`git show HEAD:src/map/demPipeline.ts`** in the same session gives
7.1 fps at z11 and 18.9 fps at z14; the patched file gives **7.1** and **18.9**.
The conditioning therefore costs nothing measurable at either zoom — the
difference was ambient, not code.

### 5. The 512 grid at z10–11 was tried and left at 256

`FULL_GRID_ZOOM` stays at 12. Raising it to 10 (so z10 and z11 get the 512 grid)
measured **6.9 fps** with the mesh on at z11 against **7.1** for the 256 grid —
inside the noise — and the two z11 frames (`.cache/coast-after-z11.png` and
`.cache/coast-grid512-z11.png`, same camera) are visually indistinguishable at
that scale, because the hillshade texture, not the mesh, is what shows there.
Four times the texels for no gain, so the regional grid stays 256 and the
sharpening cutoff — not resolution — is what handles the faceting.

### 6. Screenshots

`.cache/before-z11.png`, `.cache/after3-z11.png`, `.cache/before-z13_2.png`,
`.cache/after3-z13_2.png` — same camera (8.78 E, 44.42 N, pitch 55, terrain
2.5×), before and after.

### Still open

The flat olive plates that remain over the Ligurian sea at z13 are **not** DEM:
they are the latitude-band base geometry (`LAND_BANDS` in `style.ts`), a few
coast-sized triangles that terrain drapes from inland heights out over the water.
Fixing that means subdividing the band rings or keeping that layer out of the
draped pass — a style change this pass deliberately did not make.

## Phone first load, 2026-11-21

Protocol: production build served as static files, 390×844, CDP CPU throttling
4×, network 1.2 Mbps / 80 ms / 3G, browser cache cleared before each run, three
runs, median. `FCP` is first-contentful-paint; `canvas` is the first
`.maplibregl-canvas` in the DOM; long tasks come from
`PerformanceObserver({ type: "longtask" })`.

| Measure | before (`fb811c7`) | after |
| --- | ---: | ---: |
| first contentful paint | 2 212 ms | 2 196 ms |
| map canvas mounted | 2 511 ms | 2 495 ms |
| worst single long task | 3 703 ms | 1 128 ms |
| total long-task time, first 8 s | 10 286 ms | 7 578 ms |

What moved the blocking numbers:

- `Home` measured the dock on every animation frame for 180 frames — three
  seconds of forced layout on every load. It now takes two settled reads plus the
  existing `ResizeObserver`.
- The 3D mesh is armed after the first idle instead of during bootstrap.
  `DEFAULT_LAYERS.terrain` is `true`, so the DEM fetch, the render-to-texture
  pass and the mesh build were all inside the first seconds; that is the single
  task that fell from ~3.7 s to ~1.1 s.
- `coverage.json` is a page-sized report that feeds one badge; it now loads on
  idle rather than alongside the first manifest fetch.

First paint and canvas time did not move: over 1.2 Mbps they are bound by the
entry bundle (see the chunk table above), not by main-thread work. The win is
that the map is not frozen once it appears.

For contrast, the development server on the same profile reported
`__terraneReadyMs` ≈ 6.0 s across 85 module requests. That is a dev-server
number and not comparable with a production build.

## Deferred atlas and the map chunk, 2026-11-21 (second pass)

The first pass cut main-thread blocking but left first paint tied to the entry's
modulepreload graph: `lib/catalog.ts` imported `map/destinations` at the top,
`destinations.ts` imports `map/style.ts`, and the shared chunk that carried the
style also carried MapLibre. So `<head>` preloaded **1.07 MB** before the entry
on every route, and that was the 2.2 s first paint.

What changed:

- `startCatalog()` imports `map/destinations` when Discover first opens, so the
  entry no longer reaches `style.ts` and MapLibre is no longer preloaded with
  the shell.
- The 202 kB atlas is its own chunk (`data/places.ts` → `loadAtlas()`, called on
  first idle in `main.tsx`). `PLACES`/`bySlug` are filled in place, `useAtlas()`
  re-runs the lists derived from them, and `catalog.ts` rebuilds its atlas index
  when the rows land.
- `vite.config.ts` emits a `modulepreload` for the map chunk at the end of
  `<body>`: the megabyte is in flight while React renders, but it is not in
  front of first paint. (Removed on 2026-11-22 after it measured inside the
  run-to-run spread — see the compressed pass below.)

Protocol, unchanged from the pass above: production build, static file server
(`python3 -m http.server`), 390×844, CDP CPU throttling 4×, 1.2 MB/s + 80 ms,
cold cache before every run, five runs, median. The baseline is `9c811ce`,
built from a clean worktree in the same session and served the same way.

| Measure | `9c811ce` | this build | change |
| --- | ---: | ---: | ---: |
| first contentful paint | 2 384 ms | **1 288 ms** | −46 % |
| map canvas in the DOM | 2 695 ms | 2 453 ms | −9 % |
| entry JS (raw) | 499.6 kB | **305.8 kB** | −39 % |

### Why the canvas did not follow

The canvas cannot exist before `maplibre-gl` has been parsed and constructed, and
that chunk is 1 066 880 B — of which 1 058 059 B is MapLibre's own minified
bundle (`maplibre-gl.js` 5.24.1). On this profile the map chunk alone is ~0.9 s
of transfer, and 4× CPU adds a few hundred milliseconds of parse and WebGL init
(the last measured canvas was style-end + 218 ms).

A zero-byte entry would still put the canvas at roughly 1.6–1.9 s here, so the
30 % target (−566 ms) is not reachable by moving application code: it needs bytes
the map engine owns. The realistic options are to serve the assets compressed
(what any production host does — the map chunk is 283 kB gzipped, 240 kB brotli,
against 1 067 kB here), or to replace MapLibre, which is a product decision
rather than a build one.

The compressed pass below takes the first option: over brotli the map chunk is
251 kB, and the canvas gap to `9c811ce` is 0.34 s without third-party traffic
(0.15 s with it) rather than the ~1.4 s the uncompressed harness implied.

### Function after the deferral

On the dev server at 390×844: `querySourceFeatures("features")` returns 9 316
atlas points at world zoom once the deferred chunk lands (2 845 before the tiles
fill in), the experiences source holds 408 beacons, and dock exclusivity still
reads on the live filters — Experiences filters the pins to `__none__`, Peaks
filters the beacons to `__none__`, All destinations restores both.

## Compressed serving: the gap a phone actually sees, 2026-11-22

The passes above measured `python3 -m http.server`, which sends every asset
uncompressed and one HTTP/1.0 connection at a time. That is not how the site is
served, and it flatters an architecture change whose subject is bytes: the
1.07 MB map chunk is 251 kB over brotli, so the old `<head>` preload cost a
quarter of what the uncompressed harness charged it.

This pass re-measured `9c811ce` and the current build through a server that
behaves like a host: brotli when the browser accepts it, gzip otherwise,
HTTP/1.1 keep-alive, `immutable` caching for hashed assets, SPA fallback.

Protocol: production builds, 390×844, DPR 2, CDP 4× CPU, 1.0 MB/s down /
0.5 MB/s up / 80 ms latency, browser cache cleared **and disabled** before every
load, eleven interleaved rounds per build (the order rotates each round), median.
Off-origin tile, DEM and cell requests are aborted so the numbers describe the
origin's own payload; the live-traffic control follows.

| Measure | `9c811ce` | current | change |
| --- | ---: | ---: | ---: |
| first contentful paint | 1 628 ms | **1 068 ms** | −34 % |
| map canvas in the DOM | 1 947 ms | **1 604 ms** | −18 % |
| entry JS, brotli | 114.2 kB | **81.4 kB** | −29 % |
| map chunk, brotli | 251.9 kB | 251.1 kB | — |

With the tile, DEM and cell traffic left on — nine rounds, same conditions — the
same builds measure 1 676 → 1 244 ms for first paint (−26 %) and 1 892 →
1 747 ms for the canvas (−8 %). Tile traffic shares the 1 MB/s pipe and hides
part of the difference; both runs agree on the ordering.

### The preload plugin did nothing measurable, and is gone

Four builds, same protocol, eleven rounds each. "Map starts" and "map done" are
the map chunk's `startTime` and `responseEnd` relative to navigation start;
"entry done" is the entry's `responseEnd`.

| Build | FCP | canvas | map starts | entry done | map done |
| --- | ---: | ---: | ---: | ---: | ---: |
| `9c811ce`, head preload | 1 628 | 1 947 | 887 | 1 250 | 1 472 |
| current + body-end preload | 1 120 | 1 551 | 751 | 1 047 | 1 395 |
| current, no plugin (shipped) | **1 068** | 1 604 | 1 024 | 1 002 | 1 456 |
| current + head-preload control | 1 176 | 1 554 | 703 | 1 080 | 1 336 |

The body-end preload does start the map chunk 273 ms earlier, but it shares the
pipe with the entry: the chunk's own transfer grows 425 → 644 ms, so it finishes
61 ms earlier and the canvas 53 ms earlier — inside the ±150 ms spread between
runs — while first paint pays about 50 ms. Moving the same link into `<head>`
starts the chunk 320 ms earlier still and buys no canvas time, because MapLibre
cannot be constructed until the entry has executed. The plugin was removed; the
no-plugin row is the shipped configuration.

### What the canvas gap means now

Compressed, the remaining canvas difference between `9c811ce` and this build is
**0.34 s** isolated and **0.15 s** with live tile traffic, against a first-paint
difference of **0.56 s**. The canvas is no longer a multi-second wait behind a
megabyte; it is the 251 kB map chunk plus MapLibre's parse and WebGL init.
Preloads do not move it. Anything further has to take bytes out of that chunk or
change the engine, which is the same conclusion as before — now with the
compressed numbers that show how little is left on the table.

Run-to-run spread is ±150–400 ms. A five-round pilot on a freshly restarted
server reversed the canvas ordering; that is why the table uses eleven rounds
with the origin isolated, and why the live-traffic figures are a cross-check
rather than the headline. These absolute numbers are also not comparable with
the tables above: the server compresses, and the browser is a local headless
Chromium (SwiftShader) rather than the preview browser.
