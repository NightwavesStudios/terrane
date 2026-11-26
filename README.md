# Terrane

**The world, worth the detour.**

Terrane is a peakbagging-first globe. The living planet is the centrepiece; the
sourced lists, the local log and the facts around a summit are built around it.
Spin the world, open a peak, see the trails and mapped places around it, then bag
it or put it on your list.

**9,440,520 places in 30 categories**, one model: 24,474 destinations (7,643 of
them peaks and high points), 9,416,046 mapped places from OpenStreetMap and
agency inventories, and 485,798 trail segments in 1,017 z7 cells. Four sourced
club lists carry 184 named summits (Georgia 4,000, the New Hampshire 48, the
Adirondack 46ers and the Colorado 14ers). Every destination has a `/place/:slug`
page; practical POIs remain map-only. Coverage is uneven; the [Data page](/coverage)
and [`docs/data-pipeline.md`](docs/data-pipeline.md) say exactly where.

> **Facts only.** Place pages show type, high point, country, coordinates and a
> Wikidata description, with a credited Commons photograph where one exists.
> A listed summit is a row from the publishing club, not a generated point; only
> peaks with a real place record get a globe ring. Curated Experience detail
> pages survive as individual destinations. There are no accounts and the log
> stays in the browser.

## Quick start

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # data checks + tsc + Vite + SEO → dist/
npm test           # Vitest: routing, ranking, distances, camera, list data
npm run check      # typecheck + tests + data validation
npm run pages      # page index + details + trail links + manifest + validation
npm run data:update # incremental page/detail refresh for the current destinations
npm run details    # Wikidata/Commons place details (network; committed output)
npm run experiences # rebuild the curated Experience detail catalogue
npm run audit      # data audit → reports/ (generated, gitignored)
npm run clean      # remove dist and other regenerable build output
```

Node 20+ (the repository pins 22 in `.nvmrc`). No API keys or environment
variables are needed for the app. Python 3 is only needed for the harvest and
atlas scripts; see [`scripts/requirements.txt`](scripts/requirements.txt).

`public/poi/` is a local, gitignored harvest mirror; `public/trails/` is the
committed trail delivery used by the strict geometry gate. A fresh clone has no
POI cells; the app reads the hosted cell store instead. Set `VITE_POI_BASE` to
point a build at a different store, or at the dev origin (for example
`http://localhost:3000`) to read a local mirror. It is inlined at build time, so
it needs a rebuild, not a restart.

## Routes

| Path | Page | What it is |
| --- | --- | --- |
| `/` | `Home` | The globe, full bleed: four lenses (Peaks, Places, Around, All), the list lens, search and layers. Your bagged and wanted points are drawn over it. |
| `/?place=<slug>` | `Home` | The globe with a place pre-selected and flown to. |
| `/?guide=<slug>` | `Home` | The globe with a curated Experience pre-selected, its card open and its own map layers drawn. |
| `/?list=<id>` | `Home` | The list lens open and the globe flown to the region the list covers. |
| `/place/:slug` | `Place` | Destination page: photo, description, facts, range/park, trails, activities, nearby places and the local log actions. |
| `/lists` | `Lists` | The sourced peakbagging ledger: four complete club lists, overall progress, vertical and recent ascents, kept in this browser. |
| `/lists/:list` | `Lists` | One list: every peak, its elevation, bag/want controls and a globe link where the summit has a real place page. |
| `/log` | `Log` | Bagged and wanted entries, dates, notes, list progress, a custom-ascent form and JSON export/import. |
| `/experiences/:slug` | `Experience` | One curated destination: overview, recorded features, associated places and trails, a map, practical places from the cell store, photographs, official/source links and the local log actions. |
| `/coverage` | `Coverage` | The source health and gap register, read from the cell store. |
| `/summits`, `/summits/:list`, `/saved` | redirects | Legacy URLs now land on Lists or Log. |
| anything else | `Home` | Unknown paths fall through to the globe. |

Routing is real paths through the History API, parsed in `src/lib/router.ts`.
There is no router dependency. `/lists`, `/log` and the detail routes are lazy
chunks; the globe stays eager. `terrane.log.v2` is the one personal store; it
migrates the old summit, saved-place and saved-guide keys once, then removes
them. The place page's back link restores the last globe camera from
`sessionStorage`.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Build | Vite 8 + `@vitejs/plugin-react` | Static SPA, route- and map-level code splitting. |
| UI | React 19 + TypeScript 7 | `strict`, `noUnusedLocals`, `noUnusedParameters`. |
| Map | MapLibre GL 5 | Major deliberately held at 5; see [performance](docs/performance.md). |
| Routing | `src/lib/router.ts` | History API, no dependency. |
| Styling | `src/styles.css` | One stylesheet, no framework. |
| Fonts | `public/fonts/` | Self-hosted woff2 subsets, no Google Fonts request. |
| State | React state + `localStorage` / `sessionStorage` | No store library; the log and last camera stay on this browser. |
| Tests | Vitest | Pure modules only; the WebGL globe is checked by the build and by opening it. |

