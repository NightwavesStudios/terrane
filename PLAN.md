# TERRANE — "Explore the World"

A working title and a plan. No app code has been written yet; this is the brainstorm,
the architecture call, and three rendered UI directions to react to.

**What's in this folder**

- `concepts/design-directions.html` — the three directions, fully rendered. Already running at
  `http://localhost:3000/concepts/design-directions.html` (see the Browser panel).
- `concepts/shots/*.png` — 1440×900 crops of each board, ready to compare side by side.
- `concepts/globe.js` + `concepts/land-mask.js` — the dot-globe used in all three mocks. Real
  Natural Earth coastlines rasterised into a 2.7 KB bitmask, projected orthographically. This is
  a design prop, not the production globe, but it proves the stylised direction is cheap.
- `concepts/fonts/` — the four typefaces, vendored so the sheet renders offline.

---

## 1. The product in one line

**An interactive globe for people who actually go outside** — spin the world, land on a
mountain / park / city / landmark, and get a field-guide page that tells you what it is,
when to go, and how hard it is.

The reference points are deliberately split:

- **The globe** should feel like *Google Earth when it's beautiful* — motion, depth, light,
  the small thrill of spinning to a place you've never heard of.
- **The content** should feel like a *Patagonia catalog crossed with a National Geographic
  field guide* — confident, restrained, photographic, specific.
- **The utility** should feel like *AllTrails without the clutter* — effort, distance,
  season, difficulty, and nothing else shouting for attention.

Most "explore the world" projects die in one of two ways: a pretty globe with no reason to
click, or a place database with no reason to browse. The wedge here is that the globe is
the *browsing surface*, not the decoration. Every marker is a real, written-up place.

---

## 2. Who it's for + the core loop

**Primary user:** 25–45, plans 1–3 trips a year, saves things in a notes app and loses them.
Loves maps. Has been burned by listicles.

**The loop:**

1. **Spin** — globe idles with a slow drift; drag to rotate; scroll to zoom.
2. **Notice** — markers are few and opinionated. Not every town, only places worth a detour.
3. **Land** — click a marker: camera flies to it, a card slides in.
4. **Read** — one page: hero, one paragraph of real writing, the four numbers that matter, a
   few "nearby" links.
5. **Save** — heart it into a named collection ("Patagonia 2027"). Lives in localStorage
   first, account later (or never).

That's the whole first version. Depth comes from *curation quality*, not from more features.

---

## 3. Content model

Six place types share one schema, with type-specific extras:

| Type | Count target (v1) | Extras |
|---|---|---|
| **Mountain / peak** | ~60 | elevation, prominence, first ascent, range, grade |
| **National park** | ~45 | area, established, best season, entry fee, flagship hike |
| **City** | ~40 | population, "why go", walkability, best 3 months |
| **Landmark** | ~40 | era, UNESCO status, visit window, crowd level |
| **Hidden gem** | ~35 | why it's overlooked, access notes, "before it's famous" |
| **Trail / route** *(stretch)* | ~30 | distance, gain, days, technical grade, permit info |

**Shared fields**

```
id, slug, name, localName, type, country, region,
lat, lon, elevation_m, tagline (≤70 chars),
summary (≤220 chars), body (2–4 short paragraphs),
bestMonths[], difficulty (1–5), effort (1–5),
heroImage, gallery[], tags[], nearbyIds[], sources[]
```

Every place needs: a coordinate (for the globe), a 70-char hook (for the marker card), and
one sentence that could only be written by someone who has been there or read deeply.
**The hard part of this project is the writing, not the WebGL.**

**Data sources** (all license-clean for attribution):
- **Wikidata / Wikipedia** — coordinates, elevation, country, founding dates, descriptions
  (CC0 data / CC BY-SA text — attribute and rewrite; never paste article text).
- **NPS / Parks Canada / national park APIs** — park metadata, alerts, seasons.
- **OpenStreetMap / Overpass** — trails, peaks, viewpoints, `ele` tags (ODbL — attribute).
- **Natural Earth** — country/coastline geometry and the low-res land mask for the globe.
- **Manual curation** — the top ~50 places get hand-written copy. That's the brand.

v1 ships ~150–240 places as a single bundled JSON (~120–200 KB). No database, no CMS, no
auth. That is a feature: the whole site is static and fast.

---

## 4. Technical approach (the one real decision)

