# Changelog

## 2026-11-19 — Size means importance, and the planet is not the Himalaya

Every destination dot was the same size. The five bands shared one radius
(`1.2 px @ z0 → 4.6 px @ z14`), so a 7,000 m summit and an obscure atlas row drew
identically, and "major" existed only in the label layer. World view was worse: the
top 24 rows by height were all in seven z4 cells between the Andes and the
Himalaya, so Europe, Africa, North America and Oceania had no world dots at all.
Then nothing new appeared between z2.8 and z4.4, and z6.2/z7.6 added 20,000 rows at
once.

- `src/data/bands.json` is the one seven-band table: dot zoom, label zoom, radius
  scale, opacity, label size and cell quota. `src/data/rank.ts` assigns an explicit
  `band: 0–3` (atlas) with quotas of one per z4 cell, two per z5 cell and six per z6
  cell, so band 0 covers every continent (North America 24, Asia 20, South America
  15, Europe 14, Africa 12, Oceania 5) instead of seven cells in two ranges.
- The reveal is every 1.6–1.8 zoom levels (0, 1.8, 3.4, 5, 6.8, 8.4, 10) with
  cumulative counts 90 / 388 / 1,024 / 2,651 / 9,614 / 19,786 / 24,540. Labels now
  follow their dot by 0.8–1.0 zoom instead of lagging by up to three.
- Radius is the zoom base multiplied by the band scale (1.0 → 0.3), and label size
  follows the same order, so the early bands are visibly the larger points at any
  zoom.
- Reach tiers are capped per cell (`3` per z6 for tiers 1–2, `16` per z7 for tier
  3, `10` per z9 for tier 4) with overflow one band later. A single Alpine z6 cell
  holds 1,415 tier-3 rows; without the cap its band would draw a wall of dots. A
  1200×800 view over the Alps is now 373 dots at z5.5 and 363 at z7.5.
- `rankPlaces` no longer overloads `featured`/`curated` as band flags, so `src`
  provenance stays true; curated rows carry `editorial: true`.
- `npm run bands` writes `reports/dot-bands.{md,json}` (band counts, worst z6 cell,
  world spread, sample viewports) from the same table the map reads.

## 2026-11-18 — One kind of place, in categories

The map had four pin systems: 1,288 "named" atlas places, 23,254 "famous" Wikidata
places, 9,371,124 "mapped" OSM places and 6,013 "camps nearby" harvested in a radius
around the atlas. They were one class of place harvested four times, and the layers
panel and the globe hint presented provenance as taxonomy.

- `src/data/categories.json` is the one taxonomy: 16 destination and 13 practical
  categories with label, icon, colour, family and minzoom. `src/data/features.ts` is
  the one row and pick shape and the one style-expression builder.
- Destinations are one `features` source in five dot bands and five label bands;
  practical places are one `mapped` source with a layer per category. One click path,
  one `FeatureCard`, one ring source. The layer panel is one master, two group
  masters and a row per category with counts from the manifest; "Named places",
  "Famous places", "Everything mapped" and "Camps nearby" are gone, and search
  covers every category.
- The 8 km radius harvest is deleted (`kit.json`, `kit-detail.json`,
  `harvest-kit.mjs`, `src/map/kit.ts`, `src/map/reach.ts`, `src/map/poi.ts`). The
  world OSM cells cover that ground once.
- `importance()` no longer rewards curated rows, and the cap is per z6 cell (2 top +
  4 second, 24/360 globally), so 51 US entries can no longer crowd out one state.
- `src/data/manifest.json` carries totals, per-category counts, `generatedAt`, the
  validation result and failed extracts; every visible count reads from it.
  `scripts/validate-data.mjs` fails the build on schema, bounds, unknown categories,
  a category with no layer, duplicate rate or a manifest mismatch, and
  `scripts/audit-data.mjs` writes `reports/data-audit.{md,json}`.
- Fixed five destination label bands that MapLibre silently dropped: their
  `text-size` zoom stops descended for bands above 8, which fails style validation.
- `npm run data:refresh` runs atlas, reach, bulk merge, audit, manifest and validate
  in order; there is still no scheduler.

The audit now counts the 68 hand-written entries, which the manifest had been
missing: **24,540 destinations** (1,218 atlas + 68 hand-written + 23,254 long tail)
and 9,371,124 mapped places. The Georgia box went from 3 atlas / 71 long tail / 147
radius pins to 3 atlas / 34 hand-written / 71 long tail / 0 radius pins.

The two destination pairs that still sat within 50 m are resolved in the data, not
hidden: Tavan Bogd (Q143008) is the massif whose Wikidata `P610` highest point is
Hüiten Peak (Q1091113), both rows carried the same coordinate, and the massif's
4,082 m cannot describe a second summit there, so it is one row with Tavan Bogd as
an alias; Fitz Roy existed as both an atlas row (Q215138) and a guide entry, so the
guide row keeps its description and gains the Wikidata id. Each merge records the
absorbed row in `also` and the evidence in `src/data/atlas-merges.json`. The audit
now reports **0** pairs within 50 m, and `validate` fails the build on any new pair.

## 2026-11-18 — The cells move out of the repo, and the page says how much there is

The world harvest is 370 MB across 1,869 files. In git that made every clone pay for
it and made the push fail, so the cells now live in object storage: an R2 bucket
behind `poi-bucket/worker.js`, served at the same paths with a long cache and an open
CORS header, and writable only with the site's upload token. `public/poi` is
gitignored, `npm run poi:push` refills the bucket, and `VITE_POI_BASE` points the
loader anywhere else.

