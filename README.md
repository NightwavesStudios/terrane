# Terrane

A quiet record of mountains: a blue-hour globe, five complete peak lists, a
private climbing journal, a passport of marks and a portable archive. The home
page remains the camera, terrain and a small Discover panel; the record is the
through-line.

## Sections

- **Explore** — the interactive globe, Discover search and all catalogue peaks.
- **Peaks** — 467 sourced summits with search, list filters, sorting and detail pages.
- **Lists** — the New Hampshire 48, 58 named Colorado 14ers, 282 Munros, Adirondack 46 and current 33-peak Catskill 3500, each with explicit start, rules, edition and progress.
- **Progress** — started-list rings, days out, ten launch marks, annual recaps, list completions and JSON/CSV export.
- **Log** — quick log, history backfill, edit and delete, with date precision preserved.
- **Import** — documented CSV import with unmatched-row reporting and duplicate merge/keep/skip review.
- **Settings** — passkey account, name and units, sync status, local-record import, export and account deletion.

## Accounts and storage

Sign-in is a WebAuthn passkey (Face ID, Touch ID, Windows Hello or a security
key) plus a one-time recovery key shown at account creation. There is no
password, magic link or OAuth dependency. Profiles, records, sessions, passkeys
and recovery hashes live in a Cloudflare D1 database through the Freebuff Sites
deployment; the browser keeps only the session cookie (`HttpOnly`, `Secure`,
`SameSite=Lax`) and the pre-account guest record in `localStorage` under
`terrane.record.v1`.

A guest record can be merged into an account from Progress or Settings; it is
never uploaded implicitly. Export always remains available and account deletion
removes the profile, record, passkeys, sessions and recovery key.

The Sites preview is the canonical account environment. Production is not
published. The Vercel build is a static mirror: catalogue and guest browsing
work, but it has no `/api/*` backend, so account creation and sign-in do not work
there. Passkeys are bound to their origin, so preview and production accounts
are separate even after production is published.

## Deployment

- **Preview (canonical):** `https://terrane-record-qvlmth-preview.freebuff.site` — Sites Worker, D1 and passkey API.
- **Production:** `https://terrane-record-qvlmth.freebuff.site` — not published; starts with an empty D1 database.
- **Vercel mirror:** `https://terrane-r2d2.vercel.app` — static SPA only. `vercel.json` rewrites non-API routes to `index.html` so reloads work; `/api/*` is deliberately excluded.

## Data

Only real sourced data is seeded. New Hampshire membership is from the AMC 2026
list via NH48.info; Colorado is 58 named fourteeners from 14ers.com with NGS
2024 elevations; the Munros are the SMC 282 list with DoBIH v18 facts (CC BY
4.0); the Adirondack 46 follows the 46ers list; the Catskills use the current
33-peak club list, not the old 35. The Colorado 58/53/54 prominence distinction
and the Catskill 2021 revision are stated rather than hidden. See
[docs/data-sources.md](docs/data-sources.md) and the in-app `/about/data` page.

## Commands

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3001 --strictPort
npm test
npx tsc -b
npm run build
```

`npm run build` typechecks, builds the SPA and bundles the Sites Worker into
`dist-worker/index.js`; `freebuff.deploy.json` is the deploy manifest. The
client-only `npm run dev` keeps guest browsing but has no D1 binding, so account
flows are exercised on the deployed Site preview.

Node 20+ is required. The globe uses MapLibre, the blue-hour OpenFreeMap style
and public Mapzen terrarium terrain; allow a few seconds for the first render.
MapLibre is a separate lazy-loaded chunk, so the production build warns about
its chunk size.

## Documentation

- [Product plan](docs/product-plan.md) — current goals, shipped scope, open gates and next decisions.
- [Runbook](docs/runbook.md) — deployment, storage, account recovery, data changes and verification.
- [Data sources](docs/data-sources.md) — list provenance, licences and CSV format.
