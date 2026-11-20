# Data pipeline

The map draws from four layers of data:

1. **Destinations** — a Wikidata atlas and long tail, bundled into the app.
2. **Practical pins** — OSM and agency points, fetched per z6 cell at runtime.
3. **Trail routes** — OSM relations and agency inventories, fetched per z7 cell.
4. **Manifest and coverage** — small JSON files fetched at runtime.

## Sources

| Source | Family | Cadence | Records | Licence |
| --- | --- | --- | ---: | --- |
| OpenStreetMap via Geofabrik | points | weekly | 9,371,124 | ODbL 1.0 |
| Wikidata | destinations | occasional | 1,218 + 23,254 | CC0 |
| Hand-written entries | destinations | frozen | 68 | — |
| Recreation.gov RIDB | points | daily | 7,790 | Public domain (US Gov) |
| US Forest Service sites | points | monthly | 26,534 | Public domain (US Gov) |
| Bureau of Land Management sites | points | monthly | 694 | Public domain (US Gov) |
| NPS trails | trails | monthly | 33,906 | Public domain (US Gov) |
| USFS trails | trails | monthly | 84,564 | Public domain (US Gov) |
| BLM trails | trails | monthly | 42,671 | Public domain (US Gov) |
| Parks Canada accommodation | points | monthly | 9,592 | OGL Canada |
| NZ Department of Conservation | points | monthly | 312 | CC BY 4.0 |
| OSM hiking routes | trails | monthly | 269,889 | ODbL 1.0 |

Trail counts above are input features. The merge splits routes at cell boundaries,
so the store holds **485,798 segments** from 495,761 input rows. The exact current
numbers are in `src/data/manifest.json`; the source registry, including gates and
endpoints, is `src/data/sources.json`.

## The cell store

`infra/cell-store/worker.js` is a small Worker in front of an R2 bucket. Its
deploy manifest is `infra/cell-store/deploy.json`.

| Path | Contents |
| --- | --- |
| `GET /poi/6/{x}/{y}.json` | Practical pins for one z6 cell |
| `GET /poi/6/{x}/{y}.parking.json` | Parking for one z6 cell (fetched only past z14.4) |
| `GET /trails/7/{x}/{y}.json` | Trail route segments for one z7 cell |
| `GET /manifest.json` | The live manifest |
| `GET /coverage.json` | The last coverage report |
| `GET /sources/{id}.json` | Per-source accounting manifests |
| `PUT /upload/{key}` | Write path, requires `x-upload-token` |

Reads are public and CORS-open; writes are gated by the `UPLOAD_TOKEN` secret.
`infra/cell-store/worker.js` only allows the known prefixes and live keys.

The store also serves `upload-manifest.json`, the uploader's own list of every
object it has written. The map reads that list before it fetches a cell
(`src/lib/cellIndex.ts`), so a cell that was never harvested is an ordinary empty
answer instead of a 404 the browser logs as a failed request; a cell the list
names is still fetched, and a failure on it still throws. Families the uploader
does not track — parking cells, which are published outside the manifest — are
treated as unknown and fetched as before. If the list is missing or unreadable
the map falls back to fetching every cell optimistically.

The store is the Sites project **Terrane POI cells**. Its **preview** environment
is published at `https://terrane-poi-cells-mqa53q-preview.freebuff.site` and is
the app default. Production is unpublished and has no objects. The account R2
usage is ~700 MB of a 1 GB allowance (382 MB of POI cells, 317 MB of trail cells),
so copying the store into a second environment would exceed the quota before the
copy finished. Promoting production is therefore a deliberate migration, not a
deploy button: it needs a plan to move or shrink the objects first.

The uploader can gzip each object (`--gzip`) and the Worker echoes
`Content-Encoding` on reads. A one-time recompression is a dry run until the
migration is explicitly approved:

```bash
npm run data:upload -- --dry-run --gzip
```

A manifest revision (`generatedAt`) is appended as `?v=` to cell requests after
the index is read, so a publish is not hidden behind a cell's one-hour cache.
`npm run store:check` HEADs every key in the upload manifest and compares the
recorded byte counts; `--local` compares local object counts instead.

`public/poi` is a gitignored local mirror; `public/trails` is committed so a
clean checkout can run the strict geometry gate. Both are used by the upload
scripts. To read either in development, point `VITE_POI_BASE` at the dev origin
(for example `http://localhost:3000`); `vite.config.ts` deliberately does not
copy the mirrors into `dist`, so production reads the bucket.

### Draw-time duplicate guard

A campsite that is also an atlas park or landmark is one place in two harvests.
The client marks named practical pins within 200 m of a compatible destination
and holds them back to z13.5 (`src/map/mapped.ts`). That is a rendering guard, not
a merge: the records still exist, the counts still include them, and the fix at
source belongs in `merge-sources.py` when the atlas coordinates are available to
it. The count the guard hides is on the `?debug=1` readout.

