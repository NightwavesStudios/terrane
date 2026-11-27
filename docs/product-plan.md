# Terrane — Product Plan v3.0

**Status:** canonical build plan · v3.0 · 27 November 2026
**Supersedes:** v2.0 (`docs/product-plan.md`) and the v1.0 shareable artifact
**Primary user:** the list-driven climber with an existing history
**First build:** the NH 48 vertical slice — 48 peaks, one list, one complete loop
**Stack:** React 19 + Vite SPA · Hono API · Postgres 17 + PostGIS on Neon · field-level provenance
**North star:** monthly active record keepers, not weekly logged summits

> The atlas is the front door. The list is the reason to return. The record is the product.

This file is the one full plan. The shareable artifact is an executive brief that points here; it is not a second source of truth. If the two disagree, this file wins.

The fixed decisions from the previous round still hold:

1. **Stack:** Postgres + PostGIS on Neon, field-level provenance. ADR-001 remains accepted. The Python ingest pipeline and snapshot machinery are deferred, not replaced.
2. **Target inventory:** three regions — US Northeast, Colorado, Scotland — and five lists: NH 48 (48), Adirondack 46 (46), Catskill 3500 (35), Colorado 14ers (58 named), Munros (282). 469 peaks is the target, not the first engineering milestone. Public beta ships the first three complete lists; ADK 46 and Catskill 3500 follow in Phase D.
3. **The first build is the NH 48 vertical slice.** One list, 48 peaks, a real list page, a quick log, progress and export. No Colorado, no Munros, no badge catalogue, no GPX, no community in the slice.
4. **Ten badges launch.** The other 33 stay in `data/badges.json` as a documented backlog. They are not deleted and not promised.

The plan is deliberately narrower than v2.0. The product is not a complete mountain platform. It is a trusted record for people pursuing named peak lists, with a global atlas as the way in.

---

## 0. The one-page version

| Question | Answer |
|---|---|
| **What is Terrane?** | The trusted record for people pursuing named peak lists — and the atlas that helps them find the next one. |
| **Who is it for first?** | A climber with 30–200 summits, one to three active lists, and a spreadsheet/Yak/Peakery history they do not fully trust. |
| **What is the wedge?** | A list count they trust, a lifetime history they can finally consolidate, and a record beautiful enough to keep. |
| **What is the first loop?** | Discover a peak → see its list → start the list → log or backfill a climb → see progress → return for the next one. |
| **What ships first?** | NH 48: 48 sourced peaks, one list version, search, peak pages, auth, quick log, manual backfill, list progress, JSON/CSV export. |
| **What makes it defensible?** | The user's accumulated history and list progress, not the globe or the badge art. |
| **How does it make money?** | Not yet. Free record and export at launch; test offline, storage, print and convenience only after retention is proven. |
| **What is the north star?** | Monthly active record keepers, with D90 retention of users who have at least three ascents as the guardrail. |
| **What do we refuse?** | Global completeness claims, fabricated fields, operational safety data, public-by-default location data, points, leaderboards and a social feed. |

**The strategy in one sentence:** Yak proves people want lists and patches; Peakery proves people want the whole world of peaks. Neither owns the trusted, portable, lifetime record. Terrane earns that position one complete list at a time.

---

## 1. What changed from v2.0

v2.0 was a platform thesis. It combined a global geographic database, a peak-bagging tracker, a personal archive, a list publisher and a premium outdoor atlas, then assumed the combined value would exceed the combined complexity. That might be true eventually. It is not established.

v3.0 makes five changes:

1. **One primary user.** The list-driven climber with an existing history, not the generic explorer. Discovery is acquisition; the record is retention.
2. **One first loop.** NH 48 end to end, not 469 peaks and seven surfaces in parallel. The slice proves whether the list-to-record loop is worth expanding.
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

- A complete global mountain inventory.
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
| A global discovery atlas with honest coverage | A complete global mountain inventory |
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
| Natural Earth | Public domain | Country/region context | Coarse |
| AMC / publisher | List facts; terms vary | NH 48 membership, edition, rules | Cite; do not copy descriptions or artwork |
| Copernicus DEM | Free, attribution | Deferred; no global prominence | 30 m; not a summit survey |

