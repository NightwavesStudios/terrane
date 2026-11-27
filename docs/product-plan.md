# Terrane — Product Plan v3.0

**Status:** canonical build plan · v3.0 · 27 November 2026
**Supersedes:** v2.0 (`docs/product-plan.md`) and the v1.0 shareable artifact
**Primary user:** the list-driven climber with an existing history
**First build:** the NH 48 vertical slice — 48 peaks, one list, one complete loop
**Stack:** React 19 + Vite SPA · Hono API · Postgres 17 + PostGIS on Neon · field-level provenance
**North star:** monthly active record keepers, not weekly logged summits
**Destination:** a global atlas of the world's mountains and peaks, plus the sourced experiences around them

> The atlas is the front door. The list is the reason to return. The record is the product.

This file is the one full plan. The shareable artifact is an executive brief that points here; it is not a second source of truth. If the two disagree, this file wins.

The fixed decisions from the previous round still hold:

1. **Stack:** Postgres + PostGIS on Neon, field-level provenance. ADR-001 remains accepted. The Python ingest pipeline and snapshot machinery are deferred, not replaced.
2. **Target inventory:** three regions — US Northeast, Colorado, Scotland — and five lists: NH 48 (48), Adirondack 46 (46), Catskill 3500 (33 current; historically 35), Colorado 14ers (58 named), Munros (282). 467 peaks is the supported-list catalogue target, not the first engineering milestone and not a global coverage target. Public beta shipped the first three complete lists; ADK 46 and the current Catskill 33 were added in Phase D.
3. **The first build is the NH 48 vertical slice.** One list, 48 peaks, a real list page, a quick log, progress and export. No Colorado, no Munros, no badge catalogue, no GPX, no community in the slice.
4. **Ten badges launch.** The other 33 stay in `data/badges.json` as a documented backlog. They are not deleted and not promised.

The plan is deliberately narrower than v2.0. The product is a trusted record for people pursuing named peak lists, with a global atlas as the way in. The destination is broader: every named mountain and peak we can source with integrity, plus other sourced ways to encounter the landscape. The NH 48 slice is the proof that the record deserves that atlas; it is not the ceiling.

---

## 0. The one-page version

| Question | Answer |
|---|---|
| **What is Terrane?** | The trusted record for people pursuing named peak lists — and the atlas that helps them find the next one. |
| **What is the destination?** | A global atlas of mountains and peaks, plus sourced experiences around them, with the trusted record as the through-line. The NH 48 slice is the first proof, not the ceiling. |
| **Who is it for first?** | A climber with 30–200 summits, one to three active lists, and a spreadsheet/Yak/Peakery history they do not fully trust. |
| **What is the wedge?** | A list count they trust, a lifetime history they can finally consolidate, and a record beautiful enough to keep. |
| **What is the first loop?** | Discover a peak → see its list → start the list → log or backfill a climb → see progress → return for the next one. |
| **What ships first?** | NH 48: 48 sourced peaks, one list version, search, peak pages, auth, quick log, manual backfill, list progress, JSON/CSV export. |
| **What makes it defensible?** | The user's accumulated history and list progress, not the globe or the badge art. |
| **How does it make money?** | Not yet. Free record and export at launch; test offline, storage, print and convenience only after retention is proven. |
| **What is the north star?** | Monthly active record keepers, with D90 retention of users who have at least three ascents as the guardrail. |
| **What do we refuse?** | Global completeness claims, fabricated fields, operational safety data, public-by-default location data, points, leaderboards and a social feed. |

**The strategy in one sentence:** Yak proves people want lists and patches; Peakery proves people want the whole world of peaks. Neither owns the trusted, portable, lifetime record. Terrane earns that position one complete list at a time, then extends the same honest atlas to the rest of the world and to experiences beyond the summit.

---

## 1. What changed from v2.0

v2.0 was a platform thesis. It combined a global geographic database, a peak-bagging tracker, a personal archive, a list publisher and a premium outdoor atlas, then assumed the combined value would exceed the combined complexity. That might be true eventually. It is not established.

v3.0 makes five changes:

1. **One primary user.** The list-driven climber with an existing history, not the generic explorer. Discovery is acquisition; the record is retention.
2. **One first loop.** NH 48 end to end, not 467 peaks and seven surfaces in parallel. The slice proves whether the list-to-record loop is worth expanding.
3. **Field-level truth.** A peak is an identity, not a single quality grade. Elevation, prominence and range are optional attributes with their own sources. Missing means missing, not “imported”.
4. **A smaller passport.** Ten meaningful marks at launch, not 43. The full catalog remains as backlog.
5. **A gated roadmap.** No phase starts until the previous phase produces evidence that users want the next one. The target inventory stays at five lists, but it is earned list by list.

The old platform surfaces are not rejected forever. They are deferred until the record works: routes, conditions, forecasts, reports, photos, GPX, public profiles, companions, offline map packs and paid artifacts.

### 1.1 What stays

- The blue-hour globe, diamond mark, typography and quiet visual identity.
- Global discovery as the front door, with honest incompleteness.
- Named peak lists as the core goal structure.
- One summit counting toward every **supported** list it belongs to.
- Historical backfilling as a first-class flow.
- A private-by-default journal and a free export.
- Custom lists.
- The passport as an extension of the record, not a game layer.

### 1.2 What is explicitly not in v1

- A complete global mountain inventory in the first release; the global atlas and experience layer are Phase E.
- Route, condition, forecast, avalanche or closure data.
- Public profiles, companions, witness verification or a community feed.
- Live GPS tracking or automatic ascent recording.
- Photo storage and GPX import in the first slice.
- Physical patches, print yearbooks or a paid tier.
- Global prominence or isolation computation.
- The full 43-badge catalogue; ten launch marks are enough.

---

## 2. The primary user

### 2.1 Who we build for

**The list-driven climber with a history.** Typically 30–200 summits, one to three active lists, and a record spread across a spreadsheet, an old app, a notes file and memory. They are not a beginner, but they are not a professional mountaineer either. They care about:

- whether their list count is correct;
- whether a list changed and what that means for their completion;
- whether their history will survive the next app that dies;
- whether the record looks like something worth keeping.

They currently use a spreadsheet, Yak, Peakery, ListsOfJohn, a regional site or paper. They do not need another feed. They need one place that remembers, accurately and beautifully.

**The switching trigger:** “I can finally see my whole history in one place, and I trust the list count.” Not “this globe is cool.” Not “it has badges.”

### 2.2 Secondary users

| User | What attracts them | What brings them back | Role in the plan |
|---|---|---|---|
| **Curious explorer** | The globe, mountains, discovery | Finding a place worth pursuing | Acquisition. May never sign up; that is acceptable. |
| **Occasional hiker** | A beautiful record of meaningful trips | Remembering a few good days | Long-term retention. Do not demand weekly activity. |
| **Experience-first visitor** | Ranges, parks, trails, viewpoints and scenic places | A reason to explore beyond a summit | Later acquisition. Do not dilute Phase A; experiences arrive in Phase E. |
| **Experienced mountaineer / data skeptic** | Accuracy, provenance, depth | Contribution and correction | Quality advisor, not the first customer. Do not build global completeness for them. |

### 2.3 Jobs to be done

| When… | I want to… | So I can… |
|---|---|---|
| I finish a climb | log it in under 20 seconds | keep the record without breaking the day |
| I have been climbing for years | add my history in an afternoon | start from where I actually am |
| I choose a list | see its publisher, edition and rules | trust that my count means something |
| I plan a trip | see the remaining peaks on my list | use the list to choose the next one |
| I return after months | see my progress and my history | remember why I started |
| I leave | export everything | trust the product enough to invest in it |

### 2.4 Anti-personas

- **The leaderboard grinder:** wants to be #1 by volume and will log implausible ascents. We will not build the board that rewards them.
- **The route-only user:** wants turn-by-turn navigation and live tracking. We point them to a trail app.
- **The armchair collector:** wants to tick peaks without going. Self-reported history is accepted, but badges require an ascent record and fraud is removed.
- **The data-completeness buyer:** wants every peak on Earth with survey-grade attributes. Terrane is honest about what it knows; it is not a global survey.

### 2.5 What would make them switch

The product must beat the spreadsheet on three things:

1. **Trust:** a list count with a source and a version, not a formula they maintain.
2. **Consolidation:** decades of climbs in one place, including approximate dates.
3. **Keeping:** a record they would show someone in thirty years, with an export they control.

If it does not beat the spreadsheet on those, the globe and badges will not save it.

---

## 3. Product definition and boundaries

### 3.1 The three jobs

| Job | Surface | What it is for | What it is not |
|---|---|---|---|
| **Explore** | Globe, search, peak pages | Discover a mountain and understand what it is | A route planner or condition service |
| **Lists** | List library, list page, progress | Turn the world into a finite, sourced pursuit | A publisher’s official record |
| **Record** | Quick log, backfill, progress, passport | Preserve a life’s climbing history | A social network or performance tracker |

