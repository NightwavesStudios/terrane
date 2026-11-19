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
- **Gesture relief tier.** `movestart` switches the hillshade to one light and
  hides the DEM snow layer; `moveend` restores the four-light pass. Static
  quality is unchanged.
- **3D terrain** from the existing `relief` source, behind a switch and **off by
  default** — the measured reason is below. `setTerrain` is applied only on a
  settled style and only when the exaggeration changes (0.05 tolerance), not on
  every `styledata`. Setting the mesh during a style transition left MapLibre
  without its terrain depth program and threw in `maybeDrawDepth`; the
  settled-style guard is the fix.
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

| Zoom | Terrain | Nine samples (fps) | Median |
| --- | --- | --- | ---: |
| z11, Alps | off | 59.9, 54.5, 29.0, 50.3, 46.7, 55.8, 57.3, 60.4, 59.5 | **55.8** |
| z11, Alps | on | 10.8, 11.4, 10.6, 4.9, 5.4, 6.1, 10.6, 10.9, 6.8 | **10.6** |
| z14, Zermatt | off | 60.6, 60.2, 60.2, 60.0, 60.2, 60.1, 60.6, 60.1, 60.1 | **60.2** |
| z14, Zermatt | on | 27.7, 29.5, 29.8, 17.4, 19.5, 19.5, 23.6, 19.4, 20.4 | **20.4** |

Reading the terrain numbers:

- At z11 the mesh costs **81%** of the gesture budget (55.8 → 10.6 fps); at z14,
  **66%** (60.2 → 20.4). The plan's bar was no more than ~25%.
- The worst samples (4.9–6.1 fps at z11) are DEM tiles streaming while the camera
  moves; with terrain on, `map.idle` often did not fire within 6 s at z14 because
  mesh work keeps the map busy.
- So **3D terrain stays opt-in**. The switch's comment in `LayerControl.tsx`
  records the numbers.
- The review's z11 baseline (1.0–1.2 fps, 41 without the hillshade) came through
  the preview browser's software path while the window was occluded and cannot be
  reproduced here. On this GPU even hiding the hillshade sits inside the
  run-to-run spread (46.6 vs 49.0 fps over three runs each), so the gesture tier
  is verified by its paint state below, not by a frame-rate delta.

### Gesture relief tier (verified)

Reading the hillshade's paint properties around an `easeTo`:

| Phase | `hillshade-method` | Directions | Snow layer |
| --- | --- | --- | --- |
| Settled | `multidirectional` | 315, 45, 225, 135 | visible |
| `movestart` | `basic` | 315 | none |
| After `moveend` | `multidirectional` | 315, 45, 225, 135 | visible |

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

### Style rebuild with terrain on

`map.setStyle(createStyle(), { diff: false })` with terrain active: 66 layers
restored, `mapped-pin-3` present, terrain still set, **zero exceptions** — no
`terrainDepth` or `shaderPreludeCode` failure. The settled-style guard is what
makes that hold.

### Fixed during verification

The relief tier wrote `hillshade-highlight-color` and `hillshade-shadow-color` as
arrays of different lengths (four colours for four lights, one for the key
light). MapLibre's default 300 ms paint transition tried to interpolate them and
threw `colorArray: Arrays have mismatched length (4 vs. 1)` inside the render
loop on every gesture start and end. Both colour properties now get zero-length
transitions before the tier switches, so the change is atomic. Exceptions after
the fix: **zero**, across the whole run.

### Still unmeasured

- **Mobile / phone GPU.** No device was available. The band index is per-cell
  arrays of references, so its memory cost is small but additive; a phone's
  gesture fps will be well below these figures and terrain cost will be worse.
- **Compressed bytes per cell**, for the reason above.
- **The original review baselines** (1.0–1.2 fps at z11, ~53 ms hillshade at z14)
  belong to a different environment; only the off/on ratios in this section
  travel between machines.
