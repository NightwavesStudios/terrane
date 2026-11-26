# Scripts

Node scripts build the app data and manifest; Python scripts harvest and merge
open data. `scripts/sources/common.py` is the shared adapter helper, and
`scripts/lib/` holds the site-origin helper plus the shared destination reader.

## Build and checks

| Script | Run by | Purpose |
| --- | --- | --- |
| `build-place-index.mjs` | `npm run build`, `validate`, `pages` | Compact page records and slugs for every destination. |
| `build-guide.mjs` | `npm run build`, `validate`, `pages` | Build one curated Experience page for every slug in `guide-selection.json`, from committed details, trails and photos. Fails on an unresolved entry. |
| `build-manifest.mjs` | `npm run build`, `validate` | Derive counts and dates from the data files. |
| `check-experience-sources.mjs` | `npm run sources:check` (manual/CI network step) | Fetch every distinct curated Experience source URL, follow redirects, classify verified/dead/unreachable, and write `src/data/experience-sources.json`. `--incremental` keeps existing verified entries and checks only new URLs. Fails on dead links; refuses partial overwrites. |
| `validate-data.mjs` | `npm run build`, `validate` | Schema, category, manifest and duplicate checks; writes the validation block. |
| `gen-seo.mjs` | `npm run build` (after Vite) | Absolute `dist/sitemap.xml` and `dist/robots.txt`. |
| `clean.mjs` | `npm run clean` | Remove `dist` and `tsconfig.tsbuildinfo`. |
| `audit-data.mjs` | `npm run audit` | Density, duplicate and freshness report. |
| `band-report.mjs` | `npm run bands` | Band counts and sample viewport density. |
| `dedupe-report.mjs` | `npm run data:dedupe` | Cross-source duplicate report. |
| `poi-stats.mjs` | `npm run poi:stats` | `src/data/poi-stats.json` from the POI coverage report. |
| `coverage-report.mjs` | `npm run data:coverage` | Gap register; `--strict` is the publishing gate. |
| `fetch-source-state.mjs` | data workflows | Pull the other sources' manifests from the bucket. |
| `upload-changed.mjs` | data workflows | Hash and upload only changed cells/manifests. |

## Harvest and merge

| Script | Purpose |
| --- | --- |
| `build-atlas.py` | Wikidata atlas → `src/data/atlas.json`; updates `wikidata-meta.json`. |
| `build-atlas-api.py` | Action-API atlas rebuild from entity JSON (atomic); resolves the former seed names without SPARQL. |
| `build-place-details.mjs` | Wikidata/Commons details for every destination → sharded `src/data/place-details/` and a summary. |
| `build-trail-links.mjs` | Nearest named trails for every destination → sharded `src/data/trail-links/` and a summary. |
| `harvest-reach.py` | Wikidata long tail → `reach.json`, `reach-more.json`; each row carries its Q id and page slug. |
| `harvest-poi-bulk.py` | Streaming Geofabrik/pyosmium world POI harvest; resumable and shardable. |
| `merge-sources.py` | Dedupe and tile points/trails; refuses a truncated trail rebuild. |
| `poi-upload.sh` | Upload every file in `public/poi` (manual full push). |
| `sources/ridb.py` | Recreation.gov daily export. |
| `sources/usfs.py` | USFS sites and NFS trails. |
| `sources/blm.py` | BLM sites and GTLF trails. |
| `sources/nps.py` | NPS public trails. |
| `sources/national.py` | NZ Department of Conservation campsites. |
| `sources/parks_canada.py` | Parks Canada accommodation. |
| `sources/osm_routes_global.py` | Global OSM hiking routes through cached Geofabrik leaf boxes. |

Manual/regional tools that are not on a schedule: `sources/osm_routes.py` (PBF
input), `sources/osm_routes_overpass.py` (regional Overpass), and
`sources/osm_routes_aggregate.py` / `sources/osm_routes_raw_cache.py` (recover
from cached slices).

The one non-stdlib Python dependency is pyosmium; install it with
`python3 -m pip install -r scripts/requirements.txt`.

## Page refresh

```bash
npm run pages        # guide catalogue + details + trail links + manifest + validate
npm run experiences  # curated Experience catalogue only
npm run data:update  # the normal incremental page refresh
npm run data:refresh # full source harvest, then pages + audit
```

`build-place-details.mjs` reuses records by Wikidata Q id, so a rerun fetches
only new destinations. It writes one shard per first slug character and keeps
sparse records (`{wd}` only) as valid pages.