ADR-002 remains the licensing posture: an ODbL-compatible derived layer where required, exact attribution, public export of the open layer, no user content mixed into it, and a lawyer’s review before public launch. If the review makes the OSM-derived layer too restrictive, fall back to permissive sources for the launch slice. Do not build a production database around an unresolved licence.

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
| `place` | `id` uuid PK, `slug` citext unique, `name` text, `kind` text default `peak`, `geom` geography(Point,4326), `country_code` char(2) null, `status` text (`published`,`hidden`,`merged`), `merged_into` uuid null, timestamps | Identity only. No elevation or prominence required. Slug is permanent; rename creates an alias and a 301. |
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
| `list_completion` | `id`, `user_id`, `list_id`, `list_version_id`, `round`, `started_at`, `completed_at`, `snapshot` jsonb, `evidence_trip_id` | Unique (`user_id`,`list_id`,`round`). Snapshot stores `{place_ids, peak_count, version_label}`. A completion remains valid forever against the version it satisfied. |
| `custom_list` | `id`, `user_id`, `title`, `visibility` (`private`,`link`) | Outside the published catalogue; never earns a publisher completion or a passport badge. |
| `custom_list_entry` | `custom_list_id`, `place_id`, `position`, `note` | PK (`custom_list_id`,`place_id`); unique position. |

**Versioning rules.** A list version is the unit of truth. A publisher change creates a new version with a changelog; old completions stay attached to the old version. Current progress uses the current version. The UI can say “Completed 2024 · 2 new peaks since.” No version change silently invalidates a completion.

**Completion rules.** A required peak is complete when the user has a non-deleted `trip_peak` with `outcome='summit'` and the trip date is on or before the completion date. Past climbs count; there is no minimum gain, track or witness. Round 1 counts all history. Rounds are a later UI concern; the schema keeps `round` so the data does not need rewriting.

**Official language.** The list page always says: “Publisher: AMC. Terrane is not the official record.” Never imply that a Terrane completion grants membership, a certificate or a publisher finisher number.

### 5.3 Journal

| Table | Key columns | Rules |
|---|---|---|
| `app_user` | `id`, `email`, `handle`, `display_name`, `home_region_id`, `units`, `units_chosen_at`, `locale`, `privacy` default `private`, `role`, `created_at`, `deleted_at` | Private by default. No public profile in v1. |
| `trip` | `id`, `user_id`, `title`, `start_date`, `end_date`, `date_precision` (`day`,`month`,`year`), `notes`, `visibility` default `private`, `source` (`manual`,`backfill`,`csv`,`gpx`), `verification` (`logged`,`gps`), timestamps, `deleted_at` | One trip can contain many peaks. `start_date` is the anchor: first day of the precision period; never displayed below the precision. No photos/GPX in the first slice. |
| `trip_peak` | `trip_id`, `place_id`, `outcome` (`summit`,`attempt`,`traverse`), `order`, `summit_time`, `verified` (`logged`,`gps`) | PK (`trip_id`,`place_id`); unique (`trip_id`,`order`). At least one peak per trip. |
| `correction` | `id`, `place_id`, `user_id`, `field`, `old_value`, `new_value`, `source_url`, `status`, `reviewed_by`, `reviewed_at` | Manual review in Phase A. No public queue UI. |

**Trip rules.** A trip is a day or outing, not a checkmark. A pure attempt is valid. A repeat grows total ascents but not unique peaks. Deleting a trip removes it from stats immediately; badges are not revoked except for fraud, and self-reported past climbs are never downgraded.

**No GPX in the slice.** GPX import is a later convenience, never the definition of a valid ascent. When it arrives, it suggests matches and the user confirms; thresholds are calibrated on real tracks, not treated as universal truth.

### 5.4 Badges

| Table | Key columns | Rules |
|---|---|---|
| `badge_definition` | `id`, `slug`, `family`, `name`, `description`, `criteria` jsonb, `criteria_version`, `launch` bool, `progressive`, `progress_fact`, `progress_target`, `progress_unit`, `hidden`, `art_key` | Seeded from `data/badges.json`. The 10 launch marks are `launch=true`; the rest are backlog. |
| `badge_award` | `id`, `user_id`, `badge_id`, `criteria_version`, `earned_at`, `source_trip_id` | Unique (`user_id`,`badge_id`). Awards are permanent; criteria changes do not re-award. |

