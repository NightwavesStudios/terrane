# Terrane

**The world, worth the detour.**

Terrane is an interactive globe of places worth going outside for: peaks, ranges,
parks, coastlines, campsites, water and parking. Spin the planet, click a point,
read what is around it.

**9,440,586 places in 30 categories**, one model: 24,540 destinations (1,218
Wikidata atlas rows, 68 hand-written entries and a 23,254-row Wikidata long tail),
9,416,046 mapped places from OpenStreetMap and agency inventories, and 485,798
trail segments in 1,017 z7 cells. Coverage is uneven; the [Data page](/coverage) and
[`docs/data-pipeline.md`](docs/data-pipeline.md) say exactly where.

> **Facts only.** Place pages show type, high point, country and coordinates.
> There are no written field guides, photos, accounts or trip planning.

## Quick start

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # data checks + tsc + Vite + SEO → dist/
npm test           # Vitest: routing, ranking, filters, distances
npm run check      # typecheck + tests + data validation
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
| `/` | `Home` | The globe, full bleed: header, caption, filters, search and layers. |
| `/?place=<slug>` | `Home` | The globe with a place pre-selected and flown to. |
| `/place/:slug` | `Place` | Fact sheet: type, high point, country, coordinates and what is within 30 km. |
| `/coverage` | `Coverage` | The source health and gap register, read from the cell store. |
| anything else | `Home` | Unknown paths fall through to the globe. |

Routing is real paths through the History API, parsed in `src/lib/router.ts`.
There is no router dependency.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Build | Vite 8 + `@vitejs/plugin-react` | Static SPA, route- and map-level code splitting. |
| UI | React 19 + TypeScript 7 | `strict`, `noUnusedLocals`, `noUnusedParameters`. |
| Map | MapLibre GL 5 | Major deliberately held at 5; see [performance](docs/performance.md). |
| Routing | `src/lib/router.ts` | History API, no dependency. |
| Styling | `src/styles.css` | One hand-written stylesheet, no framework. |
| Fonts | `public/fonts/` | Self-hosted woff2 subsets, no Google Fonts request. |
| State | React state + `sessionStorage` | No store library; the IP lookup is per tab. |
| Tests | Vitest | Pure modules only; the WebGL globe is checked by the build and by opening it. |

## Architecture at a glance

```
src/
  App.tsx            route switch; Home is eager, Place and Coverage are lazy
  pages/             Home, Place, Coverage
  components/        header, chips, layers, search, card, generated ridge art
  map/               MapLibre style, globe component, layers, DEM, contours
  data/              typed models + generated JSON (atlas, reach, manifest)
  lib/               router, live cell feed, geolocation, distances, filters, meta
```

- **`src/map/style.ts`** is the hand-written basemap: OpenFreeMap vector tiles,
  a latitude-banded land backdrop, landcover, park areas, water, roads,
  boundaries and the full label ladder.
- **`src/map/Globe.tsx`** owns one `Map`, adds runtime layers, and turns clicks
  into one `Pick`. **`src/map/destinations.ts`**, **`mapped.ts`** and
  **`trails.ts`** own their sources and zoom bands. Practical pins are dealt into
  per-cell bands, pushed once per frame and bounded to the viewport.
- **`src/map/dem.ts`** exposes elevation as a MapLibre protocol; a worker fetches
  and resamples tiles. **`contours.ts`** generates contours from the same DEM.
- **`src/data/features.ts`** is the one feature/pick model and style-expression
  builder. A summit, a campsite and a car park are the same kind of thing: a point
  with a category.
- **`src/lib/live.ts`** fetches the manifest and coverage report at runtime so a
  harvest changes the counts without a new app build. **`src/lib/cells.ts`** is
  the single cell-store origin.

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

The bundled manifest is the first paint; the live manifest and coverage report
come from the cell store. `scripts/build-manifest.mjs` derives every count and
date from the data files, so two builds of the same commit produce the same
manifest. See [`src/data/README.md`](src/data/README.md) for which files are
generated and which are source.

## Checks

```bash
npm run typecheck  # tsc -b
npm test           # 44 tests: router, ranking, filters, distances, camera
npm run validate   # manifest counts, schemas, duplicate rules, coverage
npm run build      # all of the above + Data checks + Vite build + SEO into dist
npm run audit      # data density, duplicates and freshness (report only)
npm run trail:quality  # strict geometry gate (needs public/trails)
n```

`.github/workflows/ci.yml` runs typecheck, tests, validation and the full build on
every push to `main` and every pull request, and uploads `dist`. The data
workflows are separate and never deploy the site. There is deliberately no
linter; `tsc` with `noUnused*` is the static gate.

The build writes `dist/sitemap.xml` and `dist/robots.txt` only when the public
origin is known (`SITE_URL`, or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`).
Generated reports are not committed; `reports/coverage.json` is the one kept
baseline for the strict coverage gate.

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

- **The destination set is a selection, not a census.** 1,218 atlas rows, with
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
- **No field guides, photos, accounts or trip planner.** Product decisions, not
  omissions.
- **The data is not one licence.** Code is MIT (`LICENSE`); the data keeps each
  source's terms. See [`DATA-LICENSES.md`](DATA-LICENSES.md) and the per-source
  links on `/coverage`.

## Credits

Map © OpenStreetMap contributors ([ODbL](https://www.openstreetmap.org/copyright)) ·
OpenFreeMap · Terrain: Mapterhorn and Copernicus DEM · Data: OSM (ODbL), Wikidata
(CC0), Recreation.gov (RIDB), USFS, NPS, BLM (public domain), Parks Canada (OGL
Canada), NZ Department of Conservation (CC BY 4.0). Full obligations are in
[`DATA-LICENSES.md`](DATA-LICENSES.md).
