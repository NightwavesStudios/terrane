# Architecture

Terrane is a static React SPA around one MapLibre map. There is no server, no
database and no runtime API key in the browser; every data file is committed and
bundled or lazy-loaded with the app.

## Entry and routes

`src/main.tsx` mounts `App` and, on `/`, starts the `Globe` chunk early.
`src/App.tsx` keeps `Home` in the entry chunk and lazy-loads `Place`, `Lists`,
`Log` and `Experience`, so a deep link to a list or a place never downloads
MapLibre.

`src/lib/router.ts` parses real paths with the History API. `navigate()` pushes a
path and notifies subscribers; `popstate` is handled. The product has three
surfaces:

- `/` — the globe, with three lenses (Peaks, Places, All), the list lens,
  search, layers and the peak card.
- `/lists` and `/lists/:id` — the sourced peakbagging ledger.
- `/log` — the local bagged/wanted log, notes, custom ascents and JSON
  export/import.

Detail routes are `/place/:slug` and `/experiences/:slug`. `/?place=<slug>`
opens a place card, `/?guide=<slug>` opens a curated detail card and
`/?list=<id>` opens the list lens and flies to the list's region. The old
`/summits*` and `/saved` paths alias Lists and Log. The removed `/coverage`,
experiences index and `/collections*` catalogue permanently redirect to the
globe: `vercel.json` answers them before the SPA rewrite, and `redirectFor()` in
`src/lib/router.ts` repeats the redirect for any other host. There is no router
dependency.

## Lists and the personal log

`src/data/summits.ts` is the committed ledger: four complete club lists (Georgia
4,000, New Hampshire 48, Adirondack 46ers and Colorado 14ers), 184 peaks, each
with published elevation, membership, source and, where available, a real place
slug. A peak without a place record has no coordinate; the UI never invents one.
Each list also carries an editorial `center` and `zoom` for “show this region on
the globe”.

`src/lib/log.ts` is `terrane.log.v2`, one versioned `localStorage` list of
bagged and wanted entries. Keys are canonical: `peak:<list>/<slug>`,
`place:<slug>`, `pin:<lat>,<lon>` or `custom:<id>`. It migrates the old summit,
saved-place and saved-guide keys once, then removes them. Reads and writes are
guarded, rows are validated, and the store is capped. Dates, notes and custom
ascents are edited on `/log`; JSON export/import is the backup. There is no
account and no sync.

`src/lib/logTargets.ts` turns a list row or a map pick into a log target.
`src/components/LogActions.tsx` and `WantButton.tsx` are the only personal
controls. A wanted entry can become bagged; a bagged entry cannot be silently
downgraded.

## Curated Experiences

The frozen editorial list is `src/data/guide-selection.json`;
`scripts/build-guide.mjs` builds only those slugs into `src/data/guide-index/`
(`catalog.json`, one hash-bucket shard per record and `meta.json`). A detail page
loads the catalogue and one shard (`src/lib/guide.ts`) and adds
`components/guide/GuideMap.tsx` for the selected destination and its recorded
neighbours. A page has one real destination, associated places within 30 km,
credited photographs, official/Wikipedia links and the six-kind classification.
It does not claim access, facilities, closures or a route.

The curated records survive as individual detail pages and as markers on the
globe. There is no separate browse screen for them.

## Map

