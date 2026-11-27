# Terrane — Product Plan

**Status: build source of truth · v2.0 · 27 November 2026**
**Baseline: commit `e3d06d6` (blue-hour globe, diamond logo, legacy fonts, Discover-only overlay)**
**Launch scope: US Northeast + Colorado + Scotland · Wave 1 = 469 peaks across five lists**
**Stack: React 19 + Vite SPA · Postgres 17 + PostGIS on Neon · field-level provenance**

> The globe is the front door. The list is the reason to return. The passport is the proof.

This is the complete, in-repo product plan for Terrane. It is the source of truth for Phases 1–4 and the reference for everything after. Where it disagrees with an earlier doc, this file wins. Where it is silent, the nearest ADR or schema migration wins. It assumes the shipped UI is the visual and technical starting point, not a prototype to replace.

The two decisions taken before this document are not open:

1. **Launch scope** is three deep regions — US Northeast, Colorado and Scotland — with Wave 1 = 469 peaks across five lists: NH 48 (48), Adirondack 46 (46), Catskill 3500 (35), Colorado 14ers (58 named), Munros (282).
2. **Stack** is Postgres + PostGIS on Neon with field-level provenance. No document database, no proprietary peak database, no fabricated records.

Everything else below is specified so an engineer can build Phase 1 without re-deciding product questions.

---

## 0. The one-page version

| Question | Answer |
|---|---|
| **What is Terrane?** | A quiet, provenance-first atlas and climb journal for people who go up mountains. |
| **Who is it for?** | List-curious hikers and lifelong peak baggers who want a trustworthy record, not another feed. |
| **What is the wedge?** | Three things done properly: versioned lists, honest data provenance, and a record beautiful enough to keep. |
| **What are the surfaces?** | Atlas (globe, search, peaks), Lists, Journal, Passport (stats + badges), Field Notes (routes, reports, photos — later). |
| **How does it make money?** | Free core forever; a $24/year Supporter tier; physical completion patches later. No ads, no data sales. |
| **What is the north star?** | Weekly logged summits by returning users. |
| **How do we start?** | Deep data in three regions, global discovery at declared coverage tiers, then accounts, then lists, then badges. |
| **What do we refuse?** | Fabricated peaks, points, leaderboards, public-by-default location data, and a 640,000-peak database with no quality floor. |

**The one-sentence strategy:** Peakery proves people want the whole world of peaks; Yak proves people want their lists and their patches. Neither owns the calm, crafted, trustworthy record. Terrane takes that position and earns it with data you can inspect and a journal you want to keep.

---

## 1. Product thesis

### 1.1 The gap

Peak software currently comes in three shapes, and each leaves the same person unsatisfied.

1. **List trackers** (Yak, Hill Bagging, regional apps) are excellent at counting one list. They are thin on the rest of the world, and they often make you start from zero because they only record what the phone saw.
2. **Atlases** (Peakery, PeakVisor, ListsOfJohn) are excellent at breadth. But breadth without curation produces a long tail of unnamed bumps, duplicate summits, and peak pages with no point of view.
3. **Trail apps** (AllTrails, Gaia GPS, Strava, komoot) are excellent at tracks. They treat the summit as a point on a line, not as a place with a history.

The person in the middle — someone who has been climbing for years, follows two or three lists, keeps a spreadsheet, and wants one place that remembers — is served badly by all three.

### 1.2 The Terrane answer

Terrane is the **record**, not the feed.

- The **globe** is the identity and the front door. Blue hour is the hour you leave or the hour you return; the whole product lives at that edge of the day.
- The **atlas** is a global peak index with visible provenance, so every elevation, prominence and list membership can be traced.
- The **journal** accepts the climbs you already have, not just the ones you record with the app.
- The **lists** are versioned like the published lists they come from, because a count that silently changes is worse than no count.
- The **passport** turns the record into something worth keeping: stamps, completion marks, a yearbook — earned, never bought, never ground for.

### 1.3 Beliefs

1. **A summit is a fact, not a score.** We record it; we do not monetise the dopamine.
2. **The best record is the one you would show someone in thirty years.** Design for the archive, not the notification.
3. **Lists make a mountain range finite.** Completion is one of the strongest motivations in the outdoors, and it deserves respect, not gamification.
4. **Data quality is a feature you can see.** Every peak page says where its numbers came from and how confident we are.
5. **Quiet is premium.** Fewer prompts, fewer badges, fewer emails, slower motion, better typography.
6. **Past climbs count.** Most people arrive mid-list. The product must accept a life's history in an afternoon.
7. **One summit counts everywhere.** A peak belongs to every list it is on; the user never ticks the same mountain twice.
8. **Nothing is fabricated.** No placeholder peaks, no invented ascents, no demo users in production. Empty states tell the truth.
9. **Delete means delete.** Export is free; deletion is real; location history is private by default.
10. **No leftovers.** Every phase ends by removing dead code, dead styles, dead assets and dead copy. The repository is part of the product.

### 1.4 Why now

- The list-tracking category is proven and growing: Yak ships 16 quests across the Munros, 14ers, NH 48, Adirondack 46ers and more; Peakery reports 640,000+ peaks, 430,000+ logged climbs, 760+ challenges and 520,000+ photos.
- The big trail apps still do not treat lists as first-class, which leaves the category to specialists.
- Open geodata (OSM, GeoNames, Wikidata, Copernicus DEM, USGS 3DEP) is good enough to build a credible global index without licensing a proprietary database.
- MapLibre, vector tiles and cheap object storage make a globe-first product affordable for a small team.
- The aesthetic gap is real: almost every competitor looks like a fitness app. Terrane can look like a place.

---

## 2. What Terrane is — and is not

| Terrane is | Terrane is not |
|---|---|
| A global atlas of named peaks with visible data provenance | A complete topographic map or a replacement for Gaia GPS / CalTopo |
| A journal of summits and attempts, including climbs from before you joined | A live GPS tracker that records every step by default |
| A library of published peak lists, versioned and sourced | A scraped mirror of other people's list data |
| A quiet passport of earned marks and completed lists | A points economy, streak machine or leaderboard |
| A place to read routes, conditions and trip reports | A guidebook with liability for route safety |
| A web app that works beautifully on a phone, offline where it matters | A native app on day one |
| A community of people who love mountains | A social network optimised for posting frequency |

**The line we hold:** if a feature makes the product louder without making the record better, it waits.

---

## 3. Reference teardown: what to take from Yak and Peakery

### 3.1 Yak — the list and patch model

**What Yak does**

- Free iPhone and Android app built around **quests**: the Munros, Colorado 14ers, NH 48, Adirondack 46ers, 50 state highpoints, Seven Summits and others (16 quests at the time of writing).
- **One summit counts on every quest it belongs to.** Climb Mount Whitney and it appears on the California 14ers, Lower 48 14ers and Sierra Peaks Section at once.
- A **climb journal** that accepts GPS-recorded climbs and past climbs with date, notes, photos and conditions.
- **Forecasts at three elevations** (trailhead, mid-mountain, summit), wind, freezing level and local avalanche danger.
- **Routes** drawn on a topo map or imported from GPX, plus trip reports and hazards from other climbers.
- Each quest has its own **embroidered patch**; completion is an emotional artifact, not a progress bar.

**What to take**

- Multi-list counting as a core data rule, not a feature.
- Backfilling past climbs as a first-class flow.
- Per-list completion art that feels earned (Terrane: engraved passport marks and optional physical patches).
- Forecast and conditions context on the peak page, so the product is useful before the climb.
- A journal that holds photos, notes and conditions, not just a checkmark.

**What to leave**

- Mobile-only access. Terrane is web-first and installable, with the full record available on a laptop.
- The word "quest". Terrane uses **Lists**, which is what publishers and baggers actually call them.
- Silent list versions. Terrane versions every list and shows what changed.
- Check-in-only verification. Terrane accepts history, GPS and manual entries, with verification shown honestly.

**Lesson:** completion is emotional. The artifact — patch, certificate, finisher number — is the product's memory.

### 3.2 Peakery — the atlas model

**What Peakery does**

- 640,000+ peaks worldwide, 430,000+ logged climbs, 760+ Peak Challenges, 520,000+ photos.
- Peak pages with elevation, prominence, range, challenges, climb counts and last-climb dates; **Classic** and **Ultra** badges (Ultra = at least 1,500 m prominence).
- Filters for elevation, prominence, climbs, last climbed, route length and vertical gain; multiple topo/satellite/3D layers.
- Offline peak browsing in the app, live elevation and gain while climbing, GPS tracks, photos and trip reports.
- Multi-peak trip logging (added December 2025), **Rounds** for repeat completions, and 750+ challenges with pursuers/finishers.
- Profile sub-pages with deep stats, filters, charts and a fullscreen climb map.

**What to take**

- The peak card as a compact, scannable unit: name, elevation, prominence, range, list memberships, climb count, last climbed.
- Challenges/lists with pursuers and finishers, because social proof helps people choose a goal.
- Rounds and repeat ascents as first-class data.
- Multi-peak trips in one log entry.
- Offline browsing of peaks and saved lists.
- A profile that is a real archive, not a dashboard of vanity metrics.

**What to leave**

- The undifferentiated long tail. Terrane publishes a **coverage tier** on every peak and curates the launch regions.
- Challenge sprawl. 760+ challenges is a library, not a point of view. Terrane launches with a focused catalogue and adds deliberately.
- Map noise at low zoom. Terrane clusters by prominence and only labels what matters at each zoom.
- The expectation that more peaks equals more value. Terrane's promise is trust, not count.

**Lesson:** breadth wins search traffic; curation wins loyalty. Terrane needs both, separated into tiers.

### 3.3 The rest of the field

| Product | Strength | What Terrane learns |
|---|---|---|
| **PeakVisor** | Camera identification, check-ins, AR peak names | Identification is a utility, not a record. Link out, do not rebuild. |
| **ListsOfJohn** | Deepest US list coverage, custom lists, ascent details | List depth and custom lists matter; the interface can be plain if the data is trusted. |
| **Hill Bagging / DBIH** | Official-grade hill database, ~70 lists, offline logging | Authority comes from publishers and versioning. Partner or cite, never clone. |
| **HiiKER / komoot** | Automatic bagging from recorded hikes | Auto-matching is expected; the user confirms, and the match must be explainable. |
| **14ers.com** | Regional authority, routes, conditions | One region done properly beats ten regions done shallowly. |
| **AllTrails / Strava** | Trail and activity tracking at scale | They will not own lists. Integrate with their GPX exports rather than compete on tracking. |

### 3.4 Positioning

```
                 CURATED / CRAFTED
                        ▲
                        │        Terrane
                        │
        ListsOfJohn     │      Peakery
        Hill Bagging    │
                        │
   ◀────────────────────┼────────────────────▶
        NARROW          │            BROAD
                        │
         Yak            │      AllTrails / Strava
                        │
                        ▼
                 VOLUME / SOCIAL
```

Terrane sits high on craft and medium-high on breadth: the whole world is discoverable, but the product has a point of view about what deserves a page.

---

## 4. Users and jobs

### 4.1 Personas

**Maya — the Chaser (38, product manager, New Hampshire)**

- 23 of the NH 48, a spreadsheet, a WhatsApp group, three summit selfies per year she actually likes.
- Wants one count she trusts, a map of what is left, and a way to log the hikes she did before the app existed.
- Fears: losing her history to another app that dies; being made to feel like a beginner.

**Tom — the Returner (52, teacher, Colorado)**

- Climbed 30 14ers in the 1990s, remembers half the dates, has a shoebox of photos.
- Wants to reconstruct the record with approximate dates and no judgement.
- Fears: apps that only count what the phone recorded; being told his climbs "do not count".

**Priya — the Planner (31, designer, London)**

- Chasing the Munros slowly, plans trips around clusters of unclimbed peaks.
- Wants "what is near me / near this bothy / on the way to Fort William", conditions, and a route she can trust.
- Fears: driving six hours to a clouded-out summit; list apps that are useless before the climb.

**Eli — the Archivist (44, engineer, Washington)**

- Has 400 summits, 2,000 photos, strong opinions about prominence.
- Wants to contribute corrections, see provenance, and export everything.
- Fears: sloppy data, duplicated peaks, and a product that treats him as a content generator.

**Sam — the Dabbler (27, nurse, Manchester)**

- One or two hills a year, mostly for the view.
- Wants a beautiful record and a gentle suggestion, not a project.
- Fears: being onboarded into a 282-peak commitment on the first screen.

### 4.2 Jobs to be done

| When… | I want to… | So I can… |
|---|---|---|
| I finish a climb | log it in under 30 seconds | keep the record without breaking the day |
| I have been climbing for years | add my history in an afternoon | start from where I actually am |
| I choose a list | see its publisher, version and rules | trust that my count is the official count |
| I plan a trip | see unclimbed peaks near my route | use the list to plan, not just to archive |
| I stand on a summit | know what I am looking at | understand the place, not just tick it |
| I finish a list | mark it properly | feel the weight of the achievement |
| I return after a year | see my year and my remaining peaks | remember why I started |
| I leave | take my data with me | trust the product enough to invest in it |

### 4.3 Anti-personas

- **The leaderboard grinder** — wants to be #1 by volume, will log implausible ascents. We will not build the board that rewards them.
- **The route-only user** — wants turn-by-turn navigation and live tracking. We point them to a trail app; we are the record.
- **The gear reviewer** — wants a marketplace and affiliate links. Not our product.
- **The armchair collector** — wants to tick peaks without going. We accept self-reported history, but badges require an ascent record, and fraud is removed.

---

## 5. Product principles for the build

1. **Provenance is visible.** Every peak page has a "Data" section: source, license, last verified, coverage tier. No number appears without a lineage.
2. **One summit, every list.** `place_id` is the join key; completions are derived, never re-entered.
3. **Lists have versions.** A completion is always against a `list_version`. "Finisher, 2024 list" is a legitimate, permanent state.
4. **Badges are facts.** Awarded from recorded history, never bought, never spent, never used to rank people.
5. **Past climbs are equal.** A 1994 ascent entered by hand is as valid as a 2026 GPX, with a different verification label.
6. **Empty is honest.** No fake records, no invented counts, no placeholder "recent activity". The current empty states stay truthful until data exists.
7. **Private by default.** Profiles and ascents start private. Sharing is a deliberate act, one climb at a time.
8. **The map is the product.** The globe is not a hero image; it is the primary navigation surface. It must be fast, legible and keyboard-accessible.
9. **One primary action per screen.** On the atlas it is Discover. On a peak it is Log climb. In the journal it is Add a climb.
10. **No leftovers.** Every phase deletes what it replaces: components, CSS, assets, types, routes, fixtures, screenshots. A clean `git status` and a clean bundle are part of done.

---

## 6. Information architecture, routes and API

### 6.1 Route map