## Architecture at a glance

```
src/
  App.tsx            route switch; Home is eager, the rest are lazy
  pages/             Home, Place, Lists, Log, Experience, Coverage
  components/        header, globe dock, list lens, cards, layers, place/, guide/
  map/               MapLibre style, globe component, layers, DEM, contours, log/list rings
  data/              typed models + generated JSON (atlas, reach, page index, details, trail links, guide, summits, manifest)
  lib/               router, live cell feed, distances, meta, log, log targets
```

- **`src/map/style.ts`** is the custom basemap: OpenFreeMap vector tiles,
  a latitude-banded land backdrop, landcover, park areas, water, roads,
  boundaries and the full label ladder.
- **`src/map/Globe.tsx`** owns one `Map`, adds runtime layers, and turns clicks
  into one `Pick`. **`src/map/destinations.ts`**, **`mapped.ts`**,
  **`trails.ts`** and **`experiences.ts`** own their sources and zoom bands.
  Practical pins are dealt into per-cell bands, pushed once per frame and bounded
  to the viewport; the Experiences source is the curated catalogue only.
- **`src/map/dem.ts`** exposes elevation as a MapLibre protocol; a worker fetches
  and resamples tiles. **`contours.ts`** generates contours from the same DEM.
- **`src/data/features.ts`** is the one feature/pick model and style-expression
  builder. A summit, a campsite and a car park are the same kind of thing: a point
  with a category.
- **`src/lib/live.ts`** fetches the manifest and coverage report at runtime so a
  harvest changes the counts without a new app build. **`src/lib/cells.ts`** is
  the single cell-store origin.
- **`src/lib/placePages.ts`** resolves atlas pages immediately and lazy-loads one
  page-index shard for reach pages. **`src/lib/placeDetails.ts`** and
  **`src/lib/trailLinks.ts`** load only the detail/trail shard for that page.
  **`src/lib/log.ts`** is the one versioned personal store (bagged, wanted,
  dates, notes, migration); **`src/lib/lastView.ts`** restores the camera behind
  a place page.

Deeper detail: [architecture](docs/architecture.md),
[data pipeline](docs/data-pipeline.md), [deployment](docs/deploy.md),
[performance notes](docs/performance.md), and [design history](docs/history.md).

## Data

One taxonomy in `src/data/categories.json`: 16 destination categories and 13
practical categories, plus trails. Destinations arrive in seven bands with a
per-cell quota, so the world view is not a Himalaya view; `src/data/rank.ts`
assigns bands deterministically and `src/data/bands.json` defines the zooms and
sizes. Practical pins are fetched per z6 cell as the camera moves; trail routes
are z7 cells. Trail cells are clipped to their tile, assembled at member
endpoints, deduplicated and re-simplified in metres; `npm run trail:quality` is
the strict geometry gate. The atlas and the famous long tail are bundled; the
rest of the tail is a lazy chunk.

Place pages cover every destination, not just the atlas. `src/data/place-index/`
holds compact page records in slug shards; `src/data/place-details/` holds
Wikidata descriptions, Commons photographs with credit and licence, official
websites, parent ranges and protected areas; `src/data/trail-links/` holds the
nearest named trails. `npm run pages` rebuilds the index, fetches only missing
detail records, rebuilds trail links, regenerates experiences and validates;
`npm run data:update` is the normal incremental command. The generated files are
committed, and `npm run build` regenerates the page index, the curated catalogue
and the manifest from them without the network.

`src/data/summits.ts` is the peakbagging ledger: four complete lists with names,
published elevations, list membership and source URLs, plus an editorial
`center`/`zoom` for each list's globe region. A peak without a real place record
keeps its list row but has no invented coordinate. Progress lives in
`terrane.log.v2`; it is not part of the harvest.

`src/data/guide-index/` is the curated Experience catalogue: a compact
`catalog.json` for the list and search, sixteen hash-bucket shards, and
`meta.json`. The set is frozen editorially in `src/data/guide-selection.json`
(183 destinations), not computed from a live ranking; `scripts/build-guide.mjs`
writes one page per selected slug from that destination's own detail, trail and
photo records, and fails on an unresolved entry. Every page names its six-kind
classification, associated places within 30 km, nearby named trails, photographs
and official or Wikipedia sources. It invents no access, facilities or
connections; missing facts are omitted. Practical campsites, huts and trailheads
are read from the cell store at runtime rather than baked into the page.

The bundled manifest is the first paint; the live manifest and coverage report
come from the cell store. `scripts/build-manifest.mjs` derives every count and
date from the data files, so two builds of the same commit produce the same
manifest. See [`src/data/README.md`](src/data/README.md) for which files are
generated and which are source.

## Checks

```bash
npm run typecheck  # tsc -b
npm test           # router, ranking, distances, camera, catalog, list data
npm run validate   # manifest counts, schemas, duplicate rules, coverage
npm run build      # all of the above + Data checks + Vite build + SEO into dist
npm run sources:check  # opt-in network: fetch every experience source URL
npm run audit      # data density, duplicates and freshness (report only)
npm run trail:quality  # strict geometry gate (needs public/trails)
n```

