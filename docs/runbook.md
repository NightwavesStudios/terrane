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

## What is stored

- Key: `terrane.record.v1` in `localStorage`.
- Contents: local profile, started list IDs, list-start edition/membership snapshots and trips.
- Signing out or deleting the record removes this local state.
- Nothing is sent to a server in this build. Production auth, Postgres/PostGIS, email and deployment credentials are not configured here.

## Data changes

1. Update the seed in `src/data/nh48.ts` or `src/data/co14ers.ts`.
2. Keep the publisher, edition, version, rules and source URL explicit.
3. Update `docs/data-sources.md`.
4. Add or update a contract test. A list fail must fail on count, duplicate slug or missing provenance.
5. Run tests, typecheck and build before shipping.

Colorado and New Hampshire share a peak name (Mount Lincoln), so slugs are globally unique: `mount-lincoln` is New Hampshire and `mount-lincoln-co` is Colorado.

## CSV import

Settings → Import CSV. Use the in-app template or the format in `docs/data-sources.md`. Review reports bad rows by number. Duplicate rows can merge into the existing trip, stay separate or be skipped; nothing commits until the review action.

## Verification that is not present

- No production account, database, email delivery, preview deployment or 10-user cohort exists in this workspace.
- No retention or “users ask for the next list” gate can be empirically passed here.
- The visual check was performed in the Cloud browser; automated DOM/e2e suites are not part of this repository.
- The global atlas and experiences remain gated by sourcing, licensing and regional publication; they are not claimed as shipped.

## Recovery

The JSON export contains the profile, both list progresses, list starts and every trip with display dates and peak names. Keep it before clearing browser storage. CSV export is one row per trip peak and can be imported back through the documented template.