| Route | Surface | State today | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|---|
| `/` | Atlas — globe | **Shipped**: blue-hour globe, Discover only | Live peak search in Discover; peak preview card; coverage chip | Trips count on the card if signed in | List membership chips on the card | "Your marks" layer |
| `/peaks` | Atlas — index | **Shipped shell**: empty state | Real index, filters, sort, map/list toggle, cursor pagination | "Climbed" filter | "On a list" filter | Badge-worthy peaks filter |
| `/peaks/:slug` | Atlas — peak detail | **Template** at `/peaks/preview` | Real page: stats, provenance, lists, nearby, map inset | Your trips + Log climb | List progress on the page | Marks earned here |
| `/lists` | Lists — library | **Shipped shell**: empty state | Published list count and coverage teaser | — | Real library, search, categories, progress rings | Completion marks |
| `/lists/:slug` | Lists — detail | **New** | — | — | Version, rules, map, peak table, progress, rounds, export | Completion sheet + patch |
| `/log` | Journal — new trip | **New** | — | Three-step quick log, multi-peak, offline queue | Log from list page | Badge toast |
| `/log/:id` | Journal — trip | **New** | — | Trip detail, edit, photos, GPX | List impact | Marks earned |
| `/progress` | Passport — overview | **Shipped shell**: honest empty states | — | Stats v1, calendar, history | Active lists, next peaks | Passport, badge case, yearbook |
| `/progress/badges` | Passport — badges | **New** | — | — | — | All 43 marks, families, progress, silhouettes |
| `/progress/year/:year` | Passport — yearbook | **New** | — | — | — | Yearbook v1 |
| `/u/:handle` | Public profile | **New, later** | — | — | — | Opt-in in Phase 5 |
| `/signin` | Account | **New** | — | Magic link, Google, Apple | — | — |
| `/settings` | Account | **New** | — | Units, privacy, export, delete | Home region | Notifications |
| `/about/data` | Trust | **New** | Sources, licenses, coverage, corrections | — | List sources | Dataset changelog |
| `/about/changelog` | Trust | **New** | Snapshot changelog | — | List version changelog | Badge catalog version |
| `*` | Not found | **Shipped** | Keep, add search | Keep | Keep | Keep |

### 6.2 Navigation

- **Desktop header:** Logo · Explore · Peaks · Lists · Progress · **Log a climb** (primary button) · account.
- **Mobile:** four tabs (Explore, Peaks, Lists, Progress) plus a raised centre **Log** action. The current bottom nav already has the right four items; the Log action is the fifth, centre element.
- **Command palette:** `⌘K` / `/` opens Discover from anywhere. It searches peaks, lists, places and your own trips; arrow keys navigate; Enter opens; Esc closes. The existing Discover already owns the keyboard contract — extend it rather than adding a second palette.
- **Deep links:** every filter state is in the URL (`/peaks?country=US&state=NH&list=nh-48&sort=prominence`). Every peak and list has a stable slug; renamed slugs 301 to the new one.

### 6.3 Naming

| Concept | User-facing word | Data word |
|---|---|---|
| A mountain | Peak | `place` + `peak` |
| A published collection | List | `list` / `list_version` / `list_entry` |
| A climb | Climb (or Trip in detail views) | `trip` |
| A failed climb | Attempt | `trip_peak.outcome = 'attempt'` |
| The collection of marks | Passport | `badge_award` |
| An earned mark | Badge (visually a stamp) | `badge_definition` |
| Repeating a list | Round | `list_completion.round` |
| Data trust label | Coverage | `place.coverage_tier` |

### 6.4 API surface

The API is a separate Hono service. Public reads are cacheable; personal reads are private; every mutation is same-origin, validated, rate-limited and audited.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Liveness + database check |
| GET | `/api/search?q=&limit=&lat=&lng=` | none | Peaks, lists, places, your trips if signed in |
| GET | `/api/peaks?bbox=&country=&region=&list=&elev_min=&elev_max=&prom_min=&prom_max=&coverage=&climbed=&sort=&cursor=` | optional | Peak index |
| GET | `/api/peaks/:slug` | optional | Peak detail |
| GET | `/api/peaks/:slug/trips` | optional | Public trips for a peak |
| GET | `/api/peaks/:slug/conditions` | optional | Published condition reports |
| GET | `/api/lists?category=&region=&q=&cursor=` | optional | List library |
| GET | `/api/lists/:slug` | optional | List detail, current version |
| GET | `/api/lists/:slug/peaks` | optional | Current version entries |
| GET | `/api/lists/:slug/progress` | required | User progress + rounds |
| GET | `/api/regions/:slug` | none | Region page data |
| GET | `/api/badges` | none | Published badge catalog |
| GET | `/api/me` | required | Profile + units + privacy |
| PATCH | `/api/me` | required | Profile, home region, units |
| GET | `/api/me/stats?year=` | required | Stats snapshot |
| GET | `/api/me/badges` | required | Awards + progress |
| GET | `/api/me/trips?year=&peak=&cursor=` | required | Journal |
| GET, POST | `/api/me/custom-lists` | required | List or create custom lists |
| GET, PATCH, DELETE | `/api/me/custom-lists/:id` | required | Detail/progress, rename/visibility, delete |
| POST, DELETE | `/api/me/custom-lists/:id/entries` | required | Add or remove a peak |
| PATCH | `/api/me/custom-lists/:id/order` | required | Reorder entries |
| POST | `/api/trips` | required | Create a trip with 1..n peaks |
| PATCH | `/api/trips/:id` | required | Edit a trip |
| DELETE | `/api/trips/:id` | required | Soft delete |
| POST | `/api/uploads/presign` | required | Presigned photo/GPX upload |
| POST | `/api/photos/complete` | required | Register an uploaded photo |
| POST | `/api/imports/gpx` | required | Start a GPX import |
| GET | `/api/imports/:id` | required | Import review state |
| POST | `/api/imports/:id/commit` | required | Accept suggested matches |
| GET | `/api/me/export?format=json\|csv\|gpx` | required | Full export |
| POST | `/api/corrections` | required | Suggest a data correction |
| POST | `/api/reports` | required | Report content |
| GET | `/api/steward/corrections` | steward | Correction queue |
| POST | `/api/steward/corrections/:id/approve` | steward | Accept a correction |
| POST | `/api/steward/corrections/:id/reject` | steward | Reject a correction |

**Conventions:** JSON; cursor pagination (`nextCursor`); ISO 8601 dates; metres stored, units rendered; RFC 7807 problem details; `ETag` on public peak/list reads; `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` for public pages; `private, no-store` for `/api/me/*` and progress; auth via httpOnly session cookie; CSRF token on mutations; 429 with `Retry-After`; no secrets or internal IDs in responses.

### 6.5 Screen inventory (Phase 1–4)

| Screen | Existing route + components | Phase 1 adds | Phase 2 adds | Phase 3 adds | Phase 4 adds |
|---|---|---|---|---|---|
| **Globe** | `src/pages/ExplorePage.tsx`, `MapGlobe.tsx`, `Discover.tsx` | Peak points from `GET /api/peaks?bbox`, preview card, coverage chip, keyboard selection | "Log climb" from the card; signed-in climbed layer | List chips on the card | Marks layer toggle |
| **Peaks index** | `src/pages/PeaksPage.tsx`, `SearchField`, `FilterChips`, `EmptyState` | Real rows, facets, sort, map toggle, URL state, skeleton/error/empty | "Climbed / not climbed" filter | "On a list" filter, list badges | "Near a mark" filter |
| **Peak detail** | `src/pages/PeakDetailPage.tsx`, `PeakDetailTemplate.tsx` | Real peak, stat row, coverage summary, provenance panel, lists, nearby, map inset | Your trips, Log climb, edit/delete | List progress + "next on this list" | Marks earned here, share card |
| **List library** | `src/pages/ListsPage.tsx`, `SearchField`, `FilterChips` | Count + "data arriving" honest state | — | Real cards, categories, search, progress rings, featured | Completion marks |
| **List detail** | new `src/pages/ListDetailPage.tsx` | — | — | Header, version, rules, map, table, progress, next up, export | Completion sheet, patch, rounds |
| **Custom list** | new `src/pages/CustomListPage.tsx`, `ListCard` | — | — | Create/edit/reorder/share/export | Personal List completion state | — |
| **Quick log** | new `src/pages/LogPage.tsx`, `LogSheet` | — | Three steps, multi-peak, offline queue, validation | "Add to list" context | Badge toast |
| **Trip detail** | new `src/pages/TripPage.tsx` | — | Edit, delete, photos, GPX, conditions, visibility | List impact | Marks earned |
| **Progress** | `src/pages/ProgressPage.tsx`, `StatCard`, `EmptyState` | — | Real stats, calendar, history, export | Active lists, next peaks | Passport band, badge case, yearbook |
| **Badge case** | new `src/pages/BadgesPage.tsx`, `BadgeMark` | — | — | — | All 43 marks by family, progress, silhouettes |
| **Yearbook** | new `src/pages/YearbookPage.tsx` | — | — | — | Annual recap + share image |
| **Sign in** | new `src/pages/SignInPage.tsx` | — | Magic link, Google, Apple, return-to | — | — |
| **Settings** | new `src/pages/SettingsPage.tsx` | — | Units, privacy, export, delete | Home region | Notification opt-in |
| **Data page** | new `src/pages/DataPage.tsx` | Sources, licenses, tiers, corrections | — | List sources | Snapshot changelog |
| **Not found** | `src/pages/NotFoundPage.tsx` | Search entry | — | — | — |

**Shared components to add (no visual regression to the shipped shell):** `PeakCard`, `PeakSheet`, `CoverageChip`, `ListCard`, `ProgressRing`, `BadgeMark`, `Patch`, `DataTable`, `FilterSheet`, `LogSheet`, `MapLegend`, `Toast`, `SourceNote`, `EmptyState` action slot. The existing `PageHeader`, `StatCard`, `SearchField`, `FilterChips`, `Icon`, `Logo` and `PrimaryNav` stay; extend, do not replace.

---

## 7. The five surfaces

### 7.1 Atlas

**Purpose:** answer "what is this mountain, and should I climb it?" anywhere on Earth.

**7.1.1 Globe (`/`)** — keep the shipped blue-hour globe, diamond logo, legacy fonts and camera. Do not add hero copy, filters, readouts or status pills. Add only what the globe is for: Discover, a peak preview card, and a "Near me" action inside Discover. Peaks render as small elevation-tinted points; labels appear above a prominence threshold per zoom. Your climbed peaks get a quiet filled state. Selecting a peak flies the camera to it and opens the preview card. Keyboard: focusable canvas, arrow keys pan, +/− zoom, Enter opens, Esc closes; a "List view" toggle provides the same results as text. Performance: interactive within 3 seconds on a mid-range phone.

**7.1.2 Discover overlay** — search peaks, ranges, places, lists and your trips. Group results. Rank exact/prefix name, then prominence, then proximity, then climbs. Empty query shows recent searches and "Continue a list", never fabricated trending. Zero results show closest matches and "Add a missing peak" (a correction, not a live record). `⌘K`, `/`, Esc, arrows and Enter all work; focus is trapped; the field is focused on open.

**7.1.3 Peaks index** — list and map views, synchronized. Columns: peak, elevation, prominence, range, region, lists, climbs, last climbed. Sort by relevance, elevation, prominence, name, climbs. Filters: region/country, elevation band, prominence band, list, climbed/not (signed in), coverage tier, has routes/photos. Filters in a sheet on mobile and a rail on desktop; result count always visible; active filters removable. Cursor pagination, 50 per page, "Load more" fallback. States: signed out, loading skeleton, empty with reset, error with retry, offline with cached results.

**7.1.4 Peak detail** — in order: hero (name, local names, elevation, prominence, range, region, coordinates, coverage chip, Log climb); stat row (elevation, prominence, isolation, parent peak, first known ascent if sourced, your trips); lists (chips with your status); map inset; your record; routes; conditions and reports; photos; nearby peaks; data panel (field sources, methods, last verified, licenses, suggest a correction). Useful signed out, printable, shareable with an OG image.

### 7.2 Lists

**Purpose:** turn geography into a finite, trustworthy pursuit.

**7.2.1 Library** — featured row of three editorial lists; categories: Elevation, Prominence, Region, High points, Parks & wilderness, Historic, Seasonal; a separate **Custom** section shows the user's `custom_list` rows, not published catalogue entries. Cards show patch, title, publisher, version, peak count, region, and progress if signed in. Search by list, publisher, region; filter by category and distance. Every card states its version and last-checked date. A list without a source cannot be published.

**7.2.2 List detail** — header (patch, title, publisher, version, effective date, peak count, character, source link); your progress (ring, done/remaining, last climb, estimated finish only when enough data, rounds); rules in plain language with official link and "not the official record"; map coloured by status; peak table (rank, peak, elevation, prominence, status/date, nearby) with filters; next five remaining peaks by travel; rounds; changes (added/removed with "completed v2024; 2 new peaks since"); export (GPX of remaining, CSV, print checklist).

**7.2.3 Custom lists** — private by default, share by unguessable link, reorder, note per peak, export, print. No publisher completion badge and no passport badge; a single "Personal list complete" presentation state. Free in v1.

### 7.3 Journal

**Purpose:** make recording a climb faster than not recording it.

- **Quick log:** peak prefilled → date (today) → Summit → Save. Three taps; everything else optional.
- **Full log:** multiple peaks, outcome per peak, route, party, conditions, notes, photos, GPX, distance/gain, visibility.
- **Attempts:** the same flow with outcome Attempt; counted separately, no summit badges (except the deliberate "ones that got away" mark).
- **Backfill:** "Add a past climb" and "Import history" (GPX, CSV, manual year-by-year). Dates can be approximate (`1998-07`); the UI shows "July 1998" and the data keeps precision.
- **Duplicate protection:** same peak and date shows both and offers merge or keep separate.
- **Offline:** IndexedDB queue, visible "Waiting to sync", never silently lost.
- **Edit/delete:** every trip editable; soft delete 30 days; stats and badges recalculate.

### 7.4 Passport

**Purpose:** the record, made legible and worth returning to.

- Passport header: name, member since, home region, units, totals (summits, unique peaks, lists active, lists completed).
- Stats: unique peaks, total trips, attempts, reported gain, distance, days out, highest, most prominent, countries, ranges.
- Calendar: 12-month heatmap; click a day to see the trip.
- Charts: trips by year, elevation distribution, list rings.
- Active lists: up to three cards with progress and next peak.
- Badge case: recent marks, then the full case.
- Yearbook: generated in December, permanent at `/progress/year/:year`.
- Export: JSON, CSV, GPX; free, no support ticket.

### 7.5 Field Notes (later)

Routes with grade, distance, gain, season, source and GPX; trip reports attached to a peak and a trip; hazards and closures with expiry and source; photos with credit, license and report control; moderation, steward review and a public corrections log. This surface waits until the record works. A journal with no users does not need a feed.
---

## 8. Data model

### 8.1 Conventions

- **IDs:** UUIDv7 generated application-side; never reused; never exposed as a sequence.
- **Slugs:** permanent; a rename writes a `place_alias` / `list_alias` row and the old slug 301s.
- **Time:** `timestamptz` in UTC; dates that represent a local calendar day use `date` plus a `timezone` column.
- **Geography:** `geography(Point, 4326)` for peaks; `geography(MultiPolygon, 4326)` for regions; GiST indexes.
- **Soft delete:** only user content (`trip`, `photo`, `condition_report`, `app_user`); peaks, regions, lists and versions are archived, never hard-deleted. A purge job removes user content 30 days after deletion.
- **Audit:** every mutation writes an `audit_event`; badges and list completions are append-only ledgers.
- **Enums:** Postgres enums for stable small sets (`coverage_tier`, `outcome`, `visibility`, `units`, `role`, `list_status`); text + check for sets likely to grow.
- **Naming:** snake_case tables and columns; singular table names; `_id` suffix for foreign keys; `created_at` / `updated_at` on every mutable table.

### 8.2 Domains and tables

#### 8.2.1 Place / peak / region / provenance

A **place** is a point feature (today only `kind = 'peak'`). A **peak** is the 1:1 detail row for a place of that kind. A **region** is an area feature: continent, country, admin-1, admin-2, range, park or island. This split keeps map points and polygons separate. `place.region_id` is the primary display region; `place_region` is the full membership set, so a peak can be in a range, a park, an admin area and a continent without duplicating its point. Range membership is a foreign key rather than a string.

