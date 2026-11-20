# Scripts

Node scripts build the app data and manifest; Python scripts harvest and merge
open data. `scripts/sources/common.py` is the shared adapter helper, and
`scripts/lib/` holds the site-origin helper.

## Build and checks

| Script | Run by | Purpose |
| --- | --- | --- |
| `build-manifest.mjs` | `npm run build`, `validate` | Derive counts and dates from the data files. |
| `validate-data.mjs` | `npm run build`, `validate` | Schema, category, manifest and duplicate checks; writes the validation block. |
| `gen-seo.mjs` | `npm run build` (after Vite) | Absolute `dist/sitemap.xml` and `dist/robots.txt`. |
| `clean.mjs` | `npm run clean` | Remove `dist`, `tsconfig.tsbuildinfo`, `terrane.html`. |
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
| `build-place-details.mjs` | Wikidata/Commons place details → `src/data/place-details.json`. |
| `harvest-reach.py` | Wikidata long tail → `reach.json`, `reach-more.json`. |
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