The passport is an **extension of Record**, not a fourth product. It makes the record legible and worth keeping. It does not create a second reason to climb.

### 3.2 The loop

```
Explore a peak
   ↓
See which supported lists it belongs to
   ↓
Start or continue a list
   ↓
Log the climb (or backfill the ones you already did)
   ↓
See progress and the record grow
   ↓
Return for the next remaining peak
```

If any link is weak, the loop fails. The first build tests all five links with 48 peaks.

### 3.3 What Terrane is — and is not

| Terrane is | Terrane is not |
|---|---|
| A global atlas of mountains and experiences, with honest coverage | A claim of complete global mountain inventory |
| A trusted tracker for supported, sourced lists | The official record of any publisher |
| A private lifetime climbing archive | A live GPS tracker or social feed |
| A quiet passport of meaningful marks | A points economy or leaderboard |
| A place to see what a peak is and which lists it belongs to | A guidebook, route database or safety service |
| A web app that works on a phone | A native app on day one |

### 3.4 Product principles

1. **The record is the product.** The atlas is the front door; the list is the return mechanism.
2. **One summit counts across supported lists.** Only where the peak-to-list mapping is explicit and sourced.
3. **Lists are publications.** Publisher, edition, source and rules are visible. Terrane is never the official record.
4. **Truth is per field.** A peak can have a verified name and an unknown elevation. Do not grade the whole mountain by its weakest attribute.
5. **Past climbs are equal.** A 1994 climb entered by hand is as valid as a 2026 logged climb. Evidence labels describe support, not worth.
6. **Private by default.** The journal is personal. Sharing is a later, deliberate act.
7. **Quiet is premium.** Fewer prompts, fewer badges, no confetti, no streak pressure.
8. **Nothing is fabricated.** No invented peaks, elevations, ascents or “trending” content. Empty states tell the truth.
9. **Export is free.** The user’s record, photos and list progress are always portable.
10. **No platform creep.** If a feature belongs to a route app, a social network or a survey, it waits outside the boundary.

### 3.5 The one big flow

Phase A is one path, not a collection of pages. Every screen has a next action, and the path survives sign-in, a refresh, a map failure and a phone screen.

| Step | What a signed-out visitor sees | What a signed-in user sees | The next action |
|---|---|---|---|
| **Land** | The globe and Discover | The globe and Discover | Search or open a peak |
| **Peak** | Identity, known/unknown fields, sources, NH 48 membership | The same, plus their record | Start the list or log the climb |
| **Auth** | Sign in with `returnTo` | — | Return to the exact peak/list/log intent |
| **List** | Publisher, edition, rules, public progress shape | Ring, remaining peaks, per-peak status | Add history or log a climb |
| **Record** | — | Quick log, backfill, edit or delete | Save and return to progress |
| **Return** | — | Updated ring, recent climbs, remaining peaks | Next peak, export, or leave |

**Flow rules:**

- One primary action per screen; no dead-end success page.
- Starting a list is an explicit, idempotent action that creates `user_list`. Progress does not exist without it.
- Logging from a peak or list carries `peak` and `list` query context; saving returns to the list with the ring already updated.
- Sign-in never loses the intent. If the session expires, the user returns to the same step.
- The four primary nav items remain Explore, Peaks, Lists and Progress. **Log a climb** is a persistent primary action, not a fifth tab; account, settings and data live in the account menu or footer.
- No forced onboarding wizard. Units default from locale and can change later; home region is optional.
- Empty, loading and error states each show a truthful next action. If the globe fails, the list view still completes the flow.
- The flow must work at 390 px, with keyboard navigation and visible focus, without horizontal scrolling.

The Phase A acceptance test is the whole path: a first-time visitor can search a peak, open its list, sign in, start the list, backfill two climbs, log one, see progress and export without help and without using browser Back to recover.

---

## 4. Data philosophy and field-level provenance

### 4.1 Three layers

Terrane separates three things the old plan conflated:

| Layer | What it contains | Required? | Display |
|---|---|---|---|
| **1. Geographic identity** | Name, point, aliases, identifiers, feature kind | Yes, for a peak page | Always visible; source linked |
| **2. Optional attributes** | Elevation, prominence, isolation, range, country, highpoint flag | No | Shown only when known; “unknown” otherwise |
| **3. Curated lists** | Publisher, edition, rules, membership | Yes, for a list page | Publisher, source, edition, “not official” |

A peak can exist with a name and a point and nothing else. A list can include it if the identity is confirmed and the list source is explicit, even if elevation and prominence are unknown. A badge that needs elevation or prominence simply does not fire until that attribute exists.

### 4.2 Field-level provenance

The authoritative record is `place_provenance`. Every displayed attribute has one accepted row:

| Column | Meaning |
|---|---|
| `place_id` | The peak |
| `field` | `name`, `name_local`, `geom`, `elevation_m`, `prominence_m`, `isolation_km`, `is_highpoint`, `region_memberships`, `country_code` |
| `value` | Accepted value, normalized |
| `source_id` | Source (OSM, GeoNames, Wikidata, USGS, publisher, steward) |
| `source_ref` | OSM ID, QID, tile/row, publisher page |
| `method` | `source`, `dem`, `derived`, `human` |
| `confidence` | `verified`, `sourced`, `estimated`, `unknown` |
| `is_accepted` | Exactly one accepted row per (`place_id`, `field`) |
| `checked_at` / `checked_by` | When and by whom |

**There is no public peak-level coverage tier.** The old `coverage_tier` becomes an internal QA filter at most, never the label a user sees. A page says:

> Name and coordinates: OpenStreetMap (ODbL), checked 2026-11-20.
> Elevation: USGS 3DEP, 1,917 m, sourced.
> Prominence: unknown.
> Lists: NH 48, 2026 edition, confirmed.

That is more useful than “Imported”.

### 4.3 What we will not compute globally

- **No global prominence.** Use a sourced value where a publisher or national dataset provides one. Compute only for a supported list/region if the list rule requires it, and store the method and DEM version.
- **No global isolation.** Same rule. Missing is better than invented.
- **No universal elevation filter.** A filter is offered only for attributes with adequate coverage, and it says so.
- **No “complete” claim.** Coverage is a property of the data, not a marketing promise.

### 4.4 Data sources and licensing

| Source | Licence | Use at launch | Caveat |
|---|---|---|---|
| OpenStreetMap | ODbL 1.0 | Identity, names, some coordinates | Share-alike; legal review before public launch |
| GeoNames | CC BY 4.0 | Names, alternate names, coarse coordinates | Uneven quality |
| Wikidata | CC0 | Cross-IDs, cited attributes | Sparse |
| USGS 3DEP | Public domain | NH elevation and terrain checks | US only |
| USGS GNIS | Public domain | US names, coordinates, feature IDs | US only; not a global source |
| Natural Earth | Public domain | Country/region context | Coarse |
| AMC / publisher | List facts; terms vary | NH 48 membership, edition, rules | Cite; do not copy descriptions or artwork |
| Copernicus DEM | Free, attribution | Deferred; no global prominence | 30 m; not a summit survey |

ADR-002 remains the licensing posture: an ODbL-compatible derived layer where required, exact attribution, public export of the open layer, no user content mixed into it, and a lawyer’s review before public launch. If the review makes the OSM-derived layer too restrictive, fall back to permissive sources for the launch slice. Do not build a production database around an unresolved licence.

**Phase A source rule.** The slice seed uses permissive sources and publisher list facts, not an unresolved ODbL derived layer. OSM may be used for QA comparison but does not enter the Phase A production database until the review clears it; if cleared, it enters Phase E as a separate derived layer. The 10-user test is a private alpha; public launch waits for the review. This removes the licence decision from the critical path without pretending the issue is solved.

### 4.5 No fabrication

- A missing elevation is `null`, never 0, never estimated to fill a card.
- A list entry that cannot be matched to a real place blocks the list version; do not invent a peak to complete it.
- A placeholder image is a generated contour, never a stock photo pretending to be the peak.
- Test fixtures live only in test/seed paths and never appear in production.
- A seeded list fails validation if its entries do not match its declared count or reference an unpublished place.

### 4.6 Corrections

A correction is a suggestion with a source, not a live edit. A steward reviews it, updates the accepted provenance row, and writes a changelog entry. The old ascent facts and list-version snapshots are never rewritten. Rejected corrections notify the user with a reason. At launch, corrections are limited to the NH 48 data and handled manually; no correction queue UI until Phase B.

---

## 5. Data model

This is the minimum schema for the slice and the public-beta direction. Exact DDL will be migrations in Phase A; this section fixes names and rules.

### 5.1 Places and attributes

