# Terrane — Product Plan

- **Status:** current · v4.0 · 28 November 2026
- **Supersedes:** v3.0 and its phased global-atlas roadmap
- **North star:** people trust Terrane with their real climbing history and return to keep it current.

## What Terrane is

A private, list-aware record of mountains. Terrane helps someone who is already pursuing named peak lists consolidate their history, understand their progress, and keep a record worth returning to.

The globe and catalogue are the way in. The record is the product.

This phase is deliberately not a global peak directory. The previous global-atlas roadmap is retired as a commitment; expansion is a later decision, made only after the current record earns it.

## Current goals

1. **Make the record trustworthy.** Every climb, list count, completion and export should be correct and easy to inspect. No fabricated fields, no silent data loss.
2. **Finish the interface.** One clear primary action per screen, less explanatory copy, a calm signed-in state, and a mobile layout that holds at 320 px without horizontal overflow.
3. **Make accounts dependable.** Passkey creation, recovery, cross-device return, export and deletion must work without a password or an email dependency.
4. **Make operations clear.** One canonical account deployment, a static Vercel mirror that reloads correctly, current docs, no dead code or contradictory plans.
5. **Earn the next expansion.** Complete real-device validation, the legal/data review and a small-user cohort before adding new surfaces or lists.

## Who it serves

The list-driven climber with an existing history: roughly 30–200 summits, one to three active lists, and records spread across a spreadsheet, an old app and memory. They want a count they trust, a history they can consolidate, and a record that looks worth keeping.

The curious visitor can use the globe and catalogue without an account. Guest browsing is supported; a guest record is never uploaded implicitly.

## What is shipped

| Surface | Current state |
|---|---|
| **Explore** | Blue-hour MapLibre globe, Discover search and catalogue entry points. |
| **Peaks** | 467 sourced summits across five complete lists, with search, filters, sorting and detail pages. |
| **Lists** | NH 48, Colorado 14ers (58 named), Munros (282), Adirondack 46 and the current Catskill 33. Publisher, edition and rules stay visible. |
| **Log** | Quick log, historical backfill, edit and delete, with day/month/year precision. |
| **Progress** | Started-list rings, current-list focus, days out, completions, annual recap, ten launch marks and JSON/CSV export. |
| **Import** | Documented CSV import with row-level errors and duplicate merge/keep/skip review. |
| **Settings** | Passkey account, display name, units, sync status, local-record import, export and account deletion. |
| **Accounts** | WebAuthn passkeys plus a one-time recovery key; D1-backed profiles, revisioned records and sessions. |

Release checks: `npm test` (87 tests) and `npm run build` pass. The deployed preview browser pass covers account creation, persistence, recovery, deletion and 320/390/desktop layouts.

## Product rules

- **The record comes first.** Discovery should lead to a climb, a list or a record action; it should not become a separate product.
- **One primary action per screen.** Secondary actions are quiet. Do not duplicate the same CTA in the header and page body.
- **Quiet over clever.** The visual identity is the blue-hour globe, the diamond mark, restrained type and generous space. No game layer, feed or points.
- **Private by default.** No public profiles, location sharing, analytics pixels or third-party tracking. Export and delete remain first-class.
- **Mobile is the primary shell.** The five-item bottom navigation, compact header and full-screen Discover are part of the product, not a fallback.
- **Truth over completeness.** A missing field stays unknown. A list ships only when membership, source, edition and rules are complete.
- **No new surface without evidence.** A feature must answer a current goal or a named open gate.

## Architecture

- React 19 + TypeScript + Vite SPA, React Router, MapLibre GL.
- Hono API in a Cloudflare Worker, deployed through Freebuff Sites.
- Cloudflare D1 for profiles, revisioned user records, sessions, WebAuthn credentials, challenges and recovery-key hashes.
- Passkey-first auth; no passwords, magic links or OAuth. A 32-byte recovery key is shown once and stored only as a hash.
- Catalogue data is bundled and audited in TypeScript seeds; list provenance lives in `docs/data-sources.md`.
- No Postgres/PostGIS, Neon or Better Auth dependency exists in the current build. Those are not current commitments.

## Deployments

| Environment | Role |
|---|---|
| **Freebuff Sites preview** — `terrane-record-qvlmth-preview.freebuff.site` | Canonical account environment. D1, passkey API and the full app. |
| **Freebuff Sites production** — `terrane-record-qvlmth.freebuff.site` | Not published. Starts with an empty D1 database. Publishing is an owner decision. |
| **Vercel** — `terrane-r2d2.vercel.app` | Static SPA mirror. Catalogue and guest browsing work; `/api/*` is absent, so accounts do not work there. `vercel.json` provides the history fallback for reloads. |

Preview and production are separate WebAuthn origins. Passkeys created on one do not authenticate on the other.

## Open gates

| Gate | Why it matters | State |
|---|---|---|
| **Real-device passkey pass** | The browser pass used a software authenticator, not Face ID, Touch ID or a hardware key. | Open |
| **Legal and licensing review** | Publisher facts, source attribution and any future open-data layer need a defensible posture before public launch. | Open |
| **10-user cohort** | The core loop has not been tested with target users or measured for retention. | Open |
| **Production publication and restore** | Production is unpublished; a post-publish health, isolation and D1 restore check is still required. | Open |
| **Vercel account decision** | The Vercel mirror cannot create accounts. Either give it a backend or label it clearly as a static preview. | Open |

## Measures

No analytics collection is configured. The next validation round should answer:

- Can a new user start a list and log or backfill a climb without help?
- Does a user return within 30 days to update the record?
- Are list counts and completions trusted without manual correction?
- Can a user export, delete and recover without confusion or data loss?
- Does the mobile flow hold at 320 px and 390 px?

## Not now

Global atlas ingestion, additional peak lists, public profiles, social features, routes or conditions, photos, GPX, offline maps, custom-list building, paid tiers, native apps and the full badge backlog.

These are not rejected forever. They are deferred until the current record is validated.

## Next decision

The next step is a scope conversation, not a committed roadmap. The questions are:

1. Publish the Sites production environment, or keep the preview as the only account environment?
2. Give Vercel a real backend, or reduce it to an explicitly static mirror?
3. Run the real-device passkey and 10-user validation now, or finish more interface work first?
4. What did the first cohort actually ask for that the current five lists and record do not provide?
5. Which expansion is worth earning next: deeper archive tools, another list, or broader discovery?

Until those are answered, do not add a new product surface.

## Reference

- [Runbook](runbook.md) — local setup, deployment, storage, data changes, verification.
- [Data sources](data-sources.md) — list membership, provenance, licences and CSV format.