At 10 launch badges and a single-user write path, evaluate synchronously after a trip create/update/backfill. No outbox, no worker, no materialized facts table. Revisit only when the catalogue or write volume makes it painful.

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
- One `place_region` membership for the White Mountains range, with source; country/US state memberships.
- `is_highpoint=true` for Mount Washington, with a source (NH state highpoint).
- `/about/data` lists sources, licences, attribution and checked dates.

**Product**

- Existing globe with 48 real peaks, search and a preview card; list view fallback.
- `/peaks` with real rows, search and simple filters; no prominence filter unless the data supports it.
- `/peaks/:slug` with identity, known attributes, list membership, your record, nearby peaks and data sources.
- `/lists` and `/lists/nh-48` with publisher, edition, rules, progress, remaining peaks and export.
- `/signin` with email magic link and one OAuth provider (Google or Apple); no passwords.
- `/log` quick log: peak(s), date, outcome, save. Edit/delete.
- Manual backfill: year/month/day precision, multi-peak, 20 climbs without a modal per climb.
- `/progress` with the NH 48 ring, remaining count, recent climbs and basic stats.
- JSON and CSV export of all trips and list progress. GPX of remaining list peaks is Phase B; no track export yet.
- `/settings` with units, home region, privacy and delete account.

**Out of scope for the slice**

- Colorado, the Munros, ADK 46 or Catskill 3500.
- Badges (the passport starts in Phase C).
- Photos, GPX import, routes, conditions, forecasts, reports.
- Public profiles, companions, witness or steward verification.
- Offline mode, PWA install, native apps.
- Paid tier, patches, yearbook.

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

### 6.4 The slice test

Recruit 10 target users (active list pursuers with history). Ask them to:

1. Find five NH 48 peaks they have not climbed.
2. Start the list.
3. Backfill 10–20 past climbs.
4. Log one new climb.
5. Find their remaining peaks and export their record.

Positive signal: at least 6 complete the loop without help; at least 4 return within two weeks and take another record action. If not, fix the loop before adding Colorado or badges.

---

## 7. Lists

### 7.1 Catalogue discipline

The target catalogue is five lists, but a list is published only when it is complete. Public beta ships the first three; ADK 46 and Catskill 3500 follow in Phase D.

| List | Publisher | Peaks | Phase |
|---|---|---|---|
| NH 48 | Appalachian Mountain Club | 48 | A — the slice |
| Colorado 14ers | Colorado Mountain Club | 58 named | B |
| Munros | Scottish Mounting Club | 282 | C |
| Adirondack 46ers | Adirondack 46ers | 46 | D, only after the first three are stable |
| Catskill 3500 | Catskill 3500 Club | 35 | D, only after the first three are stable |

No partial list is published. A list with an unsupported rule (choice groups, winter-only membership, route requirements) is labelled **not supported** and is not shown as a completable list. Do not fake a flat list for a rule the product cannot represent.

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

`GET /api/lists/:slug` returns metadata, current version and entries (peak card fields). `GET /api/lists/:slug/progress` returns the user’s completed place IDs, dates, percentage and version. The public part is cacheable; progress is private. The page must render metadata, rules, map, table and progress without a second round trip for the public part.

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
| GET | `/api/lists/:slug/progress` | required | User progress + remaining peaks |
| GET | `/api/me` | required | Profile, units, privacy |
| PATCH | `/api/me` | required | Units, home region, privacy |
| GET | `/api/me/trips` | required | Journal |
| POST | `/api/trips` | required | Create a trip with 1..n peaks |
| PATCH | `/api/trips/:id` | required | Edit |
| DELETE | `/api/trips/:id` | required | Soft delete |
| GET | `/api/me/stats` | required | Basic stats |
| GET | `/api/me/export?format=json\|csv` | required | Export trips and progress |

Conventions: JSON; cursor pagination (`nextCursor`); ISO dates; metres stored, units rendered; RFC 7807 errors; `ETag` on public reads; `private, no-store` on `/api/me/*` and progress; httpOnly session cookie; same-origin/CSRF on mutations; no secrets or internal IDs in responses.

No photo, GPX, route, condition, report, public-profile or custom-list endpoint in the slice. Custom lists are Phase B/C.

### 10.2 Screens mapped to existing code

