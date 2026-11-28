# ADR-003: Phase A accounts and persistence on D1 + passkeys

- **Status:** Accepted for Phase A
- **Date:** 2026-11-28
- **Deciders:** Terrane product/engineering
- **Related:** ADR-001 (target stack), ADR-002 (data licensing), `docs/product-plan.md` §5.3 and §12

## Context

The product plan's target stack is Postgres 17 + PostGIS on Neon with Better Auth. The shipped app
was still a local-only record: profile and trips lived in `localStorage`, and the UI told users that
accounts were not configured. Phase A cannot be complete while a refresh, a second device or a new
browser loses the record.

Two target-stack dependencies were not available in this workspace:

- No Neon project, Better Auth secret or migration credentials were provisioned.
- A Freebuff OIDC sign-in was mounted and reached the identity provider, but browser verification
  cannot be completed without the user signing in with a Google/GitHub account. A phase cannot be
  called verified if the only account path needs private provider credentials and an external
  session.

The app is deployed on **Freebuff Sites**, which provides an isolated D1 database per environment
and a Workers-compatible fetch runtime. That is enough for a real Phase A account layer without a
mock or a local-only record.

## Decision

1. **Storage:** Phase A account profiles, records, sessions, WebAuthn credentials, challenges and
   recovery-key hashes live in **Cloudflare D1** through the Sites `DB` binding. The peak catalogue
   stays bundled and audited; it is not copied into D1.
2. **Accounts:** use **WebAuthn passkeys** (platform authenticator or security key) with a one-time
   recovery key. There is no password, email magic link or OAuth dependency in Phase A.
   - Registration and authentication options are generated server-side with
     `@simplewebauthn/server`; the browser uses `@simplewebauthn/browser`.
   - The server verifies the challenge, origin, RP ID, user presence, credential public key and
     assertion signature. Challenges are single-use, expire after five minutes and are stored in D1.
   - Resident credentials are required, so sign-in can use a discoverable passkey.
   - A 32-byte recovery key is returned once at account creation, stored only as a SHA-256 hash, and
     can be rotated from Settings. It is the cross-device fallback when the passkey is unavailable.
3. **Sessions:** random 32-byte bearer tokens in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. D1
   stores only the SHA-256 hash, with a 30-day expiry. Sign-out deletes the session row. Mutating
   requests require the same origin; the API also returns `Cache-Control: private, no-store`.
4. **Record shape:** one validated JSON document per user plus an integer revision. The server
   parses every write with the catalogue schema (all 467 peaks and all five lists), then performs an
   atomic compare-and-swap on the revision. A stale write returns `409` with the current record so
   the client can merge rather than overwrite.
5. **Migration from the local build:** guest browsing remains. A pre-account `localStorage` record
   can be merged into an account from Progress or Settings; it is never uploaded implicitly.
6. **Account deletion:** deletes the profile, record, sessions, passkeys, recovery key and pending
   WebAuthn flows. Export remains available before deletion.
7. **Scope:** this is the Phase A record layer, not the global atlas store. The catalogue is still
   client-side and the target Postgres/PostGIS schema remains the destination for Phase E scale.

## Consequences

- A fresh account works on any device with a passkey or the recovery key; a reload does not lose the
  record; two accounts are isolated by user id and session.
- Preview and production are different WebAuthn RP IDs. A passkey created on the preview host does
  not authenticate against production, which is expected and prevents cross-environment credentials.
- There is no email verification or account-recovery email. The recovery key is the explicit
  fallback; a user who loses both the passkey and the key can create a new account, but cannot
  recover the old record. This is stated in the account UI.
- D1 is SQLite, not PostGIS. The Phase A catalogue and record do not need spatial SQL. A move to
  Postgres is required before global spatial search, and the record document would move behind a
  migration rather than being treated as the final schema.
- The plan's Better Auth target is not used in this deployment. No password tables, OAuth client
  secrets or duplicated credential model were added. A future move to Better Auth must preserve the
  passkey-first, no-password posture or migrate credentials deliberately.
- The 10-user validation cohort and the legal/licensing review are still external gates; this ADR
  does not claim they passed.

## Alternatives considered

| Alternative | Why not chosen |
|---|---|
| **Freebuff OIDC** | Real, but browser verification requires a private Google/GitHub/Freebuff session that this workspace does not have. Shipping an unverified account path would fail the phase's own gate. |
| **Better Auth on D1** | Credible, but would add another auth schema and migration layer for one Phase A deployment; the passkey flow is small, auditable and fully exercisable here. Revisit when the Postgres target is provisioned. |
| **Neon + Better Auth** | The target stack, but no database or auth credentials were available, so it could not be built or verified in this turn. |
| **Local-only record** | Already shipped and explicitly incomplete: the record is lost on a new browser and cannot be called a real account. |
| **Password accounts** | Adds reset, breach and hashing scope the product does not need; passkeys and a recovery key cover the Phase A loop. |

## Verification

- `src/server/auth-api.test.ts` exercises registration, session persistence, record revisioning,
  logout, passkey return, recovery, key rotation, account isolation and deletion against a real
  Miniflare D1 database.
- The deployed preview was driven in a Cloud browser with a software WebAuthn authenticator that
  produces valid attestations and assertions: fresh account, empty state, saved climb, reload,
  sign-out, passkey return, recovery-key return in a separate context, account deletion, and
  320/390/desktop layout checks.
- `npm test` and `npm run build` are the release checks.

## Follow-ups

1. Publish production only after the owner authorizes it; production starts with an empty D1 and a
   different RP ID.
2. Complete the Phase A validation gate: legal/licensing review, server-side gate events and the
   10-user cohort.
3. Decide whether the Phase E migration keeps the D1 record document or moves accounts to the
   Postgres/Better Auth target. Do not run both credential stores.