| Table | Key columns | Rules |
|---|---|---|
| `place` | `id` uuid PK, `slug` citext unique, `name` text, `kind` text default `peak`, `geom` geography(Point,4326), `country_code` char(2) null, `status` text (`published`,`hidden`,`merged`), `merged_into` uuid null, timestamps | Identity only. No elevation or prominence required. Slug is permanent; rename creates an alias and a 301. Phase A uses `peak`; Phase E adds `range`, `park`, `trail`, `viewpoint` and `scenic_area` without a second inventory. |
| `peak` | `place_id` uuid PK/FK, `elevation_m` int null, `prominence_m` int null, `isolation_km` numeric null, `is_highpoint` bool null, `is_continental_highpoint` bool null, `character` text[] null | All attributes optional. `prominence_m` only from a source or a documented regional computation; never fabricated. Highpoint flags stay null until sourced. |
| `place_name` | `place_id`, `name`, `lang`, `kind` (`official`,`alternate`,`local`,`former`), `source_id` | Search across all names. Unique (`place_id`,`name`,`lang`). |
| `data_source` | `id`, `key`, `name`, `license`, `license_url`, `attribution`, `terms_url`, `retrieved_at` | Every source has a licence row. `/about/data` is generated from this. |
| `place_provenance` | `id`, `place_id`, `field`, `value`, `source_id`, `source_ref`, `method`, `confidence`, `is_accepted`, `checked_at`, `checked_by` | Exactly one accepted row per (`place_id`,`field`). Unique (`place_id`,`field`,`source_id`). |
| `region` | `id`, `slug`, `kind` (`continent`,`country`,`admin1`,`admin2`,`range`,`park`,`island`), `name`, `parent_id`, `country_code`, `geom`, `source_id` | One hierarchy for geography, ranges and parks. |
| `place_region` | `place_id`, `region_id`, `role`, `source_id` | Multiple memberships. PK (`place_id`,`region_id`,`role`). A peak can be in a range, a park and an admin area at once. |

**Indexes:** GiST on `place.geom` and `region.geom`; B-tree on `place.country_code`, `place_region.region_id`, `place_provenance(place_id,field)`, and a GIN/trigram index on `place_name` when search needs it. At 48 peaks, simple `ILIKE` is enough; do not build the global search cluster for the slice.

### 5.2 Lists and completions

| Table | Key columns | Rules |
|---|---|---|
| `list` | `id`, `slug`, `title`, `publisher`, `publisher_url`, `category`, `scope`, `description`, `rules_md`, `status` (`draft`,`published`,`retired`) | A published list has a publisher, source and version. Terrane summaries are our words, not the publisher’s. |
| `list_version` | `id`, `list_id`, `version_label`, `effective_from`, `effective_to`, `peak_count`, `source_url`, `notes`, `published_at` | Immutable except a one-time `effective_to` closure when a successor is published. Unique (`list_id`,`version_label`); partial unique current version. |
| `list_entry` | `id`, `list_version_id`, `place_id`, `rank`, `role` (`required`,`alternate`), `note` | Unique (`list_version_id`,`place_id`). v1 publishes required entries only. Membership requires confirmed identity + list source, **not** elevation or prominence. |
| `user_list` | `id`, `user_id`, `list_id`, `started_at`, `status` (`active`,`archived`), timestamps | Unique (`user_id`,`list_id`). Starting is idempotent; progress exists only for a started list. Archiving hides it from the active shelf without deleting history. |
| `list_completion` | `id`, `user_id`, `list_id`, `list_version_id`, `round`, `started_at`, `completed_at`, `snapshot` jsonb, `evidence_trip_id` | Unique (`user_id`,`list_id`,`round`). Snapshot stores `{place_ids, peak_count, version_label}`. A completion remains valid forever against the version it satisfied. |
| `custom_list` | `id`, `user_id`, `title`, `visibility` (`private`,`link`) | Outside the published catalogue; never earns a publisher completion or a passport badge. |
| `custom_list_entry` | `custom_list_id`, `place_id`, `position`, `note` | PK (`custom_list_id`,`place_id`); unique position. |

**Versioning rules.** A list version is the unit of truth. A publisher change creates a new version with a changelog; old completions stay attached to the old version. Current progress uses the current version. The UI can say “Completed 2024 · 2 new peaks since.” No version change silently invalidates a completion.

**Completion rules.** A required peak is complete when the user has a non-deleted `trip_peak` with `outcome='summit'` and the trip date is on or before the completion date. Past climbs count; there is no minimum gain, track or witness. Round 1 counts all history. Rounds are a later UI concern; the schema keeps `round` so the data does not need rewriting. A list must be started before it can show progress; starting creates `user_list`. Phase A computes progress only; `list_completion` is created in Phase C when the completion mark ships, so a corrected Phase A trip cannot leave a premature snapshot.

**Official language.** The list page always says: “Publisher: AMC. Terrane is not the official record.” Never imply that a Terrane completion grants membership, a certificate or a publisher finisher number.

### 5.3 Journal

| Table | Key columns | Rules |
|---|---|---|
| `app_user` | `id` text PK/FK auth user, `handle`, `display_name`, `home_region_id`, `units`, `units_chosen_at`, `locale`, `privacy` default `private`, `role`, `created_at`, `deleted_at` | Private by default. No public profile in v1. The id type matches Better Auth’s user id; email and credentials belong to Better Auth, not this table. |
| `trip` | `id`, `user_id`, `title`, `start_date`, `end_date`, `date_precision` (`day`,`month`,`year`), `notes`, `visibility` default `private`, `source` (`manual`,`backfill`,`csv`,`gpx`), `verification` (`logged`,`gps`), timestamps, `deleted_at` | One trip can contain many peaks. `start_date` is the anchor: first day of the precision period; never displayed below the precision. No photos/GPX in the first slice. |
| `trip_peak` | `trip_id`, `place_id`, `outcome` (`summit`,`attempt`,`traverse`), `order`, `summit_time`, `verified` (`logged`,`gps`) | PK (`trip_id`,`place_id`); unique (`trip_id`,`order`). At least one peak per trip. |
| `correction` | `id`, `place_id`, `user_id`, `field`, `old_value`, `new_value`, `source_url`, `status`, `reviewed_by`, `reviewed_at` | Manual review in Phase A. No public queue UI. |

**Trip rules.** A trip is a day or outing, not a checkmark. A pure attempt is valid. A repeat grows total ascents but not unique peaks. Deleting a trip removes it from stats immediately; badges are not revoked except for fraud, and self-reported past climbs are never downgraded. A saved trip can be edited or deleted in Phase A; a mistake must not require starting over.

**Auth tables.** Better Auth owns `user`, `session`, `account` and `verification`. `app_user` is the Terrane profile keyed to the auth user id and is created on first sign-in. Do not build password tables or duplicate credentials.

**No GPX in the slice.** GPX import is a later convenience, never the definition of a valid ascent. When it arrives, it suggests matches and the user confirms; thresholds are calibrated on real tracks, not treated as universal truth.

### 5.4 Badges

| Table | Key columns | Rules |
|---|---|---|
| `badge_definition` | `id`, `slug`, `family`, `name`, `description`, `criteria` jsonb, `criteria_version`, `launch` bool, `progressive`, `progress_fact`, `progress_target`, `progress_unit`, `hidden`, `art_key` | Seeded from `data/badges.json`. The 10 launch marks are `launch=true`; the rest are backlog. |
| `badge_award` | `id`, `user_id`, `badge_id`, `criteria_version`, `earned_at`, `source_trip_id` | Unique (`user_id`,`badge_id`). Awards are permanent; criteria changes do not re-award. |

At 10 launch badges and a single-user write path, evaluate synchronously after a trip create/update/backfill. No outbox, no worker, no materialized facts table. Phase C also creates the immutable `list_completion` snapshot used by the completion mark and `finisher`; Phase A only computes progress. Revisit only when the catalogue or write volume makes it painful.

### 5.5 What is deliberately absent

No `coverage_tier` on `place`. No `route`, `condition_report`, `photo`, `report`, `import_job`, `event_outbox`, `badge` event worker, public profile, companion or finisher integration. Add them only when a phase earns them.

---

## 6. The NH 48 vertical slice

### 6.1 Why the NH 48

- 48 peaks: small enough to source and verify completely.
- One publisher and a well-defined list: the AMC White Mountain 4,000-Footers.
- A strong, identifiable community that already tracks the list.
- A compact geography that tests the globe, search, peak pages, list progress and backfill without a global data programme.
- It is close to the existing blue-hour identity: a Northeastern American list with a real hut and trail culture.

The slice is not a demo. It is the first real product, with real data and real users.

### 6.2 Scope

**Data**

- 48 published peaks with confirmed identity, coordinates and at least a name source.
- Elevation where a publisher/USGS source exists; unknown fields stay null.
- NH 48 list record: publisher AMC, 2026 edition, 48 required entries, source URL, rules summary, “not official” note.
- One `place_region` membership for the White Mountains range, with source; country/US state memberships; a small region hierarchy so the home-region setting is real, not a free-text field.
- `is_highpoint=true` for Mount Washington, with a source (NH state highpoint).
- `/about/data` lists sources, licences, attribution and checked dates.