| Table | Column | Type | Constraints / notes |
|---|---|---|---|
| `place` | `id` | uuid | PK |
| | `slug` | citext | unique, not null |
| | `name` | text | not null |
| | `name_local` | text | nullable |
| | `kind` | text | not null, default `peak`, check in (`peak`,`summit`,`hill`,`volcano`) |
| | `geom` | geography(Point,4326) | not null |
| | `country_code` | char(2) | ISO 3166-1 alpha-2, nullable until resolved |
| | `region_id` | uuid | FK `region(id)`, nullable |
| | `coverage_tier` | coverage_tier | not null, default `imported` |
| | `status` | text | not null, default `published`, check in (`published`,`hidden`,`merged`) |
| | `merged_into` | uuid | FK `place(id)`, nullable; set only when status = merged |
| | `created_at` / `updated_at` | timestamptz | not null, default now() |
| `peak` | `place_id` | uuid | PK, FK `place(id)` on delete cascade |
| | `elevation_m` | integer | nullable, check ≥ −500 |
| | `prominence_m` | integer | nullable, check ≥ 0 and ≤ elevation_m |
| | `isolation_km` | numeric(7,2) | nullable, check ≥ 0 |
| | `parent_place_id` | uuid | FK `place(id)`; the higher summit at the key col |
| | `is_highpoint` | boolean | not null, default false; country/admin-1 highpoint |
| | `is_continental_highpoint` | boolean | not null, default false |
| | `first_ascent_year` | smallint | nullable; only when sourced |
| | `description` | text | nullable; editorial, sources cited in prose |
| | `character` | text[] | nullable; e.g. `trail`, `scramble`, `winter`, `remote` |
| `place_name` | `id` | uuid | PK |
| | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `name` | text | not null |
| | `lang` | text | BCP 47, not null |
| | `kind` | text | check in (`official`,`alternate`,`local`,`former`) |
| | `source_id` | uuid | FK `data_source(id)` |
| | | | unique (`place_id`,`name`,`lang`) |
| `region` | `id` | uuid | PK |
| | `slug` | citext | unique, not null |
| | `kind` | text | check in (`continent`,`country`,`admin1`,`admin2`,`range`,`park`,`island`) |
| | `name` | text | not null |
| | `parent_id` | uuid | FK `region(id)`; null for continent |
| | `country_code` | char(2) | nullable |
| | `geom` | geography(MultiPolygon,4326) | not null |
| | `source_id` | uuid | FK `data_source(id)` |
| `place_region` | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `region_id` | uuid | FK `region(id)` on delete cascade |
| | `role` | text | check in (`continent`,`country`,`admin1`,`admin2`,`range`,`park`,`island`) |
| | `source_id` | uuid | FK `data_source(id)`, not null |
| | | | PK (`place_id`,`region_id`,`role`) |
| `data_source` | `id` | uuid | PK |
| | `key` | text | unique: `osm`, `geonames`, `wikidata`, `usgs3dep`, `copernicus`, `natural_earth`, publisher key |
| | `name` | text | not null |
| | `license` | text | not null (SPDX where possible) |
| | `license_url` | text | not null |
| | `attribution` | text | not null; the exact string rendered on `/about/data` |
| | `terms_url` | text | nullable |
| | `retrieved_at` | timestamptz | nullable |
| `place_provenance` | `id` | uuid | PK |
| | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `field` | text | one of `name`, `name_local`, `geom`, `elevation_m`, `prominence_m`, `isolation_km`, `parent_place_id`, `region_id`, `country_code`, `is_highpoint`, `is_continental_highpoint`, `first_ascent_year` |
| | `source_id` | uuid | FK `data_source(id)` |
| | `source_ref` | text | OSM ID, GeoNames ID, QID, tile/row, publisher page |
| | `method` | text | check in (`source`,`dem`,`derived`,`human`) |
| | `confidence` | text | check in (`verified`,`calculated`,`imported`,`community`) |
| | `value` | text | candidate value, normalized; the accepted row matches the live field |
| | `value_hash` | text | hash of `value`, for change detection |
| | `is_accepted` | boolean | not null, default false; exactly one accepted row per (`place_id`,`field`) |
| | `checked_at` | timestamptz | nullable |
| | `checked_by` | uuid | FK `app_user(id)`, nullable |
| | | | unique (`place_id`,`field`,`source_id`); partial unique (`place_id`,`field`) where `is_accepted` |

Region memberships carry their own provenance on `place_region.source_id`; `place_provenance.region_id` covers the primary display region only.

**Indexes:** `place(geom) gist`, `place(country_code)`, `place(region_id)`, `place(coverage_tier)`, `place_name(lower(name))`, `place_name USING gin (to_tsvector('simple', name))`, `peak(prominence_m desc)`, `peak(elevation_m desc)`, `region(geom) gist`, `region(parent_id)`, `place_region(place_id)`, `place_region(region_id)`, `place_provenance(place_id, field)`.

#### 8.2.2 Lists and versions

| Table | Column | Type | Constraints / notes |
|---|---|---|---|
| `list` | `id` | uuid | PK |
| | `slug` | citext | unique, not null |
| | `title` | text | not null |
| | `publisher` | text | not null |
| | `publisher_url` | text | not null |
| | `category` | text | `elevation`,`prominence`,`region`,`highpoint`,`park`,`historic`,`seasonal` |
| | `scope` | text | region/country description |
| | `description` | text | our words, not the publisher's |
| | `rules_md` | text | our plain-language summary, sourced |
| | `status` | list_status | `draft`,`published`,`retired` |
| | `created_at` / `updated_at` | timestamptz | |
| `list_version` | `id` | uuid | PK |
| | `list_id` | uuid | FK `list(id)` |
| | `version_label` | text | not null, e.g. `2026` |
| | `effective_from` | date | not null |
| | `effective_to` | date | nullable; null = current |
| | `peak_count` | integer | not null, check > 0 |
| | `source_url` | text | not null |
| | `notes` | text | nullable |
| | `published_at` | timestamptz | not null |
| | | | unique (`list_id`,`version_label`); partial unique (`list_id`) where `effective_to is null` |
| `list_entry` | `id` | uuid | PK |
| | `list_version_id` | uuid | FK `list_version(id)` on delete restrict |
| | `place_id` | uuid | FK `place(id)` on delete restrict |
| | `rank` | integer | nullable; publisher rank |
| | `role` | text | `required`,`alternate`; v1 publishes only required |
| | `note` | text | nullable; winter/ski note |
| | | | unique (`list_version_id`,`place_id`); unique (`list_version_id`,`rank`) where rank is not null |
| `list_completion` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `list_id` | uuid | FK `list(id)` |
| | `list_version_id` | uuid | FK `list_version(id)` |
| | `round` | integer | not null, check ≥ 1 |
| | `started_at` | date | not null; round 1 = `1970-01-01` |
| | `completed_at` | timestamptz | not null |
| | `finisher_no` | text | nullable; only when a publisher issues one |
| | `snapshot` | jsonb | not null; `{place_ids, peak_count, version_label}` |
| | `evidence_trip_id` | uuid | FK `trip(id)`, nullable |
| | | | unique (`user_id`,`list_id`,`round`) |
| `custom_list` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `title` | text | not null; 1–80 chars |
| | `visibility` | text | `private`,`link`; default private |
| | `created_at` / `updated_at` | timestamptz | |
| `custom_list_entry` | `custom_list_id` | uuid | FK `custom_list(id)` on delete cascade |
| | `place_id` | uuid | FK `place(id)` on delete restrict |
| | `position` | integer | not null, check ≥ 1 |
| | `note` | text | nullable |
| | | | PK (`custom_list_id`,`place_id`); unique (`custom_list_id`,`position`) |

**Rules:** custom lists live outside the published catalogue and never appear in `list`, `list_version`, `list_entry` or `list_completion`; they do not earn passport badges. A published `list_version` is immutable except for a one-time `effective_to` closure when a successor is published; its entries are immutable. A trigger enforces both. A change publishes a new version in one transaction: insert the new version, copy entries, set the previous `effective_to`, then flip the pointer. A `list_completion` always references the exact version and stores a JSON snapshot of the place IDs, so it survives even a future version deletion (which is forbidden anyway). Rounds are explicit and separate from versions.

#### 8.2.3 Trips, peaks, photos, conditions

| Table | Column | Type | Constraints / notes |
|---|---|---|---|
| `app_user` | `id` | uuid | PK |
| | `email` | citext | unique, not null |
| | `handle` | citext | unique, not null; 3–24 chars, lowercase |
| | `display_name` | text | not null |
| | `avatar_key` | text | nullable |
| | `home_region_id` | uuid | FK `region(id)`, nullable |
| | `units` | units | `metric`,`imperial`; default metric |
| | `units_chosen_at` | timestamptz | nullable; set only when the user explicitly chooses units (required by `true-north`) |
| | `locale` | text | BCP 47 |
| | `privacy` | privacy | `private`,`followers`,`public`; default private |
| | `role` | role | `member`,`steward`,`admin` |
| | `created_at` / `deleted_at` | timestamptz | |
| `trip` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `title` | text | nullable; default from peaks |
| | `start_date` | date | not null; anchor = first day of the `date_precision` period (year → Jan 1, month → day 1); never displayed below the precision |
| | `end_date` | date | nullable; check ≥ start_date |
| | `date_precision` | text | `day`,`month`,`year` |
| | `start_time` | time | nullable; local time for dawn/night marks |
| | `timezone` | text | IANA; nullable |
| | `route_id` | uuid | FK `route(id)`, nullable |
| | `distance_m` | integer | nullable; only user/GPX supplied |
| | `gain_m` | integer | nullable; only user/GPX supplied |
| | `notes` | text | nullable; 10,000 char limit |
| | `conditions` | jsonb | nullable; structured tags |
| | `visibility` | visibility | `private`,`followers`,`public`; default private |
| | `gpx_key` | text | nullable; original object key |
| | `source` | text | `manual`,`gpx`,`csv`,`backfill` |
| | `verification` | text | `logged`,`gps`,`witness`,`steward`; default logged |
| | `created_at` / `updated_at` / `deleted_at` | timestamptz | |
| `trip_peak` | `trip_id` | uuid | FK `trip(id)` on delete cascade |
| | `place_id` | uuid | FK `place(id)` on delete restrict |
| | `outcome` | outcome | `summit`,`attempt`,`traverse` |
| | `order` | smallint | not null, check ≥ 1 |
| | `summit_time` | timestamptz | nullable; local offset when known |
| | `verified` | text | `logged`,`gps`,`witness`,`steward` |
| | | | PK (`trip_id`,`place_id`); unique (`trip_id`,`order`) |
| `trip_companion` | `trip_id` | uuid | FK `trip(id)` on delete cascade |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `status` | text | `pending`,`confirmed`,`declined` |
| | | | PK (`trip_id`,`user_id`) |
| `photo` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `trip_id` | uuid | FK `trip(id)` on delete set null |
| | `place_id` | uuid | FK `place(id)` on delete set null |
| | `storage_key` | text | not null, unique |
| | `width` / `height` | integer | not null |
| | `caption` | text | nullable |
| | `alt_text` | text | nullable; required before public |
| | `taken_at` | timestamptz | nullable |
| | `license` | text | `all_rights_reserved`,`cc_by`,`cc_by_sa`; default all rights reserved |
| | `moderation` | text | `pending`,`approved`,`rejected`; default pending |
| | `created_at` | timestamptz | |
| `condition_report` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `trip_id` | uuid | FK `trip(id)` on delete set null |
| | `route_id` | uuid | FK `route(id)` on delete set null |
| | `observed_at` | date | not null |
| | `conditions` | jsonb | `snow`,`ice`,`rock`,`weather`,`visibility`,`wind` |
| | `body` | text | not null; 4,000 chars |
| | `status` | text | `draft`,`published`,`removed`; default published |
| | `expires_at` | date | nullable; stale after 90 days |
| | `created_at` | timestamptz | |

#### 8.2.4 Badges, events, operations

| Table | Column | Type | Constraints / notes |
|---|---|---|---|
| `badge_definition` | `id` | uuid | PK |
| | `slug` | citext | unique, not null |
| | `family` | text | one of the nine families in §12.3 |
| | `name` | text | not null |
| | `description` | text | not null; one sentence |
| | `criteria` | jsonb | not null; grammar in §12.5 |
| | `criteria_version` | integer | not null, default 1 |
| | `progressive` | boolean | not null |
| | `progress_fact` | text | nullable; required iff progressive |
| | `progress_target` | integer | nullable; required iff progressive |
| | `progress_unit` | text | nullable; `peaks`,`summits`,`metres`,`countries`,`ranges`,`continents`,`rounds`,`lists`,`months`,`seasons`,`attempts`,`photos`,`reports`,`percent` |
| | `hidden` | boolean | not null, default false |
| | `art_key` | text | not null |
| | `created_at` / `updated_at` | timestamptz | |
| `badge_award` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `badge_id` | uuid | FK `badge_definition(id)` |
| | `criteria_version` | integer | not null; the version under which it was earned |
| | `earned_at` | timestamptz | not null |
| | `source_trip_id` | uuid | FK `trip(id)` on delete set null |
| | | | unique (`user_id`,`badge_id`); never re-awarded on a criteria bump |
| `event_outbox` | `id` | uuid | PK |
| | `event_type` | text | `trip.created`,`trip.updated`,`trip.deleted`,`list.version.published`,`badge.evaluate`,`stats.rebuild`,`email.send` |
| | `aggregate_type` | text | `trip`,`list`,`user`,`badge` |
| | `aggregate_id` | uuid | not null |
| | `payload` | jsonb | not null |
| | `created_at` | timestamptz | not null |
| | `processed_at` | timestamptz | nullable |
| | `attempts` | smallint | not null, default 0 |
| | `last_error` | text | nullable |
| `correction` | `id` | uuid | PK |
| | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `field` | text | one of the provenance fields |
| | `old_value` | text | nullable |
| | `new_value` | text | not null |
| | `source_url` | text | nullable |
| | `status` | text | `pending`,`accepted`,`rejected`; default pending |
| | `reviewed_by` | uuid | FK `app_user(id)` |
| | `reviewed_at` | timestamptz | nullable |
| | `created_at` | timestamptz | |
| `report` | `id` | uuid | PK |
| | `reporter_id` | uuid | FK `app_user(id)` on delete set null |
| | `target_type` | text | `trip`,`photo`,`condition_report`,`profile`,`route` |
| | `target_id` | uuid | not null |
| | `reason` | text | `spam`,`abuse`,`privacy`,`inaccurate`,`copyright`,`other` |
| | `detail` | text | nullable |
| | `status` | text | `open`,`actioned`,`dismissed` |
| | `resolution` | text | nullable |
| | `created_at` | timestamptz | |
| `import_job` | `id` | uuid | PK |
| | `user_id` | uuid | FK `app_user(id)` on delete cascade |
| | `kind` | text | `gpx`,`csv` |
| | `file_key` | text | not null |
| | `status` | text | `uploaded`,`parsed`,`review`,`committed`,`failed` |
| | `matched_count` | integer | not null, default 0 |
| | `error` | text | nullable |
| | `created_at` / `updated_at` | timestamptz | |
| `import_candidate` | `id` | uuid | PK |
| | `import_id` | uuid | FK `import_job(id)` on delete cascade |
| | `place_id` | uuid | FK `place(id)` |
| | `trip_date` | date | nullable |
| | `confidence` | text | `high`,`medium`,`low` |
| | `status` | text | `suggested`,`accepted`,`rejected` |
| | | | unique (`import_id`,`place_id`) |
| `route` | `id` | uuid | PK |
| | `place_id` | uuid | FK `place(id)` on delete cascade |
| | `name` | text | not null |
| | `grade` | text | nullable |
| | `distance_m` / `gain_m` | integer | nullable |
| | `route_type` | text | `trail`,`scramble`,`snow`,`ice`,`mixed` |
| | `description` | text | nullable |
| | `gpx_key` | text | nullable |
| | `source` | text | `editorial`,`community`,`publisher` |
| | `verified` | boolean | default false |
| `audit_event` | `id` | uuid | PK |
| | `actor_id` | uuid | FK `app_user(id)` on delete set null |
| | `action` | text | e.g. `trip.create`, `badge.award`, `list.version.publish` |
| | `target_type` / `target_id` | text / uuid | |
| | `payload` | jsonb | |
| | `created_at` | timestamptz | |