`.github/workflows/ci.yml` runs typecheck, tests, validation and the full build on
every push to `main` and every pull request, and uploads `dist`. The data
workflows are separate and never deploy the site. There is deliberately no
linter; `tsc` with `noUnused*` is the static gate.

`npm run sources:check` is the one networked check. It fetches every distinct
Wikipedia article and Wikimedia Commons file page carried by a shipped curated
Experience, follows redirects, and classifies each link verified, dead or
unreachable. It writes `src/data/experience-sources.json`; the validator admits
only Experiences whose article and photo pages are verified, and the normal build
and CI read that artifact offline. `--incremental`
checks only new URLs and keeps the existing verified entries. The check refuses to
overwrite the artifact when nothing could be verified or when any URL was
unreachable, and `--strict` (used by the npm script) exits non-zero on a confirmed
dead link. A manual `.github/workflows/experience-sources.yml` run repeats it
without making CI or the build depend on the network.

The build always writes `dist/sitemap.xml` and `dist/robots.txt`: absolute URLs
use `SITE_URL` (or Vercel's production hostname) when set, and the documented
placeholder origin when it is not, so a plain local build still produces the full
route set rather than no file. The sitemap is generated from the page index, the
curated detail catalogue and the app routes, and `npm run validate` fails if a
detail page or route is missing from it. Generated reports are not committed;
`reports/coverage.json` is the one kept baseline for the strict coverage gate.

## Deploy

The site is a static Vite build. `vercel.json` supplies the SPA rewrite, install
and build commands, and immutable caching for hashed assets. The data store is a
separate Sites/Cloudflare Worker in front of R2; `infra/cell-store/` holds its
source and deploy manifest.

The app currently defaults to the **published preview** environment of the cell
store. Production is deliberately unpublished: the store is ~700 MB of a 1 GB R2
allowance, so a second environment would exceed the quota before the objects could
be copied. See [deployment](docs/deploy.md) for the runbook and the decision.

## Known limitations

- **The destination set is a selection, not a census.** 1,213 atlas rows, with
  per-country caps; the long tail is ranked by fame, not completeness.
- **Practical coverage is OSM coverage.** A blank cell means nobody mapped it;
  Europe is densest. Agency feeds cover the US, Canada and NZ only.
- **The store origin is a preview environment.** It is public and published, but
  it is not the production environment.
- **Contours are a capped client-side pass** and only draw above z9.
- **Deep-zoom relief depends on national DEM coverage.** Elsewhere the 30 m global
  model is resampled; large forms, not gullies.
- **Zooming is engine-bound.** The globe projection and the hillshade are the
  cost; measurements are in [performance](docs/performance.md).
- **Photos and descriptions are Wikidata's coverage.** Some pages have a Commons
  image and description; many reach pages are sparse and show ridge art and no
  About section. Official websites are sparser still.
- **Experiences are a curated selection, not a census.** The 183 entries in
  `guide-selection.json` are chosen editorially from the destination database; a
  remarkable place can exist on the Globe without having an Experience page yet.
  The Globe remains the comprehensive discovery surface.
- **Experiences are not itineraries.** A page lists what is recorded about one
  destination and its associated places and trails; it makes no claim about how
  to travel between them, current access or seasonal closures.
- **Every Experience source is verified.** A curated entry needs a verified
  Wikipedia article and, when it has a photo, a verified Commons file page. The
  generator refuses an unresolved entry rather than inventing content.
- **Lists are complete club ledgers, not a rank.** The four lists carry every
  published member; a summit without a real place record remains a row and has
  no globe point. Completion is the reader's local record, not a certificate.
- **Practical places on Experience pages are OSM coverage.**
  Campsites, huts and trailheads come from the cell store and inherit its uneven
  coverage. An empty section means nobody mapped it, not that there is nowhere to
  stay.
- **The log is local to one browser.** Bagged and wanted entries, dates, notes
  and list progress are not an account and do not sync; clearing site data
  removes them. JSON export/import is the only backup.
- **Practical POIs are map-only.** Campsites, parking, water, toilets and
  trailheads do not get generated pages; the destination layer does.
- **Per-page social tags need JavaScript.** The SPA updates the head on route
  change; a crawler that does not execute JavaScript sees the site-level tags.
- **The data is not one licence.** Code is MIT (`LICENSE`); the data keeps each
  source's terms. See [`DATA-LICENSES.md`](DATA-LICENSES.md) and the per-source
  links on `/coverage`.

## Credits

Map © OpenStreetMap contributors ([ODbL](https://www.openstreetmap.org/copyright)) ·
OpenFreeMap · Terrain: Mapterhorn and Copernicus DEM · Data: OSM (ODbL), Wikidata
(CC0), Recreation.gov (RIDB), USFS, NPS, BLM (public domain), Parks Canada (OGL
Canada), NZ Department of Conservation (CC BY 4.0) · Photos: Wikimedia Commons
(per-file licences). Full obligations are in [`DATA-LICENSES.md`](DATA-LICENSES.md).