**Product**

- Existing globe with 48 real peaks, search and a preview card; list view fallback.
- `/peaks` with real rows, search and simple filters; no prominence filter unless the data supports it.
- `/peaks/:slug` with identity, known attributes, list membership, your record and data sources. Nearby peaks are a Phase B candidate, not a Phase A blocker or a Phase A–B commitment.
- `/lists` and `/lists/:slug` with publisher, edition, rules, explicit **Start the list**, progress, remaining peaks and export.
- `/signin` with email magic link and one OAuth provider (Google or Apple); no passwords. `returnTo` preserves the exact peak, list or log intent. If email delivery is blocked in readiness, OAuth-only is the documented fallback.
- `/log` quick log: peak(s), date, outcome, save. Edit/delete immediately after save.
- Manual backfill: year/month/day precision, multi-peak, 20 climbs without a modal per climb.
- `/progress` with the NH 48 ring, remaining count, recent climbs and basic stats.
- JSON and CSV export of all trips and list progress. GPX of remaining list peaks is Phase B; no track export yet.
- `/settings` with units, optional home region, privacy and delete account.
- One flow end to end: globe/search → peak → list → sign-in `returnTo` → start list → backfill/log → progress → export. No fifth nav tab; **Log a climb** is a persistent action.

**Out of scope for the slice**

- Colorado, the Munros, ADK 46 or the current Catskill 33.
- Badges and the immutable `list_completion` snapshot (the passport and completion mark start in Phase C).
- Photos, GPX import, routes, conditions, forecasts, reports.
- Public profiles, companions, witness or steward verification.
- Offline mode, PWA install, native apps.
- Paid tier, patches, yearbook.
- Global ingestion, global coverage claims and the experience layer (Phase E).
- Nearby peaks, bulk edit and CSV import (Phase B).

### 6.3 Acceptance criteria

The slice is done when:

1. 48/48 NH 48 entries resolve to published places; the seed fails if any entry is missing or unmatched.
2. Every displayed name, coordinate and elevation has an accepted provenance row; unknown fields show “Unknown”, not a guess.
3. A signed-out visitor can search “Mount Washington”, open its page, see the NH 48 membership and understand what Terrane is.
4. A new user can sign in, start the NH 48, log a climb in under 20 seconds and see the ring move.
5. A user can backfill 20 past climbs in under 20 minutes using approximate dates.
6. The list page shows the publisher, edition, source, rules and “not the official record”.
7. Export produces JSON and CSV that round-trip the user’s trips, dates and list progress.
8. A signed-out user cannot read another user’s trips.
9. The globe remains interactive on a mid-range phone with all 48 points; the list view works when the globe or terrain fails.
10. The existing globe, logo, fonts, Discover overlay and content-page styling are visually unchanged.
11. The one-flow test passes: a signed-out visitor can search a peak, open its list, sign in with `returnTo`, start the list, backfill two climbs, log one, correct one, see the ring update and export without browser Back or a dead end.
12. Starting the list is idempotent; a second start does not duplicate `user_list`; edit/delete updates progress immediately.
13. The flow works at 390 px, with keyboard navigation, visible focus and no horizontal scroll; the list fallback completes the loop when the globe fails.
14. The gate events fire server-side for search, peak open, list start, log, backfill, edit, export and sign-in, without PII or a third-party pixel.

### 6.4 The slice test

**Before the build:** test a clickable prototype of the one flow with 5 target users. At least 4/5 must complete it without help, and 3/5 must say they would prefer it to their current spreadsheet. If not, fix the flow before writing UI code.

**After the build:** recruit 10 target users (active list pursuers with history). Ask them to:

1. Find five NH 48 peaks they have not climbed.
2. Open the list and start it.
3. Backfill 10–20 past climbs.
4. Log one new climb, then correct a date or delete the trip.
5. Find their remaining peaks and export their record.

Positive signal: at least 6 complete the loop without help; at least 4 return within two weeks and take another record action. If not, fix the loop before adding Colorado or badges. The gate is measured with the events in §11.4, not by memory or a spreadsheet reconstruction.

The 10-user test is a private alpha, not a public launch. Public launch waits for the legal review, the production data page, and a clean restore/backup check.

---

## 7. Lists

### 7.1 Catalogue discipline

The target catalogue is five lists, but a list is published only when it is complete. Public beta shipped the first three; ADK 46 and the current Catskill 33 shipped in Phase D.

| List | Publisher | Peaks | Phase |
|---|---|---|---|
| NH 48 | Appalachian Mountain Club | 48 | A — the slice |
| Colorado 14ers | Colorado Mountain Club | 58 named | B |
| Munros | Scottish Mounting Club | 282 | C |
| Adirondack 46ers | Adirondack 46ers | 46 | D, only after the first three are stable |
| Catskill 3500 | Catskill 3500 Club | 33 current (35 before 2021) | D, only after the first three are stable |

No partial list is published. A list with an unsupported rule (choice groups, winter-only membership, route requirements) is labelled **not supported** and is not shown as a completable list. Do not fake a flat list for a rule the product cannot represent.

The five lists are the Phase A–D catalogue, not the product boundary. Phase E adds experiences and broader coverage; it does not turn every experience into a completion list.

### 7.2 Rules and versions

- A list version is a publication: publisher, edition, effective date, source URL, count, required membership, rules summary.
- Required entries only in v1. Alternates and choice groups wait for a real `list_choice_group` model.
- Winter/ski variants are separate lists, not a toggle.
- A publisher change creates a new version with a changelog. Old completions stay against the old version.
- A completion is a snapshot, not a live derivation. It survives later versions.
- Rounds are deferred; the schema keeps `round` but the UI does not advertise rounds until users ask.
- Finisher numbers are not invented. If a publisher issues one, it is a labelled external fact; otherwise absent.

### 7.3 Custom lists

Private by default, shareable by unguessable link, add/remove/reorder, note per peak, export CSV/GPX coordinates, print. A custom list has a **Personal list complete** presentation state; it never creates a `list_completion`, never earns a passport badge and never appears as a published list.

### 7.4 List page contract

`GET /api/lists/:slug` returns metadata, current version and entries (peak card fields). `POST /api/lists/:slug/start` creates `user_list` idempotently and returns the same shape as progress. `GET /api/lists/:slug/progress` returns `started`, the user’s completed place IDs, dates, percentage and version; when `started` is false it returns public metadata plus a start CTA, not a fake zero. `GET /api/me/lists` returns active and archived lists. The public part is cacheable; progress is private. The page must render metadata, rules, map, table and progress without a second round trip for the public part.

---

## 8. The journal

### 8.1 Two levels

**Quick log** is the default:

- peak or peaks
- date (today by default)
- summit / attempt / traverse
- save

**Expanded record** is optional after save:

- notes
- companions (plain text later; no accounts at launch)
- conditions tags (later)
- photos (later)
- GPX (later)
- distance/gain (manual or GPX; never inferred from summit elevation)

The quick log must remain the fastest path. Do not make the full form the price of recording a climb.

### 8.2 Backfill

- “Add history” from Progress or the list page.
- Year → month → peak, with approximate dates; the UI shows “July 1998” and never a fabricated day.
- Multi-select peaks and add them in one action.
- `source='backfill'`; `paper-trail` is awarded when a trip date is more than one year before account creation.
- Bulk entry of 20 climbs should take under 20 minutes.
- CSV import in Phase B; GPX later. A CSV row that cannot be matched is reported, never silently dropped.

### 8.3 Verification and privacy

- Only `logged` and `gps` at launch. No witness or steward verification.
- Evidence describes support, not legitimacy. A 1994 handwritten climb and a 2026 GPS track are both records.
- Trips are private by default. No public profile, no follower graph, no companion accounts.
- Per-trip visibility is stored but only `private` is exposed in the slice.
- Delete account: immediate removal from the product, 30-day soft delete, then purge; export offered before deletion.
- No photos or GPX in the slice, so no EXIF/track-location risk yet. When added, strip EXIF by default and warn that a track can reveal more than the summit.

---

## 9. The passport: 10 launch badges

### 9.1 Why ten

The passport is the emotional artifact, but 43 badges before the record works is a game layer with a mountain theme. The launch set is ten marks that are:

- about mountains, history or list progress;
- achievable by the target user with the launch data;
- computable from known facts, without unreliable prominence or global coverage;
- quiet enough to fit the product.

The other 33 remain in `data/badges.json` as backlog. They are not shown, not promised and not deleted.

### 9.2 Launch marks

