# Repository audit — 2026-11-19

This is the pre-freeze audit of the repository, not a product roadmap. Baseline:

- 146 tracked files, clean tree, no tags.
- Node 22.18 / npm 10.9; all nine top-level npm dependencies used.
- 9,440,586 places / 24,540 destinations / 9,416,046 mapped / 449,576 trails /
  30 categories / 156 atlas countries / 385 mapped countries.
- Cell store preview published; production unpublished; R2 659 MB of 1 GB.

## Resolved

| Finding | Resolution |
| --- | --- |
| Builds were non-deterministic (`new Date()`, mtimes) | `build-manifest.mjs` and `validate-data.mjs` derive dates from data files; a second build leaves the tree clean. |
| Sitemap used relative `<loc>` and ran before Vite | `gen-seo.mjs` runs after the build, writes absolute URLs into `dist/`, uses the shared Vercel origin fallback, includes `/coverage`, and reads `curated-index.json`. |
| `npm run single` could not load lazy chunks | Removed the script and its docs. The Vite build emits six JS chunks and two CSS files; a first-chunk inliner cannot produce a working page. |
| Local cell mirrors were copied into `dist` | `vite.config.ts` disables `copyPublicDir` and copies `public/` except `poi/` and `trails/`. Local build output fell from 302 MB to 3.2 MB. |
| Trails stopped loading after a route change | `trails.ts` keys its listener binding by map (`WeakSet`), like `mapped.ts`. |
| Failed cell fetches retried on every `moveend` | A non-HTTP error now uses the intended backoff instead of `NaN`. |
| `/coverage` could show "Reading coverage…" forever | Added explicit loading, failure and retry states, plus a status hook in `live.ts`. |
| Cell-store origin was duplicated in three modules | `src/lib/cells.ts` is the single origin and URL builder. |
| Duplicate haversine implementations | `src/lib/geo.ts`; `places.ts` and `Home.tsx` use it; tests added. |
| Filter logic lived in a component | `src/lib/filters.ts`, with tests. |
| Dead `.about-*` CSS, unused MVT reader, legacy Overpass harvester, unused exports | Removed. |
| Generated reports, sitemap and coverage JSON tracked | Untracked; only `reports/coverage.json` remains as the strict-gate baseline. |
| `national.py` accounting could go negative | `fetched` increments before coordinate rejection; `common.emit` refuses nonzero accounting. |
| Python dependency undocumented | `scripts/requirements.txt` (pyosmium) and the pipeline doc. |
| Stale README/docs (counts, removed files, `localStorage`, `nearbyFor`, band counts) | Rewritten; README is now an entry point and the detail lives in focused docs. |

## Verified after the changes

- `npx tsc -b` passes.
- `npx vitest run` passes: 5 files, 29 tests.
- `npm run build` passes 27/27 validation checks; `dist` is 3.2 MB.
- `python3 -m compileall scripts` passes.
- Two consecutive builds produced identical data hashes and identical chunk names;
  the only status change was the temporary build log, which was deleted.

## Open decisions

1. **Cell-store production.** The app defaults to the published preview store.
   Production is unpublished and empty, and duplicating 659 MB into a second R2
   environment would exceed the 1 GB allowance. Keep preview as canonical, or
   plan a move/shrink migration and update `src/lib/cells.ts` in the same change.
2. **Code licence.** There is no LICENSE file. Data licences are documented per
   source; the code licence is a choice for the owner.
3. **Destination filter chips.** The UI exposes All, Peaks, Parks and the home
   chip, while the taxonomy has 16 destination categories. This is the product
   decision described in `FilterChips.tsx`; expanding it is a feature, not a
   cleanup.
4. **Error boundary.** A failed lazy chunk currently falls back to the route
   shell rather than a dedicated recovery screen. Not added here to avoid new
   behaviour beyond the approved cleanup.

## Remaining known limitations

- OSM coverage is mapping effort, not ground truth; agency coverage is US,
  Canada and NZ only.
- The destination set is a selection with per-country caps, not a census.
- Contours are capped and client-side; deep relief needs national DEM coverage.
- The globe is a single large MapLibre chunk; route-level splitting is already in
  place.
- No field guides, photos, accounts or trip planner.