#### 8.2.5 Materialised views

- `user_stats` — one row per `(user_id, year)` plus `year = 0` for all time: `summits`, `unique_peaks`, `attempts`, `days_out`, `gain_m`, `distance_m`, `highest_m`, `most_prominent_m`, `countries`, `ranges`, `lists_started`, `lists_completed`, `updated_at`. Rebuilt on trip write and nightly.
- `peak_climb_stats` — `place_id`, `trips`, `unique_climbers`, `last_climbed_at`. Updated on trip write; used for sorting and the peak card.
- `list_progress` — for each `(user_id, list_id)` on a **published** list: current version, required count, summits count, `pct`, last summit, completed rounds. Custom lists compute progress separately. Definition in §10.4.

### 8.3 Coverage tiers and provenance matrix

`place.coverage_tier` is derived from field provenance. It is not hand-set except by a steward promotion.

| Field | Verified | Calculated | Imported | Community |
|---|---|---|---|---|
| `name` | source + human check | source | source | user, unreviewed |
| `name_local` | source or null | source or null | source or null | null |
| `geom` | source + human check | source/DEM | source | user, unreviewed |
| `elevation_m` | source + human check | DEM or source | source or null | null |
| `prominence_m` | source or computed + review | computed from DEM, method stored | null | null |
| `isolation_km` | optional, source/DEM | optional, DEM | null | null |
| `parent_place_id` | optional, derived | derived, stored | null | null |
| `place_region` memberships / `country_code` | point-in-polygon + review | point-in-polygon | coarse/nearest | null |
| `is_highpoint` / `is_continental_highpoint` | publisher/agency source | derived only if unambiguous | false | false |
| `first_ascent_year` | cited source | null | null | null |
| **List membership** | allowed | allowed | no | no |
| **Prominence badges** | allowed | allowed | no | no |
| **Elevation badges** | allowed | allowed | allowed only if elevation source exists | no |

**Derivation rule:** `verified` requires name, geom and elevation to have a `verified` provenance row; `calculated` requires name + geom + a sourced/DEM elevation; `imported` requires name + geom from a global source; `community` is everything else. A steward can promote `calculated` to `verified` only by attaching the missing source/check rows. A demotion is a new audit event and a changelog entry.

### 8.4 List versioning, completions and rounds

1. **Immutable versions.** A published `list_version` is immutable except for a one-time `effective_to` closure when a successor is published; its `list_entry` rows cannot be updated or deleted. A trigger enforces both. Corrections create a new version.
2. **One current version.** Partial unique index on `(list_id)` where `effective_to is null`. Publishing a new version sets the previous `effective_to` to the day before the new `effective_from` in the same transaction.
3. **Completion snapshot.** When the user reaches 100% of the current version's required entries, the system inserts one `list_completion` with `list_version_id`, `round`, `started_at`, `completed_at`, and `snapshot = {place_ids, peak_count, version_label}`. The snapshot is the immutable record; progress can be recomputed, the completion cannot.
4. **Rounds are explicit.** Round 1 counts all history (`started_at = 1970-01-01`). After a completion, the user may start round 2; `started_at` defaults to today (it may be backdated by the user to record a past round). A round completes when every required peak of the then-current version has a summit with `trip.start_date >= started_at`. This prevents a backfilled history from inflating rounds automatically.
5. **Version changes after completion.** The completion remains valid forever: "Finisher · 2024 list". Current progress uses the new version; the UI shows "2 new peaks since". The completion badge is never revoked by a version change.
6. **Rounds and versions.** A round records the version it completed. A later version can be completed for the next round. `second-round` and `third-round` use the maximum `round` across lists.
7. **Finisher numbers.** Only stored when a publisher issues one; Terrane never invents a number and labels it "publisher finisher no.".
8. **Retired lists.** Status `retired`; readable; completions preserved; cannot be started or completed again.

### 8.5 Trip model

- **One trip, many peaks.** A `trip` is the unit a person remembers: a day or a multi-day outing. `trip_peak` records each summit/attempt with an order and outcome. A trip may contain one peak (the common quick log) or ten (a traverse).
- **No duplicate peak in a trip.** Primary key `(trip_id, place_id)`.
- **Outcome is per peak.** A trip can include a summit, a failed attempt and a traverse in one record; stats count them separately.
- **Past climbs are first-class.** `source = 'backfill'`; `date_precision` may be `year` or `month`; `start_date` stores the first day of that precision period, and the UI renders "July 1998" without showing the anchor day. `paper-trail` is computed as a trip date more than one year before `app_user.created_at`.
- **A trip can be a pure attempt.** At least one `trip_peak` is required; a trip with only attempts counts in attempts and days out, not summits.
- **GPX is evidence, not authority.** The import creates an `import_job` and `import_candidate` rows; nothing is written to `trip` until the user commits. The matcher suggests; the user accepts.
- **Visibility is per trip.** Default private; followers/public are opt-in. Photos inherit the trip visibility but can be more restrictive.

**GPX matching rules (exact):**

