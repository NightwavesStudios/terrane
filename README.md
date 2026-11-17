# Terrane

**The world, worth the detour.**

An interactive globe for exploring mountains, national parks, natural landmarks and
hidden gems — outdoors-first, no listicles. Peaks lead: over half the map is summits,
and nothing on it is a city or a building. Spin the globe, click a light, land
somewhere.

Currently **1,288 places across 156 countries**: 68 hand-picked entries plus 1,220
national parks, peaks and natural landmarks generated from Wikidata. Over half the
map — 663 points — is peaks, and they are ranked by topographic prominence rather
than raw height, so the set is major summits and not every high shoulder.

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
npm run build      # tsc -b && vite build  → dist/
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
| `/explore` | `Explore` | Searchable, filterable index. 60 cards per page, "Load more". |
| `/saved` | `Saved` | Collections stored in this browser. |
| `/about` | `About` | The manifesto, plus data credits and counts. |
| `/place/:slug` | `Place` | Fact sheet for one place: hero art, type, high point, country, coordinates, nearby. |
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
`land-base` solves it: one GeoJSON polygon covering the planet
(`-180…180 × -85…85`) filled with the land colour, sitting *under* the water layers.
Water paints over it, land keeps its own colour, and the globe reads as a globe
instead of a hole. `style.ts` declares three sources: `world` (that polygon),
`relief` (the DEM) and `openmaptiles`.

The DEM source belongs in the style even though the hillshade *layer* is added at
runtime. A layer that references a source added later makes MapLibre reject the
whole style — blank map, `getStyle()` undefined — which is what made every attempt
to declare the hillshade statically look like a broken layer.

Layer order, bottom to top:

```
bg → land-base → landcover-{wood,grass,ice} → landuse-residential
→ relief-hillshade → contours-{minor,major} → water
→ waterway → boundary-{country,state} → water-label
→ road-{minor,major,highway} → label-{country,state,city}
→ places-heat → places-halo → places-dot → places-curated
→ places-selected → places-label-top → places-label
```

The hillshade sits **above** the vegetation and landuse fills, not under them.
Underneath, a semi-transparent green fill covers the shading and the middle zooms
flatten into one flat green blanket — colours survive, relief does not. Above them,
the fills tint the ground and the relief still reads through, which is the whole
point of a terrain map. It is inserted at runtime as soon as the style lands,
anchored before `water` (see the relief note below).

Labelling is zoom-gated so the world view stays clean: country labels from 2.2 to 6,
state labels from 5.5, city labels from 5. Coastlines come from
`fill-outline-color` on the `water` layer.

### `src/map/Globe.tsx`

Props: `places` (already filtered), `selected` slug, `onSelect`, optional `focus`
(`{lon, lat, zoom, key}` — the chip bar uses this to fly home or to Georgia).

