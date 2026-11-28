# ADR-001: Stack

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Terrane product/engineering
- **Supersedes:** the provisional stack table in the previous product plan
- **Phase A exception:** [ADR-003](ADR-003-phase-a-accounts.md) deploys the current record/account layer on Cloudflare Sites D1 with WebAuthn passkeys because Neon/Better Auth credentials were not available. The target stack below is unchanged for the global atlas.

## Context

The shipped app is a React 19 + TypeScript 7 + Vite 8 SPA with React Router 7 and MapLibre GL 6. It renders the legacy blue-hour globe and the Peaks/Lists/Progress shells, with no server, database, auth or data layer. Phase 1 needs a real peak index with geospatial search, field-level provenance, and a read-heavy public atlas. Phases 2–4 add accounts, a trip journal, list progress, badges and exports.

The decisive constraints:

- PostGIS-class spatial queries and full-text search over hundreds of thousands of peaks.
- Relational integrity for peaks, list versions, trips, trips-to-peaks and badge awards.
- Field-level provenance that can be audited and exported.
- A small team operating a low-ops system with a free/cheap development tier.
- No fabricated records, no proprietary peak database, no vendor lock-in on user data.

## Decision

1. **Web:** keep the existing React 19 + Vite 8 + TypeScript SPA. Extend it; do not rewrite it. MapLibre GL 6 stays, with OpenFreeMap vector tiles and the existing terrarium terrain.
2. **API:** a separate Hono service on Node 22, deployed as Vercel Functions, with Zod validation and REST endpoints under `/api`. A separate service keeps the static SPA cacheable and the API testable.
3. **Database:** Postgres 17 with the **PostGIS** extension on **Neon**. PostGIS provides `geography`, GiST indexes, `ST_DWithin`, `ST_Intersects` and viewport queries; Postgres provides relational integrity, full-text search, `pg_trgm` and transactional list versioning.
4. **ORM/migrations:** Drizzle ORM with plain SQL migrations under `db/migrations`. Forward-only, reviewed, applied in CI against a disposable database.
5. **Search:** Postgres full-text search (`tsvector`) plus `pg_trgm` and `unaccent`, backed by a materialised `peak_search` document. No separate search cluster at launch.
6. **Auth:** Better Auth with email magic links plus Google/Apple, httpOnly session cookies, owned auth tables in the same Postgres database. No passwords in v1.
7. **Files:** Cloudflare R2 with signed uploads; originals retained, derivatives generated server-side; EXIF stripped by default.
8. **Hosting:** Vercel for the SPA and API; Cloudflare R2 for objects. Preview deployments use a Neon branch.
9. **Observability:** Sentry for client/API errors, structured JSON logs, uptime checks, slow-query logging, and a data-quality dashboard fed by the ingest QA report.
10. **Testing:** Vitest for units and contract tests; a small Playwright suite for sign-in, log a trip, progress, list completion and export. Pipeline tests are fixture-based and run without network access.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **Cloudflare D1 + SQLite** | No PostGIS; spatial queries become geohash buckets and application-side distance. Fine for a demo, a migration risk for a global atlas. |
| **Firebase / Firestore / MongoDB** | Document stores do not give relational integrity across peaks, list versions, trips and awards; geospatial and transactional list-version guarantees are weaker. |
| **Convex** | Excellent reactive BaaS, but SQL/PostGIS and portable relational reporting are central to this product; a proprietary backend also weakens the data-export promise. |
| **Supabase all-in-one** | Credible, but couples auth, storage and database policy; the team wants the API and auth portable and the database directly auditable. Revisit only if ops cost dominates. |
| **Rewrite as Next.js** | The UI is shipped and the globe is a client-side MapLibre app. SSR is an SEO optimization, not a Phase 1 requirement; a rewrite would delay the atlas. |
| **Commercial peak database** | Expensive, opaque provenance, and incompatible with the "every number has a source" promise. |

## Consequences

- **Positive:** one spatial database for the atlas and the journal; SQL transactions make versioning and completions provable; provenance is a first-class table; the front end keeps its verified visual state; the stack is portable (standard Postgres, standard S3 API, framework-agnostic auth).
- **Negative:** two deployables (web + API) and a connection-pooling step (Neon serverless driver or pooled connection string); PostGIS extension management; R2 credentials and signed-URL code; more infrastructure than a single BaaS.
- **Neutral / follow-ups:** validate the Vercel Functions runtime with a latency test in Phase 1 and revisit only if it misses the budget; add SSR/prerender for public peak pages only if organic traffic proves the SPA ceiling; revisit a managed search service only if Postgres FTS misses the p95 budget.
- **Non-negotiable:** no production write from a test fixture; no schema change without a migration; no secret in the repository or client bundle.