| Screen | Existing route + components | Slice change |
|---|---|---|
| **Globe** | `src/pages/ExplorePage.tsx`, `MapGlobe.tsx`, `Discover.tsx` | Real 48 points, preview card, list view fallback; no new hero copy. |
| **Peaks index** | `src/pages/PeaksPage.tsx`, `SearchField`, `FilterChips`, `EmptyState` | Real rows, search, simple filters, URL state. No prominence filter unless sourced. |
| **Peak detail** | `src/pages/PeakDetailPage.tsx`, `PeakDetailTemplate.tsx` | Identity, known attributes, NH 48 membership, your record, nearby, sources. No routes/conditions/photos. |
| **List library** | `src/pages/ListsPage.tsx` | NH 48 card; no fake catalogue. |
| **List detail** | new `src/pages/ListDetailPage.tsx` | Publisher/edition/rules/progress/remaining/export; map + table. |
| **Quick log** | new `src/pages/LogPage.tsx`, `LogSheet` | Three fields; multi-peak; approximate dates; save. |
| **Progress** | `src/pages/ProgressPage.tsx`, `StatCard` | NH 48 ring, remaining, recent climbs, basic stats, export. |
| **Sign in** | new `src/pages/SignInPage.tsx` | Magic link + one OAuth; return-to. |
| **Settings** | new `src/pages/SettingsPage.tsx` | Units, home region, privacy, delete. |
| **Data page** | new `src/pages/DataPage.tsx` | Sources, licences, attribution, checked dates, correction entry. |
| **Not found** | `src/pages/NotFoundPage.tsx` | Keep; add search. |

No visual regression to the shipped globe, logo, fonts, Discover overlay or content-page styling. New pages reuse the existing shell and tokens.

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
| Intent | Peaks saved / lists started | ≥ 25% of signed-in sessions |
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

---

## 12. Roadmap

The dates are estimates, not commitments. Each phase has an evidence gate; the next phase does not start because the calendar says so.

### Phase A — NH 48 vertical slice (4–6 weeks)

**Build:** schema and seed for 48 peaks, NH 48 version, auth, globe/search/peak pages, quick log, manual backfill, list progress, export, data page. No badges, photos, GPX, routes or conditions.

**Gate:** the slice test passes (6/10 complete the loop; 4/10 return); 48/48 entries sourced; export round-trips; no fabricated fields.

### Phase B — Archive depth + Colorado 14ers (4–6 weeks)

**Build:** CSV import with a documented template, edit/delete, basic stats, list-version change display, Colorado 14ers as the second complete list. No new surface beyond the existing shell.

**Gate:** 20 climbs entered in under 20 minutes; progress matches a hand count; a simulated list version change preserves the old completion; users ask for the next list.

### Phase C — Passport + Munros (3–4 weeks)

**Build:** ten launch badges, quiet badge case in `/progress`, list completion mark, simple annual recap, Munros as the third list. No hidden badges, no points, no leaderboard.

**Gate:** users value the artifact enough to keep/share it; badge awards are accurate; the Munros list is complete and sourced. If badges distract from the record, cut them back further.

### Phase D — Earn expansion (ongoing)

**Build only after the gates:** ADK 46 and Catskill 3500; more sourced lists; search and map quality; data correction workflow; SEO for list pages; optional photos/GPX; offline saved records; paid convenience experiments; public profiles if users ask.

**Do not build:** forecasts, avalanche, routes, live GPS, social feed, physical patches, print yearbooks, global prominence until the data and demand justify them.

### 12.5 Implementation plan

**Staffing assumption:** one full-stack engineer, half a designer and a part-time data steward. A solo builder runs the same sequence serially; the ranges are estimates, not promises.

| Workstream | Owner | Phase A output |
|---|---|---|
| Data and provenance | Steward + engineer | NH 48 seed, source manifest, field-level checks |
| Schema and API | Engineer | Migrations, seed loader, minimal REST endpoints |
| Auth and account | Engineer | Sign-in, settings, private-by-default account, delete |
| Explore | Designer + engineer | Real peak search, peak pages, globe integration |
| Lists | Engineer | NH 48 page, progress, remaining peaks |
| Journal | Engineer | Quick log and manual backfill |
| Trust and export | Engineer | Data page, JSON/CSV export, privacy controls |
| QA and validation | Whole team | Tests, device pass, 10-user cohort |

The order matters: **data before UI; list before journal; journal before export; export before the gate.** Do not build a screen against a seed that is not validated.