| File | Responsibility |
| --- | --- |
| `src/map/style.ts` | The full MapLibre style spec, generated world-latitude bands, sources and static layers. `createStyle()` returns a clone because MapLibre mutates the spec. |
| `src/map/Globe.tsx` | Owns one `Map`, adds runtime layers idempotently, handles pick/hover, the selected-area ring, camera focus (a bounded 850 ms ease), pitch, shareable view, the 3D mesh and the stalled-state message. |
| `src/map/destinations.ts` | Atlas + Wikidata long tail in one GeoJSON source; seven dot bands and seven label bands from `bands.json`. |
| `src/map/log.ts` | The reader's bagged (warm) and wanted (cool) rings, filtered by state, with only entries that have a real coordinate. |
| `src/map/listed.ts` | Gold rings for listed summits that have a real place page. |
| `src/map/dem.ts` | `terranedem://` protocol: worker fetch, decode, resample, transfer an `ImageBitmap`; main-thread fallback. |
| `src/map/demPipeline.ts` | The elevation pipeline and provider fallback. |
| `src/map/contours.ts` | Client-side marching squares in a blob worker, capped by tiles, levels, segments and time. |
| `src/map/camera.ts` | `worldZoom`, category focus and pitch, with no MapLibre import so pages can size the opening camera cheaply. |
| `src/map/experiences.ts` | Curated Experience source, halo/ring/dot/label layers, selection of associated places and the selected place pins. |
| `src/lib/guide.ts` | Lazy curated catalogue/shard access. |
| `src/lib/placePages.ts` | Atlas-immediate / reach-sharded page lookup. |
| `src/lib/placeDetails.ts` | Lazy detail shard, thumbnail width cap and description formatting. |
| `src/lib/log.ts` | The one personal log, migration, stats and export/import. |
| `src/lib/lastView.ts` | The last settled globe camera, for a place page's back link. |

Runtime layers are added by `ensureRuntimeLayers` after `style.load`, and again
after `styledata`, because a style rebuild drops them. Every `add*` function is
idempotent. Map teardown resets the destination and Experience caches and
disposes the contour worker.

The style also carries the non-point visual layers: park and reserve polygons
from the basemap's own `park` tiles, a hypsometric tint under the hillshade, the
full settlement label ladder (country → state → city → village → hamlet) and road
names. The hillshade and the 3D mesh share the one `relief` DEM source.

## Data flow

```
Wikidata ──► src/data/atlas.json, reach.json, reach-more.json
Wikidata/Commons ──► src/data/place-details/
build-place-index.mjs ──► src/data/place-index/
build-guide.mjs ──► src/data/guide-index/
        │
        ├─ build-manifest.mjs ──► src/data/manifest.json
        └─ validate-data.mjs ──► validation block in the manifest

src/data/*.json ── vite build ──► dist/ + sitemap + robots
```

The atlas and famous long tail are bundled. The rest of the reach tail and the
page/detail shards are lazy.

## One model

`src/data/features.ts` defines `FeatureRow` and `Pick`. A peak, a park and a lake
are one shape with a `cat`, and one `FeatureCard` renders every pick. A `Pick`
may also carry its sourced list membership, which the card turns into a list
badge and the log turns into a peak target. Categories live in
`src/data/categories.json`; style expressions are built from that list so a dot
colour and label cannot drift.

Ranking is deterministic: `src/data/rank.ts` sorts by importance (height for a
peak, a fixed share for a park or landmark) and assigns a band with per-grid
quotas of 1/z4, 2/z5 and 6/z6. The world view is therefore a world view, not the
Himalaya. Provenance (`src`, `quality`) survives but never decides prominence.

## State and storage

- React state for the selected lens, pick, camera focus, list lens and layers.
- `localStorage` holds `terrane.log.v2` (bagged and wanted entries, dates, notes,
  custom ascents) through `src/lib/log.ts`. The old summit/saved keys are
  migrated once and removed.
- `sessionStorage` holds the last globe camera (`src/lib/lastView.ts`).
- Module-level caches hold the reach chunks and the loaded page/detail/guide
  shard; teardown resets the map-side ones.
- No account and no server: the log does not follow the reader to another
  browser.

## Invariants

1. One feature model, one card, one click path.
2. Every category has a colour and at least one record; `validate` fails
   otherwise.
3. No two destination rows within 50 m unless the merge is documented in
   `src/data/atlas-merges.json`.
4. The manifest totals must agree with the files.
5. Generated files are committed as data: the manifest, atlas, reach data, place
   details, the curated catalogue and its shards, and the source verification
   artifact.
6. A place page renders from the page index; the detail shard is optional and a
   failure leaves the page intact.
7. Every detail image carries a credit and a licence; an uncredited image fails
   validation.
8. A listed summit without a real place record is still a list row, but never a
   map point.
