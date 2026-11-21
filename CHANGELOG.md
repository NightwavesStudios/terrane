# Changelog

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
  performance and audit documentation; the old design journal is in
  [`docs/history.md`](docs/history.md).

## 2026-11-19 — Data store and coverage gates

- The world harvest, trail cells, agency adapters and coverage report are
  documented in `docs/data-pipeline.md`.
- Every publishing data job runs `coverage-report --strict`; a zero, missing or
  truncated source fails before the upload.
- The cell store remains the published preview environment because a second
  environment would exceed the R2 allowance.

Earlier history is in [`docs/history.md`](docs/history.md).