#### Phase A — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | Build the NH 48 seed and source manifest | This plan approved | 48/48 entries matched; every displayed field has an accepted source; list edition and rules captured; unknown fields explicitly null |
| 2 | Write seed and data-contract tests | 1 | Seed fails on a missing entry, duplicate ID, bad count or displayed value without provenance |
| 3 | Freeze the slice schema and seed loader | 2 | Migrations apply from an empty database; 48 places and one list version load; no platform tables |
| 4 | Build auth and settings | 3 | Sign up, sign in, sign out, units, home region, private default, delete account |
| 5 | Build peak search and peak pages | 3 | Signed-out search returns NH 48 peaks; peak page shows identity, known/unknown attributes, list membership, sources, nearby peaks |
| 6 | Build list page and progress | 4, 5 | Publisher, edition, rules, “not official” note, ring, remaining peaks, per-peak status |
| 7 | Build quick log and manual backfill | 4, 6 | A climb logs in under 20 seconds; 20 past climbs backfill in under 20 minutes; approximate dates render correctly |
| 8 | Build export and privacy controls | 7 | JSON/CSV round-trip trips, dates and list progress; signed-out users cannot read another user’s record |
| 9 | Integrate the existing globe and list fallback | 5 | 48 real points; preview card; list view works when the globe or terrain fails; mid-range phone check |
| 10 | Run the slice QA and 10-user test | 1–9 | All acceptance criteria pass; 6/10 complete the loop without help; 4/10 return within two weeks |

**Phase A definition of done:** all ten tasks complete; `npm test`, typecheck and build green; 48/48 sourced; no fabricated fields; export round-trips; no UI regression to the shipped globe, logo, fonts or Discover overlay; data page and runbook written. Phase A is **not** done if badges, Colorado, Munros, photos, GPX, routes, conditions, public profiles or a paid tier have been added.

#### Phase B — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | CSV template, parser and review screen | Phase A gate | A documented template imports, reports unmatched rows and never silently drops a climb |
| 2 | Edit, delete and duplicate protection | 1 | A trip is editable/deletable; same peak/date offers merge or keep separate; stats recompute |
| 3 | Basic stats | 2 | Summits, unique peaks, attempts, days out and list progress match fixtures |
| 4 | List-version change display | Phase A list model | A simulated publisher change preserves the old completion and shows the new remaining peaks |
| 5 | Colorado 14ers seed and validation | 1–4 | 58 named entries matched; source/edition captured; no partial list published |
| 6 | Phase B QA and gate review | 1–5 | 20 climbs imported in under 20 minutes; hand-count matches; users ask for the next list |

#### Phase C — ordered tasks

| # | Task | Depends on | Done when |
|---|---|---|---|
| 1 | Badge facts and ten-mark evaluator | Phase B gate | Ten launch badges evaluate correctly; no badge fires on empty facts; awards are idempotent |
| 2 | Badge case and quiet award reveal | 1 | Earned marks show date and source trip; no points, leaderboard, hidden criteria or confetti |
| 3 | List-completion mark | 1, 2 | Completion against a specific version is visible and permanent |
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

#### Implementation rules

- **One list at a time.** No second list ships while the first has unmatched entries.
- **No partial list.** A list publishes only when membership, source, edition and rules are complete.
- **No fabricated fallback.** Unknown stays unknown; a missing value never becomes zero or an estimate to make a screen look full.
- **No new surface without a gate.** Every addition must answer which phase gate it serves.
- **Every phase ends clean.** Tests, typecheck, build, docs, runbook, no dead code, no duplicate plan.
- **The app build has not started.** Phase A begins only after explicit approval of this plan.

### Not in v1

Routes, conditions, forecasts, avalanche, trip reports, live GPS, photo storage, GPX import, public profiles, companions, witness/steward verification, physical patches, print yearbooks, paid tier, offline map packs, 43 badges.

---

## 13. Acquisition, monetization and risk

### 13.1 Acquisition

The first 1,000 users come from list communities, not generic SEO:

- NH 48 groups, forums, clubs and Facebook communities.
- 14ers forums and Colorado hiking groups when Phase B ships.
- Munro communities when Phase C ships.
- Publisher/community partnerships for list pages.
- A small number of genuinely useful list pages and peak pages, not thousands of thin global pages.