| Option | Verdict |
|---|---|
| **MapLibre GL JS + `projection: globe` + terrain** | ✅ **Recommended.** ~220 KB gz, real DEM terrain, custom styleable, smooth `flyTo`, free (no Mapbox key), renders on Workers as a static SPA. Terrain gives you "mountains actually look like mountains" when you zoom. |
| react-globe.gl / three-globe | Great *look* out of the box (arcs, hex, dot globes), but no real terrain, no basemap labels, and you end up rebuilding cartography by hand. Best as an optional "poster mode". |
| CesiumJS | True 3D globe with tiles, but 500 KB+ and a platform-sized API for a browsing site. Overkill. |
| Cobe / dotted SVG globe | Perfect for the *logo* and loading state, not for the product. |

**Stack:** Vite + React + TypeScript, MapLibre GL JS, Tailwind, Framer Motion for panel
transitions, `zustand` for globe/selection state, TanStack Router if we need deep links
(`/place/torres-del-paine`). Static JSON data, deployed to Freebuff Sites as a Worker +
assets bundle. Saved places → `localStorage`. No backend until accounts are actually asked for.

**Basemap style:** our own dark, low-label style over free vector tiles, with terrain
hillshade on. The map is *set dressing* — we control its color so the editorial layer reads.
Fallbacks: if tiles are slow, the globe still renders as a styled sphere, so first paint is
never a grey box.

**Performance guardrails:** cap devicePixelRatio at 1.5, `prefers-reduced-motion` kills the
idle drift, disable terrain under 768 px wide, lazy-load hero imagery, and always offer the
non-3D "list view" (`/explore`) — it's the accessible and slow-connection path, not a penalty.

---

## 5. Screens (information architecture)

```
/                     Globe home — the whole product in one screen
/explore              Filterable index (list/grid). Keyboard + screen-reader path.
/place/:slug          Field guide page
/collections          Saved places, grouped
/collections/:id      A trip board
/about                What this is, sourcing, credits
```

**Globe home anatomy:** wordmark + search (⌘K) · the globe · a type filter strip
(Peaks / Parks / Cities / Landmarks / Gems) · a featured card bottom-left · a thin legend
("drag to spin · scroll to zoom") · coordinate readout in mono type, bottom-right.

**Place page anatomy:** full-bleed hero · type + region eyebrow · name · tagline ·
four-number stat strip · one paragraph of voice · "when to go" 12-month bar · elevation or
route profile · gallery · nearby places (3) · sources & last-updated line.

**Mobile:** globe up top, bottom sheet that snaps at three heights (peek / half / full).
The sheet *is* the navigation — no hamburger.

---

## 6. Build phases

**M0 — Prove the feeling (1–2 days).** MapLibre globe, our dark style, 40 hard-coded places,
fly-to + card. If this doesn't feel good to spin, nothing downstream matters.

**M1 — Real content (3–4 days).** Data pipeline for the 150-place seed, place pages, deep
links, search.

**M2 — Discovery (2–3 days).** Type filters as *lenses* on the globe, collections/saved,
nearby graph, "surprise me" (random place with a fly-to — the single best retention hook).

**M3 — Craft (2 days).** Loading choreography, reduced-motion + keyboard + list view,
mobile sheet, OG images per place, empty states.

**M4 — Stretch, only if asked.** Accounts + sync, trip planner with dates, user notes,
contributions, realtime "someone else is looking here" (skip).

---

## 7. Three visual directions

Rendered in `concepts/design-directions.html` — open it in the Browser panel.

### A — **Field Notes** (topographic atlas)
Cream paper, ink, moss and clay. Fraunces for display, mono for coordinates and figures.
The globe is a *printed dot-matrix* — no photo texture at all. Data rows read like a
survey card. This is the most distinctive and the most "outdoors" of the three; it also ages
well and is trivially fast (no imagery needed on the home screen).

### B — **Night Ascent** (cinematic)
Near-black, aurora mint + periwinkle accents, glowing arcs between places, glass panels over
a dusk photograph. Sora display type. This is the most *scroll-stopping* and the best fit for
a globe that's meant to be spun at 11pm. Risk: dark UI + photo hero is the default look of
every travel startup, and it demands great photography to not look cheap.

### C — **Trailhead** (modern utility)
Off-white, forest green, lime. Big rounded cards, chunky filter chips, a phone with a
three-stop bottom sheet. Closest to AllTrails/Komoot: least magic, highest immediate
usability, easiest to build and to trust.

### Comparison

| | A Field Notes | B Night Ascent | C Trailhead |
|---|---|---|---|
| Memorability | ★★★ | ★★★ | ★★ |
| Globe as hero | ★★★ (dot globe) | ★★★ (best motion) | ★ (map, not hero) |
| Needs great photography | No | Yes | Somewhat |
| Content legibility | ★★★ | ★★ | ★★★ |
| Build effort | Low | Medium | Low |
| Works for "cities + landmarks" too | ★★ | ★★★ | ★★★ |

