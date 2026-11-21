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
| Wikidata | destinations and descriptions | occasional | 1,213 + 23,261 | CC0 |
| Wikimedia Commons | photographs | occasional | credited images on destination pages | per file |
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

## Destination pages

Every destination has a page: 1,213 atlas rows plus 23,261 reach rows. Practical
POIs stay map-only; a campsite or car park is a facility, not a destination page.

`scripts/build-place-index.mjs` (`npm run place:index`) writes compact page
records and the slug list to `src/data/place-index/`, sharded by the first slug
character. The map's atlas/reach chunks are unchanged; a page loads only its own
shard.

`scripts/build-place-details.mjs` (`npm run details`) is an occasional harvest,
not a build step: its output is committed, so a checkout builds offline. For
every destination Q id it reads Wikidata's `schema:description`, P18 images, P856
official website, P4552 mountain range, P814 protected area, P2044 elevation,
P2660 prominence, the English Wikipedia sitelink and P373. Commons `imageinfo`
adds the thumbnail, the photographer, the licence and the licence URL. It reuses
records by Q id, so a rerun fetches only new pages, and writes one shard per first
slug character plus `place-details-summary.json`. At the 2026-11-20 harvest that
was 23,897 descriptions, 20,115 pages with a credited photo and 800 official
websites across 24,474 pages.

A recorded range or protected area is stored as `range` / `protected`; when there
is none, the nearest atlas `range` or `park` page within 50 km is stored as
`nearestRange` / `nearestPark` and labelled "Nearest". `validate-data.mjs` fails
on a missing page or detail record, a duplicate slug, a broken image URL, an
uncredited image, an unknown association slug or a manifest count that does not
match. Images are hotlinked, not mirrored: the R2 store is already 676 MB of a
1 GB allowance.

`scripts/build-trail-links.mjs` (`npm run trail:links`) writes the nearest named
trails for every destination into sharded `src/data/trail-links/` plus a summary.
The page loads one trail shard alongside its detail shard.

## Experiences

Experiences are generated routes, not a page-per-destination index. The inputs
are the committed destination set, the detail shards (description, elevation,
credited photographs, recorded range and protected area) and the trail-link
shards. There is no POI mirror and no network step: `npm run experiences` reads
those files and writes `src/data/experience-index/` deterministically.

`scripts/lib/experiences.mjs` is the pure part: a 0.5° bucket index, seed scoring
by fame and evidence, greedy cluster growth (3–8 stops, 40 km corridor widened to
70 km for compact groups, 120 km bounding diagonal, at most three stops of one
category), the category rules and the prose. The generator applies country and
category quotas in a second phase, so one category cannot crowd out the rest, and
every destination is claimed by at most one route.

Categories are earned from facts already recorded: a park/reserve majority or a
shared specific protected area, a peak/glacier majority or two high stops, named
trails within 10 km of most stops, water country with trails, and a compact mixed
group as the weekend fallback. Camping never asserts that a campsite exists; the
page lists mapped campsites and huts from the open POI cells instead.

Output: `catalog.json` (one compact row per route, for search and cards), one
first-character shard per route (the full record), and `meta.json` (counts and
inputs). Titles are unique, slugs are stable, and no record uses the clock. The
record's `source` is `"generated"`; a future curated route can sit beside it
without a schema change.

`npm run build`, `npm run validate` and `npm run pages` all regenerate the index
before checking it, exactly as they do for the place index. Runtime practical
places come from `src/lib/experiencePois.ts` and the existing z6 cells.

The normal update is `npm run data:update` (index + experiences + incremental
details + trail links + manifest + validate). `npm run data:refresh` re-harvests
the sources first. Both are committed-output steps; `npm run build` stays offline.

## Refresh

Install the one non-stdlib Python dependency:

```bash
python3 -m pip install -r scripts/requirements.txt   # pyosmium
```

Common commands:

```bash
npm run atlas          # Wikidata atlas
npm run place:index    # compact page records and slugs
npm run details        # Wikidata/Commons place details
npm run pages          # index + details + trail links + manifest + validate
npm run data:update    # incremental page/detail refresh
npm run data:refresh   # full source harvest, then pages + audit
npm run poi:world      # world OSM harvest (resumable, sharded in CI)
npm run poi:merge      # dedupe, tile, validate, swap public/poi
npm run poi:stats      # src/data/poi-stats.json
npm run data:merge     # agency adapters → cells
npm run data:trails    # trails-only merge + strict quality + links + manifest
npm run trail:quality  # strict geometry gate → reports/trail-quality.{json,md}
npm run trail:links    # destination ↔ nearest named trails → src/data/trail-links/
npm run experiences    # generated routes → src/data/experience-index/
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
federal feeds are public domain, Parks Canada is OGL-Canada, DOC NZ is CC BY 4.0,
Wikidata is CC0, and Commons photographs keep their per-file licences.
`DATA-LICENSES.md` records the obligations; the same fields
(`licence`, `licenceUrl`, `attribution`, `terms`) live in `src/data/sources.json`
and are shown on `/coverage` and each feature card. A source without them fails
`npm run validate`.

## Generated files

| File | Written by | Committed |
| --- | --- | --- |
| `src/data/atlas.json` | `scripts/build-atlas.py` | yes |
| `src/data/reach.json`, `reach-more.json` | `scripts/harvest-reach.py` | yes |
| `src/data/place-index/` | `scripts/build-place-index.mjs` | yes |
| `src/data/place-details/`, `place-details-summary.json` | `scripts/build-place-details.mjs` | yes |
| `src/data/poi-stats.json`, `trail-stats.json` | harvest / merge + trail-quality | yes |
| `src/data/trail-links/`, `trail-links-summary.json` | `scripts/build-trail-links.mjs` | yes |
| `src/data/experience-index/` | `scripts/build-experiences.mjs` | yes |
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
