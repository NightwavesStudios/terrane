# Terrane

**The world, worth the detour.**

An interactive globe for exploring what is worth going outside for: peaks, ranges,
parks, coastlines, campsites, water and parking. Spin the globe, click a point, land
somewhere.

**9,395,664 places in 29 categories**, one model: 24,540 destinations (1,218 atlas
rows, 68 hand-written entries and a 23,254-row Wikidata long tail) and 9,371,124
mapped places from OpenStreetMap. Peaks, parks and landmarks lead; the practical categories are what
you need once you are there. Coverage is uneven, and
[Sources, coverage and freshness](#sources-coverage-and-freshness) says exactly
where.

> **Status — facts only.** Written field guides are deliberately *not* in the product.
> Place pages show type, high point, country and coordinates, and nothing invented.
> The prose that used to sit behind each of the 68 places has been removed from the
> data file rather than left unrendered; only `tagline` (Explore search) and
> `difficulty` (card badge) survive of that layer.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # seo + manifest + validate + tsc + vite → dist/
npm test           # unit tests: routing, cell maths, ranking
npm run audit      # data density, duplicates and freshness → reports/
npm run preview    # serve the production build
npm run single     # bundle dist/ into one self-contained terrane.html (~2 MB)
npm run atlas      # regenerate src/data/atlas.json (needs python3, ~35s)
```

### The single file

`npm run build && npm run single` produces **`terrane.html`** at the project root:
CSS, JS and all fifteen woff2 font subsets are inlined (fonts as base64), so the
file has no sibling dependencies. Open it in a browser and the whole app is there.

Serve it rather than double-clicking if the globe stays dark: browsers block
MapLibre's blob workers on `file://` origins, and the app detects that case and
says so on screen (`Globe.tsx` → the 8 s `stalled` guard). `npx serve .` is enough.

Node 20+ and, for `npm run atlas` only, a Python 3 install with standard library.
No API keys, no environment variables, no backend.

`npm run dev` prints a LAN URL — the map needs network access for vector tiles and
terrain, so a fully offline dev session will show the base style but no land or
terrain.

---

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Build | Vite 8 (`@vitejs/plugin-react`) | plain SPA, no SSR; route- and map-level code splitting |
| UI | React 19 + TypeScript 7, `strict` + `noUnusedLocals` | unused imports fail the build |
| Map | **MapLibre GL 5** (`^5.24.1`, major held) | see [Why MapLibre is held at v5](#why-maplibre-is-held-at-v5) |
| Routing | ~45 lines in `src/lib/router.ts` | no router dependency |
| Styling | one hand-written `src/styles.css` | no CSS framework, no CSS modules |
| Fonts | self-hosted in `public/fonts/` | Fraunces, Sora, Plus Jakarta Sans, JetBrains Mono |
| State | React state + `localStorage` | no store library |
| Tests | none yet | `npm run build` is the check |

No images ship with the app: every "photo" is generated SVG (`RidgeArt`).

---

## Routes

Routing is real paths via the History API, parsed by hand.

| Path | Page | What it is |
| --- | --- | --- |
| `/` | `Home` | The globe, full bleed. Nothing else but the header, a caption and filters. |
| `/?place=<slug>` | `Home` | Globe with that place pre-selected and flown to. |
| `/explore`, `/saved`, `/about` | — | Removed. All three now fall through to the globe, which is the index. |
| `/place/:slug` | `Place` | Fact sheet: hero art, type, high point, country, coordinates, "Around it" (activities and distances computed from the atlas). |
| anything else | `Home` | Unknown paths fall through to the globe. |

---

## How the globe works

`src/map/style.ts` (the basemap), `src/map/Globe.tsx` (the React component that owns
a `Map`), `src/map/dem.ts` (the elevation tile protocol), `src/map/contours.ts` (the
contour worker) and `src/map/camera.ts` (camera maths with no MapLibre import, so
pages can size the opening view without pulling the map library into the entry
chunk).

### `src/map/style.ts`

- `MAP_STYLE` — a full MapLibre style spec, hand-written JSON in TS.
- `createStyle()` — returns `structuredClone(MAP_STYLE)`. **MapLibre mutates the spec
  it is given**, so a map created twice (React StrictMode does exactly that in dev)
  must not share one object.
- `FIRST_SYMBOL_LAYER = "label-country"` — the insertion point for the terrain
  hillshade layer, added at runtime.
- `TERRAIN_SOURCE` — Mapterhorn Terrarium DEM (512 px, `encoding: "terrarium"`,
  `maxzoom: 14`), fetched through the `terranedem://` protocol in `src/map/dem.ts`
  — see the relief note below. Used for the hillshade; contours fetch the same
  tiles over HTTPS.

**The palette** ("Deep Water") is deliberately not near-black. The vector source
(OpenFreeMap, no key) ships water polygons and no land polygons, so at world zoom
every continent would otherwise be the background colour — the same colour as space.
`land-base` solves it: a GeoJSON backdrop of **2° latitude bands**, generated in
`style.ts`, sitting *under* the water layers. Water paints over it, land keeps its
colour, and the globe reads as a globe instead of a hole.

One flat land colour was the reason the Sahara looked as green as a meadow. At the
zooms where you look at whole countries there is almost no landcover mapped, so the
backdrop colour *is* the desert, the taiga and the pampas. Latitude is a crude
climate proxy and the cheapest one there is — 90 static polygons, no tiles, no
per-frame cost — so a dry belt sits either side of 30°, the temperate and
equatorial bands stay green, and the stops are interpolated every 2° so the seam
is not a visible line across the desert. Landcover still paints over it wherever
OSM has polygons.

`style.ts` declares three sources: `world` (the bands), `relief` (the DEM) and
`openmaptiles`.

The DEM source belongs in the style even though the hillshade *layer* is added at
runtime. A layer that references a source added later makes MapLibre reject the
whole style — blank map, `getStyle()` undefined — which is what made every attempt
to declare the hillshade statically look like a broken layer.

Layer order, bottom to top:

```
bg → land-base → landcover-{wood,grass,farmland,ice,rock,sand}
→ landuse-residential → relief-hillshade → relief-snow
→ contours-{minor,major}
→ water → waterway → boundary-{country,state} → water-label
→ road-{minor,major,highway} → trails-{casing,path} → label-{country,state,city}
→ features-dot-{0,1.8,3.4,5,6.8,8.4,10} → features-label-{0,2.8,4.4,6,7.8,9.4,11}
→ mapped-<category> → mapped-label-{early,late} → pick-ring
```

The hillshade sits **above every land polygon and below the snow**. That is the
single ordering rule the palette depends on, and it was learned the hard way:

- **Every fill underneath.** Rock, sand and built-up areas used to be drawn after
  the shade. A fill over the shade is flat, and a flat patch with a hard edge is
  what made those three look pasted onto the map while forest and grass looked
  embedded — the same OSM polygon, blended or not depending purely on where it sat
  in the stack. With all of them below, each boundary is a shift of tone instead of
  a cut-out edge.
- **Snow above the shade.** The shade's lit colour is a green; drawn over snow it
  tints a snowfield moss-coloured. Snow sits on top, translucent, so it stays white
  and the shading still reads through.

**Why snow is a DEM layer and not a fill.** It started as a white fill on the
`landcover class=ice` polygons, and past z13 those read as what they are: flat
shapes with straight-ish edges laid over the terrain, which is exactly why snow
never sat in the landscape the way sand and rock do. Two attempts at fixing the
fill — lowering its opacity, taking it under the hillshade — traded a hard edge for
a green one, because the hillshade's lit colour is a green and it multiplies
everything above or below it.

`color-relief` (MapLibre 5.6+, on the DEM source the hillshade already uses) colours
the DEM's own pixels by elevation, so there is no polygon to see: the snowline is a
2.4 km ramp starting at 2600 m and the shading reads through at 68 % at most. A
one-elevation step looks like a pasted shape from above; a long ramp looks like snow
arriving up a face, which is the whole difference.

Measured cost of the extra DEM pass at z13.2 on a warmed level: 38.8 fps with it,
38.4 without, 37.7 with it again — inside noise, because the tiles are the same
tiles the hillshade is already reading.

Splitting the fills at `landcover-ice` satisfies both with one insertion point
(`FIRST_SYMBOL_LAYER` / `landcover-ice` fallback chain in `Globe.tsx`).

Colour, all of it vector — no extra tile pyramid, no per-frame cost:

| | |
|---|---|
| Snow, ice caps | `landcover class=ice`, `#e4edef` — not paper white, and kept at 0.3–0.4 opacity above the hillshade so the shading reads *through* the sheet. At 0.5 the glacier edges were hard white boundaries against shaded rock; a one-pixel outline of the same tone feathers the border |
| Rock, scree | `landcover class=rock`, warm brown, so altitude reads as a colour band |
| Sand | `landcover class=sand`, warm `#cbaa79`; only where OSM maps sand, so ergs and beaches, not the whole Sahara (the latitude bands handle the rest) |
| Farmland | `landcover class=farmland`, a lighter field green under wood and grass |
| Water | one `water` layer, `match` on `class`: ocean `#03182b` → lake `#06293f` → river `#0a3a53` |

**Depth by body, not bathymetry.** There is no depth field in these tiles, and a
real bathymetry raster would mean a whole extra tile pyramid for one gradient. Ocean,
lake and river are ordered the way people read depth, which is true of almost every
water body and free. Deep water looking deep is the goal; a measured depth profile
is not what this layer claims.

Labelling is zoom-gated so the world view stays clean: country labels from 2.2 to 6,
state labels from 5.5, city labels from 5. Coastlines come from
`fill-outline-color` on the `water` layer.

### `src/map/Globe.tsx`

Props: `places` (already filtered and ranked), one `pick`, `onPick`, optional
`focus` (`{lon, lat, zoom, key}` — the chip bar uses this to fly home or to the
visitor's country).

- **Init** happens once: globe projection (`setProjection({type:"globe"})`),
  `center [12, 22]`, `maxZoom 16`, `attributionControl: false` (attribution is
  rendered as page text instead, so it can't collide with the filter pill),
  `dragRotate`, `maxPitch 60`.
- **Opening zoom is responsive.** `worldZoom(width, height)` (exported, also used
  by Home when it resets the camera) solves for a planet that fits the stage: the
  rendered globe diameter is ≈ `161 · 2^zoom` CSS px, so
  `zoom = log2(min(width · 0.9, height · 0.82) / 161)`, clamped to `0.6…2.2`.
  Phones get the whole sphere instead of a planet cropped at both edges; a desktop
  window fills the stage instead of floating a small globe in black.
- **Bootstrap** runs on `style.load`, again on `load`, and once more on a 2.5 s timer
  if `isStyleLoaded()` — a `booted` ref makes it idempotent. Inside it: the
  `hillshade` layer, `setSky` (atmosphere), the `features`, `mapped` and `pick`
  sources, and every category layer. Each risky call is individually try/caught so
  a browser without hillshade or sky support still gets a working globe.
- **Relief comes from one hillshade — no terrain mesh.** A `relief` DEM source
  (`encoding: "terrarium"`, `tileSize: 512`, `maxzoom: 14`) feeds
  `relief-hillshade`, added as soon as the style lands.
  - **The DEM is Mapterhorn, not AWS.** AWS/Mapzen Terrarium is the default free
    terrain source, but past z11 it is a bilinear upsample of itself: on the Alps a
    z12 tile is ~98% predictable from its z11 parent (RMS 8 m against a 365 m
    spread), so its "12 m" at z15 is the same ~150 m surface resampled. Replaced
    with Mapterhorn — Terrarium at **512 px** from Copernicus GLO-30 (30 m) plus
    national LiDAR/ALS models (1–5 m) where they exist. Same encoding, same URL
    shape, no key.
  - **Two providers, so relief survives an outage.** Mapterhorn first; after two
    consecutive network failures it is skipped for five minutes and every tile
    comes from **AWS Terrarium** (256 px, native to z11, independent
    infrastructure) through the same resample. Verified by blocking
    `tiles.mapterhorn.com` in the browser: the hillshade still renders. A third
    option is Re:Earth Terrain, which serves the same Mapterhorn DEM as Terrarium
    from its own edge cache.
  - **Coverage is learned per cell, not probed per tile.** z13/z14 exist only over
    national DEMs, and the provider publishes no coverage metadata, so the pipeline
    probes once per **z12 cell** (at most two requests) and remembers the answer
    for the session. Tiles in the same cell then go straight to the right level, and
    exact 404s are cached too. Because the probes happen inside the worker, they no
    longer reach the page console either — a 6×-throttled z14 viewport over the
    Himalaya now logs **zero** console errors.
  - **The grid follows the zoom.** Tiles below z12 are built on a 256 px grid and
    z12+ on the full 512 one. Slopes stay correct either way because MapLibre's
    prepare shader takes metres-per-texel from the image grid, not from the
    source's `tileSize`. It is a bandwidth/memory saving, not a frame-rate one:
    the frame cost scales with the number of DEM tiles, and both grids use the
    same tiles (see the limitations below).
  - **Every requested zoom gets a real tile** (`src/map/demPipeline.ts`). MapLibre's slope
    maths divides by the tile ID's zoom, so an *overzoomed* tile has its slopes
    multiplied by 2^(camera − tile): steep faces saturate to solid shadow and the
    paint exaggeration has to be dropped to compensate, which is what flattened the
    relief. Mapterhorn's global pyramid ends at z12 (`z13+` only exists over
    national datasets, and returns 404 elsewhere), so the source declares
    `maxzoom: 14` and a custom protocol answers z13/z14 either with the native tile
    or with the z12 parent **resampled up to the requested extent**. Four children
    share one parent decode; a tile missing everywhere resolves to flat sea level so
    relief never has a hole.
  - **The resample runs on decoded elevations, not the encoded image.** Terrarium
    packs one number into R, G and B, so interpolating the channels separately puts
    a 256 m notch wherever the carry lands — rendered as hillshade, that artifact
    drew a hard contour line every 256 m across the whole view. Decode → bilinear →
    one clamped unsharp pass → re-encode. Each tile is computed with one pixel of
    apron from the parent grid and cropped afterwards, so the tile next door
    samples the same values across the shared edge; without the apron the
    sharpening pass has a one-sided neighbourhood at the border and every tile edge
    showed as a hairline step in the hillshade.
  - **The pipeline runs in a worker.** Measured on a 390×844 phone viewport at 6×
    CPU throttle, z14 over the Himalaya, ten synthesized tiles: run inline, the
    resample cost **717 ms of blocking compute and 22 long tasks totalling 4234 ms**
    for one viewport. `dem.worker.ts` (inlined via `?worker&inline`, so the
    single-file build stays self-contained) now does fetch → decode → resample →
    encode, and the main thread only receives an `ImageBitmap`: **0 ms of DEM work
    on the main thread**, with 120 ms mean and 206 ms max per resampled tile spent
    in the worker (≈20–34 ms at normal speed). Relief being on costs the frame time
    nothing: panning that viewport with the hillshade layer removed measured a
    262 ms median frame against 258 ms with it, so what limits frames at z13–z14 is
    MapLibre's own style and tile work, not the DEM path. Concurrency is capped at 6
    tiles in flight, a tile that never arrives degrades to a blank tile instead of a
    hole, and if a worker cannot be created the pipeline falls back to running on
    the main thread.
  - **`hillshade-method: "standard"`** (MapLibre's own curve) rather than `basic`:
    basic clamps at full highlight/shadow, so a 1–5 m LiDAR DEM turns into black
    valleys and blown-out pale plateaus at deep zoom. `standard` keeps the mid tones
    of a mountain flank while still reading as a lit surface.
  - **Exaggeration is a `0…1` dial.** The style spec caps `hillshade-exaggeration` at
    1, so the old 1.15 → 3.4 curve was an invalid paint value that MapLibre rejected
    (the layer silently kept its previous value). With a real tile for every zoom
    there is no overscale factor to fight, so the curve holds near 0.9 through the
    regional zooms and only eases to 0.74 at z14 (enough to keep 1–5 m LiDAR noise
    from sparkling on snowfields).
  - A second "fine" pass used to sit on top. It was removed: a hillshade is the
    most expensive layer per pixel (the DEM is resampled every frame the camera
    moves), and two of them doubled that for a subtle gain. One pass carries the
    Alps on its own.
  - `hillshade-illumination-anchor: "map"` — with the default (`viewport`) the
    light is fixed to the screen, so pitching the camera swings shadows across
    the ridges and the relief appears to slide.
  - Both use **zoom-interpolated exaggeration instead of `minzoom`**: a hillshade
    layer has no opacity property, so a `minzoom` makes the entire planet snap
    into relief at one threshold. Ramping exaggeration from 0 gives a gradual
    fade-in instead. Verified at world scale (flat) and at z6.4 (full relief).
  - `setTerrain` was removed. On globe projection the mesh did not displace the
    surface, yet still fetched a second DEM pyramid (z3…z8 for a single view) and
    re-tessellated on every gesture. Removing it roughly halves elevation traffic
    with no visual loss.
  - Do **not** move a hillshade into the static style: MapLibre fails to parse the
    whole style (blank map, `getStyle()` undefined). Verified twice.
  - Do **not** add a `color-relief` layer: it paints flat over the globe and hides
    the hillshade.
  - Naming a hillshade layer exactly `hillshade` gets it silently dropped.

- **Loading while zooming.** The app is tile-bound before it is anything else, so
  the map is configured for continuity (`Globe.tsx`):
  - `fadeDuration: 180` — arriving tiles cross-fade; this also fades symbols in
    and out as they cross their `minzoom` thresholds. Kept short: a 280 ms fade
    over every tile of a zoom gesture is itself a full-screen alpha blend, and it
    made a dive read as a slow dissolve rather than a move.
  - **Cache prefetch.** MapLibre 5 dropped `prefetchZoomDelta` (and `map.setPrefetchZoomDelta`
    no longer exists), so every zoom step is a cold request for a new pyramid.
    While a gesture runs, `prefetch()` in `Globe.tsx` fetches up to eight tiles for
    the next integer zoom into the HTTP cache, so MapLibre's own request can hit it.
    It reads the resolved tile template off the source once and caches it — asking
    `getStyle()` on every zoom event serialized the whole style.
    Measured on one region (Japan, cold cache, world → z6.4): 8.8 s to fully loaded
    with it, 13.2 s without; on another (Patagonia) the difference was inside the
    noise (12.7 s vs 12.5 s). Treat it as cheap insurance, not a guarantee.
  - `refreshExpiredTiles: false` — OSM tiles carry a short expiry, and refetching
    them mid-zoom is what puts holes in a range you are diving into.
  - `maxTileCacheSize: 48`, `renderWorldCopies: false` — a deliberate cap so the
    DEM tiles' GPU memory is bounded, never request the globe twice. 128 was tried
    and reverted: it measured the same zoom frame rate, and sampling the drawing
    buffer through a ten-step wheel zoom showed **0 % background pixels** at both
    sizes, so retention was not what made zooms feel heavy.
  - **Pitch follows the zoom at rest, not during the gesture.** Setting the
    pitch mid-gesture re-projects the camera, changes the tile cover under the
    finger and throws away what is on screen; a zoom then goes blank exactly when
    you are watching it. It is applied on `moveend` instead.
  - Line layers have no cross-fade of their own, so roads fade in over roughly one
    zoom level via `line-opacity` ramps (`style.ts`).
  - Marker dots and both label tiers fade in over a zoom range rather than popping
    at a threshold.
  - A layer past its band is at `minzoom`, not merely transparent, so there is no
    per-feature cost for a category you have zoomed out of.
  - **No hit-testing mid-gesture.** `mousemove` used to run a 3-layer spatial query
    on every pointer event — ~60 a second, and during a wheel zoom the pointer is
    always moving, so it ran through the entire gesture. It now bails while
    `isMoving()` and is throttled to 16 Hz otherwise.
  - **Pitch is throttled.** `applyPitch` runs on the `zoom` event but only calls
    `setPitch` at most every 120 ms and only when the tilt moved more than 1.2°;
    each `setPitch` re-renders the whole camera, so doing it every frame doubled
    the work of a gesture.

- **A name is drawn by exactly one label layer.** Each band filters on `lz == band`
  and carries its own `minzoom`, so a feature cannot be placed twice. The previous
  pair needed a `tier != 1` exclusion to stop every featured place getting two
  labels at the same offset; the band property makes that impossible by construction.
- **Zooming is camera travel.** `pitchForZoom(z)` tilts the camera from level at
  planet scale to 55° over a range, so the same continuous zoom reveals relief
  instead of switching modes. The tilt is applied when the camera comes to rest
  (`moveend`), not on every zoom frame: a mid-gesture `setPitch` re-projects the
  camera, changes the tile cover under the finger and reloads what is already on
  screen, which is what made a zoom flicker and go blank. Programmatic `flyTo`s
  carry their own `pitch`, and the auto-pitch bails out while `map.isEasing()` — a
  `setPitch` mid-flight cancels the flight, which is what once stopped selections
  at zoom 2 instead of 6.4. It also hands over permanently the moment the user
  pitches by hand (`pitchstart` with an `originalEvent`).
- **Markers are GPU geometry, not DOM.** 9.4 million DOM markers would not just
  crawl, they would not fit. Destinations are one GeoJSON source (`features`) drawn
  by seven dot bands and seven label bands; practical places are a second source
  (`mapped`) with one icon layer per category and two label bands. A band is a zoom,
  not a class of place.
- **Reveal is by importance, then by zoom.** `src/data/bands.json` is the one band
  table: eight-figure mountains get the largest circle at the planet view, each
  later band draws smaller, and every band starts within 1.8 zoom levels of the
  previous one, so the map fills steadily instead of showing nothing and then
  10,000 dots. Band 0 is one row per z4 cell, so the world view is spread across
  every continent instead of being the Himalaya. Atlas depth is capped per z5 and
  z6 cell; the Wikidata tiers are capped per cell too (one Alpine cell holds 1,415
  tier-3 rows) and overflow to one later band. Nothing waits behind a separate
  switch because of where it was harvested.
- **Size means rank.** The dot radius is the zoom's base radius multiplied by the
  band's scale (1.0 at band 0 down to 0.3 at the tail), and label size follows the
  same order. Two dots at the same zoom are no longer the same size just because
  both are peaks.
- **One click, one card.** Every layer carries the same `cat` property, so the hit
  test is one query over the destination and practical layers and hands back the same
  `Pick` shape. A summit with a page and a campsite without one open the same card;
  only the action differs.
- **Category switches are filters and visibility.** Destination dots share their
  layers, so turning a destination category off updates the filter on ten layers.
  Practical categories own a layer each, so switching one is a layout property.
  Turning everything off is one master, not four.
- **Filtering the chips** changes only the ranked atlas half: the chips answer "what
  should I go and see", while the practical categories are chosen in the Layers
  panel. Re-ranking calls `setAtlasPlaces`, which replaces the atlas rows without
  touching the long tail or the loaded cells.
- **Selection** writes one feature into the `pick` source — a ring on the spot — and
  flies the camera: z14.2 for a destination with a page, z12.6 for a long-tail or
  practical pin, with padding so the card does not cover the marker.
- **Resizing** is handled by a `ResizeObserver` calling `map.resize()`.
- In dev, the map is exposed as `window.__terraneMap` for console debugging.

---

## Data

### One model, 29 categories

Everything the map draws is a **feature**: a point with a category.

| Field | Meaning |
| --- | --- |
| `cat` | one id from `src/data/categories.json` |
| `name?` | display name; empty for plenty of mapped pins |
| `lat`, `lon` | decimal degrees |
| `dot`, `lz` | zoom its dot and its name appear at |
| `slug?` | page to read, when there is one |
| `near?` | slug of the nearest destination, when recorded |
| `note?` | mapped facts (fee, capacity, facilities) for a pin card |
| `elev?`, `hue?` | metres, and the seed for generated art |
| `src` | `editorial`, `atlas`, `wikidata` or `osm` |

`src` exists for provenance and confidence. It never decides which switch a pin
belongs under, which card it opens, or what it is called on screen.

`src/data/categories.json` is the whole taxonomy and the only list the map, the
layer panel, the cards and the search read:

- **Destinations (16):** peak, volcano, range, valley, park, reserve, landmark,
  waterfall, lake, glacier, cave, canyon, beach, island, desert, hot spring.
- **Places to stay & use (13):** campsite, caravan site, mountain hut, shelter,
  water, toilets, shower, parking, viewpoint, picnic site, mountain pass,
  trailhead, information board.

The old interface had four point products — "Named places", "Famous places",
"Everything mapped", "Camps nearby". They were four harvests of one class of thing.
There is now one master switch, two group masters and one row per category.

### `src/data/places.ts`

The 68 hand-written entries plus the 1,218 atlas rows, as before. Both are now
**destinations**, with no special ranking weight:

- `CURATED` is still 68 entries, 51 of them in the United States and 33 in Georgia.
  They have pages; they no longer out-rank a 4,900 m summit just for being written
  by hand.
- `ATLAS` maps `atlas.json` into the same `Place` shape.
- `bySlug`, `TYPE_LABEL`, `kmApart`, `aroundPlace` and `COUNTRY_COUNT` remain.
- `FEATURED`, `GEORGIA` and `CURATED_PLACES` are gone; they were dead exports and
  the Georgia one was the shape of the old problem.

### `src/data/atlas.json` (generated, 1,218 rows)

`{ wd, slug, name, type, country, lat, lon, elevation }` — **650 peaks, 380 parks,
190 natural landmarks** across 156 countries. (Earlier revisions of this file said
420 peaks and 260 landmarks; the script has shipped 650/190 for some time, and the
README was wrong.) **Do not hand-edit**; `npm run atlas` overwrites it.

`scripts/build-atlas.py` queries Wikidata (CC0), requires an English Wikipedia
sitelink, converts elevations from feet where needed, dedupes against the curated
set, and caps **42 peaks / 15 parks / 6 landmarks per country**. It is a selection,
not a census: 41 countries have exactly one row, 64 have two or fewer, and the
median is three.

### `src/data/reach.json`, `reach-more.json` (23,254 rows)

The long tail from `scripts/harvest-reach.py`: outdoor things in Wikidata with a
coordinate, ranked by how many Wikipedia language editions cover them.

| Tier | Sitelinks | Points | Dot | Name |
| --- | --- | ---: | --- | --- |
| 1 | ≥ 60 | 327 | z2.8 | z5.8 |
| 2 | 25–59 | 2,337 | z4.4 | z5.8 |
| 3 | 10–24 | 9,351 | z6.2 | z10.4 |
| 4 | 4–9 | 11,239 | z7.6 | z10.4 |

The famous half (tiers 1–2, 128 kB) loads after first paint; the tail
(`reach-more.json`, 867 kB) is fetched the first time the camera passes z6.6, before
its first band at z6.8. Both feed the same `features` source and the same category
switches as the atlas.

### `src/map/destinations.ts`

Owns the destination source and its **seven dot bands and seven label bands**, all
generated from `src/data/bands.json`. A band is a zoom, not a class: Everest and a
2,400 m shoulder are both peaks and arrive at different times, with the earlier band
visibly larger. Category switches are filters on those fourteen layers, so turning
`Beaches` off is one filter update rather than hiding a whole source. `npm run
bands` writes `reports/dot-bands.{md,json}` — band sizes, world spread and a
1200×800 clutter estimate for Europe, the Alps, Georgia and the Himalaya.

### `src/map/mapped.ts`

The practical half, one JSON file per z6 cell, fetched as you look at it.

```
public/poi/6/{x}/{y}.json           # [lat, lon, kindIndex, name?]
public/poi/6/{x}/{y}.parking.json   # parking, fetched only past z14.4
```

`scripts/harvest-poi-bulk.py` streams 437 Geofabrik country extracts through
pyosmium. One row index maps to a category; the cell is fetched at most six at a
time, only above z9.2, and never refetched. Parking has its own file, source and
budget because it is often two thirds of a country's rows and only matters at
street zoom.

The radius harvest (`scripts/harvest-kit.mjs`, `kit.json`, `kit-detail.json`) is
**deleted**. It seeded camps in an 8 km circle around the atlas places of the time, which is why
Georgia had 281 pins and Kazakhstan had almost none, and its rows had to be excluded
from the world harvest within 60 m to avoid drawing each campsite twice.

### Ranking — per cell, not per country

`src/data/rank.ts` scores a place on what it is, never on which file it came from:
height for a peak, a fixed weight for a park or landmark. `featured` and `curated`
are output flags, assigned by that ranking.

Names are capped at **two per z6 cell** for the first pass and **four more per cell**
for the second. A country cap could not constrain a US state, which is why 33 Georgia
entries used to win the US slots and the map named one corner of one country.

### The manifest, the validator and the audit

```bash
npm run manifest   # src/data/manifest.json: counts, dates, sources, categories
npm run validate   # schema, bounds, categories, duplicates, manifest agreement
npm run audit      # reports/data-audit.{md,json}: density, duplicates, freshness
npm run data:refresh
```

`npm run build` runs the manifest and the validator before `tsc`. The validator
fails the build if a category has no records, a coordinate is out of range, a slug
collides, the category registry and the POI kind table disagree, or the manifest
counts drift from the files. The interface prints its counts from the manifest, so
no number is typed into a component.

`npm run audit` is read-only. It records the per-country distribution, the density
of every z6 cell, duplicate pairs inside 50 m and 110 m, and the Georgia box, which
is how the before/after below was measured.

---

## State and persistence

### `src/lib/locate.ts` — where the visitor is

`locate()` asks `https://ipwho.is/` once per session for country, region and
coordinates. Keyless, CORS-enabled, no permission prompt — `navigator.geolocation`
would ask before the visitor has touched the map, and a canton is all this needs.
The answer is cached in `sessionStorage` (`terrane:home`), and a failure is recorded
so a blocked or broken lookup is not retried on every render: the chip simply does
not appear.

`homeScope()` turns that into the extra filter chip. It looks for a *region* first,
then a country, then gives up — a chip that filters to an empty map is worse than no
chip. Region names never match across sources ("Valais" against "Canton du Valais"),
so comparison is on letters only, in either direction.

There is no account, no server and nothing persisted between sessions.

### `src/lib/router.ts`

`navigate(to)` pushes state, notifies subscribers (an internal `Set` plus `popstate`)
and scrolls to top. `parseRoute(pathname)` maps a path to a `Route` union;
`useRoute()` subscribes a component to it. `navigate` is a no-op when already on the
target path.

---

## Components (`src/components/`)

| File | Role |
| --- | --- |
| `Header.tsx` | Wordmark, a single `Globe` link and the place-count pill. `tone="dark"` over the globe, `"light"` on the place page. |
| `FilterChips.tsx` | `All destinations`, `Peaks`, `Parks`, plus whatever `homeScope` resolved (region, country, or nothing). The other destination categories are still on the globe and in All; a chip row is a short decision, not the full taxonomy. Also exports `homeScope(home)` and `matches(place, filter, scope)`. |
| `MapSearch.tsx` | ⌘K search over every category: atlas and loaded Wikidata names, plus OSM pins as their cells arrive. |
| `LayerControl.tsx` | Base switches, one master, two group masters and one row per category, with counts from the manifest. |
| `FeatureCard.tsx` | The one card: category, name, elevation or mapped note, nearest destination and a page link when there is one. |
| `RidgeArt.tsx` | Deterministic SVG landscape from a `hue`: gradient sky, sun glow, two ridge lines, snow caps. Uses `useId()` for unique gradient ids so many can coexist. No photography anywhere in the app. |

## Pages (`src/pages/`)

| File | Role |
| --- | --- |
| `Home.tsx` | Owns filter state and the one `Pick`, composes `Globe`, the header, the manifest caption, the credits, the filter bar and `FeatureCard`. Filter changes refocus the camera (the visitor's own country, or the world). |
| `Place.tsx` | Fact sheet. Hero art + eyebrow, optional elevation under the title, a four-cell stat grid (type / high point / country / coordinates), "Around it", and "See it on the globe" in the aside. Unknown slugs get a not-found block. |

There are only two pages now. Explore was removed as a slower copy of the globe's
own search and filters; Saved and its collections were removed with it, and About
went too — a four-paragraph page that explained a map is worse than the map.

`src/App.tsx` maps the route to a page and sets `document.title`;
`src/main.tsx` mounts it into `#root` inside `StrictMode`.

---

## Styling

One file, `src/styles.css` (~1,600 lines), organised in commented sections: tokens →
buttons → header → home/globe → cards → place → explore/saved → about → footer →
responsive tweaks.

Design tokens live at the top as CSS custom properties: night (`--night #05070c`),
paper (`--paper #f4f1e8`), ink ramp, and accents `--mint`, `--peri`, `--clay`,
`--moss`, plus the four font stacks. Two registers coexist on purpose: **dark** for
the globe, **paper** for reading pages.

Globe-specific pieces worth knowing:

- `.home` is `100dvh`, `overflow: hidden`, and hosts `Globe`, then `.vignette`
  (radial darkening at the edges) and — since the palette got brighter — a
  `.home::before` top scrim that keeps the header, caption and credits legible over
  land.
- `.globe-filters` is the centred bottom pill; `.pick` is the selection card, lifted
  above the pill so the two never overlap.
- `.globe-hint` / `.globe-credits` are the two mono lines at the top; the credits line
  is hidden on small screens.

Fonts are vendored: `public/fonts.css` declares the four families with
`unicode-range` splits, and `public/fonts/*.woff2` holds the subsets. `index.html`
links `/fonts.css`, and no font is fetched from Google.

---

## Repository extras

| Path | What it is |
| --- | --- |
| `public/` | Fonts and `fonts.css`, the icons (`favicon.svg`, `icon-180.png`), `og.jpg`, `manifest.webmanifest`, and the generated `robots.txt` + `sitemap.xml`. |
| `scripts/gen-seo.mjs` | Writes `public/sitemap.xml` (home + every place slug) and `public/robots.txt`. Runs before every build; `npm run seo` runs it alone. |
| `scripts/build-atlas.py` | Regenerates `src/data/atlas.json` from Wikidata + Natural Earth. Reads `src/data/curated-index.json` for the protected slug list. |
| `scripts/build-standalone.mjs` | Packs `dist/` into the single-file `terrane.html`. |
| `terrane.html` | Build output (gitignored): the whole app in one file. |
| `vercel.json` | The deploy: `dist`, an SPA rewrite to `index.html`, immutable caching for `/assets`. |
| `.github/workflows/` | `ci.yml` (typecheck, tests, validate, build on every push and PR) plus the four scheduled data refreshes and the coverage report. |
| `docs/deploy.md` | Everything a deploy touches: the Vercel project, environment variables, GitHub secrets and variables, the cron map, rollback. |
| `.nvmrc`, `.editorconfig` | Node 22 for local, CI and Vercel; two-space TS, four-space Python. |
| `.github/dependabot.yml`, `.github/pull_request_template.md` | Weekly npm and monthly Actions updates; the PR checklist. |

---

## Checks

```bash
npm run build      # seo + manifest + validate + tsc -b + vite build
npm run typecheck  # tsc -b, no emit
npm test           # vitest: routing, cell maths, ranking
npm run check      # typecheck + tests + data validate
npm run validate   # data schema, categories, duplicates, manifest agreement
npm run audit      # reports/data-audit.{md,json}
```

`.github/workflows/ci.yml` runs typecheck, the tests, the validator and the full
build on every push to `main` and every pull request, so a red check is the same
failure Vercel would hit. There is still no linter.

The suite covers the pure modules only (`src/lib/router.ts`, `src/data/rank.ts`).
The globe needs WebGL and the map style needs the network, so it is checked by the
build and by opening the page, not by the tests. [Deploying](docs/deploy.md) has
the Vercel project, secrets and cron map.

Expected build footprint: entry chunk ~449 kB JS (≈126 kB gzip, including the
1,218-row atlas and the manifest) plus a lazy `Globe` chunk ~1.07 MB (≈287 kB
gzip) that carries MapLibre, and ~18 kB of app CSS. The long tail is its own
125 kB chunk (54 kB gzipped) and the rest of it 867 kB (376 kB gzipped). The globe
route paints its header, filters and caption off the entry chunk and pulls the map
in behind them; `/place/*` never downloads MapLibre at all.

`npm run build` runs `gen-seo`, then the manifest and the data validator, so a build
always ships a sitemap matching the atlas and cannot ship counts that disagree with
the files. Set `SITE_URL` (e.g. `SITE_URL=https://terrane.example
npm run build`) to make the canonical, `og:url`, `og:image` and the sitemap absolute;
without it they stay root-relative, which is valid but not submittable to a search
console. The placeholder `__SITE_URL__` in `index.html` is replaced by a small Vite
plugin in `vite.config.ts` for both dev and build — never hardcode the domain into
the head.

For the map, `npm run dev` plus `window.__terraneMap` in the console is the practical
debugging loop (`__terraneMap.isStyleLoaded()`, `getStyle().layers`,
`queryRenderedFeatures`).

---

## Map controls (Phase 1)

Two controls sit on the globe, top right, below the credits line.

**Search** (`⌘K` / `Ctrl-K` / `/`) — a map-first search over every category. It
matches names from the atlas and the loaded Wikidata tail, plus the OSM pins in cells
the map has already fetched, and flies the camera to whatever you pick without
leaving the globe: the ring follows and the one card opens in place. Arrow keys move
the cursor, `↵` selects, `esc` closes. A cell the map has not fetched is not
searchable, and the empty state says so rather than pretending otherwise.

**Layers** — six base switches (`Relief`, `Contours`, `Paths`, `Roads`, `Borders`,
`Labels`), one `Places & pins` master, two group masters and one row per category —
29 of them, grouped as **Destinations** and **Places to stay & use**. Destination
rows update a filter on the shared dot/label bands; practical rows own a layer each.
Anything created at runtime (the hillshade, the contour layers) re-reads the current
switches after it is added, so a toggle never gets lost to a race.

The grouping is by what a person sees, not by what the style calls things. The first
version had a single `Roads & borders` switch that also owned landcover and water:
turning it off deleted the ocean along with the roads, which reads as a broken map
rather than as a hidden layer. Two rules came out of that:

- **The base is not a switch.** Land cover, water, rivers and built-up areas are
  always drawn; there is no state where the globe is better off without them.
- **A place owns its labels.** Peak and park names used to live with the map labels,
  so turning the markers off left their names floating over empty terrain.

**Clicking any point** flies down to `PLACE_FOCUS_ZOOM` (z14.2) for a destination
with a page and z12.6 for a long-tail or practical pin, instead of stopping at a
regional view: z13–14 is where the hillshade, the contours and the trails are worth
looking at. Clicking again from a closer camera leaves the zoom alone, and the one
card opens in place with the ring on the spot.

### Contours

Generated in the browser from the same Terrarium DEM the hillshade uses, by marching
squares over the tiles covering the viewport, in a worker built from a blob URL (so
the single-file build stays self-contained). Only above zoom 10; interval 250 m below
z11.5, 150 m to z12.5, 100 m to z13.5 and 50 m beyond; the two contour layers sit
above the hillshade and below the water and labels.

**Both the DEM level and the sampling follow the camera.** The first version pinned
the DEM at z10 and thinned every level to 220 segments, which looks fine from z10
and falls apart close in: at z14 a z10 cell is ~450 m on the ground, so every line
arrived as a huge staircase with most of its segments missing. Now the DEM level
runs `floor(zoom) − 1` (capped at z12, the last level that exists worldwide) and
the marching-squares grid goes to 512 px past z12.5.

**This is still a capped first pass, not a topographic sheet.** The first version
allowed six tiles at a 100 m interval, emitted over half a million segments, and
froze the tab — MapLibre's line tessellation, not the worker, was the bottleneck.
The shipped budget is two tiles, at most ten levels per tile (the interval widens
if a tile spans more), 900 segments per level and a 320 ms budget per tile. Caps
are applied contiguously, so a dense tile produces fewer, unbroken lines instead
of sampled dashes. A real implementation wants vector contour tiles (or a custom
WebGL layer drawing the marching-squares output directly), not GeoJSON fed through
the line layer.

### Hiking trails

Footpaths come from the **basemap's own vector tiles** — `transportation` features
with `class` in `path`, `footway`, `steps`, `pedestrian` — drawn as `trails-casing`
and `trails-path` in `style.ts`, from z11.4 up.

**Names come from the same tiles.** `transportation` has geometry and no name
property, but its companion layer `transportation_name` carries one for every way
OSM has named — at Zermatt: *Europaweg*, *Riffelberg-Trail*, *Arvenweg*, *Moos Trail*.
`trails-label` places those along the line from z12.4 (`symbol-placement: line`,
`text-max-angle: 40`), in the same warm tone as the dashes with a dark halo. It
costs no request at all: the layer rides in tiles the map already asked for, which
is why names are affordable here and an Overpass lookup of route relations was not
(see below). `pedestrian` is drawn as a trail but deliberately excluded from the
labels: in towns that class is the shopping street, and Zermatt's Bahnhofstrasse
came through as a gold "trail" name on the first pass.

That replaced a Waymarked Trails raster overlay (`route=hiking` relations rendered
with difficulty colours and numbered shields), for two reasons. The overlay baked
grey pictogram markers and route badges into its PNGs, where they could be neither
restyled nor removed, and they were the part people could not read. Vector paths are
styled instead of blended: a dashed warm line (`#c9a06b`, `#e0c08a` for steps) with
a dark casing, over a solid cased slate road, so a trail and a road are different
species at a glance rather than two thin lines to squint at.

On the other side of the same problem the drivable network got working: a
`road-casing` line beneath the roads, neutral slate instead of blue-grey, and a
narrower `road-minor`.

#### Why not "proper" OSM route relations

Route relations carry what the paths do not: the *names* (Tour du Cervin, WHR) and
the difficulty grading. Getting them means Overpass, and Overpass does not fit a
static client. Measured for a 0.05° × 0.06° box over Zermatt:

| | |
|---|---|
| Elements returned | 21 named relations |
| Payload (`out geom`, full member geometry) | **1.2 MB** |
| Latency, `overpass-api.de` | **32.8 s** |
| Latency, `overpass.kumi.systems` | no response in 40 s |
| Fair use | ~2 concurrent slots per IP, shared globally |

A viewport-sized query therefore lands a second or more *per pan* in the best case
and half a minute in this one, for a megabyte of JSON that has to be parsed and
tessellated. Every pan would also spend someone else's shared quota. Making it
interactive needs a cache in front of Overpass — a server or a build step that
pre-fetches regions — which this app deliberately does not have.

What route relations would add over this, and what is still missing: a long-distance
identity that spans the paths it borrows ("the Europaweg" as one route, whatever way
it is walking on), the difficulty grading, and the numbered shields. Individual named
paths are here; the relation stitching them is not.

What the layer does not have: any trail at all below z11.4 (OpenMapTiles starts
emitting paths around z12), and no labels below z12.4. The lines fade in over
z11.4–12.2, sit above the hillshade and roads but below every label, and are
drawn to z16 — past the tile schema's z14 the geometry overzooms, which keeps the
network on screen at the zoom where you are trying to read it.

---

## Known limitations

- **No field guides.** Deliberate. The 68 curated entries carry no prose in the data
  file, so a field-guide feature would start from a blank page, not a hidden one.
- **The destination set is a selection, not a census.** ~6,500 national parks exist;
  the per-country caps mean 1,218 atlas rows deliberately. 41 countries have exactly
  one row and the median is three. The 23,254-row long tail is ranked by Wikipedia
  language count, which is fame, not completeness.
- **Practical coverage is OSM coverage.** A blank cell means nobody mapped it. Europe
  is mapped far more densely than most of Africa, South America and Central Asia, and
  the credits line says so.
- **The POI store is served from a preview environment.** Its production bucket has
  no objects yet; switching the default before the 370 MB upload would blank every
  practical pin.
- **Two duplicate destination rows are merged, with both sources kept.** Tavan Bogd
  is the massif whose highest point Wikidata names as Hüiten Peak, and Fitz Roy
  existed in both the atlas and the guide; each is one row now, with the absorbed
  row recorded in `also` (`src/data/atlas-merges.json` explains the evidence). The
  audit reports no destination pair within 50 m, and `validate` fails if one appears.
- **Approximate proximity.** `nearbyFor` uses planar degrees, not real geodesic
  distance — fine for a "what else is around here" teaser, wrong near the poles.
- **Contours are capped.** They are a client-side first pass — sparse, viewport-bound
  and only above z10. See the contours note above for why.
- **No photos, no accounts, no trip planner.** By product decision, not omission.
- **The globe is one large chunk.** Routes are split and MapLibre is lazy, but the
  map library itself is still a single ~280 kB gzip chunk that cannot be usefully
  split further.
- **Deep-zoom relief depends on coverage.** z13+ DEM tiles exist only over
  countries that publish a high-resolution national model (Alps, Pyrenees, much of
  the US, Japan, New Zealand, Greenland). Everywhere else — the Himalaya, the Andes,
  most of Africa — a z14 view is the 30 m global model resampled up 4×: correctly
  scaled and shaded, but large forms rather than gullies. A commercial 10 m DEM is
  the next step if that matters more than a keyless setup.
- **DEM tiles are heavier than before.** 512 px Mapterhorn tiles are ~150–200 kB
  each against ~120 kB for the old 256 px AWS tiles; a deep view is ~2 MB of
  elevation. Each live tile also holds 2 MiB of GPU texture (1 MB DEM + 1 MB
  hillshade normal): a measured phone viewport at z14 keeps 10–17 live, i.e.
  20–34 MiB. Cached (off-screen) tiles keep only the decoded elevation grid,
  ~1 MiB each, and `maxTileCacheSize: 128` caps how many can accumulate.
- **The globe projection is part of the regional-zoom cost, but not all of it.**
  At z11, medians of repeated zooms: **globe 1.0–1.2 fps against mercator 3.1–3.3**.
  So the projection is worth roughly 3× there — and mercator is still only ~3 fps,
  which means switching projection would trade the app's whole identity for a
  problem it does not fix. No relief sharpness was traded for this.
- **Zooming is engine-bound, and the hillshade is a fixed per-tile tax on it.**
  Settled, the map runs at 60 fps; while the camera moves it is ~8 fps at z14 and
  worse further out (z11 measures 1–2 fps), because MapLibre is re-projecting the
  globe and rebuilding tile cover every frame. Measured medians of three runs at
  z14 on a 1280×800 viewport: **8.0 fps with the hillshade, 13.9 without it**, so
  the hillshade costs about 53 ms per frame.
- **That cost is per tile, not per texel.** Serving a 256 px DEM grid instead of
  512 at z14 measured **8.1 fps against 7.8** — no gain — while the same switch
  halves relief resolution. So the grid below z12 is kept for bandwidth and memory
  (a quarter of the DEM bytes per tile), not for frame rate, and z12+ keeps 512.
  Cutting the hillshade's frame cost for real means fewer DEM tiles per view —
  a larger `tileSize` with upsampled images, or letting MapLibre overzoom a z12
  DEM — and both pay in relief sharpness, which is why neither is on by default.
- **Earlier single-sample numbers here were noise.** A first pass reported 5 fps
  with the hillshade against 8 without; repeated runs put both higher and the gap
  smaller. Measure this with repeats, a settle between runs, and a warm cache.
- **The fallback is coarser.** AWS Terrarium is a ~150 m surface resampled to the
  requested zoom: relief stays on screen, but a range that was crisp on Mapterhorn
  looks soft until the primary recovers.
- **A few provider probes still 404.** Bounded to at most two per z12 cell per
  session, in the worker rather than the page — not zero, because neither provider
  publishes per-region coverage.
- **Attribution is page text**, not MapLibre's `AttributionControl` (which collided
  with the filter pill). Credits appear under the globe and in every footer.

### Why MapLibre is held at v5

MapLibre 6 was tried and silently rendered **zero vector layers** — raster styles
worked, workers were healthy, tiles returned valid PBF, no console errors, yet
`isStyleLoaded()` stayed false and `queryRenderedFeatures` returned nothing. Pin
`maplibre-gl@5` until that is understood. Do not "upgrade the map library" as a
routine dependency bump: keep the major at 5 until the failure is diagnosed.

Also note: OpenFreeMap's stable alias
`https://tiles.openfreemap.org/planet/2/2/1.pbf` returns **200 with 0 bytes**; always
go through the TileJSON `url` (`https://tiles.openfreemap.org/planet`), as
`style.ts` does.

### Where a zoom actually goes (z11, 1280x800, this machine)

Measured by hiding one layer at a time and sampling frame rate across a 0.4-zoom
jump, repeated:

| Configuration | fps |
| --- | --- |
| Everything on | 1.5 |
| Contours off | 1.6 |
| Trails off | 1.8 |
| **Hillshade off** | **41.3** |

The DEM is the whole cost of a low-zoom gesture, and nothing else is close. Two
plausible fixes were tried and both were rejected on the measurement:

- `antialias: false` (skip MSAA): 1.8–1.9 fps against a 1.6–1.8 baseline. No gain —
  what dominates is DEM tiles, not the multisample resolve.
- Coarser DEM grids at low zoom (128 px at z9–11): 1.4 fps either way. The cost is
  not texels, so the detail was restored.

Per-tile DEM timings say the same thing from the other side: 400–750 ms per tile at
z10–11 against 0 ms for tiles served from cache. A zoom is waiting on tile
production, not on shading. The honest next lever is to not produce DEM tiles for
levels the camera is only passing through, which needs either a prefetched DEM
pyramid or a hillshade that can drop out during a gesture (hiding it is worth 41 fps,
but it also removes the relief exactly when you are looking for it).

### Snow, in short

Snow is elevation, not geometry. `color-relief` over the DEM the hillshade reads,
from z10.5, white above ~2600 m with a long ramp; the OSM ice polygons handle sea
ice and the poles and fade out by z13.6 so the two never overlap. The handoff exists
because a polygon is right at continental scale and wrong at summit scale, where the
eye is close enough to see that the edge is a straight line.

### Pixel ratio is capped at 1.5

The hillshade is a full-screen fragment shader, so its cost follows pixel count, and
a 3x phone asks for nine times the pixels of a laptop. `Globe.tsx` sets
`pixelRatio: min(devicePixelRatio, 1.5)`: relief is soft enough that the difference
is invisible on shading, while fragment work drops by half or more. Measured on the
relief at z11.2, pitch 50, same frame, three ratios: **pr 1 → 1.9 fps, pr 1.5 → 1.0,
pr 2 → 0.6**. (This VM renders in software at dpr 1, so only the ratio — not the
absolute numbers — transfers to a real GPU.)

---

## Head, icons and the mark

The mark is a diamond with a mountain ridge inside it, drawn once in
`src/components/Logo.tsx` (stroke `currentColor`, so it takes `--mint` in the header)
and again as `public/favicon.svg`, which is the same geometry on a rounded dark tile.
`public/icon-180.png` is a 180 px render of that SVG; `public/og.jpg` is a 1200×630
frame of the Alps at z12.4, pitch 55.

`index.html` carries the static head: title, description, canonical, robots, OG and
Twitter cards, `WebApplication` JSON-LD, the icon links, the manifest, three font
preloads and preconnects to both tile hosts. Two rules held while writing it:

- **Only latin subsets are preloaded** (`f5` Sora, `f9` Plus Jakarta, `f15` JetBrains
  Mono — the faces the globe actually paints). Fraunces is the place page's serif and
  is left to load normally.
- **No absolute URL without a domain.** Everything that needs one carries the
  `__SITE_URL__` placeholder described above.

Per-route tags come from `src/lib/meta.ts`: the place page rewrites title,
description, canonical, `og:type=article` and the Twitter pair from the place itself
("*X* is a peak in the Alps, 4,808 m high. Coordinates, elevation and the places
within 30 km of it."), and every other route restores `HOME_META`. Crawlers that run
JavaScript see the per-place tags; the rest keep the site-level ones.

The location lookup (`/lib/locate.ts`) now runs from `requestIdleCallback`, not on
mount: it used to race the first DEM tiles for the network and the main thread to
fill a chip nobody had looked at yet.

---

## Sources, coverage and freshness

The map is one set assembled from three kinds of source. They do not have the same
confidence, and the interface says so.

### OpenStreetMap — systematic, not complete

9,371,124 practical rows from 437 Geofabrik extracts (385 countries), streamed on
2026-11-18. The method is the strongest thing here: every extract parsed, every cell
read back and validated, no failures, no seed list.

It measures **mapping effort, not ground truth**:

- Europe has 3.2 M parking rows; Africa has 66 k.
- 1,053,188 information boards against 17,024 trailheads.
- 86,373 camping and hut features mapped as relations (multipolygons) are not
  placed at all.

So a blank cell means "nobody mapped it", not "nothing is there". That is why the
credits line says coverage varies by region.

### Wikidata — a selection, twice

- The atlas is 1,218 rows, capped per country and filtered to items with an English
  Wikipedia article. It is English-documentation-biased by construction.
- The long tail is ranked by Wikipedia language count. It has no country field and
  no per-country balance: 3,800 lakes, 2,600 islands and 965 beaches, heavily
  Europe and Japan.

Coordinates are Wikidata's, not surveyed. Deduplication is a grid hash at ~55 m plus
the harvest's own 1.2 km exclusion against the atlas; the audit reports zero
remaining pairs within 50 m.

### Editorial — 68 pages, no privilege

The hand-written entries exist for the places worth a page. After the ranking change
they carry no bonus: 33 Georgia entries now compete in their own cell like everyone
else, and the always-on white ring on the curated set is gone. World view shows the
best row in each z4 cell, wherever the cell is, so the planet is not one mountain
range with a handful of dots.

### Updated when someone runs it

There is no CI, no cron and no nightly job. Every dataset is a manual script run, and
the old claim that the harvest writes cells every night was never true in this repo.

- `npm run data:refresh` chains the atlas, the reach harvest, the bulk harvest, the
  merge, the report, `poi:stats` and the validator.
- `src/data/manifest.json` records `generatedAt`, the OSM day and both source dates.
  The globe hint prints the OSM date, so staleness is visible rather than implied.
- The practical cells are served from the published **preview** environment of the
  POI bucket (`VITE_POI_BASE` can point elsewhere). Its production environment has
  no objects yet: switching the default to production before uploading 370 MB would
  blank every practical pin. That upload is the outstanding deployment step.

### What the change removed, measured

`npm run audit` before and after:

| | Before | After |
| --- | ---: | ---: |
| Point systems in the UI | 4 | 1 model, 29 categories |
| Georgia box: radius pins | 281 | 0 |
| Georgia box: atlas / Wikidata | 3 / 71 | 3 / 71 |
| Name caps | 2 + 6 per country | 2 + 4 per z6 cell |
| Duplicate pairs ≤ 50 m | 1 | 1 |
| Categories with no records | 0 | 0 |

The destination density is honest, not even: the fullest z6 cell (the Alps) holds
2,267 destinations against a median of 5. Capping names per cell keeps that from
becoming a wall of labels; it does not pretend the underlying mapping is uniform.