| ID | Name | Family | Criteria | Why it belongs |
|---|---|---|---|---|
| `first-light` | First Light | Firsts | `ascents.summits >= 1` | The first recorded summit. |
| `paper-trail` | Paper Trail | Firsts | `ascents.has_pre_account_ascent == true` | The archive accepts the life before the app. |
| `ten-up` | Ten Up | Count | `ascents.unique_peaks >= 10` | A first real body of work. |
| `halfway` | Halfway | Lists | `lists.max_progress_pct >= 50` | Reach halfway on a list of 10+ required peaks. |
| `finisher` | Finisher | Lists | `lists.completed >= 1` | The central completion moment. |
| `grand-traverse` | Grand Traverse | Rare | `ascents.max_peaks_in_trip >= 3` | A day with more than one summit. |
| `winter-round` | Winter Round | Seasons | `ascents.winter_summits >= 10` | Commitment to a season, not a streak. |
| `highpoint` | Highpoint | Geography | `ascents.has_highpoint == true` | A sourced geographic fact, not a guess. |
| `home-mountain` | Home Mountain | Rare | `ascents.max_ascents_on_single_peak >= 5` | Repetition and relationship, not volume. |
| `comeback` | Comeback | Rare | `ascents.has_summitted_previous_attempt == true` | The record honours failure and return. |

All ten are `hidden=false`. No silhouettes, no secret criteria, no award toast confetti. A quiet inline mark on the trip is enough.

### 9.3 Backlog (33)

The remaining catalog is grouped here; exact criteria live in `data/badges.json`.

| Family | Backlog |
|---|---|
| Firsts | `true-north`, `first-frame`, `cartographer` |
| Count | `fifty-up`, `century`, `five-hundred`, `thousand` |
| Elevation | `four-thousand`, `fourteener`, `five-thousand`, `eight-thousand`, `continental-crown` |
| Prominence | `p300`, `p1000`, `ultra`, `p2000` |
| Lists | `enrolled`, `second-round`, `third-round`, `grand-slam` |
| Seasons | `solstice`, `perfect-year`, `dawn-patrol`, `night-shift` |
| Geography | `new-range`, `three-countries`, `seven-continents` |
| Craft | `steward`, `scout`, `archivist` |
| Rare | `hard-way`, `lonely-summit`, `ones-that-got-away` |

The backlog is not a roadmap. Elevation/prominence/geography marks wait for reliable attributes; craft marks wait for community surfaces; hidden marks wait for a reason to exist.

### 9.4 Engine

- Criteria are data, validated at seed time. Every fact must exist in the registry.
- Evaluate the ten launch badges synchronously after a trip create/update/backfill. One facts query; no worker.
- `badge_award` is unique on (`user_id`,`badge_id`); criteria changes never re-award.
- A trip deletion removes the facts but does not revoke an award except for fraud.
- Tests: 43 unique IDs, 10 launch IDs, every launch badge earns on a fixture, no badge earns on empty facts, each launch badge fails one step below its threshold.
- `src/badges/badges.test.ts` is the contract; `data/badges.json` has `launch: true` on exactly ten.

### 9.5 Art and display

- One square SVG per mark; engraved contour style; three sizes.
- The passport page is part of `/progress`; no separate game surface.
- Earned marks show the date and the trip that earned them.
- No points, levels, leaderboards, streaks, confetti or sound.
- A share card is later; at launch, export is the artifact.

---

## 10. API and screens for the slice

### 10.1 API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/search?q=&limit=` | none | Peaks, lists and places |
| GET | `/api/peaks?bbox=&list=&cursor=` | none | Peak index / map viewport |
| GET | `/api/peaks/:slug` | optional | Peak detail + list memberships |
| GET | `/api/lists` | none | Published list library |
| GET | `/api/lists/:slug` | none | List metadata, version, entries |
| POST | `/api/lists/:slug/start` | required | Idempotent `user_list` start; returns progress |
| GET | `/api/lists/:slug/progress` | required | `started`, progress and remaining peaks |
| GET | `/api/me/lists` | required | Started and archived lists |
| GET | `/api/me` | required | Profile, units, privacy |
| PATCH | `/api/me` | required | Units, home region, privacy |
| GET | `/api/me/trips` | required | Journal |
| POST | `/api/trips` | required | Create a trip with 1..n peaks |
| PATCH | `/api/trips/:id` | required | Edit |
| DELETE | `/api/trips/:id` | required | Soft delete |
| GET | `/api/me/stats` | required | Basic stats |
| GET | `/api/me/export?format=json\|csv` | required | Export trips and progress |
| DELETE | `/api/me` | required | Delete account and schedule purge |
| GET | `/api/data-sources` | none | Sources, licences, attribution and checked dates |

Conventions: JSON; cursor pagination (`nextCursor`); ISO dates; metres stored, units rendered; RFC 7807 errors; `ETag` on public reads; `private, no-store` on `/api/me/*` and progress; httpOnly session cookie; same-origin/CSRF on mutations; no secrets or internal IDs in responses. Better Auth owns `/api/auth/*`; do not hand-roll sessions. `POST /api/lists/:slug/start` is idempotent; repeating it returns the existing `user_list` and progress.

No photo, GPX, route, condition, report, nearby-peak, public-profile or custom-list endpoint in the slice. Nearby peaks and custom lists are Phase B/C.

### 10.2 Screens mapped to existing code

| Screen | Existing route + components | Slice change |
|---|---|---|
| **Globe** | `src/pages/ExplorePage.tsx`, `MapGlobe.tsx`, `Discover.tsx` | Real 48 points, preview card, list view fallback; no new hero copy. |
| **Peaks index** | `src/pages/PeaksPage.tsx`, `SearchField`, `FilterChips`, `EmptyState` | Real rows, search, simple filters, URL state. No prominence filter unless sourced. |
| **Peak detail** | `src/pages/PeakDetailPage.tsx`, `PeakDetailTemplate.tsx` | Identity, known attributes, NH 48 membership, your record, sources. No routes/conditions/photos/nearby. |
| **List library** | `src/pages/ListsPage.tsx` | NH 48 card; no fake catalogue. |
| **List detail** | new `src/pages/ListDetailPage.tsx` at `/lists/:slug` | Publisher/edition/rules/start/progress/remaining/export; map + table. |
| **Quick log** | new `src/pages/LogPage.tsx`, `LogSheet` at `/log` | Three fields; multi-peak; approximate dates; save; edit/delete. |
| **Progress** | `src/pages/ProgressPage.tsx`, `StatCard` | NH 48 ring, remaining, recent climbs, basic stats, export. |
| **Sign in** | new `src/pages/SignInPage.tsx` at `/signin` | Magic link + one OAuth; `returnTo`; OAuth-only fallback. |
| **Settings** | new `src/pages/SettingsPage.tsx` at `/settings` | Units, optional home region, privacy, delete. |
| **Data page** | new `src/pages/DataPage.tsx` at `/about/data` | Sources, licences, attribution, checked dates, correction entry. |
| **Not found** | `src/pages/NotFoundPage.tsx` | Keep; add search. |

**Navigation contract:** keep the four primary nav items (Explore, Peaks, Lists, Progress). **Log a climb** is a persistent header action on desktop and a primary action above the mobile nav; it is not a fifth tab. Sign in, account, settings and data live in the account menu or footer. Do not add an Experience tab until Phase E has evidence.

**Route migration:** the current app uses `/peaks/:peakId` and a `/peaks/preview` template. Phase A makes `/peaks/:slug` the public route, maps the param to the API slug, and removes the preview route from the production build. Do not keep two peak detail routes or a preview card that looks like a real record.

**Replace, do not layer.** The Phase 01 placeholder copy, the “accounts are out of scope” footnote, the Goals panel, the disabled peak actions and the fake list anatomy are replaced by the real flow. A new feature must not sit on top of an empty-state scaffold that tells the user the product is unfinished.

**Every new screen ships with:** signed-out, empty, loading, error and success states; a mobile layout; a keyboard path; and one truthful next action. “Coming soon”, disabled primary actions and fake counts do not count as a state.

No visual regression to the shipped globe, logo, fonts, Discover overlay or content-page styling. New pages reuse the existing shell and tokens. Replace the Discover placeholder in place; do not add a second search surface.

---

## 11. Metrics and validation

### 11.1 North star

**Monthly active record keepers (MARR):** users who take a record action in a month — log a climb, edit a climb, backfill history, or meaningfully view progress/list status. It measures whether Terrane is becoming the archive, not whether people summit weekly.

**Guardrail:** D90 retention of users who have at least three ascents. This is the target user; occasional visitors are welcome but not the proof.

### 11.2 Funnel hypotheses

| Stage | Metric | Hypothesis — not a promise |
|---|---|---|
| Discovery | Search → peak open | ≥ 40% |
| Discovery | Peaks explored per session | ≥ 3 |
| Intent | Peak open → list start | ≥ 25% of signed-in sessions |
| Activation | First meaningful action within 7 days (log, backfill, start list) | ≥ 50% |
| Record | First ascent logged | ≥ 40% of signups |
| Backfill | 10+ historical climbs added | ≥ 25% of target users |
| Retention | D30 / D90 / D365 | ≥ 30% / ≥ 20% / ≥ 12% (cohort-dependent) |
| Trust | Corrections submitted and resolved | Tracked, not gamified |
| Performance | Search p95 / peak page p95 | < 300 ms / < 200 ms |