The interface now quotes the size of the set — **9,371,124 places in 1,869 files from
437 country extracts** — in the globe footer and on the World POIs switch, read from
`src/data/poi-stats.json` (generated by `npm run poi:stats`) instead of typed into a
component.

Fixes found by testing that data: five of the thirteen kinds had no layer at all and
were therefore invisible; a 276,000-row cell over the Alps overflowed the call stack
when its features were spread into a call; and eviction dropped cells that were
still on screen, fetching the same 11 MB again on the next pan.

## 2026-11-18 — The world's outdoor places, harvested from country extracts

Places to sleep, drink, shelter and park are no longer harvested in a radius around
written-up places. Every country's OpenStreetMap extract is streamed through
`pyosmium` and tiled into the cells the map already reads, so coverage follows the
ground rather than the atlas.

### The bulk path

- `scripts/harvest-poi-bulk.py` replaces the Overpass queue for the world pass:
  437 Geofabrik leaf extracts, ~75 GB, smallest first, with no request limits. The
  Overpass script stays as a regional fallback and now skips cells that already
  exist, so it cannot strip ids or tags from a bulk cell.
- **Thirteen categories**, no per-country cap and no "named only" filter: campsites
  (named or not), caravan sites, alpine and wilderness huts, shelters, drinking
  water, springs and taps, toilets, showers, parking, viewpoints, picnic sites,
  mountain passes, information boards and trailheads. Routes are counted, not drawn;
  the basemap already serves OSM's path network.
- Rows keep the OSM element id, and camping rows keep the tags that decide whether
  you can stay (`fee`, `capacity`, `access`, `operator`, `reservation`, facilities).
  A pin's card now summarises them — "Free · 40 pitches · water".
- **Parking travels separately.** It is often two thirds of a country's rows and
  only matters at street zoom, so it is written to `{y}.parking.json` and fetched
  only above z14.4.

### Resumable, validated, never silently partial

- Per-extract manifest (`state.json`) with status, counts, bytes, `Last-Modified`
  and attempts; failures in `failures.log`; rows written to `.part` and renamed.
- Merging goes to `public/.poi-staging`, reads every cell back and checks
  coordinates, kinds, id alignment and detail indices, then swaps atomically. It
  refuses to merge while extracts are missing unless `--allow-partial` is passed.
- `reports/poi-coverage.{md,json}` lists countries parsed and pending, totals per
  category, duplicate and exclusion stats, trail relations observed, failures and
  the validation result.

### The client

- New kinds with their own pictograms and zoom floors; parking in its own source and
  its own file; the World POIs switch and legend describe what is there.
- A failed cell load no longer caches its 404 forever: misses expire after five
  minutes, and a style rebuild re-pushes the loaded cells instead of leaving the
  layer empty.
- Credits now read "© OpenStreetMap contributors · OpenFreeMap · Terrain:
  Mapterhorn · Data: Wikidata".

The first full import is complete: 437 of 437 extracts, 75.5 GB streamed, no failures.
The merge wrote 3,530,458 places into 1,007 cells (186 MB) and 5,840,666 parking rows
into 862 files of their own (196 MB): **239,120 campsites**, 28,913 huts, 585,409
shelters, 29,776 caravan sites, 678,605 water sources, 445,756 toilets and 1,053,188
information boards, after dropping 237,618 repeated elements and 513,869 pins that sat
within 25 m of another of their kind. Every cell was read back and passed validation;
per-country counts are in `reports/poi-coverage.md`.

## 2026-11-15 — Phase 1: the map becomes terrain

Relief, colour and camera, reworked so the map reads as landscape at every zoom
level rather than only at world view.

### Relief

- The hillshade now sits **above** the vegetation and landuse fills and **below**
  water. It used to sit underneath, where a translucent green fill covered the
  shading and mid zooms collapsed into one flat teal sheet.
- The DEM source is declared in the style, not added at runtime. A layer that
  references a source added later makes MapLibre reject the whole style, which is
  what had made static hillshade declarations produce a blank map.
- The DEM pyramid runs to **z15** instead of stopping at z10, so deep zooms have
  real data rather than one overzoomed blob.
- Exaggeration **scales with zoom** (1.15 at z3.2 → 3.4 at z15). Terra's deep
  tiles are bilinearly upsampled, so the slope between neighbouring texels shrinks
  as you zoom in; at a fixed exaggeration the shading flattened to a grey wash.
- The light is a deep green (`#46603f`) against near-black shadow, so lit slopes
  keep their colour instead of washing out pale.
- Glacier polygons fade to 22% with zoom, so shaded rock shows through an icefield
  instead of being covered by a pale sheet.

### Colour

- Base land, forest and pasture each carry a distinct hue, so regional views stay
  coloured when the fills cover the frame.
- Rivers fade in over z6→z7 instead of snapping on at full opacity mid-flight.

### Map furniture

- Layer control (relief, contours, detail, labels, places), ⌘K/Ctrl-K search,
  contour generation from the DEM, and selection that only flies if the camera is
  further out than z6.4, so you never lose context.

### Data

- 1,288 places across 157 countries: 650 peaks ranked by topographic prominence,
  380 parks, 190 natural landmarks and 68 curated entries. No cities, no buildings,
  no cultural sites — outdoor places only.