- **Init** happens once: globe projection (`setProjection({type:"globe"})`),
  `center [12, 22]`, `maxZoom 14`, `attributionControl: false` (attribution is
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
  `hillshade` layer, `setSky` (atmosphere), the `places` and `selected` GeoJSON
  sources, and the place layers. Each risky call is individually try/caught so a
  browser without hillshade or sky support still gets a working globe.
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
  - **Every requested zoom gets a real tile** (`src/map/dem.ts`). MapLibre's slope
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
    one clamped unsharp pass → re-encode. The outer ring is left unsharpened so
    adjacent tiles do not disagree at the seam.
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
  - `fadeDuration: 280` — arriving tiles cross-fade; this also fades symbols in
    and out as they cross their `minzoom` thresholds.
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
  - `maxTileCacheSize: 160`, `renderWorldCopies: false` — keep several zoom levels
    resident, and never request the globe twice.
  - Line layers have no cross-fade of their own, so roads fade in over roughly one
    zoom level via `line-opacity` ramps (`style.ts`).
  - Marker dots and both label tiers fade in over a zoom range rather than popping
    at a threshold.
  - `places-heat` stops at z4.7 and `places-halo` at z9.5. Both are `circle-blur`
    layers costing per-feature work on 1,288 points; once they are fully
    transparent there is no reason to keep evaluating them.
  - **No hit-testing mid-gesture.** `mousemove` used to run a 3-layer spatial query
    on every pointer event — ~60 a second, and during a wheel zoom the pointer is
    always moving, so it ran through the entire gesture. It now bails while
    `isMoving()` and is throttled to 16 Hz otherwise.
  - **Pitch is throttled.** `applyPitch` runs on the `zoom` event but only calls
    `setPitch` at most every 120 ms and only when the tilt moved more than 1.2°;
    each `setPitch` re-renders the whole camera, so doing it every frame doubled
    the work of a gesture.

- **Label layers must not overlap.** `places-label-top` draws tier 1 from z1.2 and
  `places-label` draws the remaining curated set from z3.8. The second one's filter
  is `curated == 1 AND tier != 1` — without the `tier != 1` exclusion every featured
  place got two identical labels at the same offset, and the two layers fought for
  symbol placement frame by frame (text flickering over the Alps). Verified at z4.5:
  zero rendered names appear in both layers.
- **Zooming is camera travel.** `pitchForZoom(z)` tilts the camera from level at
  planet scale to 55° over a range, so the same continuous zoom reveals relief
  instead of switching modes. Programmatic `flyTo`s carry their own `pitch` and the
  auto-pitch bails out while `map.isEasing()` — a `setPitch` mid-flight cancels the
  flight, which is what once stopped selections at zoom 2 instead of 6.4. It also
  hands over permanently the moment the user pitches by hand (`pitchstart` with an
  `originalEvent`).
- **Markers are GPU geometry, not DOM, and they reveal themselves.** 1,288 DOM
  markers would crawl, so places are one GeoJSON source drawn by:
  - `places-heat` — large blurred discs that pile up into a density wash where the
    world is busy; fades out by zoom 3.6.
  - `places-dot` — the points themselves, `minzoom 2`, fading in from zoom 2 to 2.9,
    so world view stays quiet instead of becoming a database dump.
  - `places-curated` — a fine white ring on the curated set at every zoom, so those
    stay findable at planet scale.
  - `places-label-top` — the eight featured places, from zoom 1.5;
    `places-label` — the rest of the curated set, from 4.2. Labels arrive in stages.
  Colours come from a `match` expression on `type`: peaks `#eaf7ff`, parks
  `#57f0b2`, landmarks `#ffc766`, gems `#c99bff`.
- **Clicking** queries `queryRenderedFeatures` over an 18×18 px box around the cursor
  (a 9 px radius, generous for touch and for 1.3 px dots), then calls `onSelect` with
  the feature's `slug`. `mousemove` sets a pointer cursor over the same hit test.
- **Selection** writes one feature into the `selected` source and `flyTo`s it —
  `zoom max(current, 4.6)`, with `padding` on the right at desktop widths so the place
  card doesn't cover the marker, and bottom padding on narrow screens.
- **Filtering** just calls `setData` on the `places` source when the `places` prop
  changes; nothing is re-created.
- **Resizing** is handled by a `ResizeObserver` calling `map.resize()`.
- In dev, the map is exposed as `window.__terraneMap` for console debugging.

---

## Data

### `src/data/places.ts`

Defines the model and assembles the dataset. `Place`:

| Field | Type | Present on | Meaning |
| --- | --- | --- | --- |
| `slug` | `string` | all | URL key, unique across both tiers |
| `name` | `string` | all | display name |
| `type` | `"peak" \| "park" \| "city" \| "landmark" \| "gem"` | all | drives colour, filters, copy |
| `region` | `string?` | curated | state / province / range, shown under the name |
| `country` | `string` | all | normalised display country |
| `lat`, `lon` | `number` | all | decimal degrees |
| `elevation` | `number?` | most | metres; the "high point" |
| `tagline` | `string` | all | one line; still used by Explore search, no longer rendered as a field note |
| `difficulty` | `1..5?` | curated | effort badge on cards only |
| `hue` | `number` | all | 0–359, seeds the generated ridge art |
| `featured` | `boolean?` | curated | leftover from the pre-globe layout |
| `curated` | `boolean?` | all | `true` for the hand-written set, `false` for atlas rows |
| `wd` | `string?` | atlas | Wikidata Q-id, useful for provenance |

`CURATED` is the 68-entry array at the top of the file (35 international, 33 Georgia).
Everything in it is an outdoor destination — the cities (Kyoto, Savannah, Atlanta,
Athens, Tromsø, Santorini) and the archaeological sites (Petra, Machu Picchu, the
Etowah and Ocmulgee mounds) were removed.
`ATLAS` maps `atlas.json` rows into the same shape: it normalises a handful of country
names (`COUNTRY_FIX`), derives `hue` from a stable string hash around a per-type base
(`HUE_BY_TYPE`), and generates a factual `tagline` from type + elevation + country.

`PLACES = [...CURATED (flagged curated: true), ...ATLAS]` — curated first, so the
hand-written set wins ordering everywhere.

Other exports:

- `TYPE_LABEL` / `TYPE_LABEL_PLURAL` — "Peak"/"Peaks" etc.
- `DIFFICULTY_LABEL` — `["", "Gentle", "Easy", "Moderate", "Hard", "Severe"]`
- `MONTHS` — three-letter month names
- `bySlug` — `Map<string, Place>`, used by routes and saved collections
- `FEATURED`, `GEORGIA`, `CURATED_PLACES` — prefiltered arrays left over from the
  pre-globe layout; currently **unused by the UI**. (The Georgia chip does not use
  `GEORGIA`: it goes through `matches()` in `FilterChips`, which tests whether
  `region` contains "Georgia" — that is what catches curated entries whose region is
  a county name.)
- `CURATED_COUNT` — 68
- `COUNTRY_COUNT` — distinct countries across `PLACES` (144)
- `nearbyFor(place, count = 3)` — nearest places by naive degree distance, with a
  +6 penalty for a different type so a summit doesn't return four other summits

### `src/data/atlas.json` (generated, 1,220 rows)

`{ wd, slug, name, type, country, lat, lon, elevation }` — 420 peaks, 380 parks, 260
landmarks, 143 countries. **Do not hand-edit**; it is overwritten by `npm run atlas`.

### `src/data/curated-index.json`

`{ slug, name, country }` for the 68 curated entries, read by the atlas builder so a
generated record can never duplicate a hand-written one. **If you add a curated place,
add it here too** (or the next atlas build may generate a near-duplicate).

### `scripts/build-atlas.py`

```bash
npm run atlas        # ~30–40 s, one SPARQL round trip per type
```

1. **Queries Wikidata** (`https://query.wikidata.org/sparql`, CC0) for three sets:
   - **peaks** — `P31 = Q8502` (mountain) with an elevation `P2044` above 1,700 m,
     ranked by **topographic prominence** `P2660` (its own SPARQL query — asking for
     prominence alongside names and coordinates blows WDQS's budget and returns 504).
     Elevation is read as a *quantity with its unit* and converted to metres
     (`Q11573` = metre, `Q3710` = foot), because US summits are frequently stored in
     feet — without this, Mount Blackburn reports 16,390 "m" instead of 4,996 m.
   - **parks** — `P31 = Q46169` (national park), with inception `P571` if present.
   - **landmarks** — natural features only: waterfalls `Q34038`, canyons `Q48214`,
     volcanoes `Q8072`, glaciers `Q35666`, caves `Q35509`, deserts `Q8514`. This used
     to be every UNESCO World Heritage site, which is how the map ended up full of
     cathedrals, temples and cathedral treasuries.
   - All three require an **English Wikipedia sitelink**, which filters out
     near-empty items.
2. **Cleans** — strips disambiguation parentheses, drops names under 3 or over 60
   chars, keeps only rows with coordinates and a country.
3. **Dedupes** against the curated set using a normalised key that ignores words like
   "National Park" and "Reserve", and within each type by Wikidata Q-id.
4. **Ranks and caps** — peaks most prominent first, parks with a known inception first,
   then capped **per country** (`PER_COUNTRY`: 42 peaks / 15 parks / 6 landmarks)` so the
   globe fills out worldwide rather than only in the Himalaya. Totals are
   `TARGET`: 420 / 380 / 260.
5. **Slugifies** to ASCII and appends the Q-id on collision, then writes
   `src/data/atlas.json` compactly and prints counts.

Raising `TARGET` and `PER_COUNTRY` is the one-line way to make the globe denser.

---

## State and persistence

### `src/lib/saved.ts` — collections in `localStorage`

Key `terrane.collections.v1`, value `[{ id, name, slugs }]`. A default "Want to go"
collection is created on first read, and unreadable/blocked storage falls back to an
in-memory copy rather than throwing.

- `useCollections()` — `useSyncExternalStore` over a module-level array, so `Header`,
  `SaveButton` and `Saved` all re-render together
- `toggleIn(collectionId, slug)` — add or remove one slug, `removeFromAll(slug)` —
  drop it everywhere
- `createCollection(name)` → id, `removeCollection(id)` (never deletes the last one,
  it just empties it)

There is no account and no network call: everything lives in this browser.

### `src/lib/router.ts`

`navigate(to)` pushes state, notifies subscribers (an internal `Set` plus `popstate`)
and scrolls to top. `parseRoute(pathname)` maps a path to a `Route` union;
`useRoute()` subscribes a component to it. `navigate` is a no-op when already on the
target path.

---

## Components (`src/components/`)

| File | Role |
| --- | --- |
| `Header.tsx` | Wordmark, nav (Globe / Explore / Saved / About), saved count badge, place-count pill. `tone="dark"` over the globe, `"light"` on paper pages. |
| `FilterChips.tsx` | The filter bar. Exports `Filter` (`all \| PlaceType \| "georgia"`) and `matches(place, filter)` — the single source of truth shared by the globe and Explore. |
| `PlaceCard.tsx` | Index/saved card: ridge art, type chip, name, region · country, elevation and effort grade. Navigates to `/place/:slug`. |
| `SaveButton.tsx` | Star button plus a popover of collections with checkboxes and an inline "new collection" form. Closes on outside click and Escape. `compact` renders the star only (used on the globe card). |
| `RidgeArt.tsx` | Deterministic SVG landscape from a `hue`: gradient sky, sun glow, two ridge lines, snow caps. Uses `useId()` for unique gradient ids so many can coexist. No photography anywhere in the app. |

## Pages (`src/pages/`)

| File | Role |
| --- | --- |
| `Home.tsx` | Owns filter + selection state, composes `Globe`, the header, the mono caption, the credits line, the filter pill and the selection card (`.pick`). Filter changes refocus the camera (world or Georgia); selecting a place closes nothing else. |
| `Explore.tsx` | Text search over name/region/country/tagline, the same chips, 60-per-page paging and a result count. |
| `Saved.tsx` | Renders each collection with its cards; empty states; delete collection. |
| `About.tsx` | Manifesto, counts (places, countries, peaks, parks), data and map credits. |
| `Place.tsx` | Fact sheet. Hero art + eyebrow, optional elevation under the title, a four-cell stat grid (type / high point / country / coordinates), nearby cards, save + "See it on the globe" in the aside. Unknown slugs get a friendly not-found block. |

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
| `public/` | Only fonts and `fonts.css`. |
| `scripts/build-atlas.py` | Regenerates `src/data/atlas.json` from Wikidata + Natural Earth. Reads `src/data/curated-index.json` for the protected slug list. |
| `scripts/build-standalone.mjs` | Packs `dist/` into the single-file `terrane.html`. |
| `terrane.html` | Build output (gitignored): the whole app in one file. |

---

## Checks

```bash
npm run build     # tsc -b (strict, noUnusedLocals) + vite build
```

There is no test suite, no linter and no CI. Typechecking happens inside `build`.

Expected build footprint: entry chunk ~425 kB JS (≈119 kB gzip) plus a lazy
`Globe` chunk ~1.05 MB (≈280 kB gzip) that carries MapLibre and its CSS, and
~26 kB of page CSS. The globe route paints its header, filters and caption off the
entry chunk and pulls the map in behind them; `/explore`, `/saved`, `/about` and
`/place/*` never download MapLibre at all. Vite warns about the size of the Globe
chunk; that warning is expected, not a failure.

For the map, `npm run dev` plus `window.__terraneMap` in the console is the practical
debugging loop (`__terraneMap.isStyleLoaded()`, `getStyle().layers`,
`queryRenderedFeatures`).

---

## Map controls (Phase 1)

Two controls sit on the globe, top right, below the credits line.

**Search** (`⌘K` / `Ctrl-K` / `/`) — a map-first search over the 1,288 places. It
matches name, region and country, ranks exact and prefix matches first, then curated
places, and flies the camera to whatever you pick without leaving the globe: the
selection ring follows and the card opens in place. Arrow keys move the cursor,
`↵` selects, `esc` closes. It searches places only — mountain ranges, trails and
campsites are records in the geographic database planned for Phase 2 and are not
searchable yet.

**Layers** — five independent switches: `Relief` (hillshade), `Contours`, `Roads &
borders`, `Place labels`, `Places`. They map to layer groups in `Globe.tsx`
(`LAYER_GROUPS`); anything created at runtime (the hillshade, the contour layers)
re-reads the current switches after it is added, so a toggle never gets lost to a
race.

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

---

## Known limitations

- **No field guides.** Deliberate. The 68 curated entries carry no prose in the data
  file, so a field-guide feature would start from a blank page, not a hidden one.
- **Atlas coverage is a selection, not a census.** ~6,500 national parks exist; the
  per-country caps mean 1,220 points deliberately, and a country with more than 42
  qualifying peaks shows only its 42 most prominent.
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
  elevation. `maxTileCacheSize` was cut from 160 to 72 to keep the GPU texture
  budget (1 MB DEM + 1 MB hillshade normal per tile) in check.
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