Do not set a badge-earning target. If badges need a target to look successful, they are too easy or too central.

### 11.3 Validation gates

| Test | How | Positive signal |
|---|---|---|
| **Discovery** | 10 people explore an unfamiliar range | 7/10 find 3 interesting peaks in < 2 minutes without help |
| **List** | Active baggers use a real list for two weeks | 5/7 prefer it to their current method; 3/7 would switch |
| **Backfill** | Target users reconstruct 20 climbs | 5/7 finish in < 20 minutes; 4/7 would continue |
| **Return** | Prototype cohort over 30 days | 40% return unprompted twice; 25% take a record action in week 4 |
| **Data** | Show pages with unknown attributes | 8/10 understand what is known/unknown; < 2% sample errors |
| **Positioning** | Compare with spreadsheet/Yak/Peakery | 5/8 can explain why Terrane without prompting |

If the list test fails, the core thesis is wrong; stop and reshape. If discovery fails, the globe is decoration; simplify it or make search the front door. If backfill fails, the archive value is weaker than assumed; narrow to a list tracker.

### 11.4 Measurement plumbing (Phase A)

The gate cannot be judged from anecdotes. Add server-side events before the 10-user cohort:

| Event | Fires when | Not included |
|---|---|---|
| `search_submitted` | A search request is accepted | Query text in analytics; keep it in the request log only |
| `peak_opened` | A peak page renders for a real place | User identity |
| `list_started` | `user_list` is created, first time only | Repeat starts |
| `trip_logged` | A trip with at least one summit is created | Notes, companions or coordinates |
| `backfill_saved` | A trip with `source='backfill'` is created | Free-text notes |
| `trip_edited` / `trip_deleted` | A saved trip changes | Before/after notes |
| `export_downloaded` | A JSON/CSV export succeeds | File contents |
| `signin_completed` | A session is established | Email or provider token |

Use a first-party event table or structured server logs with a random cohort id; no third-party pixel and no PII. The 10-user cohort gets a code, not a name in analytics. If an event cannot be measured without collecting sensitive data, the gate uses a manual observation and says so. The event list is part of the Phase 0 readiness checklist; without it, the 10-user test is a demo, not evidence.

---

## 12. Roadmap

The dates are estimates, not commitments. Each phase has an evidence gate; the next phase does not start because the calendar says so.

### Phase 0 — Phase A readiness (2–4 days; no app build)

This phase closes the dependencies that otherwise stop the slice mid-build. It is planning, data and platform setup, not feature code.

| Readiness item | Output | Blocks if missing |
|---|---|---|
| Scope and estimate frozen | Phase A critical path accepted; no “small additions” | Every task |
| NH 48 source pack and licence path | Publisher edition, membership, coordinates, elevations, highpoint and source manifest; permissive fallback named | Seed and public launch |
| Platform | Neon PostGIS branch, Vercel API project, same-origin `/api` rewrite, preview environment, migrations in CI, seed reset, backup/restore check | Schema and 10-user test |
| Auth | Email provider deliverability test, one OAuth app, redirect domains, same-origin cookie test; OAuth-only fallback if email is blocked | Sign-in and every private route |
| Prototype | Clickable one-flow prototype tested with 5 target users | UI build |
| Measurement | Event list and 10-user cohort plan; consent and PII rules | Gate review |

**Gate:** every row has an owner and no open blocker. If one is open, do not start the UI build; do not “work around” auth or deployment with a fake user or local-only state.

### Phase A — NH 48 vertical slice (6–9 weeks)

**Build:** schema and seed for 48 peaks, region context, NH 48 version, Better Auth and `user_list`, globe/search/peak pages, explicit list start, quick log, manual backfill, edit/delete, list progress, export, settings and data page. No badges, photos, GPX, routes or conditions.

**Gate:** the prototype passed before build; the slice test passes (6/10 complete the loop; 4/10 return); 48/48 entries sourced; export round-trips; no fabricated fields; the flow works on a 390 px screen.

### Phase B — Archive depth + Colorado 14ers (4–6 weeks)

**Build:** CSV import with a documented template, duplicate protection and merge, basic stats, list-version change display, Colorado 14ers as the second complete list. Edit/delete of a single trip already shipped in Phase A; this phase adds bulk import and merge review. No new surface beyond the existing shell.

**Gate:** 20 climbs imported in under 20 minutes; progress matches a hand count; a simulated list version change preserves the old completion; users ask for the next list.

### Phase C — Passport + Munros (3–4 weeks)

**Build:** ten launch badges, quiet badge case in `/progress`, list completion mark, simple annual recap, Munros as the third list. No hidden badges, no points, no leaderboard.

**Gate:** users value the artifact enough to keep/share it; badge awards are accurate; the Munros list is complete and sourced. If badges distract from the record, cut them back further.

### Phase D — Earn expansion (ongoing)

**Build only after the gates:** ADK 46 and Catskill 3500; more sourced lists; local search and map quality; data correction workflow; SEO for list pages; optional photos/GPX; offline saved records; paid convenience experiments; public profiles if users ask.

**Do not build:** forecasts, avalanche, routes, live GPS, social feed, physical patches, print yearbooks, global prominence until the data and demand justify them.

### Phase E — Global atlas + experiences (after Phase D)

**Build only when §13.6 is satisfied:** global source manifest and licence layer, ingest and identity resolution, region-by-region publication, coverage dashboard, search/map scale, experience taxonomy and sourced pages for ranges, parks, corridors and viewpoints. No routes, conditions, bookings or live data.

**Gate:** coverage is measured, not claimed; search and map p95 stay inside budget; corrections have an owner; the experience pages add a reason to explore without thinning the record. This is a sequence of regional releases, not a global launch day.

### 12.5 Implementation plan

**Staffing assumption:** one full-stack engineer, half a designer and a part-time data steward. A solo builder runs the same sequence serially. Phase A is **6–9 weeks** with those people; 4–6 weeks is only credible if the seed, auth and deployment are already prepared. The ranges are estimates, not promises.

| Workstream | Owner | Phase A output |
|---|---|---|
| Data and provenance | Steward + engineer | NH 48 seed, region context, source manifest, field-level checks |
| Platform and API | Engineer | Neon, Vercel, migrations, seed reset, REST contract, fixtures |
| Auth and account | Engineer | Better Auth, `app_user`, `user_list`, return-to, settings, delete |
| Explore | Designer + engineer | Real search, peak pages, 48-point globe, accessible list fallback |
| Lists | Engineer | NH 48 start, ring, remaining peaks, per-peak status |
| Journal | Engineer | Quick log, manual backfill, edit/delete |
| Trust and export | Engineer | Data page, JSON/CSV export, privacy controls |
| Measurement and QA | Whole team | Events, prototype test, device pass, 10-user cohort |

The order matters: **readiness before build; API contract before screens; data before UI; auth before personalized UI; list start before progress; edit/delete before the gate; events before the cohort.** Do not build a screen against an unvalidated seed or an unspecified endpoint.

#### Phase 0 — readiness checklist

| # | Task | Depends on | Done when |
|---|---|---|---|
| 0.1 | Freeze Phase A scope and estimate | This plan approved | Critical path and non-goals signed off; no Phase B work in the branch |
| 0.2 | Assemble the NH 48 source pack and licence decision | 0.1 | 48 rows, publisher edition, coordinates, elevation/highpoint sources; permissive fallback; legal review scheduled |
| 0.3 | Provision Neon/PostGIS, Vercel API and preview, same-origin `/api`, CI migrations, seed reset | 0.1 | Empty branch migrates and seeds; preview URL works; restore check passes; no cross-site cookie |
| 0.4 | Configure auth email and OAuth | 0.3 | Magic link delivers; redirect domains work; OAuth-only fallback documented; session survives refresh |
| 0.5 | Prototype and test the one flow | 0.1 | 4/5 target users complete the prototype without help; 3/5 prefer it to their spreadsheet |
| 0.6 | Define events and cohort | 0.1 | Event list, PII rules and 10-user recruitment plan approved |