SEO follows the list pages: “NH 48 tracker”, “NH 48 remaining peaks”, “NH 48 list changes”. A page with three database fields will not outrank established sources. The Blue Hour 50 remains an editorial project after the core loop; label it “Terrane collection”, not an official list.

### 13.2 Monetization

No paid tier at launch. The record, list progress and export are free. Test willingness to pay only after retention:

- offline saved records and map packs;
- extra photo storage;
- printed yearbook;
- physical list-completion patch.

Do not build patches or print until users have completed lists and asked. Do not promise “every future feature free forever”; promise that the user’s own record is always accessible and exportable.

### 13.3 Risks

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

### 13.4 Open decisions

| Decision | Recommendation | When |
|---|---|---|
| Second list: Colorado 14ers or Munros? | Colorado 14ers (smaller, strong community, US data) | Phase B |
| GPX import timing | After manual logging/backfill proves useful; Phase C/D | Phase C review |
| Photos | After manual record and export; not before | Phase D |
| Public profiles | Not before retention and explicit demand | Phase D |
| Paid tier | Do not design until retention; test offline/print | Phase D |
| ADK/Catskills | Only after the first three lists are stable | Phase D |

The primary user, NH 48 slice, field-level provenance, ten launch badges and this roadmap are **not** open. They are the v3.0 contract.

---

## 14. Next ten tasks

Steps 1–2 of the previous list are complete: this file is canonical and the ten launch badges are flagged and tested. These next tasks are the implementation path; the app build has not started, so tasks 1–3 are data/contract work and tasks 4–9 begin only after Phase A approval.

1. **Build the NH 48 seed.** Reviewed JSON/CSV with 48 names, coordinates, elevation sources, highpoint flag, list membership and publisher edition. *Output:* 48/48 matched; every displayed field sourced; unknown allowed.
2. **Write the data-contract tests.** Seed validation, unique IDs, list count, no missing entries, no fabricated fields, provenance required for displayed values. *Output:* the seed fails loudly before it can publish.
3. **Freeze the slice schema and seed loader.** `place`, `peak`, `place_name`, `place_provenance`, `region`, `place_region`, `list`, `list_version`, `list_entry`, `app_user`, `trip`, `trip_peak`. *Output:* migrations apply from empty; no platform tables.
4. **Build auth and settings.** Magic link plus one OAuth provider, private-by-default account, units, home region, delete. *Output:* sign-up to first record works; signed-out users cannot read another record.
5. **Build peak search, peak pages and globe integration.** Real 48 points, preview card, known/unknown attributes, sources, list membership, nearby peaks, list-view fallback. *Output:* signed-out discovery works on a mid-range phone.
6. **Build the NH 48 page and progress.** Publisher, edition, rules, “not official” note, ring, remaining peaks, per-peak status. *Output:* progress matches a hand count.
7. **Build quick log and manual backfill.** Peak(s), date precision, outcome, save; 20 past climbs without a modal per climb. *Output:* log under 20 seconds; backfill under 20 minutes.
8. **Build export and privacy controls.** JSON/CSV round-trip of trips, dates, list progress and unknown attributes; delete account path. *Output:* a user can leave with their record.
9. **Run the slice QA and 10-user test.** All acceptance criteria, device pass, 6/10 complete the loop, 4/10 return. *Output:* evidence for the Phase A gate.
10. **Run the Phase A gate review.** If the gate passes, start Phase B (CSV import, edit/delete, stats, Colorado 14ers). If it fails, fix the loop; do not add Colorado, badges or a paid tier.

When these ten are done, Terrane has one verified list, one honest data contract and a testable loop. That is the right foundation for the app build — not a 469-peak platform built on assumptions.

---

## Sources

- Yak — list tracking and patches: https://yakapp.co/
- Peakery — global peak atlas: https://peakery.com/
- AMC — White Mountain 4,000-Footers: https://www.outdoors.org/
- OpenStreetMap — copyright and licence: https://www.openstreetmap.org/copyright
- GeoNames: https://www.geonames.org/
- Wikidata: https://www.wikidata.org/
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
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
| **Record keeper** | A user who logs, edits, backfills or meaningfully reviews their climbing record. |
| **Slice** | The NH 48 end-to-end product used to prove the loop before expanding. |
| **Supported list** | A list whose membership and rules Terrane can represent accurately and source. |