The next payload lever is the other way round: **1,053,188 information boards**
are the largest practical category and mostly unnamed, and they are a large share
of the 382 MB POI store. Dropping unnamed boards from the cell files would shrink
both the store and the cell payloads, but it rewrites published objects, so it is
a separate, approved data job — not part of the map pass.

## Refresh

Install the one non-stdlib Python dependency:

```bash
python3 -m pip install -r scripts/requirements.txt   # pyosmium
```

Common commands:

```bash
npm run atlas          # Wikidata atlas
npm run data:refresh   # atlas + reach + world POI + merge + stats + validate
npm run poi:world      # world OSM harvest (resumable, sharded in CI)
npm run poi:merge      # dedupe, tile, validate, swap public/poi
npm run poi:stats      # src/data/poi-stats.json
npm run data:merge     # agency adapters → cells
npm run data:trails    # trails-only merge + strict quality + links + manifest
npm run trail:quality  # strict geometry gate → reports/trail-quality.{json,md}
npm run trail:links    # destination ↔ nearest named trails → src/data/trail-links.json
npm run data:coverage  # reports/coverage.{md,json} + public/coverage.json
npm run data:upload    # PUT changed cells and manifests
npm run store:check    # HEAD every stored object; compare counts/bytes
```

The trail rebuild is deliberately separate from a point merge. `--trails-only`
keeps the published points untouched; `--points-only` carries the last trail
numbers forward. A full trail rebuild refuses to start without OSM rows or with
less than 90% of the last known-good input, so a checkout with only the agency
feeds cannot silently replace the store with a smaller network.

`scripts/trail-quality.mjs --strict` is the trail gate. It fails on any segment
outside its z7 tile, a relative chord rate above 0.01%, duplicate geometry above
0.5%, distance mismatch above 5%, a cell over 12 MB, or invalid coordinates. The
monthly workflow runs it before upload; `npm run validate` invokes the same
strict gate against the committed cells, then checks the block it records in
`trail-stats.json`.

Uploads are uncompressed by default. `node scripts/upload-changed.mjs --gzip`
(and the Worker's `Content-Encoding` handling) is available for the planned R2
recompression; it is opt-in until that migration is approved.

`data-weekly.yml` runs the world harvest in 12 shards by `--shard I/12`; the
assemble job refuses to publish unless every planned Geofabrik extract produced
rows. `data-monthly-trails.yml` runs the OSM route harvest before merging, because
the agency feeds alone would shrink the trail store. `merge-sources.py` also
refuses to rebuild trails from less than 90% of the last known-good input.

Every publishing job runs `node scripts/coverage-report.mjs --strict`. It fails on
a missing source, a zero source, a source below its published gate, unaccounted
records, or totals below 90% of the last known-good report. `common.emit` refuses
to write a source manifest whose accounting does not add up.

## Licences

Code is MIT (`LICENSE`). Data keeps each source's terms: OSM is ODbL, the US
federal feeds are public domain, Parks Canada is OGL-Canada, DOC NZ is CC BY 4.0
and Wikidata is CC0. `DATA-LICENSES.md` records the obligations; the same fields
(`licence`, `licenceUrl`, `attribution`, `terms`) live in `src/data/sources.json`
and are shown on `/coverage` and each feature card. A source without them fails
`npm run validate`.

## Generated files

| File | Written by | Committed |
| --- | --- | --- |
| `src/data/atlas.json` | `scripts/build-atlas.py` | yes |
| `src/data/reach.json`, `reach-more.json` | `scripts/harvest-reach.py` | yes |
| `src/data/curated-index.json` | `scripts/build-curated-index.mjs` | yes |
| `src/data/poi-stats.json`, `trail-stats.json` | harvest / merge + trail-quality | yes |
| `src/data/trail-links.json` | `scripts/build-trail-links.mjs` | yes |
| `src/data/manifest.json` | `scripts/build-manifest.mjs`, then `validate-data.mjs` | yes |
| `src/data/sources.json` | hand-maintained registry | yes |
| `src/data/wikidata-meta.json` | atlas / reach harvest | yes |
| `reports/*` | audits and reports | only `reports/coverage.json` and `reports/merge.json` |
| `public/poi`, `public/coverage.json` | harvest / merge | no |
| `public/trails` | merge | yes — committed for the strict gate |
| `dist/sitemap.xml`, `dist/robots.txt` | `scripts/gen-seo.mjs` | no |

The manifest and validator use the data files' own dates, never the clock or
checkout mtimes, so the same commit builds the same manifest. `src/data/README.md`
lists the local conventions.