#### Phase A — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | Build the NH 48 seed, region context and source manifest | 0.2 | 48/48 entries matched; every displayed field has an accepted source; list edition/rules captured; unknown fields explicitly null |
| 2 | Write seed and data-contract tests | 1 | Seed fails on a missing entry, duplicate ID, bad count or displayed value without provenance |
| 3 | Freeze schema, Better Auth tables, `user_list`, migrations and seed loader | 2, 0.3 | Migrations apply from empty; 48 places, regions and one list version load; no platform tables |
| 4 | Freeze API contract, typed fixtures and permission matrix | 3 | Every Phase A screen has a contract; 401/403/empty/error cases are specified; no UI invents a field |
| 5 | Build auth, settings and return-to | 3, 4, 0.4 | Sign up, sign in, sign out, units, optional home region, private default, delete; deep-link return works |
| 6 | Build search, peak pages and globe integration | 4, 5 | Signed-out search returns NH 48 peaks; peak page shows identity, known/unknown, list membership and sources; 48 points and list fallback work |
| 7 | Build list start and progress | 4, 5, 6 | `user_list` start is idempotent; publisher, edition, rules, “not official”, ring, remaining peaks and per-peak status; no completion snapshot until Phase C |
| 8 | Build quick log, manual backfill and edit/delete | 5, 7 | Log under 20 seconds; 20 past climbs under 20 minutes; approximate dates; a saved trip can be corrected or deleted immediately |
| 9 | Build export, privacy and data page | 8 | JSON/CSV round-trip trips, dates and progress; delete-account path; sources/licences/checked dates visible |
| 10 | Run the slice QA, one-flow test and 10-user cohort | 1–9 | Acceptance criteria pass; all events fire; 6/10 complete the loop; 4/10 return; 390 px and keyboard pass |

**Phase A definition of done:** Phase 0 blockers closed; all ten tasks complete; `npm test`, typecheck and build green; 48/48 sourced; no fabricated fields; `user_list` exists and list start is explicit; edit/delete works; export round-trips; events prove the gate; no UI regression to the shipped globe, logo, fonts or Discover overlay; data page and runbook written. Phase A is **not** done if badges, Colorado, Munros, photos, GPX, routes, conditions, public profiles, global ingestion or a paid tier have been added.

#### Phase B — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | CSV template, parser and review screen | Phase A gate | A documented template imports, reports unmatched rows and never silently drops a climb |
| 2 | Duplicate protection and merge review | 1 | Same peak/date offers merge or keep separate; bulk rows can be corrected before commit |
| 3 | Basic stats | 2 | Summits, unique peaks, attempts, days out and list progress match fixtures |
| 4 | List-version change display | Phase A list model | A simulated publisher change preserves the old completion and shows the new remaining peaks |
| 5 | Colorado 14ers seed and validation | 1–4 | 58 named entries matched; source/edition captured; no partial list published |
| 6 | Phase B QA and gate review | 1–5 | 20 climbs imported in under 20 minutes; hand-count matches; users ask for the next list |

#### Phase C — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | Badge facts and ten-mark evaluator | Phase B gate | Ten launch badges evaluate correctly; no badge fires on empty facts; awards are idempotent |
| 2 | Badge case and quiet award reveal | 1 | Earned marks show date and source trip; no points, leaderboard, hidden criteria or confetti |
| 3 | List-completion mark | 1, 2 | Completion against a specific version is visible and permanent; the immutable `list_completion` snapshot is created here |
| 4 | Simple annual recap | 2, 3 | A year with 0, 3 and 50 trips renders without fabricating content |
| 5 | Munros seed and validation | Phase B list model | 282 entries matched and sourced; unsupported rules labelled, not faked |
| 6 | Phase C QA and gate review | 1–5 | Awards accurate; list complete; users value the artifact enough to keep/share it |

#### Phase D — earned expansion

Do these as separate, gated items, never as one bundle:

1. ADK 46 seed and list page.
2. Catskill 3500 seed and list page.
3. More sourced lists, one at a time.
4. Public correction workflow and steward review.
5. List-page SEO and community distribution.
6. Optional photos and GPX import.
7. Offline saved records and map packs.
8. Paid convenience experiments.
9. Public profiles, only if users ask.

Stop conditions: if D90 retention is below the gate, do not expand the catalogue; fix the loop. If badges distract from the record, cut them back. If a list cannot be represented accurately, do not publish it. If a new surface has no metric or gate, it waits.

#### Phase E — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | Experience taxonomy and user test | Phase D gate | 10 sourced example experiences tested; users find a reason to explore without a route/conditions expectation |
| 2 | Global source manifest and ODbL/permissive decision | 1 | Every source has a licence row; the derived-layer boundary is signed off |
| 3 | Ingest, identity resolution and merge log | 1, 2 | Duplicates are measurable; no source row is destroyed; names and points resolve |
| 4 | Publication thresholds and coverage dashboard | 3 | Published places meet the identity/name/point/source rule; coverage is reported by region |
| 5 | Search and map scale | 3, 4 | p95 budgets hold at regional volume; the browser never downloads the world |
| 6 | Experience model, pages and collections | 1, 5 | Ranges, parks, corridors and viewpoints connect to places; no thin pages or copied publisher text |
| 7 | Corrections and stewardship | 4, 6 | Suggestion, review, changelog and source-removal paths work |
| 8 | Regional release and gate | 1–7 | One region is live and supportable before the next begins |

#### Implementation rules

- **Readiness before build.** No Phase A feature code until the Phase 0 blockers are closed.
- **One flow.** Every screen has one next action; no fifth nav tab, no dead-end success page.
- **One list at a time.** No second list ships while the first has unmatched entries.
- **No partial list.** A list publishes only when membership, source, edition and rules are complete.
- **No fabricated fallback.** Unknown stays unknown; a missing value never becomes zero or an estimate to make a screen look full.
- **No global ingest in Phase A.** The atlas grows in Phase E, after the record loop is proven.
- **No new surface without a gate.** Every addition must answer which phase gate it serves.
- **Every phase ends clean.** Tests, typecheck, build, docs, runbook, no dead code, no duplicate plan.
- **The app build has not started.** Phase A begins only after explicit approval of this plan.

### Not in v1

Routes, conditions, forecasts, avalanche, trip reports, live GPS, photo storage, GPX import, public profiles, companions, witness/steward verification, physical patches, print yearbooks, paid tier, offline map packs, 43 badges.

---

## 13. The global atlas and experiences

The NH 48 slice is the first proof, not the product's ceiling. The destination is a global atlas of the world's mountains and peaks, plus the sourced experiences that make those places worth seeking out. The record remains the through-line: a list climber can use the atlas without losing the thing that brought them.

### 13.1 What “every mountain and peak” means

“Every” is a coverage goal, not a completeness claim. A place is published when it has:

- a stable identity and slug;
- a name and point with a source;
- a kind (`peak` in Phase A; later `range`, `park`, `trail`, `viewpoint`, `scenic_area`);
- zero or more sourced attributes;
- a visible provenance panel and a correction path.

We do not invent a peak to fill a country, assume an elevation, or call a page “verified” because it exists. Coverage is reported as a number and a date, never as “all”.

### 13.2 Other experiences, not a second product

An experience is a curated, sourced way to encounter one or more places. It is editorial context, not a route, conditions report, booking or live guide.

| Experience kind | What it is | What it is not |
|---|---|---|
| Range / massif | A named group with a boundary and member peaks | A route or conditions page |
| Park / protected area | A sourced administrative or conservation area | A permit or booking service |
| Trail / scenic corridor | A named approach or drive with a source and access note | Turn-by-turn navigation or closure data |
| Viewpoint / dark-sky place | A place worth seeing for its view or sky | A live weather or safety service |
| Editorial collection | A Terrane-curated set, e.g. Blue Hour 50 | A publisher list or completion |

Experiences share the `place` identity and `place_provenance` layers. `experience` is a future editorial object (`id`, `slug`, `kind`, `title`, `summary`, `geom` or bbox, `source_id`, `status`) with `experience_place` joining it to places. It is not a new inventory and it does not create a second completion system. Public experiences appear in Explore and on place pages; a dedicated nav item waits until Phase E has evidence.

**One flow still applies.** An experience page does not create a second funnel. Its primary action opens a member place, where the existing peak → list → record loop takes over. A park or scenic corridor can explain why a place matters and point to its peaks; it cannot become a separate social feed, route planner or completion system. That is the test that experiences are a lens, not a product fork.

### 13.3 Data path (Phase E, gated)

1. **Source manifest and licence layer.** Start with permissive sources; add OSM as a separate ODbL layer only after legal review. One accepted value per field.
2. **Ingest and identity resolution.** Normalise names, aliases, coordinates and feature kinds; merge duplicates with a merge log; never delete a source row.
3. **Publication threshold.** Publish identity + name + point + source; optional attributes remain null. Internal QA tiers only; no public coverage grade.
4. **Search and map scale.** Postgres FTS/trigram until p95 misses; vector tiles or clustering for the globe; server-side bbox; never download the world to the browser.
5. **Experience curation.** An editor or steward adds ranges, parks, corridors and viewpoints with a source; no thin pages and no copied publisher text.
6. **Corrections and coverage.** Public suggestion path, steward queue, changelog, coverage dashboard and source-removal process.
7. **Regional release.** Add coverage by region only when search, data quality and support can carry it; no global “launch” day.

### 13.4 Coverage and quality metrics

Track, do not promise:

