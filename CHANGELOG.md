# Changelog

## 2026-11-25 — Search opens on a phone, and practical pins arrive sooner

- Fixed the phone stylesheet hiding the whole map tools stack while Discover was
  open. The panel is a child of that stack, so its own rule faded the field and
  the results to zero: below 900 px the search opened invisible and untappable.
  Only the two floating triggers step aside now.
- Practical pins start much earlier: camps at z6.2, huts, passes, caravans and
  trailheads at z7.2, every other practical family at 8.2, and the overflow band
  at 9.2. Per-cell quotas grew and the trim keeps half again as many rows.
- The quota is dealt across a cell's z9 sub-tiles, best row of each first, so a
  band covers the whole cell instead of clustering on its most famous corner;
  scrolling within a cell now meets new pins instead of the same handful.
- A settled view drains its remaining cells: when one cell finishes, the next
  visible one starts, instead of waiting for the reader to move the map again.
  A view wider than the three-cell pass fills completely.

## 2026-11-22 — The map preload that bought nothing, measured on a compressed host

- Removed the build plugin that appended a `modulepreload` for the map chunk to
  the end of `<body>`. Served compressed, it starts the chunk 273 ms earlier,
  but the chunk takes 219 ms longer to arrive, so it finishes 61 ms earlier and
  the canvas mounts 53 ms earlier — inside the run-to-run spread — while first
  paint pays about 50 ms. A head-preload control was no better.
- Measured both builds through a brotli/gzip server instead of an uncompressed
  one. Isolated from third-party tile traffic: first contentful paint
  **1 628 → 1 068 ms (−34 %)** and map canvas **1 947 → 1 604 ms (−18 %)**
  against `9c811ce`, medians of eleven cold runs at 390×844, 4× CPU,
  1 MB/s + 80 ms. With live tile traffic the same builds measure
  1 676 → 1 244 ms and 1 892 → 1 747 ms.
- The first-paint win survives compression; the remaining canvas gap is
  0.15–0.34 s, not the seconds the uncompressed harness implied.

## 2026-11-21 — A phone paints in half the time, and the atlas gets out of the way

- The entry no longer drags the map's style module into first paint.
  `lib/catalog.ts` imported `map/destinations` at the top, `destinations.ts`
  imports `map/style.ts`, and the shared chunk carrying the style also carried
  MapLibre — so `<head>` preloaded 1.07 MB before the entry on every route.
  `startCatalog()` now imports that module when Discover first opens.
- The 202 kB atlas is its own chunk. `loadAtlas()` fetches it on the first idle,
  `PLACES`/`bySlug` are filled in place, `useAtlas()` re-runs the lists derived
  from them, the catalog rebuilds its atlas index when the rows land, a
  `?place=` deep link is applied when they arrive, and Saved and the place
  resolver work from stored records until then.
- `vite.config.ts` emits a modulepreload for the map chunk at the end of the
  body, so the map download overlaps React's first render instead of following
  it — without sitting in front of first paint.
- Measured on a production build at 390×844, 4× CPU, 1.2 MB/s + 80 ms, cold
  cache, five runs, median, against `9c811ce` built in the same session:
  first contentful paint **2 384 → 1 288 ms (−46 %)** and entry JS
  **499.6 → 305.8 kB (−39 %)**. The map canvas went 2 695 → 2 453 ms (−9 %).
- The canvas did not follow because it cannot mount before MapLibre arrives: the
  map chunk is 1 067 kB and 1 058 kB of that is MapLibre itself. Hitting the
  −30 % target there means serving those bytes compressed (283 kB gzipped, as
  any real host would) or replacing the map engine — not moving app code.
- Function checked on the dev server after the deferral: 9 316 atlas points and
  408 beacons render at world zoom, and the dock still hides the pins for
  Experiences and the beacons for a kind.

## 2026-11-21 — The dock decides what the map shows; the map stops freezing

- The map dock leads with **Experiences**, and the strip is exclusive: picking
  Experiences hides the destination pins, picking a kind hides the curated
  beacons, and All destinations shows both. A location scope only narrows the
  pins. Checked in the browser against the live MapLibre filters — the layer that
  should be gone reads `__none__`.
- Every point got easier to see without changing the palette: destination dots
  ~20 % larger with a stronger ring and halo, practical pins 0.42 → 0.56 at
  their first zoom and 0.78 → 0.96 at z16, labels +1 px at full opacity, and the
  Experience beacons larger with a 1.9 px ring.
- Phone first load, measured on the production build under 4× CPU throttle and
  3G: the worst single blocking task fell from 3.7 s to 1.1 s and total blocking
  in the first 8 s from 10.3 s to 7.6 s. The dock no longer measures itself on
  180 animation frames, the 3D mesh is armed after the first idle instead of
  during bootstrap (`DEFAULT_LAYERS.terrain` is on, so the DEM fetch, the
  render-to-texture pass and the mesh built were all in the first seconds), and
  `coverage.json` waits for idle. First paint is unchanged — it is bundle-bound.

