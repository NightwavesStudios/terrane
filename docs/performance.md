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