### My recommendation: **A × B hybrid**

**Dark cinematic globe as the home screen** (B's stage, arcs, glow — where the wow lives),
**paper-white editorial pages for everything you read** (A's type, rule lines, mono figures,
survey-card stats). The transition from night globe → cream field guide is the brand moment,
and it solves the real problem: dot-globe magic plus long-form readability, without depending
on a photo library we don't have yet.

---

## 8. Naming (pick one before we build)

- **Terrane** — a fragment of crust that drifted onto a continent. Geological, ownable, short. *Favourite.*
- **Meridian** — classic, but crowded (airlines, banks).
- **Wayfare** — warm, human, "wayfarer". Slightly soft.
- **Fathom** — depth, measuring the unknown. Good, but sounds nautical.
- **Overland** — confident and outdoorsy; a travel magazine already exists.
- **Cairn** — a stack of stones marking a trail. Beautiful metaphor, hard to say in a URL.

Tagline: *"The world, worth the detour."*

---

## 9. Risks

- **Globe performance on mid-range Android** — mitigate with the DPR cap, terrain off under 768 px, and the list view as an equal citizen.
- **Content is the bottleneck** — 150 places × 120 words of real writing is a lot of writing. Plan: write 25 excellent ones first, template the rest, and be honest about which are stubs.
- **Tile/style licensing** — stay on free vector tiles + attribution; don't build on a key that expires.
- **"Pretty but pointless"** — guarded by making every marker a written destination and putting "surprise me" on the home screen.
- **Scope creep into a trip planner** — explicitly out of v1.

---

## 10. Decisions I need from you

1. **Direction** — A, B, C, or the A×B hybrid?
2. **Name** — Terrane, or something else?
3. **Globe feel** — realistic terrain you can zoom into (MapLibre + DEM), or a stylised dot globe that stays graphic at every zoom (three-globe / SVG)? The hybrid wants "map behind, dot-globe aesthetic on top", which is doable but is the main technical fork.
4. **Scope of v1** — globe + 150 places + saved lists? Or globe + 40 places done extremely well?

---

## 11. Built — v0.1

Decisions taken: **A×B hybrid**, name **Terrane**, tagline *the world, worth the detour*,
MapLibre + DEM terrain, 100-place target, saved collections, no accounts, no trip planner.

**What exists and runs**

- `/` — **the globe, and nothing else.** Full-bleed, centred, no hero copy, no buttons. Header,
  one mono caption with the counts, a floating filter pill at the bottom, and a place card that
  appears only after you click a light. 1,138 points drawn as GPU circle layers (not DOM
  markers), type-coloured, fly-to on select, DEM terrain + hillshade, labels only at zoom.
- `/place/:slug` — the field guide: generated ridge art from the place's hue, Fraunces title,
  written body, 12-month best-window bar, stat strip, nearby places. Atlas records show a
  clearly-marked fact panel instead of inventing prose.
- `/explore` — searchable, filterable index, 60 per page (the keyboard / slow-connection path).
- `/saved` — collections in `localStorage`: save from any card, create named collections
  (verified: created "North Georgia", place persisted, survives reload).
- `/about` — the manifesto that used to sit on top of the globe.
- Content: **1,138 places — 78 written-up field guides + 1,060 atlas records** across 144
  countries. The atlas is generated from Wikidata (CC0) by `python3 scripts/build-atlas.py`
  (or `npm run atlas`): national parks, peaks over 2,200 m and World Heritage sites, deduped,
  ranked and capped per country so the globe fills out worldwide instead of only in the Himalaya.

**Stack as built**

Vite 8 · React 19 · TypeScript · MapLibre GL **5.24** · OpenFreeMap vector tiles (no key) ·
AWS Terrarium DEM · hand-written night style · custom hash-free History router · zero state lib.

> MapLibre GL 6 was installed first and its vector renderer produced **no layers and no errors**
in the cloud browser (raster tiles rendered fine, WebGL and blob workers were healthy), so the
project is pinned to the stable 5.x line. Retest 6 before upgrading.

**Still to do**

- 22 more places to reach 100; the Georgia set could go deeper (Lake Rabun, Chattooga, more
  Cohutta entries).
- Real photography (every card currently uses generated ridge art — deliberate, not a gap).
- Terrain currently reads best above zoom 5; check it on a phone before tuning further.
- No accounts, no trip planner, no OG images, no automated tests yet.

**Run it**

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

