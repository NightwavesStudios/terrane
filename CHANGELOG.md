# Changelog

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
