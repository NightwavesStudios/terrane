# Architecture

Terrane is a static React SPA around one MapLibre map. There is no server, no
database and no runtime API key in the browser; the only network dependency for
data is the public cell store.

## Entry and routes

`src/main.tsx` mounts `App` and, on `/`, starts the `Globe` chunk early.
`src/App.tsx` keeps `Home` in the entry chunk and lazy-loads `Place`,
`Experiences`, `Experience`, `Saved` and `Coverage`, so a `/place/:slug` visit
never downloads MapLibre, and the experience catalogue is a separate chunk from
one experience page.

`src/lib/router.ts` parses real paths with the History API. `navigate()` pushes a
path and notifies subscribers; `popstate` is handled. `/saved` is the saved list;
`/experiences` and `/experiences/:slug` are the generated route catalogue and one
route; unknown paths fall through to the globe. There is no router dependency.

Experiences load two generated pieces lazily: `experience-index/catalog.json` for
the list and one first-character shard for a page (`lib/experiences.ts`). The page
adds `components/experiences/ExperienceMap.tsx`, a flat MapLibre builder that
reuses `map/style.ts` but none of the globe's runtime layers, and
`lib/experiencePois.ts`, which fetches the z6 cells covering the route's bounds.

The route is stored walked: `itinerary` holds one entry per walking day (split by
Naismith's rule, so a long leg can span several days), `difficulty` is graded
from the longest day, the climb and the high point, and each day carries the
recorded trails nearest its stops. `nearestStays` in `lib/experiencePois.ts`
attaches the nearest mapped campsite, hut or shelter to a stop once the cells
arrive. The catalogue filters on category, difficulty, free text and a chosen
place within 150 km (`filterExperiences`), all pure functions in
`lib/experiences.ts`.

## Map

| File | Responsibility |
| --- | --- |
| `src/map/style.ts` | The full MapLibre style spec, generated world-latitude bands, sources and static layers. `createStyle()` returns a clone because MapLibre mutates the spec. |
| `src/map/Globe.tsx` | Owns one `Map`, adds runtime layers idempotently, handles pick/hover, camera focus (a bounded 850 ms ease), pitch, shareable view, one constant hillshade state, the 3D mesh (created once, exaggeration as a uniform) and the stalled-state message. |
| `src/map/destinations.ts` | Atlas + Wikidata long tail in one GeoJSON source; seven dot bands and seven label bands from `bands.json`. |
| `src/map/mapped.ts` | Practical pins from z6 cells, dealt into per-cell pin bands, one push per frame, viewport-bounded payloads, cross-source duplicate suppression, parking in its own source and file, bounded caches and search indexing. |
| `src/map/trails.ts` | Trail routes from z7 cells, casing/line/label layers, coalesced pushes, retry and cache handling. |
| `src/map/dem.ts` | `terranedem://` protocol: worker fetch, decode, resample, transfer an `ImageBitmap`; main-thread fallback. |
| `src/map/demPipeline.ts` | The elevation pipeline and provider fallback. |
| `src/map/contours.ts` | Client-side marching squares in a blob worker, capped by tiles, levels, segments and time. |
| `src/map/campIcon.ts` | The camping-kit pictograms drawn into canvases once. |
| `src/map/camera.ts` | `worldZoom` and `pitchForZoom`, with no MapLibre import so pages can size the opening camera cheaply. |
| `src/lib/placePages.ts` | Atlas-immediate / reach-sharded page lookup. |
| `src/lib/placeDetails.ts` | Lazy detail shard, thumbnail width cap, description and difficulty formatting. |
| `src/lib/trailLinks.ts` | Lazy per-page trail-link shard. |
| `src/lib/saved.ts` | Versioned `localStorage` save list, cross-tab updates. |
| `src/lib/lastView.ts` | The last settled globe camera, for a place page's back link. |

Runtime layers are added by `ensureRuntimeLayers` after `style.load`, and again
after `styledata`, because a style rebuild drops them. Every `add*` function is
idempotent. Map teardown resets the trail and practical caches and disposes the
contour worker.

The style also carries the non-point visual layers: park and reserve polygons
from the basemap's own `park` tiles, a hypsometric tint under the hillshade, the
full settlement label ladder (country → state → city → village → hamlet) and road
names. The hillshade and the 3D mesh share the one `relief` DEM source.

## Data flow

```
data/sources/*.ndjson      adapters + bulk OSM harvest
        │
        ├─ merge-sources.py ──► public/poi, public/trails ──► upload ──► R2
        │
        ├─ build-atlas.py ─────► src/data/atlas.json
        ├─ harvest-reach.py ───► src/data/reach.json, reach-more.json
        ├─ build-place-index.mjs ─► src/data/place-index/
        ├─ build-place-details.mjs ─► src/data/place-details/
        ├─ build-trail-links.mjs ─► src/data/trail-links/
        └─ poi-stats.mjs ──────► src/data/poi-stats.json

src/data/*.json ── build-manifest.mjs ──► manifest.json ── validate ──► build
                                                              │
                                                    runtime fetch of manifest
                                                    and coverage from the store
```

The atlas and famous long tail are bundled. The rest of the reach tail, the
page/detail/trail shards and the cell data are lazy. `src/lib/cells.ts` is the
one origin for `manifest.json`, `coverage.json`, `poi/` and `trails/`.

## One model

`src/data/features.ts` defines `FeatureRow` and `Pick`. A peak, a park, a campsite
and a car park are one shape with a `cat`, and one `FeatureCard` renders every
pick. Categories live in `src/data/categories.json`; style expressions are built
from that list so a dot colour, icon, label and zoom floor cannot drift.

Ranking is deterministic: `src/data/rank.ts` sorts by importance (height for a
peak, a fixed share for a park or landmark) and assigns a band with per-cell
quotas of 1/z4, 2/z5 and 6/z6. The world view is therefore a world view, not the
Himalaya. Provenance (`src`, `quality`) survives but never decides prominence.

## State and storage

- React state for the selected filter, pick, camera focus and layers.
- `localStorage` holds the saved places (`lib/saved.ts`), versioned and capped.
- `sessionStorage` caches the IP-based home lookup per tab (`lib/locate.ts`) and
  the last globe camera (`lib/lastView.ts`).
- Module-level caches hold loaded cells, the reach chunks and one page/detail/trail
  shard; teardown resets the map-side ones.
- No account and no server: saves do not follow the reader to another browser.

## Invariants

1. One feature model, one card, one click path.
2. One cell-store origin (`lib/cells.ts`).
3. Every category has a colour or icon and a zoom floor; `validate` fails if a
   category has no records.
4. No two destination rows within 50 m unless the merge is documented in
   `src/data/atlas-merges.json`.
5. The manifest totals must agree with the files, and the strict coverage gate
   must pass before a data job publishes.
6. Generated files are not committed except the bundled manifest, atlas, reach
   data, place details, stats and the `reports/coverage.json` baseline.
7. A place page renders from the page index; the detail and trail shards are
   optional and a failure leaves the page intact.
8. Every detail image carries a credit and a licence; an uncredited image fails
   validation.
9. A practical pin is pushed once per frame, in its band, and at z8+ only inside
   the viewport; the cached cell is not the payload.