1. Parse the GPX; reject points with horizontal accuracy > 50 m; simplify with a 10 m threshold.
2. Candidate peaks are those within **300 m** of any track point.
3. A candidate is a **high-confidence summit** when a track point is within **100 m horizontal** of the summit and either (a) the track elevation is within **30 m** of the summit elevation, or (b) the track has no elevation data.
4. A candidate is a **near miss** when within 300 m but not high-confidence; it is a suggestion only.
5. Reject impossible sequences: two peaks more than 5 km apart within 10 minutes; timestamps out of order; a file hash already imported by the user.
6. The review screen shows the matched segment, the confidence and the peak; the user accepts/rejects per candidate, then commits one trip (or one trip per day, at the user's choice).
7. `trip_peak.verified = 'gps'` only for accepted high-confidence matches; otherwise `logged`.
8. Elevation gain and distance come from the GPX or the user; never from summit elevation minus an assumed trailhead.

### 8.6 Migration and seed rules

- Migrations are SQL files under `db/migrations`, applied with Drizzle Kit; every migration is forward-only and reviewed.
- Seed data lives in `db/seed/` and is idempotent. The badge catalog is seeded from `data/badges.json`; the launch list catalogue is seeded from `data/lists/*.json` with source URLs.
- No production row is created from a test fixture. No fixture is loaded in production.
- The badge seed validates before insert; a single unknown fact aborts the seed.
- The pipeline writes to staging tables (`stage_*`) and publishes through a versioned snapshot; it never writes production `place`/`peak` rows directly.

---

## 9. Peak data and provenance (ingest)

### 9.1 Sources and licensing

| Source | License | Use | Caveats |
|---|---|---|---|
| **OpenStreetMap** (`natural=peak`) | ODbL 1.0 | Candidate summits, names, some `ele`, wikidata links | Variable quality; `ele` often rounded/wrong; share-alike obligations |
| **GeoNames** | CC BY 4.0 | Names, alternate names, coarse elevation, feature class | Global but uneven; populated-place noise |
| **Wikidata** | CC0 | Cross-IDs, elevation/prominence where cited, first ascent | Sparse; statements need references |
| **Natural Earth** | Public domain | Countries, admin-1, coastlines, islands, ranges | Coarse boundaries; not survey-grade |
| **USGS 3DEP** | Public domain (US) | DEM for elevation, prominence, isolation in the US | US only |
| **Copernicus DEM GLO-30** | Free, attribution (ESA) | Global DEM sampling; prominence/isolation for launch regions | 30 m; canopy/building artefacts; not a summit survey |
| **National mapping agencies** | Varies | Authoritative elevation/boundaries (OS, IGN, etc.) | Licence-by-licence review |
| **List publishers** | Facts; terms vary | Membership, ranks, versions, rules | Never copy descriptions or artwork; link to the publisher |

**Basemap:** keep OpenFreeMap for the globe (shipped) and the public Mapzen/AWS terrarium terrain. Both need attribution and a production fallback; neither is the peak index. The dataset's licence manifest is published on `/about/data` and in every snapshot export.

### 9.2 Pipeline stages

1. **Extract** — pull candidates from OSM, GeoNames and Wikidata into Parquet with source IDs and timestamps. Store the raw extract hash.
2. **Normalize** — Unicode NFKC, diacritics, transliteration, local names, alternate names, language tags. Strip generic prefixes only when they are not part of the name.
3. **Match/dedupe** — candidate match if within **150 m** and (name similarity > 0.85 or shared Wikidata ID). Conflicts go to a human queue. Never auto-merge two named summits without review. A merge keeps the loser as `status='merged'`, `merged_into` set, and redirects the slug.
4. **Elevation** — priority: national survey > publisher/cited value > DEM sample > OSM `ele` > GeoNames. Store every candidate and the chosen value. Flag discrepancies over 20 m.
5. **Prominence** — use a sourced value if one exists. Otherwise compute for the launch regions from the DEM: for each summit, find the highest saddle (key col) connecting it to a higher summit; prominence = summit − key col. Store method, DEM version and source. Do not compute globally on day one; do not estimate silently.
6. **Isolation** — distance to the nearest higher ground from the DEM, for launch regions and major peaks. Optional; never guessed.
7. **Hierarchy** — point-in-polygon for country/admin; nearest named range for range; island assignment from Natural Earth. Store the source.
8. **Tiering** — assign `verified`, `calculated`, `imported` or `community` by the matrix in §8.3.
9. **Verification** — a steward reviews every `verified` claim: name, coordinates, elevation, prominence, region, highpoint flags. The review is a row, not an email.
10. **Publish** — write a versioned snapshot (`2026.12`), a licence manifest and a changelog. The API serves the snapshot; production tables are swapped in one transaction.
11. **Index/tiles** — build `peak_search` documents and low-zoom peak tiles (z0–8). High-zoom points come from the API.
12. **QA** — automated checks plus a steward queue; publish a QA report with every snapshot.

### 9.3 Dedupe and matching rules (exact)

- **Candidate pair:** distance ≤ 150 m.
- **Match score:** name similarity (trigram) ≥ 0.85, or shared Wikidata ID, or same GeoNames ID.
- **Auto-accept:** score ≥ 0.95 and both sources agree on elevation within 30 m.
- **Review:** 0.85–0.95, or any disagreement > 30 m, or two named peaks within 150 m.
- **Reject:** distance > 150 m unless an official source explicitly links them; never merge distinct named summits by proximity alone.
- **Name rules:** compare normalized names; a local name and an English name can merge only with a shared source ID; do not merge "Mount X" and "X Mountain" on string similarity alone without review.
- **Coordinate rules:** prefer the source with the most precise datum; store the chosen point and the alternatives in provenance.

### 9.4 Verification workflow

1. Pipeline flags a peak for review when any required field is missing, two sources disagree beyond threshold, or the point is on water/steep terrain.
2. Steward opens the review queue: source values side by side, map, DEM sample, existing lists.
3. Steward chooses the value, records the reason, and promotes the tier.
4. Accepted corrections become `place_provenance` rows and a `correction` row with status `accepted`; the changelog names the field, old value, new value and source.
5. Rejected corrections notify the user with the reason; no silent rejection.
6. Every accepted correction can award `steward` (once) and updates `peak_search`/tiles.

### 9.5 No-fabrication rule

- A peak is never created to fill a list. If a list entry cannot be matched to a real place, the list version is **not published**; the mismatch is a blocker.
- A missing elevation/prominence is `null`, never 0 and never estimated. Badges that need the field do not fire.
- A placeholder image is a generated contour, never a stock photo pretending to be the peak.
- Demo/test data is confined to `db/seed/test/` and never loaded in production.
- The build fails if a seeded list has fewer entries than its declared `peak_count`, or if any entry references an unpublished place.

### 9.6 Launch dataset

1. **Three deep regions** — US Northeast (NH, NY, New England), Colorado, Scotland.
2. **Global discovery** — named peaks with a plausible source, labelled `imported`, quality floor = name + coordinates + country. No badges, no list claims.
3. **Signature editorial list** — the **Blue Hour 50**, 50 peaks chosen for the quality of the light and the walk. Terrane's own list; proves curation.

**Wave 1 (Phase 1):** NH 48 (48), Adirondack 46 (46), Catskill 3500 (35), Colorado 14ers (58 named), Munros (282) = **469 peaks**. Every one must be present and verified before Phase 1 exits.

**Why these regions:** they cover a US state list culture, a high-elevation list culture and a British hill-list culture, stress-testing versioning against three different publishers.

**Why only three:** each verified peak costs steward time, and a list is only publishable when every entry is matched and sourced. 469 is the largest Wave 1 that one steward can verify before Phase 1 exits; breadth stays available at the `imported` tier so search is useful without claiming the long tail is verified.

### 9.7 Refresh cadence

- Peaks: quarterly full snapshot; monthly corrections; emergency fixes for wrong coordinates.
- Lists: on publisher change; a version within 14 days of an official update.
- Elevation/prominence: annual, or when a national dataset changes.
- Changelog: every snapshot gets a human-readable entry (added, removed, corrected, re-tiered).

---

## 10. Lists

### 10.1 Anatomy of a list

A published list is a **versioned publication** with a publisher, a rule and a date.

| Field | Example |
|---|---|
| Title | White Mountain 4,000-Footers |
| Publisher | Appalachian Mountain Club |
| Version | 2026 edition |
| Effective from | 2026-01-01 |
| Peak count | 48 |
| Scope | New Hampshire, USA |
| Rule | The 48 summits on the AMC's official list, climbed on foot |
| Source | Publisher page, checked 2026-11-01 |
| Character | Trail hiking, severe weather, long days |
| Patch | Engraved mark, family: alpine |

### 10.2 Versioning and completion rules

1. A version is immutable after publication.
2. A change creates a new version with a changelog; the previous version gets `effective_to`.
3. The user's default progress is against the current version.
4. A completion is stored against the version that was current when completed and remains valid forever.
5. If a list changes after completion, show both: "Completed 2024 · 2 new peaks in 2026".
6. Rounds are counted per list; each completion records its version and a place-ID snapshot.
7. Retired lists remain readable and keep completions.
8. Alternates and choice groups are out of scope for v1; do not fake them with a flat list.
9. Winter/ski variants are separate list variants, not a toggle.
10. A list without a source URL and a verified membership set cannot be published.

### 10.3 Completion semantics (exact)

A list version is complete for a user when, for every `list_entry` with `role='required'`:

- there is at least one `trip_peak` with `outcome='summit'` and `place_id = entry.place_id`;
- the trip's `start_date >= completion.started_at` (round 1 uses 1970-01-01);
- the trip is not soft-deleted and the user owns it.

Attempts do not count. A traverse counts only if the outcome is `summit`. Past climbs count in round 1. There is no minimum gain, track or witness requirement.

### 10.4 Progress and rounds

- `list_progress.pct = round(100 * completed_required / total_required)`, capped at 100.
- `completed_required` counts distinct required peaks with at least one qualifying summit.
- `remaining` is the difference; the list page shows the next five by travel.
- A completion is inserted once per `(user, list, round)`; the app shows a completion sheet only when the insert is new.
- `round` starts at 1; "Start round 2" sets `started_at` to today (editable for a past round). A round is not auto-started by a version change.
- `second-round` / `third-round` badges read `max(round)` across all lists.
- A completion snapshots `place_ids` so a later version cannot rewrite what was completed.

Custom lists are excluded from this section: their progress is computed from `custom_list_entry` and they never create a `list_completion`.

### 10.5 Catalogue and waves

Counts are commonly published figures; **verify against the publisher at import** and store the version. This table is the shopping list, not the source of truth.

| List | Publisher | Peaks | Notes | Wave |
|---|---|---|---|---|
| White Mountain 4,000-Footers (NH 48) | Appalachian Mountain Club | 48 | Official AMC list; winter variant later | 1 |
| Adirondack 46ers | Adirondack 46ers | 46 | Historic list; herd paths; winter variant later | 1 |
| Catskill 3,500 Club | Catskill 3500 Club | 35 | Requires winter climbs for membership; model as a variant | 1 |
| Colorado 14ers | Colorado Mountain Club | 53 ranked / 58 named | Two versions; the user chooses which count they follow | 1 |
| Munros | Scottish Mountaineering Club | 282 | Canonical list; revisions are rare but real | 1 |
| Sierra Peaks Section List | Sierra Club, Angeles Chapter | 247 | 25th edition (2017), one suspended peak | 2 |
| 50 State Highpoints | — | 50 | Facts; no single publisher; cite sources per peak | 2 |
| Corbetts | Scottish Mountaineering Club | 222 | 2,500–3,000 ft, 500 ft drop | 2 |
| Wainwrights | Alfred Wainwright / publishers | 214 | Chapters, not a prominence rule | 2 |
| Alpine 4,000ers | UIAA | 82 | Verify edition and summit definitions | 2 |
| Seven Summits | — | 7 | The Carstensz variant is a separate list | 2 |
| Country highpoints | — | ~195 | Depends on territory definition; version it | 2 |
| Ultra P1500 | Computed from our data | ~1,500+ | Only verified/calculated prominence; no publisher | 3 |
| The Blue Hour 50 | Terrane | 50 | Editorial; our own list; proves curation | 2 |
| Marilyns | Database of British and Irish Hills | 2,011 | Prominence ≥150 m; large list | 3 |

**Wave 1 (Phase 1):** 469 peaks across five lists (Colorado uses the 58 named variant). **Wave 2 (Phase 3):** ships only when membership is complete and sourced; no partial list is published. **Wave 3 (Phase 7):** needs national/global prominence at scale.

### 10.6 Custom lists

Private by default; share by unguessable link; add/remove/reorder; note per peak; export GPX/CSV; print. Stored in `custom_list`/`custom_list_entry`, outside the published catalogue. Completion shows a **Personal List** state in the journal, not a passport badge and not a publisher completion. Free in v1.

### 10.7 List page data contract

`GET /api/lists/:slug` returns list metadata + current version + entries (peak card fields). `GET /api/lists/:slug/progress` returns the user's completed place IDs, dates, percentage, rounds and version. The public part is cacheable; progress is private.

---

## 11. Trips, ascents and the journal

### 11.1 What a trip is

A trip is a **day or outing**, not a checkmark. One trip can include several peaks, one track, several photos and one story. This mirrors how people climb and avoids duplicate entries.

| Field | Required | Notes |
|---|---|---|
| User | Yes | Owner; private by default |
| Date | Yes | Day, month or year precision; `date_precision` records which |
| Peak(s) | At least one | Each with outcome `summit`, `attempt` or `traverse` |
| Title | No | Defaults to peak names; editable |
| Route | No | From the peak's routes or free text |
| Party | No | Names or handles; no location data |
| Conditions | No | Snow, rock, weather, visibility; structured tags plus notes |
| Notes | No | Markdown, 10,000 chars |
| Photos | No | Up to 20; EXIF location stripped by default |
| GPX | No | Up to 20 MB; stored, simplified for display |
| Distance/gain | No | Auto-filled from GPX; editable; never inferred |
| Visibility | Yes | Private (default), followers, public |
| Verification | Derived | `logged`, `gps`, `witness`, `steward` |

### 11.2 Backfill

- Year → month → peak, with approximate dates; a "history" flag distinguishes pre-account climbs.
- Bulk entry: 50 peaks in one sitting without a modal per peak.
- No requirement for a date exact to the day; no requirement for a track.
- `paper-trail` is awarded when a trip date is more than one year before the account creation date.

### 11.3 GPX import (suggest-only)

1. Upload multiple files; each becomes an `import_job`.
2. Parse, simplify, find candidates within 300 m.
3. High-confidence summit rule: within 100 m horizontal and (track elevation within 30 m of summit or no elevation).
4. Near misses are suggestions only.
5. Reject teleports, out-of-order timestamps and duplicate file hashes.
6. User reviews candidates with a map segment and confidence; accepts/rejects; commits one trip per day (or merges).
7. Nothing is published until commit. `verified='gps'` only for accepted high-confidence matches.
8. Distance/gain only from GPX or user entry.

### 11.4 Attempts, repeats, rounds

- Attempts count in days out and attempts, not summits or list progress.
- Repeats grow total trips, not unique peaks.
- Rounds count completions, not repeats.
- "The ones that got away" is three attempts; affectionate, not a failure state.

### 11.5 Privacy

- Trips private by default; public profile opt-in.
- Per-trip visibility; hide exact dates (show year/season) available.
- EXIF GPS stripped by default; opt-in to attach to the peak, never a home address.
- Deletion: immediate removal, 30-day soft delete, purge; backups expire within 30 days; export offered, never required.
---

## 12. Badges and the passport

### 12.1 Philosophy

A Terrane badge is a **sentence about your history**, not a currency. It is awarded from recorded facts, it is permanent, and it is never spent, ranked or used to unlock basic features.

The visual language is a **passport stamp**: engraved contour lines, paper ink, one accent colour, a date and a place. Not a glossy game token, not confetti.

### 12.2 Rules

1. Derived from facts only. No manual grants except `steward` (audited).
2. Awarded once per badge; tiers are separate badges.
3. Never revoked except for fraud or a duplicate account; revocation is audited and the user is told.
4. No points, no levels, no global leaderboard, no daily streaks.
5. Hidden badges show a silhouette and a hint, not the exact criteria, until earned.
6. Progress toward a badge is visible where useful (list completion, century count), never as a nag.
7. Badges can be earned retroactively when history is backfilled.
8. A badge is never paywalled and never sold.

### 12.3 Families

| Family id | Name | What it celebrates |
|---|---|---|
| `firsts` | Firsts | Starting, and trusting the record with your history |
| `count` | Count | Accumulation over a life |
| `elevation` | Elevation | Height above the sea |
| `prominence` | Prominence | The shape of a mountain, not just its height |
| `lists` | Lists | Completion and return |
| `seasons` | Seasons | When you go, not just where |
| `geography` | Geography | The breadth of the map |
| `craft` | Craft | Contribution and care |
| `rare` | Rare | The stories worth telling |

### 12.4 The full catalog (43 marks)

All criteria are evaluated against the facts in §12.5 using the grammar defined there; the table shows comparisons in shorthand (`>=`, `==`, `all(...)`). The canonical machine-readable file is `data/badges.json`, and `src/badges/badges.test.ts` proves every row evaluates.

| ID | Name | Family | One-line description | Exact criteria | Type | Hidden |
|---|---|---|---|---|---|---|
| `first-light` | First Light | Firsts | Log your first summit. | `ascents.summits >= 1` | One-shot | No |
| `paper-trail` | Paper Trail | Firsts | Log a climb from before you joined. | `ascents.has_pre_account_ascent == true` | One-shot | No |
| `true-north` | True North | Firsts | Set your home region and units. | `profile.has_home_region_and_units == true` | One-shot | No |
| `first-frame` | First Frame | Firsts | Attach a photo to a climb. | `contributions.photos >= 1` | One-shot | No |
| `cartographer` | Cartographer | Firsts | Attach a GPS track to a climb. | `ascents.gpx_tracks >= 1` | One-shot | No |
| `ten-up` | Ten Up | Count | Reach ten unique summits. | `ascents.unique_peaks >= 10` | Progressive · 10 peaks | No |
| `fifty-up` | Fifty Up | Count | Reach fifty unique summits. | `ascents.unique_peaks >= 50` | Progressive · 50 peaks | No |
| `century` | Century | Count | Reach one hundred unique summits. | `ascents.unique_peaks >= 100` | Progressive · 100 peaks | No |
| `five-hundred` | Five Hundred | Count | Reach five hundred unique summits. | `ascents.unique_peaks >= 500` | Progressive · 500 peaks | No |
| `thousand` | Thousand | Count | Reach one thousand unique summits. | `ascents.unique_peaks >= 1000` | Progressive · 1,000 peaks | Yes |
| `four-thousand` | Four Thousand | Elevation | Stand on a 4,000-metre summit. | `ascents.max_elevation_m >= 4000` | Progressive · 4,000 m | No |
| `fourteener` | Fourteener | Elevation | Stand on a 14,000-foot summit. | `ascents.max_elevation_m >= 4267` | Progressive · 4,267 m | No |
| `five-thousand` | Five Thousand | Elevation | Stand on a 5,000-metre summit. | `ascents.max_elevation_m >= 5000` | Progressive · 5,000 m | No |
| `eight-thousand` | Eight Thousand | Elevation | Stand on an 8,000-metre summit. | `ascents.max_elevation_m >= 8000` | Progressive · 8,000 m | Yes |
| `continental-crown` | Continental Crown | Elevation | Summit the highest peak of a continent. | `ascents.has_continental_highpoint == true` | One-shot | Yes |
| `p300` | P300 | Prominence | Summit a peak with at least 300 m of prominence. | `ascents.max_prominence_m >= 300` | Progressive · 300 m | No |
| `p1000` | P1000 | Prominence | Summit a peak with at least 1,000 m of prominence. | `ascents.max_prominence_m >= 1000` | Progressive · 1,000 m | No |
| `ultra` | Ultra | Prominence | Summit a peak with at least 1,500 m of prominence. | `ascents.max_prominence_m >= 1500` | Progressive · 1,500 m | No |
| `p2000` | P2000 | Prominence | Summit a peak with at least 2,000 m of prominence. | `ascents.max_prominence_m >= 2000` | Progressive · 2,000 m | Yes |
| `enrolled` | Enrolled | Lists | Start any published list. | `lists.started >= 1` | One-shot | No |
| `halfway` | Halfway | Lists | Reach halfway on a list of ten or more peaks. | `lists.max_progress_pct >= 50` | Progressive · 50% | No |
| `finisher` | Finisher | Lists | Complete any published list. | `lists.completed >= 1` | One-shot | No |
| `second-round` | Second Round | Lists | Complete the same list twice. | `lists.max_completed_rounds >= 2` | Progressive · 2 rounds | No |
| `third-round` | Third Round | Lists | Complete the same list three times. | `lists.max_completed_rounds >= 3` | Progressive · 3 rounds | Yes |
| `grand-slam` | Grand Slam | Lists | Complete three distinct published lists. | `lists.distinct_completed >= 3` | Progressive · 3 lists | Yes |
| `winter-round` | Winter Round | Seasons | Summit ten peaks in winter. | `ascents.winter_summits >= 10` | Progressive · 10 summits | No |
| `solstice` | Solstice | Seasons | Summit on a solstice. | `ascents.has_solstice_summit == true` | One-shot | No |
| `dawn-patrol` | Dawn Patrol | Seasons | Start a summit climb before 06:00 local time. | `ascents.has_dawn_start == true` | One-shot | No |
| `night-shift` | Night Shift | Seasons | Summit after local sunset. | `ascents.has_night_summit == true` | One-shot | Yes |
| `perfect-year` | Perfect Year | Seasons | Summit in every month of a calendar year. | `all(time.months_with_summits_in_year >= 12, time.current_year_complete == true)` | Progressive · 12 months | Yes |
| `new-range` | New Range | Geography | Summit in two distinct ranges. | `ascents.ranges >= 2` | Progressive · 2 ranges | No |
| `three-countries` | Three Countries | Geography | Summit in three countries. | `ascents.countries >= 3` | Progressive · 3 countries | No |
| `seven-continents` | Seven Continents | Geography | Summit on all seven continents. | `ascents.continents >= 7` | Progressive · 7 continents | Yes |
| `highpoint` | Highpoint | Geography | Summit a state or country highpoint. | `ascents.has_highpoint == true` | One-shot | No |
| `steward` | Steward | Craft | Have a data correction accepted. | `contributions.corrections_accepted >= 1` | One-shot | Yes |
| `scout` | Scout | Craft | Publish five field reports. | `contributions.reports >= 5` | Progressive · 5 reports | Yes |
| `archivist` | Archivist | Craft | Attach fifty photos. | `contributions.photos >= 50` | Progressive · 50 photos | Yes |
| `hard-way` | The Hard Way | Rare | Summit the same peak in all four seasons. | `ascents.seasons_on_single_peak >= 4` | Progressive · 4 seasons | Yes |
| `lonely-summit` | Lonely Summit | Rare | Summit a peak that stays under five ascents. | `ascents.has_lonely_summit == true` | One-shot | Yes |
| `grand-traverse` | Grand Traverse | Rare | Summit three peaks in one trip. | `ascents.max_peaks_in_trip >= 3` | Progressive · 3 peaks | No |
| `home-mountain` | Home Mountain | Rare | Climb the same peak five times. | `ascents.max_ascents_on_single_peak >= 5` | Progressive · 5 ascents | No |
| `comeback` | Comeback | Rare | Summit a peak you once turned back on. | `ascents.has_summitted_previous_attempt == true` | One-shot | Yes |
| `ones-that-got-away` | The Ones That Got Away | Rare | Log three attempts. | `ascents.attempts >= 3` | Progressive · 3 attempts | No |

**Counts:** 43 marks, 9 families, 28 progressive, 15 one-shot, 15 hidden.

### 12.5 Criteria grammar and facts registry

**Criteria grammar (the only shapes the evaluator accepts):**

```text
Comparison = { "fact": "<FactName>", "gte"|"gt"|"lte"|"lt": <number> }
           | { "fact": "<FactName>", "eq"|"neq": <number|boolean> }
Criteria   = Comparison
           | { "all": [Criteria, ...] }   // at least one child
           | { "any": [Criteria, ...] }   // at least one child
           | { "not": Criteria }
```

Exactly one operator per comparison. Numeric operators require a numeric fact; equality requires the fact's declared type. Missing facts evaluate false; an unknown fact is a validation error, never a silently false badge. Every catalog entry stores a criteria tree in this shape; a single comparison may be wrapped in `all` for a uniform seed.

A fact is computed once per evaluation from the current database state. The registry is the only set of names a criteria row may reference.

| Fact | Type | Definition |
|---|---|---|
| `ascents.summits` | number | Count of `trip_peak` rows with `outcome='summit'` on non-deleted trips |
| `ascents.unique_peaks` | number | Distinct `place_id` among those summits |
| `ascents.attempts` | number | Count of `trip_peak` rows with `outcome='attempt'` |
| `ascents.gpx_tracks` | number | Count of non-deleted trips with `gpx_key is not null` |
| `ascents.winter_summits` | number | Summits dated Dec–Feb for peaks in the Northern Hemisphere, Jun–Aug in the Southern |
| `ascents.seasons_on_single_peak` | number | Maximum distinct meteorological seasons (spring Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb; flipped south) across summits of one peak |
| `ascents.max_ascents_on_single_peak` | number | Maximum count of summits of one peak (repeats included) |
| `ascents.countries` | number | Distinct `country_code` among summits with a known country |
| `ascents.continents` | number | Distinct continent memberships (`place_region.role='continent'`) among summits |
| `ascents.ranges` | number | Distinct range memberships (`place_region.role='range'`) among summits |
| `ascents.max_peaks_in_trip` | number | Maximum count of `trip_peak` rows with `outcome='summit'` in one trip |
| `ascents.max_elevation_m` | number | Maximum `peak.elevation_m` among summits where the peak is `verified` or `calculated`, or `imported` with an `elevation_m` provenance row |
| `ascents.max_prominence_m` | number | Maximum `peak.prominence_m` among summits where the peak is `verified` or `calculated` |
| `ascents.has_pre_account_ascent` | boolean | Any trip date more than one year before `app_user.created_at` |
| `ascents.has_solstice_summit` | boolean | Any summit on the June or December solstice (±1 day) |
| `ascents.has_dawn_start` | boolean | Any summit trip with a local `start_time` before 06:00 |
| `ascents.has_night_summit` | boolean | Any summit after local sunset, computed from peak coordinates and date with NOAA solar equations |
| `ascents.has_highpoint` | boolean | Any summit on a peak whose `is_highpoint` flag is verified |
| `ascents.has_continental_highpoint` | boolean | Any summit on a peak whose `is_continental_highpoint` flag is verified |
| `ascents.has_lonely_summit` | boolean | Any summit whose peak still has fewer than 5 ascents 30 days later (nightly job) |
| `ascents.has_summitted_previous_attempt` | boolean | Any peak with an earlier attempt and a later summit |
| `lists.started` | number | Distinct published, non-custom lists with at least one qualifying summit |
| `lists.completed` | number | Distinct published, non-custom lists with a `list_completion` row |
| `lists.distinct_completed` | number | Distinct published list IDs among completions |
| `lists.max_progress_pct` | number | Maximum progress across published, non-custom lists with at least 10 required peaks |
| `lists.max_completed_rounds` | number | Maximum completed round across published, non-custom lists |
| `contributions.photos` | number | Non-deleted photos owned by the user |
| `contributions.reports` | number | Published condition/trip reports owned by the user |
| `contributions.corrections_accepted` | number | Corrections accepted by a steward |
| `time.months_with_summits_in_year` | number | Maximum distinct calendar months with a summit in one calendar year |
| `time.current_year_complete` | boolean | The year supplying `months_with_summits_in_year` has ended (Dec 31 passed in the user's timezone) |
| `profile.has_home_region_and_units` | boolean | `home_region_id` is set and `units_chosen_at` is set |

Custom lists never contribute to any `lists.*` fact; they are user-authored, live outside the published catalogue, and show a Personal List completion state in the UI rather than a passport badge (the catalog stays at 43). See §10.6.

### 12.6 The engine

1. **Write path.** A trip create/update/delete writes `event_outbox` in the same transaction: `trip.created`, `trip.updated` or `trip.deleted`.
2. **Evaluation worker.** A worker reads unprocessed outbox rows, rebuilds the user's facts in one query, evaluates all 43 badges, and inserts missing `badge_award` rows with `on conflict do nothing`.
3. **Idempotence.** The unique key `(user_id, badge_id)` makes retries and criteria-version bumps safe: an award records the `criteria_version` under which it was earned and is never re-awarded. The outbox row is marked processed only after the awards commit.
4. **List version publish.** Publishing a list version enqueues `badge.evaluate` for affected users; completions are snapshotted, badges are never revoked by a version change.
5. **Nightly sweep.** Time-dependent facts (`lonely-summit`, `perfect-year`, `paper-trail`) and backfills run nightly; the sweep also repairs any missed outbox row.
6. **Revocation.** Only fraud/duplicate-account removal, with an `audit_event` and a user-visible note. No routine revocation.
7. **Performance.** One facts query + 43 in-memory evaluations per trip is cheap; the catalog is seeded into `badge_definition` and cached in the worker. Revisit event-driven rules only past ~200 badges.
8. **Testing.** Every badge has a fixture in `src/badges/badges.test.ts` (empty, satisfying, boundary). The catalog validator rejects an unknown fact, a malformed operator, a duplicate id or a progressive badge without a target.

### 12.7 Art and display

- One square mark per badge, SVG, three sizes (24, 48, 96 px), monochrome ink plus one accent from the blue-hour palette.
- Family frames: Firsts (thin ring), Count (stacked contour), Elevation (triangle), Prominence (single contour), Lists (patch shape), Seasons (sun/moon), Geography (globe line), Craft (pen nib), Rare (broken line).
- Award toast: the mark, the name, one line of why. No confetti, no sound, no modal.
- Badge case: grouped by family, earned first, silhouettes for hidden; tap for the earned date and the trip that earned it.
- Share card: 1080×1350, the mark, the peak, the date, the list if relevant; no personal stats unless the user chooses.
- Physical patches: list completions only, made to order, at cost plus shipping; the digital mark is always free.

---

## 13. Stats and the yearbook

Stats are where a record becomes a story. They must be **defined once, computed once, and explained on the page**.

### 13.1 Definitions

| Stat | Definition | Excludes |
|---|---|---|
| Summits | Count of `trip_peak` rows with `outcome='summit'` | Attempts, traverses that did not summit |
| Unique peaks | Distinct `place_id` among summits | Repeats |
| Total trips | Count of non-deleted trips with at least one summit | Pure attempts |
| Attempts | Count of `trip_peak` rows with `outcome='attempt'` | Summits |
| Days out | Distinct local dates across all trips, including attempts | — |
| Reported gain | Sum of user/GPX gain | Never inferred from peak elevation |
| Reported distance | Sum of user/GPX distance | Never inferred |
| Highest | Maximum peak elevation among summits | — |
| Most prominent | Maximum prominence among summits | Peaks with null prominence |
| Countries | Distinct country codes among summits | Unknown country |
| Ranges | Distinct range IDs among summits | Unknown range |
| Lists active | Published lists with at least one summit and less than 100% | Completed lists; custom lists shown separately |
| Lists completed | Distinct published lists with a `list_completion` row | Custom-list completion is shown separately, never as a passport badge |
| Repeats | Summits minus unique peaks | — |

Every stat has a tooltip with its definition and a link to "How stats work". Missing data shows "—", not zero.

### 13.2 Progress page

1. **Passport band** — name, member since, home region, units, four totals: summits, unique peaks, lists active, lists completed.
2. **This year** — trips by month (bar), days out (calendar heatmap), biggest month.
3. **All time** — trips by year, elevation distribution, countries and ranges.
4. **Active lists** — three cards with ring, remaining count and next peak.
5. **Badge case** — last six marks, plus a link.
6. **Yearbook** — current year card and past years.
7. **Export** — JSON, CSV, GPX; one button, no upsell.

### 13.3 Yearbook

A generated annual recap, available every December and permanently at `/progress/year/:year`.

- Cover: year, summits, highest peak, best month.
- Spreads: the map of the year, lists advanced, badges earned, repeats, attempts, photos, people.
- One shareable image (1080×1350), no precise dates unless chosen.
- Optional print-on-demand book in the Supporter tier; the digital yearbook is free.
- Fewer than three ascents: a single quiet card, not an empty book.

### 13.4 Edge cases

- Time zones: the trip date is the local date at the peak, stored with the offset when known; otherwise the user's home time zone.
- Multi-peak days count once for days out, once per peak for summits.
- Deleted trips disappear immediately; aggregates recompute nightly and on demand.
- Imports do not double-count: file hash and `(user, peak, date)` duplicate checks.
- Unit rounding: store metres; display feet with one rule everywhere (nearest 10 ft above 1,000 ft).

---

## 14. Key UX flows

### 14.1 First visit (signed out)

Globe loads → Discover is the only overlay → type "Mount Washington" → results grouped by Peaks / Lists / Places → select the peak → preview card → "Open peak" → peak page → "Log climb" → sign-in sheet (email magic link or Google/Apple) → return to the prefilled log form. No onboarding wall before the first search.

### 14.2 Log a climb from a peak

Peak page → **Log climb** → date defaults to today → outcome defaults to Summit → optional route, notes, photos, GPX → Save → quiet award toast if earned → the peak page now shows "Your record" and the trip.

### 14.3 Quick log from anywhere

Header/bottom-nav **Log** → search peak → select → date → Summit → Save. The full form is one tap away, never mandatory.

### 14.4 Backfill a life

Progress → "Add history" → choose year → search peaks → multi-select → date precision (year/month/day) → save in bulk → review list → import. 50 peaks in one sitting without a modal per peak.

### 14.5 Start and finish a list

Lists → filter by region → open a list → "Start this list" → progress ring appears on Progress → "Next up" suggests the nearest remaining peak → log it from the list page → the ring moves → on the last peak, a completion sheet: date, round, patch/mark, share (optional).

### 14.6 Import a GPX

Journal → Import → drop files → parse → review suggested peaks per file with confidence → accept/reject → commit → duplicates skipped → unmatched tracks kept as "route only" with an option to attach a peak later.

### 14.7 Plan the next peak

List page → "Remaining" → map → select a cluster → filter by distance from home or last climb → peak page → routes and conditions → "Save to a custom list" or "Log when done". No booking, no gear shop.

### 14.8 Delete an account

Settings → Delete → explain what is removed and when → require typing the handle → offer export → delete → confirmation email → 30-day purge → no dark patterns, no retention upsell.

---

## 15. Design system extension

### 15.1 Visual language

Keep the shipped blue-hour palette, Sora / Plus Jakarta Sans / Fraunces / JetBrains Mono, diamond mark and the map's quiet chrome. The additions must feel like the same object, not a dashboard bolted on.

| Token | Use |
|---|---|
| `--ink`, `--ink-soft`, `--paper`, `--paper-dim` | Text and surfaces; already in the legacy system |
| `--glacier`, `--dusk`, `--ember` | Accent, selected state, earned marks |
| `--line`, `--line-strong` | Hairlines, table rules, map chrome |
| `--space-1..8` | 4 px base scale |
| `--radius-sm/md/lg` | 6/10/16 px; patches and maps use their own geometry |
| `--motion-fast/base/slow` | 120/240/400 ms; ease-out; respect `prefers-reduced-motion` |

**Type:** display (Fraunces) for page titles and list names; body (Plus Jakarta) for prose; mono (JetBrains) for data, coordinates, dates and Discover chrome. Never mono for paragraphs.

**Imagery:** photographs are evidence, not decoration. No stock hero images; the hero is the map, the peak, or the user's own photo. Badge art is engraving, not 3D.

### 15.2 New components

| Component | Use | Notes |
|---|---|---|
| `PeakCard` | Search results, list rows, nearby | Name, elevation, prominence, range, list chips, climbed state |
| `PeakSheet` | Map selection | Bottom sheet on mobile, popover on desktop; keyboard dismiss |
| `CoverageChip` | Data trust | Verified / Calculated / Imported / Community; tooltip with source |
| `ListCard` | Library, progress | Patch, title, publisher, version, ring |
| `ProgressRing` | List progress | SVG, accessible label with exact counts |
| `BadgeMark` | Badge case, toast | SVG, three sizes, silhouette state |
| `Patch` | List completion | Larger, print-ready SVG |
| `DataTable` | Peak/list tables | Sticky header, keyboard rows, sortable, responsive cards |
| `FilterSheet` | Mobile filters | Focus trap, apply/reset, count preview |
| `LogSheet` | Quick log | Three steps, progress, save-and-add-another |
| `MapLegend` | Atlas | Elevation scale, climbed state, coverage |
| `Toast` | Award, sync, errors | One line; errors do not auto-dismiss |
| `EmptyState` | All surfaces | Existing component, extended with an action and a truthful reason |
| `SourceNote` | Peak/list data | Inline attribution and last-verified date |

### 15.3 Microcopy

- Plain, dry, specific. "No peaks match these filters" beats "Nothing to see here!"
- Never shame: "No ascents yet", not "You haven't climbed anything."
- Never claim safety: "Reported conditions, not advice."
- Never fake urgency or scarcity.
- Dates: "12 July 2026" in prose, "2026-07-12" in tables.
- Units: user's choice, always labelled; metres stored.

### 15.4 Accessibility

- WCAG 2.2 AA: contrast, focus visible, keyboard paths, 44×44 mobile targets, reduced motion.
- The map is never the only way to reach a peak: every map view has a list equivalent.
- Map controls have text labels; the canvas has an accessible summary ("Map showing 124 peaks in the current view; use the list for details").
- Errors announced; award toasts `aria-live="polite"`; persistent labels, not placeholder-only.
- Photos need alt text before public; no colour-only status.
---

## 16. Technical architecture

### 16.1 Current foundation

- React 19, TypeScript 7, Vite 8, React Router 7, MapLibre GL 6, Vitest.
- A static SPA with a lazy-loaded globe; no server, database, auth or data layer.
- The globe uses OpenFreeMap vector tiles and public Mapzen/AWS terrarium terrain.
- `npm run build` and `npm test` are the release gate; the legacy shell is the visual baseline.

### 16.2 Target shape

```
src/            React SPA (the current UI; stays where it is)
server/         Hono + Zod API (Node 22 on Vercel Functions)
pipeline/       Python ingest + QA + snapshot builder
packages/shared Types, badge criteria, stat definitions
db/             migrations, seeds, local PostGIS compose
data/           badges.json, list catalogue, source manifests
docs/           product plan, ADRs, runbooks
```

The pipeline is runnable on a laptop and in CI without touching production. The web app keeps its verified routes and components; new pages are added alongside, not by rewriting the shell.

### 16.3 Stack decisions

The full reasoning is in `docs/adr/ADR-001-stack.md`. The short version:

| Layer | Decision |
|---|---|
| Web | Existing React 19 + Vite 8 + TypeScript SPA; MapLibre GL 6 |
| API | Hono on Node 22, Zod validation, REST under `/api` |
| Database | Postgres 17 + PostGIS on Neon |
| ORM / migrations | Drizzle ORM + forward-only SQL migrations |
| Search | Postgres FTS + `pg_trgm` + `unaccent`, materialised `peak_search` |
| Auth | Better Auth: email magic link + Google/Apple, httpOnly sessions |
| Files | Cloudflare R2, signed uploads, server-side derivatives, EXIF strip |
| Hosting | Vercel for web + API; Neon branch per preview; R2 for objects |
| Errors / analytics | Sentry; privacy-first cookieless analytics |
| Tests | Vitest units/contracts; Playwright for five critical flows; pipeline fixtures |

### 16.4 API request and response contracts

**Error shape (RFC 7807):**

```json
{
  "type": "https://terrane.app/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "errors": [{ "path": "peaks[0].placeId", "message": "Unknown place" }],
  "requestId": "req_01J..."
}
```

**Peak detail (`GET /api/peaks/:slug`):**

```json
{
  "id": "0193...",
  "slug": "mount-washington-new-hampshire",
  "name": "Mount Washington",
  "nameLocal": null,
  "kind": "peak",
  "coordinates": { "lat": 44.2705, "lng": -71.3033 },
  "elevationM": 1917,
  "prominenceM": 1873,
  "isolationKm": 1319.0,
  "parent": { "slug": "mount-washington", "name": "..." },
  "range": { "slug": "white-mountains", "name": "White Mountains" },
  "region": { "slug": "new-hampshire", "name": "New Hampshire" },
  "countryCode": "US",
  "coverageTier": "verified",
  "lists": [{ "slug": "nh-48", "title": "White Mountain 4,000-Footers", "version": "2026", "status": "climbed" }],
  "provenance": [
    { "field": "elevation_m", "source": "NHD/AMC", "license": "public-domain", "method": "source", "checkedAt": "2026-11-01", "confidence": "verified" }
  ],
  "nearby": [{ "slug": "...", "name": "...", "elevationM": 1741, "distanceKm": 2.1 }]
}
```

**Create a trip (`POST /api/trips`):**

```json
{
  "startDate": "2026-07-12",
  "datePrecision": "day",
  "title": "Franconia Ridge",
  "visibility": "private",
  "notes": "Windy on the ridge; clear on Lincoln.",
  "routeId": null,
  "distanceM": 13200,
  "gainM": 1100,
  "peaks": [
    { "placeId": "0193...", "outcome": "summit", "order": 1 },
    { "placeId": "0193...", "outcome": "summit", "order": 2 }
  ]
}
```

`Idempotency-Key` is required on `POST /api/trips`. The response is the trip with its peaks and the list progress deltas. A duplicate key returns the original trip, not a second one.

**Pagination:** `?cursor=...&limit=50`; response `{ "data": [...], "nextCursor": "..." }`. The cursor is opaque, signed and stable.

**Auth:** Better Auth owns `/api/auth/*`; the API reads the session cookie. Mutations require a same-origin `Origin`/`Referer` check plus a CSRF token. There are no API keys in v1.

**Caching:** public peak/list reads return `ETag` and `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. `/api/me/*` and `/api/lists/:slug/progress` return `private, no-store`. The SPA is immutable-hashed by Vite.

**Rate limits:** 60 reads/min/IP, 20 writes/min/user, 5 imports/hour/user, 3 reports/day/user. `429` includes `Retry-After`.

### 16.5 Search and map queries

- **Search:** query the materialised `peak_search` document; rank exact name > prefix > trigram similarity, then prominence, then proximity to the map centre. Cap at 20. Return the matched name and the alternate name that matched. Debounce 150 ms in the UI.
- **Viewport:** `ST_MakeEnvelope` + GiST, ordered by prominence, limit 500. At low zoom, serve precomputed clusters (geohash/H3) so the globe never asks for 50,000 points.
- **Peak page:** one query for the peak, one for list memberships, one for the user's trips (if signed in), one for nearby. Cache the public part at the CDN; personalise on the client.
- **List page:** one query for metadata/version/entries, one for progress (private). The public payload is cacheable; the progress overlay is not.

### 16.6 Jobs

| Job | Cadence | Output |
|---|---|---|
| Peak ingest + QA | Quarterly | New snapshot, changelog, QA report |
| List version check | Monthly | Diff report; a new version if the publisher changed |
| Stats materialisation | Nightly + on write | `user_stats`, `peak_climb_stats` |
| Badge evaluation | Outbox + nightly sweep | Awards, backfill, time-dependent marks |
| Image derivatives | On upload | Thumbnails, EXIF-stripped originals |
| Sitemap + OG images | Daily | Public peak/list pages |
| Email | On auth event | Magic link, deletion confirmation, receipt |
| Export | On request | Signed ZIP; expires in 24 hours |
| Backup + restore drill | Daily / quarterly | Encrypted backup; tested restore |

### 16.7 Performance budgets

| Metric | Budget |
|---|---|
| LCP (p75, mobile) | < 2.5 s |
| INP (p75) | < 200 ms |
| CLS | < 0.1 |
| Initial JS (gzip, excluding map chunk) | < 250 KB |
| Globe interactive | < 3 s on a mid-range phone |
| Search API p95 | < 300 ms |
| Peak page API p95 | < 200 ms |
| List progress API p95 | < 250 ms |
| Uptime | 99.9% |

### 16.8 SEO

Public peak and list pages are the acquisition engine. The SPA alone cannot serve 600,000 indexable pages well. Phase 1 adds:

- Prerendered HTML for the top 5,000 peaks and every list (build-time snapshot).
- A sitemap split by region, with last-modified dates.
- Per-page `<title>`, meta description, canonical, OG image and JSON-LD (`Mountain`, `TouristAttraction`, `BreadcrumbList`).
- An edge function that injects meta tags for social crawlers on the remaining pages.
- Revisit SSR (Astro/Next) only if organic traffic proves the SPA ceiling; do not rewrite the app for SEO before launch.

### 16.9 Security and data protection

- Postgres row-level security for user-owned tables; the API connects as a restricted role.
- httpOnly, secure, same-site cookies; CSRF protection on mutations; rate limits per IP and user.
- Signed, short-lived upload URLs; file type/size validation; image re-encoding; no SVG uploads.
- Strict CSP; no third-party scripts in the authenticated app; dependency audit in CI.
- Secrets only in the hosting environment; never in the repo, never in client code.
- Backups: daily, encrypted, 30-day retention; restore tested quarterly.
- Database branches for preview; no production data in previews.

### 16.10 Testing

- Unit: stat definitions, badge criteria, GPX matcher, list progress, date precision.
- Contract: API schemas and error shapes.
- Integration: trip create → stats → badge award; list version change → progress; correction → peak page.
- E2E (small, stable): sign in, log a trip, see it on Progress, complete a two-peak list, export.
- Pipeline: fixture snapshot with duplicates, missing elevations, ocean coordinates; assert QA gates.
- Badge catalog: `src/badges/badges.test.ts` — 43 unique ids, nine families, every criterion evaluable, every fact real, progressive boundaries.
- Every phase ends with `npm run build` and `npm test` green, plus the relevant integration suite.

---

## 17. Offline and PWA strategy

### 17.1 PWA, not native (for now)

A native app is a distribution decision, not a product decision. Until retention is proven, ship an installable PWA that:

- precaches the app shell, fonts, icons and the last-viewed peak/list pages;
- caches map tiles for a pinned area with an explicit size limit;
- queues trips, photos and GPX in IndexedDB with an idempotency key;
- shows a clear offline state and a sync queue count;
- retries on reconnect and never silently drops a climb.

### 17.2 Cache strategy

| Asset | Strategy | Limit |
|---|---|---|
| App shell, fonts, icons | Precache, versioned | ~2 MB |
| Peak/list JSON (public) | Stale-while-revalidate, 24 h | Last 200 pages |
| Map style + glyphs + sprites | Cache-first, 7 days | ~10 MB |
| Vector tiles | Cache-first, 7 days, LRU | 50 MB default |
| Terrain tiles | Network-only (large, opaque) | 0 |
| User photos | Cache on demand | 20 MB |
| Unsynced queue | IndexedDB, never evicted | No limit |

The service worker is generated by the Vite PWA plugin (Workbox). A cache-version bump clears old shells but never touches the queue. Settings shows storage used and a "Clear map cache" action.

### 17.3 Queue and sync

- Queue item: `{ id, idempotencyKey, kind: 'trip'|'photo'|'gpx', method, url, body, file?, createdAt, attempts, lastError }`.
- The form writes to IndexedDB before the network call; the UI says "Saved on this device" and then "Waiting to sync".
- Sync runs on `online`, on app focus, and on a manual "Sync now". Background Sync is used when available; the manual path always works.
- Server is canonical. A `409` returns the current trip; the user chooses "Keep mine" or "Use server". Photos upload separately and attach when done.
- A queued trip is editable/deletable until synced. Errors are visible, not silent; retries are capped with backoff.

### 17.4 Offline scope

- Offline: view pinned peaks/lists, read your last 200 pages, draft/edit a trip, queue a GPX/photo.
- Not offline (v1): search the whole atlas, live map tiles outside the pinned area, account changes, exports.
- Pinned lists store peak metadata and progress; the whole world is never downloaded.
- A "field mode" toggle on a list pin limits sync to text only (no photos) for a long trip.

### 17.5 Native later

The only features that genuinely need native are background GPS recording, share-sheet import and push notifications. Add them when the web product proves weekly retention; a Capacitor shell is the cheapest path. Do not build three clients for a product still finding its list.

**Acceptance:** a trip logged in airplane mode syncs exactly once on reconnect; unsynced data is never evicted; the queue is visible; the cache can be cleared without losing the record.

---

## 18. Trust, safety, privacy and legal

### 18.1 Self-reported data, honestly labelled

Terrane is a record, not a referee. Every trip is self-reported unless it carries a GPS, witness or steward label. List pages state that the publisher's own record is the official one. We never sell "verified completion" as an official status.

### 18.2 Moderation

- Report any profile, trip, photo, condition report or route.
- Block users; private profiles cannot be followed without approval.
- Rate-limit uploads and reports; new accounts cannot publish publicly for 24 hours.
- Photo moderation: automated NSFW/CSAM checks plus human review for reports; illegal content removed and reported.
- A steward programme for data corrections, with a public log and a code of conduct.
- Response targets: illegal content within 24 hours; other reports within 72 hours; corrections within 14 days.

### 18.3 Privacy

- Private by default: profile, trips, photos, stats.
- Public profile is opt-in, with a preview of exactly what will be visible.
- Per-trip visibility; hide exact dates; hide gain/distance; hide photos.
- No precise home location; home region is a coarse area, never a point.
- EXIF GPS stripped by default; camera metadata can be removed entirely.
- No ad trackers, no data sale, no third-party pixels in the authenticated app.
- GDPR/CCPA: export, correction, deletion, objection; a data processing agreement is available.
- Minors: 16+ (or the local digital age of consent), with a clear statement.

### 18.4 Safety and access

- Conditions, routes and trip reports are **reports, not advice**. Every surface says so, without a legalistic wall.
- No live avalanche, weather or closure guarantee; if we integrate a source, we label it and link to the official service.
- Respect closures, sacred sites, private land and seasonal restrictions; allow lists/peaks to carry an access note.
- Do not publish precise locations of sensitive cultural sites or endangered species.
- "Leave no trace" is product copy, not a badge.

### 18.5 Intellectual property and licensing

The accepted posture is `docs/adr/ADR-002-data-licensing.md`.

- **List membership and ranks are facts.** Descriptions, rules text and artwork are not; write our own summaries and link to the publisher.
- Publisher names are used nominatively ("the AMC's NH 48"), without logos or implied endorsement.
- **Peak data** carries per-source licences: OSM ODbL, GeoNames CC BY 4.0, Wikidata CC0, Natural Earth public domain, Copernicus DEM attribution, national datasets per their terms.
- **User content:** the user retains ownership; Terrane gets a non-exclusive licence to display, resize and back up the content, and to show it publicly only as the user chooses. Deletion ends the display licence.
- **Photos:** the uploader must have the rights; credit is shown; a licence choice (all rights reserved / CC BY / CC BY-SA) is offered, not forced.
- **Dataset downloads:** carry the same licence manifest and attribution as the API.
- **Trademarks:** "Terrane" and the diamond mark are the brand; list names belong to their publishers.

### 18.6 The data page

`/about/data` is a first-class page, linked from every peak's data panel. It lists every source, licence, attribution string and refresh date; coverage stats by country and tier; known gaps and how to report them; the dataset changelog; and the download of the open, ODbL-licensed layer where required.

---

## 19. Monetization

### 19.1 Principles

- The record is free. Logging, lists, badges, export and privacy are never paywalled.
- No ads, no data sale, no paid ranking, no sponsored lists, no affiliate-driven recommendations.
- Paid value is convenience and artifacts: offline packs, more photo storage, print, early access.
- Price in local currency where possible; no dark patterns; cancel in two clicks.

### 19.2 Tiers

| | Free | Supporter — $24/year (or $3/month) |
|---|---|---|
| Trips, lists, badges | Unlimited | Unlimited |
| Export (JSON/CSV/GPX) | Yes | Yes |
| Search and atlas | Full | Full |
| Offline | Last 10 peaks + pinned lists | Unlimited pinned areas and lists |
| Photos | 2 GB | 20 GB |
| Stats | Core | Advanced charts and full history |
| Yearbook | Digital | Digital + print discount |
| Badge case | All earned | All earned + Supporter mark |
| Early features | — | Yes |

### 19.3 Boundaries (exact)

- **Never paid:** creating an account, logging a trip, seeing your own history, list progress, badges, any data export, privacy controls, deleting your account.
- **Paid:** offline capacity, photo storage above 2 GB, advanced charts, print discount, early access.
- **Not sold:** peak data, list memberships, user data, search ranking, badge display.
- **Supporter mark:** one small mark on the passport; never a badge in the catalog and never a ranking signal.

### 19.4 Physical patches

- Only for published list completions; the digital mark is always free.
- Made to order through a print-on-demand partner; the user pays cost + shipping; no inventory risk.
- One design per list, approved by the publisher where required; no publisher logos without permission.
- A retention and identity play, not a revenue line; model at break-even.

### 19.5 Later

- Gift memberships and print yearbooks.
- Club/organisation accounts for guiding clubs and list publishers (bulk member progress, private leaderboards they run themselves).
- A public read-only API for clubs and researchers, rate-limited and licensed.

**Target:** 3–5% Supporter conversion by the end of year two, enough to cover infrastructure, data licences and a part-time steward. Do not optimise revenue before retention.
---

## 20. Metrics

### 20.1 North star

**Weekly logged summits (WLS):** the number of summits logged by returning users in the last seven days. It measures the habit the product exists to create, not vanity traffic.

### 20.2 Funnel and targets

| Stage | Metric | Target (first 6 months after public beta) |
|---|---|---|
| Acquisition | Organic visits to peak/list pages | Growing 10% month over month |
| Search | Search → peak page click-through | ≥ 45% |
| Signup | Peak page → account created | ≥ 8% of signed-out peak viewers |
| Activation | Signup → first trip within 24 hours | ≥ 50% |
| Habit | Signup → second trip within 30 days | ≥ 35% |
| Retention | D30 retention | ≥ 25% |
| List engagement | Activated users with an active list | ≥ 50% |
| Badges | Activated users with ≥1 badge in 7 days | ≥ 60% |
| Quality | Searches with zero results | < 5% |
| Quality | Reported content rate | < 1% |
| Performance | Search API p95 | < 300 ms |
| Data | Corrections resolved within 14 days | ≥ 90% |

### 20.3 Counter-metrics

- Duplicate trips per new user (should fall, not rise).
- Fraud flags and removed trips (under 0.5% of logs).
- Notification opt-out rate (if it rises, we are too loud).
- Support tickets per 1,000 trips (if it rises, the log flow is unclear).
- List completions disputed by publishers (should be zero; we are not the official record).
- Page weight and map load time (growth must not cost the globe).

### 20.4 Event taxonomy

`search_performed`, `search_result_clicked`, `peak_viewed`, `list_viewed`, `signup_started`, `signup_completed`, `trip_started`, `trip_saved`, `trip_edited`, `trip_deleted`, `import_completed`, `list_started`, `list_completed`, `badge_awarded`, `yearbook_viewed`, `export_requested`, `correction_submitted`, `report_submitted`.

Properties: surface, peak/list ID, coverage tier, signed-in state, device class, result count. No precise location, no email, no free-text. Analytics must be useful without being surveillance.

---

## 21. Roadmap and acceptance criteria

Assumes one full-stack engineer, half a designer, and a part-time data steward. Weeks are working weeks, not calendar promises. Every phase ends with a clean tree, a passing build and tests, and a short written retrospective.

### Phase 0 — The shell (shipped)

- Blue-hour globe, diamond logo, legacy fonts, Discover only.
- Peaks, Lists and Progress shells with honest empty states.
- Build and tests green; no fabricated data; clean repository.
- **Exit:** commit `e3d06d6`, verified in the browser at mobile and desktop widths.

### Phase 1 — Atlas foundation (8 weeks)

**Build**

- ADR-001 (stack) and ADR-002 (data licensing) accepted; the schema and migrations in `db/`; local PostGIS via Docker; CI runs migrations, pipeline fixtures, build and tests.
- Python ingest for OSM, GeoNames and Wikidata; source manifest; raw extract hash; dedupe/elevation/prominence/isolation for the launch regions; QA dashboard.
- Seed 469 Wave 1 peaks and the five list versions with entries; global discovery set at the `imported` tier.
- `GET /api/search`, `/api/peaks`, `/api/peaks/:slug`; the real Peaks index; the real Peak detail; live Discover search; the peak preview card on the globe; coverage chip and data panel.
- `/about/data`; prerender the top peaks; sitemap; OG images; JSON-LD.

**Acceptance**

- 469/469 Wave 1 peaks are published with verified name, coordinates and elevation; every list entry matches a published place; zero fabricated records.
- 100% of published peaks have provenance for name, coordinates and elevation; 100% of Wave 1 peaks have verified provenance.
- Duplicate audit < 0.5% in launch regions; 99.5% of coordinates on land.
- Search p95 < 300 ms; peak page p95 < 200 ms; index paginates 50/page; filters live in the URL.
- `/about/data` lists every source, licence, attribution and last refresh; the dataset manifest is downloadable.
- `npm run build` and `npm test` pass; pipeline fixture tests pass; no console errors on `/`, `/peaks`, `/peaks/:slug`.
- The shipped globe, logo, fonts, Discover overlay and content-page styling are visually unchanged.

### Phase 2 — Journal (5 weeks)

**Build**

- Better Auth (magic link + Google/Apple), sessions, settings, units, home region, privacy, account deletion.
- Trip schema/API; quick log; full log; multi-peak; attempts; edits; soft delete; duplicate guard.
- GPX import and suggest-only review; CSV import; manual bulk backfill.
- Trip detail; "Your record" on the peak page; Progress stats v1; export JSON/CSV/GPX.

**Acceptance**

- A user can sign up, sign in and sign out; sessions are httpOnly; return-to works.
- A trip can be logged in under 30 seconds from a peak page; a two-peak trip saves as one trip with two `trip_peak` rows.
- 50 past climbs can be entered in one sitting without a modal per peak; approximate dates render as month/year.
- GPX import suggests candidates, commits only on user confirmation, rejects impossible tracks and duplicate file hashes; `verified='gps'` only for accepted high-confidence matches.
- Stats match a fixture; missing data shows "—"; export round-trips exactly; deletion removes the trip from stats.
- New trips are private by default; a signed-out visitor cannot read them.

### Phase 3 — Lists (4 weeks)

**Build**

- List library, list detail, versions, changelog, rounds, completion snapshot.
- Wave 2 lists published only when complete; Wave 1 lists live.
- Progress API and list page; "next up"; export remaining peaks; custom lists.

**Acceptance**

- Every published list has a publisher, source URL and immutable version; a list without them cannot publish.
- Progress matches a hand-count on all 469 Wave 1 peaks; 100% creates exactly one `list_completion` with a place-ID snapshot.
- A simulated publisher change creates a new version, preserves the old completion and shows "2 new peaks since".
- "Start round 2" requires new qualifying summits; past climbs do not auto-complete a round.
- Custom lists are private by default, shareable, exportable and show only a Personal List completion state (no passport badge).
- No partial list is shown as published; the list page p95 < 250 ms.

### Phase 4 — Passport and badges (4 weeks)

**Build**

- Badge engine, facts, criteria grammar, award ledger, outbox worker, nightly sweep, backfill.
- 43 badges seeded from `data/badges.json`; badge case; award toast; passport; yearbook v1; share cards.

**Acceptance**

- `data/badges.json` validates: 43 unique ids, 9 families, 28 progressive, 15 one-shot, every fact real.
- Every badge has a test fixture (empty, satisfying, boundary); awards are idempotent across retries and imports; backfilling awards retroactively without duplicates.
- No badge is awarded on an empty history; every badge is awarded on the rich fixture; every progressive badge fails one step below target.
- List version changes do not revoke a completion badge; fraud removal is audited.
- The badge case is keyboard-navigable, accessible and quiet; no points, levels or leaderboard anywhere.
- The yearbook renders for a year with 0, 3 and 50 trips; the share card hides precise dates by default.

### Phase 5 — Field Notes (6 weeks)

**Build**

- Routes (curated + community), condition reports, hazards, photos; moderation queue; public profiles opt-in.
- Photo pipeline: EXIF strip, derivatives, credit, licence; report controls.

**Acceptance**

- A route/report can be published, reported and removed; every public surface has a report control.
- Photos strip location by default; public photos require alt text; moderation states are enforced.
- Moderation targets are visible in the admin view; illegal content path documented.
- Public profiles are opt-in and show aggregate stats before individual trips.

### Phase 6 — Offline and mobile (5 weeks)

**Build**

- PWA install, offline shell, IndexedDB queue, sync, pinned lists/areas, cache settings.
- Performance pass, accessibility audit, device testing; decision memo on a Capacitor shell.

**Acceptance**

- A trip logged in airplane mode syncs exactly once on reconnect; unsynced data is never evicted; the queue is visible.
- LCP, INP and CLS budgets pass on a mid-range phone; WCAG 2.2 AA audit has no blocking issues.
- Clearing the map cache does not remove unsynced data or the user's record.

### Phase 7 — Public launch and community (ongoing)

- Partner with two or three publishers for verified list data and finisher links.
- Launch the Blue Hour 50 as an editorial signature.
- Add regions by wave; never lower the quality floor to grow the count.
- Public read-only API for clubs and researchers when the model is stable.
- Native shell only if retention proves the need.

### Not in v1

- Social feed, global leaderboards, likes, comments on every trip.
- Live GPS tracking, turn-by-turn navigation, avalanche forecasting.
- Gear reviews, affiliate links, trip booking.
- AI trip planning or chat.
- Native iOS/Android apps.
- Paid ranks, sponsored lists, data sales.

---

## 22. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OSM ODbL forces the peak database open | Medium | High | ADR-002: separate ODbL layer, attribution, derived-data offer, legal review before launch |
| Data quality embarrasses the brand | Medium | High | Coverage tiers, QA gates, corrections queue, no global claims without sources |
| Prominence computation is expensive or wrong | High | Medium | Compute only for launch regions; source where possible; label the method; never guess |
| Cold start: no users, no content | High | High | Launch with 469 verified peaks and five lists; editorial Blue Hour 50; publisher partnerships; SEO from day one |
| Scope creep into a social network | High | High | The "not in v1" list is a contract; the feed waits for Phase 5 |
| Badge inflation or gamification drift | Medium | Medium | Fixed catalog, no points, no leaderboards, criteria tests, design review |
| List publisher objection | Medium | High | Facts only, no copied text/art, link and credit, remove on request, partner where possible |
| Map performance on mid-range phones | Medium | High | Clustering, low-zoom tiles, lazy globe, budgets, device testing |
| Moderation burden | Medium | High | Private by default, no public feed in v1, rate limits, steward programme, report tools |
| Privacy incident (location/absence) | Low | Severe | Private default, hide dates, EXIF strip, no home point, minimal retention, audit |
| Infrastructure cost | Low | Medium | Postgres + object storage + CDN; R2 egress; cache public pages; monitor |
| Solo-team bus factor | Medium | High | ADRs, reproducible pipeline, runbooks, backups, no undocumented magic |
| Auth migration or vendor lock-in | Low | Medium | Own the user table; Better Auth; export sessions; no proprietary user IDs in content |

---

## 23. Open decisions

The two decisions that shape everything are closed: launch scope and stack (see the header and ADRs). These remain, and none blocks Phase 1.

| # | Decision | Recommendation | Why | Deadline |
|---|---|---|---|---|
| 1 | Wave 2 order | Sierra SPS, 50 State Highpoints, Corbetts, Wainwrights, Alpine 4,000ers, Seven Summits, country highpoints, Blue Hour 50 | US depth first, then British lists, then global | Phase 3 start |
| 2 | GPX thresholds | 300 m candidate, 100 m summit, 30 m vertical | Generous suggestion, conservative auto-match; tune with real tracks | Phase 2, after 100 test files |
| 3 | Public profiles | Private only at launch; opt-in public in Phase 5 | Protects location and absence data | Phase 2 |
| 4 | Physical patches | Phase 4 experiment, made to order | Identity play; no inventory risk | Phase 4 |
| 5 | Native apps | Not before Phase 6; Capacitor if needed | Retention first; avoid three clients | Phase 6 |
| 6 | Price | $24/year, $3/month; test $30 later | Below the cost of two guidebooks; sustainable | Phase 4 |
| 7 | Analytics vendor | Privacy-first, cookieless; no ads | Trust is the product | Phase 1 |
| 8 | Email vendor | Transactional only; magic links and receipts | Auth dependency; no marketing | Phase 2 |
| 9 | Yearbook print partner | Print-on-demand, no inventory | Supporter perk without ops | Phase 4 |
| 10 | Public API | Read-only in Phase 7 | Clubs and researchers; protect write quotas | Phase 7 |

---

## 24. The next ten tasks

1. **Verify the ADRs and schema decisions are in the repo.** `docs/adr/ADR-001-stack.md`, `docs/adr/ADR-002-data-licensing.md`, and the §8 table set are the contract. *Output:* the team can answer "where does this live?" without a meeting.
2. **Scaffold `db/`, `pipeline/`, `apps/api/` and `packages/shared/`.** Local PostGIS in Docker, CI runs migrations and tests, `.env.example` with names only. *Output:* `docker compose up` gives a working database; CI is green.
3. **Write the core migrations.** `place`, `peak`, `region`, `data_source`, `place_provenance`, `list`, `list_version`, `list_entry`, `app_user`, `trip`, `trip_peak`, `photo`, `condition_report`, `badge_definition`, `badge_award`, `event_outbox`, `audit_event`. *Output:* migrations apply cleanly; seed fixtures load.
4. **Build the source extract + manifest.** OSM/GeoNames/Wikidata to Parquet; source/licence rows; raw extract hash. *Output:* a reproducible extract command and counts per source.
5. **Ingest the 469 Wave 1 peaks.** Dedupe, elevation, prominence/isolation for the launch regions, hierarchy, tiers, QA report. *Output:* `snapshot-2026.12` with zero unmatched list entries and <0.5% duplicates.
6. **Seed the five Wave 1 list versions.** Publisher, version, source URL, 469 entries, rules summaries. *Output:* every entry references a published place; counts match; the build fails on a mismatch.
7. **Ship the search and peaks API + the real index.** FTS/trigram, viewport, facets, cursor pagination, URL state. *Output:* `/peaks` works signed out on mobile and desktop with no console errors.
8. **Ship the real peak detail + data page + live Discover.** Provenance panel, coverage chip, lists, nearby, map inset, OG/meta. *Output:* `/peaks/:slug` is useful signed out and printable; Discover returns real results.
9. **Add auth + trips + stats + export.** Magic link/Google/Apple, quick log, multi-peak, backfill, GPX suggest-only, Progress v1, JSON/CSV/GPX. *Output:* log → stats → export round-trips; private by default.
10. **Add the badge engine + all 43 marks.** Seed `data/badges.json`, outbox worker, badge case, yearbook v1, fixture tests. *Output:* `npm test` enumerates 43 unique badges; awards are idempotent; no points or leaderboard.

Tasks 1–8 are Phase 1. Tasks 9–10 open Phases 2–4. When they are done, Terrane has a real atlas, a real journal, a real list library and the first marks of a passport — the public beta.

---

## 25. The overbuff list — product magic worth building

These are the ideas that make Terrane feel like a place rather than a database. None adds points, a feed, or a notification the user did not ask for. Cost is S (days), M (weeks), L (a month or more).

| Idea | What it is | Why it fits | Cost | Phase |
|---|---|---|---|---|
| **Real blue hour** | Sun position drives a subtle day/night terminator and twilight tint on the globe; peaks glow at dawn and dusk. | The brand's name, made literal. No competitor owns it. | M | 2 |
| **Contour portrait** | Every peak gets a generated contour/SVG portrait from its DEM tile as its default image. | Replaces stock photography with place-specific art; scales to 600,000 peaks. | M | 1 |
| **Passport patina** | Stamps age visually with the years; print-ready at 300 dpi. | Makes the record feel physical without a game layer. | S | 4 |
| **On this day** | Once a year, a quiet card: "You stood on X, twelve years ago." | Memory, not engagement bait. One card, no feed. | S | 2 |
| **The ones that got away** | Attempts shown on their own map and a gentle "return" list. | Honours failure; differentiates from checkmark apps. | S | 2 |
| **Next unclimbed** | From the current view or home region, the nearest remaining peak on each active list. | Turns the list into a planner, not just a scoreboard. | M | 3 |
| **Trip companions** | One trip log, several people credited; companions can confirm (witness verification). | How people actually climb; grows the graph without a feed. | M | 5 |
| **Three-elevation forecast** | Trailhead, mid-mountain and summit forecasts, wind and freezing level, with official links. | Yak's best utility idea; makes the peak page useful before the climb. | M | 5 |
| **Sunrise and sunset** | Today's first and last light, plus golden hour, computed for the peak's coordinates. | Cheap magic; connects the brand to the plan. | S | 1 |
| **Publisher finisher link** | Where a publisher offers one, a verified finisher reference; never our own claim. | Authority without pretending to be the official record. | M | 7 |
| **Yearbook as an atlas** | Print-on-demand small book: maps, photos, marks, the year's lines. | The artifact worth keeping; a natural Supporter perk. | M | 4/6 |
| **Steward's ledger** | A public corrections log with contributor credit and the resulting data diff. | Makes provenance a community craft, not a support queue. | S | 5 |
| **Blue Hour 50 essays** | Editorial writing and photography for the signature list. | Proves curation and gives the brand a voice. | M | 7 |

**The rule for all of them:** if it cannot be explained in one sentence and removed without breaking the record, it is decoration. Decoration is allowed only when it makes the mountain more legible.

---

## Sources and further reading

- Yak — "The best peak bagging apps, and what each one actually tracks": https://yakapp.co/blog/best-peak-bagging-apps
- Yak — quests: https://yakapp.co/quests
- Peakery — home, challenges and changelog: https://peakery.com/ · https://peakery.com/challenges/ · https://peakery.com/changelog
- Neon — PostGIS extension: https://neon.com/docs/extensions/postgis
- Wikipedia — list of mountain lists (Munros 282, Corbetts 222, Wainwrights 214, Marilyns 2,011): https://en.wikipedia.org/wiki/List_of_mountain_lists
- 14ers.com — Colorado 14ers (53 ranked / 58 named): https://www.14ers.com/14ers
- Sierra Club — Sierra Peaks Section list, 25th edition (247 peaks): https://www.sierraclub.org/sites/default/files/sce/sierra-peaks-section/files/SPS%20list%2025th%20ed_0.pdf
- OpenStreetMap — copyright and licence: https://www.openstreetmap.org/copyright
- GeoNames: https://www.geonames.org/
- Wikidata: https://www.wikidata.org/
- Natural Earth: https://www.naturalearthdata.com/
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
- Copernicus DEM: https://dataspace.copernicus.eu/
- OpenFreeMap: https://openfreemap.org/
- MapLibre: https://maplibre.org/
- Better Auth: https://www.better-auth.com/docs
- Drizzle ORM: https://orm.drizzle.team/docs/overview

---

## Glossary

| Term | Meaning |
|---|---|
| **Ascent** | A trip that reaches one or more summits; the unit of the journal. |
| **Attempt** | A trip that did not reach the summit; counted separately. |
| **Bagging** | The practice of climbing peaks to complete a list. |
| **Completion** | Every required peak on a specific list version has a summit trip. |
| **Coverage tier** | How well a peak's data is verified: verified, calculated, imported, community. |
| **Finisher** | A person who has completed a list; the publisher may issue a number. |
| **Isolation** | Distance from a summit to the nearest higher ground. |
| **List version** | An immutable publication of a list's membership at a point in time. |
| **Parent peak** | The higher summit to which a peak connects via its key col. |
| **Prominence** | The height of a summit above its key col; the measure of a mountain's independent rise. |
| **Round** | A repeat completion of the same list, with its own start date. |
| **Summit** | The highest point of a peak; a trip outcome. |
| **Track** | A GPX recording of a trip. |
| **Verification** | The label on a trip: logged, GPS, witnessed or steward. |