## 2026-11-21 — One navigation, one dock, one set of states

- Added `src/components/nav.ts`: the header and the phone tab bar now read one
  table of four destinations, and a place page belongs to Discover. Before, a
  place page highlighted no tab at all in the header.
- Renamed the map surface to **Discover** everywhere — the tab, the panel and
  the back link — instead of a Globe tab opening a Discover panel.
- Rebuilt the map's bottom bar as one dock: the visitor's own location is pinned
  first and never scrolls away, the destination kinds follow it in a row that
  scrolls by drag, swipe, trackpad or arrow key, and the strip never wraps, so
  `--filters-h` stops changing when a region name arrives. Under 620 px the strip
  and the tab bar share one edge and one width instead of floating as two pills
  of different sizes; the tablet strip matches the tab bar's width.
- Added `useScrollRow` (drag, edge fades, roving arrow keys) to the map dock and
  both catalogue chip rows, so a horizontal row is no longer a dead end for a
  mouse.
- Experiences and Collections share `CatalogControls`: one search field, one
  nearby-place combobox replacing a 1,213-option `<datalist>`, one chip row and
  one clear-filters action.
- Added `StateNotice` for loading, empty and error states, and used it for the
  lazy-route fallback (previously an empty div), both catalogues and the empty
  library.
- Place and Experience pages showed two differently labelled save controls; the
  hero owns the save now, and `BackLink`/`SaveButton` share the pattern.
- Saved is a real library: filter by kind, sort by recent or A–Z, multi-select
  and bulk remove, and a 7-second undo instead of an irreversible click.
- Layers gained an in-panel filter and a reset, and open from the dock's “All
  categories” chip.
- Accessibility and polish: `:focus-visible` on every interactive element (there
  was none outside the map canvas and two inputs), `role="listbox"`/`option`
  with `aria-activedescendant` in Discover, named z-index and motion tokens, a
  route fade, and raised contrast on the small mono chrome.

## 2026-11-21 — Experiences become curated destinations; Collections are separate

- Split the product into four tabs with distinct jobs: **Globe** (the full POI
  database), **Experiences** (curated individual destinations), **Collections**
  (generated thematic groups) and **Saved** (the personal library).
- Added a curated Experience catalogue of **183 destinations** across 47
  countries, frozen in `guide-selection.json` and built by `build-guide.mjs` from
  each place's own description, protected area, range, elevation, photos, trails
  and neighbours. Pages have an overview, why it is worth visiting, recorded
  features, associated places and trails, a map, photographs, official/source
  links and clear uncertainty; no access, facilities or closures are asserted.
- Classified the catalogue into six kinds (peak, park, waterfall, lake, coast,
  landmark) type-first, so a national park named for a waterfall stays a park.
- Moved the previous generated experience catalogue to `/collections` and
  `/collections/:slug`, with its 220 collections intact. Collections no longer
  appear on the globe, no longer have save controls and no longer appear in Saved.
- The globe's Experience layer now draws the curated catalogue only; layers,
  counts and picking follow the six kinds. Saved Experiences use their own
  `terrane.saved.guide.v1` store; saved places are unchanged.
- Added the Experiences → Globe hand-off: every curated card and detail page
  opens `/?guide=<slug>`, which selects the destination on the globe, opens its
  card and draws only that destination and its recorded neighbours.
- Extended source verification to both catalogues and added `--incremental`:
  2,885 URLs verified, 0 dead, 0 unreachable. Added 14 curated-Experience checks
  to `npm run validate` (78 checks total) and `/experiences`, `/collections` and
  their detail routes to the sitemap.

## 2026-11-21 — Experience source links are fetched, not assumed

- Added `npm run sources:check`, a networked verifier that fetches every
  distinct source URL a shipped place links to, follows redirects, checks the
  final page is a real article or Commons file, and classifies each as verified,
  dead or unreachable. It never treats 404/410, a redirect to search or the main
  page, a missing-article page or an off-site redirect as verified.
- Wrote `src/data/experience-sources.json`: 2,576 distinct URLs (1,312 Wikipedia
  articles, 1,264 Commons file pages) checked, 2,576 verified, 0 dead,
  0 unreachable. The generator now admits a place only when its article and photo
  page are in that artifact, and refuses to run without it; missing artifacts are
  build errors, not silent fallbacks.
- Added `npm run sources:verify` for an offline coverage check, a manual
  networked GitHub workflow, and validator checks that every shipped source and
  photograph page is verified and that Georgia keeps at least three collections
  with every place source verified. No places or collections were dropped.

## 2026-11-21 — Experiences become verified collections

- An experience is now a collection of remarkable places in one region, not an
  itinerary. Records no longer carry `itinerary`, `days`, `durationHours`,
  `difficulty` or `distanceKm`; `spanKm` states only the extent of the group.
- Every place must have a Wikipedia URL in its detail record, so every stop on
  every page links to its Terrane page and an external reference. The generator
  refuses unverified destinations instead of filling a quota, and the validator
  checks the links resolve to a page.
