# Terrane runbook

## Local

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3001 --strictPort
npm test
npx tsc -b
npm run build
```

Node 20+ is required. Vite serves the SPA; MapLibre loads the blue-hour OpenFreeMap style and Mapzen terrarium terrain. The map can take several seconds to render on first load.

The local Vite server has no D1 binding. Guest browsing, the catalogue and the record UI work, but `/api/me` is signed out and account creation returns 503. Exercise account flows on the deployed Site preview.

## Deployment

### Freebuff Sites

`npm run build` typechecks, builds the SPA and bundles the Sites Worker to `dist-worker/index.js`. `freebuff.deploy.json` is the deploy manifest; `dist-worker` and `dist` are generated, not committed.

- Site: **Terrane Record** (`69992688-02bb-4bdc-925a-a27ade5ad275`).
- Preview: `https://terrane-record-qvlmth-preview.freebuff.site` — published from this workspace and the canonical account environment.
- Production: `https://terrane-record-qvlmth.freebuff.site` — **not published**; starts with an empty D1 database.
- Both environments have a D1 `DB` binding. Passkeys are bound to the origin, so preview and production accounts are separate.

Publishing production is an owner decision. After an authorized publish, check `/api/health` (expect `{"ok":true,"storage":"d1","accounts":"passkey"}`), create a passkey account, save a climb, reload, sign in with the passkey, sign out, and sign in with the recovery key in a separate browser context.

### Vercel static mirror

`https://terrane-r2d2.vercel.app` builds the SPA from `main`. It has no Worker, D1 binding or `/api/*` backend, so accounts do not work there. `vercel.json` rewrites every non-API path to `index.html`; this is what makes nested routes survive a reload. The rewrite deliberately excludes `/api/*` so missing API routes return a real 404 instead of the HTML shell.

Do not test account flows on the Vercel URL. Verify `/`, `/progress`, `/lists/nh48`, `/peaks/mount-washington`, `/settings` and `/about/data` return HTML, and `/api/me` remains a non-HTML 404.

## What is stored

- **D1 `profiles`** — user id, display name, optional email label, units and creation time.
- **D1 `user_records`** — one validated JSON record per user and an integer revision. The API uses a compare-and-swap on the revision; a stale write returns 409 with the current record.
- **D1 `sessions`** — SHA-256 hashes of 32-byte session tokens, expiry and user id. The raw token is only in the `terrane_session` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, 30 days).
- **D1 `webauthn_credentials`** — credential id, public key, counter, transports and backup flags. Private keys never leave the authenticator.
- **D1 `webauthn_flows`** — single-use registration/authentication challenges, five-minute expiry.
- **D1 `recovery_keys`** — SHA-256 hash of the one-time recovery key; the plaintext is shown once.
- **`localStorage` `terrane.record.v1`** — guest record and pre-account record. It is not uploaded unless the user chooses Import from Settings or Progress.
- **`localStorage` `terrane.units.v1`** — guest elevation-unit preference (`imperial` or `metric`). Signed-in accounts keep the same choice on the profile.
- No third-party analytics, pixel, email provider or PII collection is configured.

Signing out deletes the D1 session; it does not delete the record. Delete account removes the profile, record, sessions, passkeys, recovery key and pending WebAuthn flows.

## Accounts and recovery

- Creation returns a 43-character recovery key once. Store it outside the browser before leaving the screen. Settings can rotate it, which invalidates the previous key immediately.
- A passkey can be added from Settings on another device while signed in. Sign-in uses discoverable credentials.
- Lost passkey + lost recovery key = no account recovery. The record can still be exported while signed in; the account can be deleted and recreated, but the old record cannot be recovered.
- The API rejects mutating requests whose `Origin` is not the deployed origin. Responses are `private, no-store`.

## Data changes

1. Update the seed in `src/data/nh48.ts`, `src/data/co14ers.ts`, `src/data/munros.ts`, `src/data/adk46.ts` or `src/data/catskills.ts`, then register it in `src/data/lists.ts`.
2. Keep the publisher, edition, version, rules and source URL explicit.
3. Update `docs/data-sources.md`.
4. Add or update a contract test. A list fail must fail on count, duplicate slug or missing provenance.
5. Run tests, typecheck and build before shipping.

The Catskill list is the current 33-peak roster after the 2021 revision. Do not restore Graham or Doubletop; the four winter repeats are a membership rule, not extra entries.

Colorado and New Hampshire share a peak name (Mount Lincoln), so slugs are globally unique: `mount-lincoln` is New Hampshire and `mount-lincoln-co` is Colorado.

## CSV import

Settings → Import CSV. Use the in-app template or the format in `docs/data-sources.md`. Review reports bad rows by number. Duplicate rows can merge into the existing trip, stay separate or be skipped; nothing commits until the review action.

## Verification

Last checked 28 November 2026:

- `npm test` — 85 tests across 19 files, including the D1 repository and the passkey account API against Miniflare D1.
- `npm run build` — SPA and Worker bundle succeed; the only warning is the existing MapLibre chunk size.
- Deployed preview browser pass — fresh passkey account at 320 px, empty record, saved NH 48 climb, reload persistence, sign-out, passkey sign-in with the same credential, recovery-key sign-in in a separate context, and account deletion. Layout checks at 320, 390 and 1440 px showed no horizontal overflow; `Discover` and the compact account header remained intact.
- The WebAuthn browser pass used a software authenticator producing valid attestations and assertions; the server verified them with `@simplewebauthn/server`. This is not a real Face ID/Touch ID hardware test.

Vercel static mirror checked on the same date:

- `/`, `/progress`, `/lists/nh48`, `/peaks/mount-washington`, `/settings` and `/about/data` returned `200 text/html`; browser reloads rendered the app rather than Vercel's 404.
- `/api/me` remained `404 text/plain`, confirming the API exclusion.

Not present or not run:

- Production publication and a production D1 restore/export check.
- The legal and licensing review.
- The 10-user cohort and retention measurement.
- A real Face ID/Touch ID/hardware-key pass; the browser pass used a software authenticator.
- Automated browser tests in the repository; the browser pass was manual/scripted in the Cloud browser.

## Recovery

The JSON export contains the profile, all five list progresses, list starts and every trip with display dates and peak names. Keep it before deleting an account or clearing browser storage. CSV export is one row per trip peak and can be imported back through the documented template.

If the Worker returns 500s after a deploy, inspect the Sites deployment receipt and the Worker logs. `ensureSchema` creates missing D1 tables on first request; it does not migrate a table that already exists. A schema change needs an explicit D1 migration, not a rename of an existing column.