- published places, by kind and region;
- percentage with name + point + source;
- percentage with elevation, prominence and highpoint flags;
- duplicate and merge rate;
- search zero-result and first-result click rate;
- correction backlog and resolution time;
- map/search p95;
- percentage of public pages with at least one sourced experience.

### 13.5 Why customers will care

- **Explorers** get a real place and a reason to go, not an infinite list of pins.
- **List climbers** get a portable record that is not trapped in one region.
- **Experience seekers** get ranges, parks, viewpoints and drives without a route/conditions app.
- **The business** gets acquisition from place and experience pages and retention from the record.

The tension is real: breadth can make the product feel like a thin directory. That is why Phase E follows the record loop, not the other way round. If the slice cannot retain list climbers, global coverage is a cost without a customer.

### 13.6 Phase E gates

Do not start global ingestion until:

- five lists are stable and sourced;
- D90 retention and MARR clear the Phase C/D gates;
- the ODbL/permissive licence decision is signed off;
- search p95 and map performance have headroom;
- a data steward can own corrections and coverage;
- 10 experience pages tested with users add a reason to explore, not clutter.

Phase E ships region by region. A global count is a dashboard, not a launch.

---

## 14. Acquisition, monetization and risk

### 14.1 Acquisition

The first 1,000 users come from list communities, not generic SEO:

- NH 48 groups, forums, clubs and Facebook communities.
- 14ers forums and Colorado hiking groups when Phase B ships.
- Munro communities when Phase C ships.
- Publisher/community partnerships for list pages.
- A small number of genuinely useful list pages and peak pages, not thousands of thin global pages.

SEO follows the list pages: “NH 48 tracker”, “NH 48 remaining peaks”, “NH 48 list changes”. A page with three database fields will not outrank established sources. The Blue Hour 50 remains an editorial project after the core loop; label it “Terrane collection”, not an official list.

Experience pages are not an acquisition strategy until Phase E. When they arrive, ranges, parks, scenic corridors and viewpoints can bring non-baggers in; measure assisted signups, not page views. Do not publish thousands of thin place pages to chase search traffic. A small number of genuinely useful pages beats a generated catalogue.

### 14.2 Monetization

No paid tier at launch. The record, list progress and export are free. Test willingness to pay only after retention:

- offline saved records and map packs;
- extra photo storage;
- printed yearbook;
- physical list-completion patch.

Do not build patches or print until users have completed lists and asked. Do not promise “every future feature free forever”; promise that the user’s own record is always accessible and exportable.

### 14.3 Risks

| Risk | Mitigation |
|---|---|
| ODbL forces an open derived layer | ADR-002, separate layer, attribution, legal review before public launch; permissive fallback for the slice |
| List membership/identity errors | 48-peak manual verification; seed validation; corrections; no publish until 100% matched |
| List maintenance becomes a job | One list at a time; source/edition/changelog; no partial lists; no more than five at beta |
| Cold start | The slice is useful to one person immediately: discover, start, backfill, progress, export |
| Scope creep | The “not in v1” list is a contract; Phase D gates; no routes/conditions/social |
| Globe performance | 48 points first; list view fallback; realistic device test before expansion |
| Privacy/location | Private by default; no public profiles; no photos/GPX in slice; deletion/export |
| Solo-team bus factor | One canonical plan, ADRs, seed files, runbooks, tests |
| Badge gamification | Ten meaningful marks; no points/leaderboards/hidden; cut if they distract |
| Auth email deliverability | Phase 0 sends a real magic link; OAuth-only fallback if the provider or domain fails |
| Deployment/migration failure | Neon branch, migration smoke, seed reset and restore check before the cohort |
| Scope overload in Phase A | 6–9 week estimate; explicit non-goals; nearby/CSV/global experiences deferred |
| Global coverage becomes a thin directory | Phase E gates; region-by-region release; no thin pages; coverage measured |
| Experiences dilute the record | No experience nav or surface until Phase E; test 10 experiences before building more |
| UI flow loses people | One-flow prototype before build; one primary action; no fifth tab; 390 px and keyboard pass |
| Gate judged by anecdotes | Server-side events before the 10-user cohort; no PII; manual fallback documented |

### 14.4 Open decisions

| Decision | Recommendation | When |
|---|---|---|
| Second list: Colorado 14ers or Munros? | Colorado 14ers (smaller, strong community, US data) | Phase B |
| GPX import timing | After manual logging/backfill proves useful; Phase C/D | Phase C review |
| Photos | After manual record and export; not before | Phase D |
| Public profiles | Not before retention and explicit demand | Phase D |
| Paid tier | Do not design until retention; test offline/print | Phase D |
| ADK/Catskills | Only after the first three lists are stable | Phase D |
| Auth if email is blocked | OAuth-only for the slice; add magic link later | Phase 0 |
| First experience kinds | Ranges, parks, scenic corridors and viewpoints; no routes or conditions | Phase E |
| Global source order | Permissive base first; OSM as a separate ODbL layer only after review | Phase E |
| Coverage target | Report coverage by region; never promise “all” | Phase E |
| Nearby peaks | Defer; it adds a query and a surface without proving the loop | Phase B candidate |

The primary user, NH 48 slice, field-level provenance, ten launch badges, the global destination and this phase order are **not** open. They are the v3.0 contract.

---

## 15. Next ten tasks

Steps 1–2 of the earlier list are complete: this file is canonical and the ten launch badges are flagged and tested. The app build has not started. These ten tasks close the Phase 0 blockers; Phase A code begins only after they pass.

1. **Approve the Phase A scope and estimate.** 6–9 weeks, explicit non-goals, no Phase B work in the branch. *Output:* a signed critical path and a named owner.
2. **Assemble the NH 48 source pack.** 48 names, coordinates, elevation/highpoint sources, list membership, publisher edition and rules. *Output:* every field has a source; unknown fields are null.
3. **Choose the licence path.** Permissive/publisher facts for the slice, with OSM held out until review; schedule the legal review. *Output:* no unresolved ODbL data in the Phase A production database.
4. **Test the one-flow prototype with 5 target users.** Include `returnTo`, list start, backfill, edit/delete and export. *Output:* 4/5 complete without help; 3/5 prefer it to their spreadsheet.
5. **Provision the platform.** Neon PostGIS branch, Vercel API, preview environment, CI migrations, seed reset and restore check. *Output:* an empty branch migrates, seeds and serves a preview.
6. **Configure auth.** Better Auth email magic link, one OAuth app, redirect domains; test deliverability. *Output:* sign-in and sign-out work; OAuth-only fallback is ready.
7. **Write the data contract and tests.** Seed validation, unique IDs, count, no missing entries, no fabricated fields, provenance required. *Output:* the seed fails loudly before publish.
8. **Freeze schema and API contracts.** Include `user_list`, Better Auth tables, `place`, `peak`, `list`, `list_entry`, `trip`, `trip_peak`; type the endpoints and fixtures. *Output:* no screen invents a field; 401/403/empty states specified.
9. **Build the NH 48 seed and region context.** Run the data contract against the real list. *Output:* 48/48 matched; one list version; sources and checked dates.
10. **Run the Phase 0 gate review.** If any readiness item is open, do not start UI code. *Output:* Phase A kickoff decision, with the one-flow and measurement plans attached.

When these ten are done, Terrane has one verified list, one honest data contract and a testable loop. That is the right foundation for the app build — not a 467-peak platform built on assumptions.

---

## Sources

- Yak — list tracking and patches: https://yakapp.co/
- Peakery — global peak atlas: https://peakery.com/
- AMC — White Mountain 4,000-Footers: https://www.outdoors.org/
- OpenStreetMap — copyright and licence: https://www.openstreetmap.org/copyright
- GeoNames: https://www.geonames.org/
- Wikidata: https://www.wikidata.org/
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
- USGS GNIS: https://www.usgs.gov/domestic-geographic-names
- Natural Earth: https://www.naturalearthdata.com/
- Neon PostGIS: https://neon.com/docs/extensions/postgis
- Better Auth: https://www.better-auth.com/docs
- MapLibre: https://maplibre.org/

## Glossary

| Term | Meaning |
|---|---|
| **Backfill** | Adding a climb from before the user joined Terrane, with approximate date precision. |
| **Completion** | Every required peak on a specific list version has a qualifying summit trip. |
| **Field provenance** | The source, method, confidence and checked date for one attribute of a peak. |
| **List version** | An immutable publication of a list’s membership and rules at a point in time. |
| **MARR** | Monthly active record keepers: users taking a record action in a month. |
| **User list** | A user’s explicit start of a published list; progress exists only after it. |
| **Experience** | A sourced editorial way to encounter one or more places; not a route or conditions service. |
| **Global atlas** | The Phase E destination: sourced mountains, peaks and experiences, released region by region. |
| **Record keeper** | A user who logs, edits, backfills or meaningfully reviews their climbing record. |
| **Slice** | The NH 48 end-to-end product used to prove the loop before expanding. |
| **Supported list** | A list whose membership and rules Terrane can represent accurately and source. |