- Collections are built within one country, so a Georgia collection contains
  Georgian places rather than a border-spanning mixture. The set is capped at
  220 collections, one per represented country, with at least three in Georgia.
- The map draws a selected collection's places as neutral markers and no longer
  draws a dashed line or numbered stops. Cards and saved rows show places,
  extent and sources instead of days and difficulty.
- Pages list campsites, huts, trailheads and viewpoints from OpenStreetMap cells
  with coordinates, and state that coverage is uneven rather than inferring a
  stay from the destination data.

## 2026-11-21 — Experiences are walked, graded and named after the ground

- Experiences are now planned on foot: walking days split long legs by
  Naismith's rule, each day states km and miles, hours, climb and high point, and
  the route carries a difficulty grade with the thresholds printed beside it.
- Each walking day names the recorded trail nearest its stops, and the page
  attaches the nearest mapped campsite, hut or shelter from the cell store.
- Route titles are the protected area, range or anchor name ("Okstindan", "Monte
  Rosa Massif") instead of category templates ("Camping around…").
- The catalogue gains a difficulty filter and a place filter: pick a peak, park or
  town and see routes within 150 km, ordered by distance.
- Validation now rejects a missing day plan, a day set that does not cover the
  stops, a missing difficulty grade, or a templated title.

## 2026-11-20 — Every destination gets a page

- All 24,474 destinations (1,213 atlas + 23,261 reach) now have a
  `/place/:slug` page. Practical POIs remain map-only.
- Reach rows keep their Wikidata Q id and gain stable, collision-safe slugs; the
  map emits `slug`, `src`, `srcid` and `url`, and reach cards open their page.
- Added a sharded page index, detail harvest and trail-link harvest keyed by the
  first slug character. A page loads one shard of each, not the full 24k set.
- Added `npm run pages`, `npm run data:update` and `npm run data:refresh`; the
  build and validator run `build-place-index` first and stay offline.
- Removed dead exports and the unused reach metadata file, and replaced the
  single `place-details.json` / `trail-links.json` with committed shards.

## 2026-11-20 — Production cache and data freshness

- The SPA rewrite no longer catches `/assets/*` or `/fonts/*`, so a missing hashed
  asset returns 404 instead of `index.html` with a one-year immutable cache.
- The HTML shell is `no-store` on `/`, `/place/*`, `/saved` and `/coverage`, so a
  deployment switch cannot leave a browser on an old shell.
- The live cell-store manifest only replaces the bundled manifest when it is not
  older; a lagging store can no longer roll the visible counts back.

## 2026-11-20 — Destination pages, generated only

- Removed the 68 hand-written destinations and their index pipeline. Every
  destination now comes from the Wikidata atlas; the three type labels remain.
- Added `npm run details`, a committed Wikidata/Commons harvest: one-line
  descriptions, credited photographs, official websites, parent ranges, protected
  areas, elevation and prominence for 1,213 pages.
- Rebuilt `/place/:slug` around one section order: photo hero (or generated ridge
  art), fact strip, About, landscape, trails, activities and nearby places.
- Added save/unsave in `localStorage`, the `/saved` page and save controls on the
  map card; saves are local to one browser.
- Added the last-camera back link, per-page OG image and JSON-LD, and a detail
  coverage block in the manifest.
- `validate-data.mjs` now fails on a missing detail record, an uncredited image or
  a manifest count that disagrees with the detail file.
- The atlas was rebuilt through the Wikidata Action API without the old exclusion
  list: 13 former names returned as generated rows and the per-country caps
  displaced 14 old rows, leaving 1,213 unique pages.

## 2026-11-19 — Repository freeze readiness

- Builds are reproducible: the manifest and validator no longer write wall-clock
  timestamps or checkout mtimes; all dates come from the data files.
- The SEO step now runs after Vite and writes an absolute `dist/sitemap.xml` and
  `dist/robots.txt`, using the same origin fallback as the canonical tags. The
  generated files are no longer committed.
- Removed the broken `npm run single` self-contained build. Vite emits six lazy
  chunks and two stylesheets; the old inliner could only embed the first of each.
- `public/poi` and `public/trails` are excluded from the production copy. A local
  build with harvested cells fell from ~302 MB to ~3.2 MB.
- Fixed trail routes not reloading after navigating away from the globe and back.
- Fixed failed cell fetches retrying on every `moveend` after a network error.
- Gave `/coverage` explicit loading and failure states instead of an endless
  "Reading coverage…".
- Consolidated the cell-store origin, haversine distance and pure place filters;
  removed unused exports, dead CSS, the legacy Overpass harvester and the unused
  MVT reader.
- Rewrote the README and split architecture, data-pipeline, deployment,
  performance and audit documentation; the old design journal has since been
  removed.

## 2026-11-19 — Data store and coverage gates

- The world harvest, trail cells, agency adapters and coverage report were
  documented in the data-pipeline docs (since removed).
- Every publishing data job runs `coverage-report --strict`; a zero, missing or
  truncated source fails before the upload.
- The cell store remains the published preview environment because a second
  environment would exceed the R2 allowance.
