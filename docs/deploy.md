# Deploying Terrane

The site is a static Vite build: `npm run build` writes `dist/`, and that
directory is the whole deployment. There is no server, no database and no runtime
API key in the browser.

Three pieces sit outside the repository:

| Where | What it does | Configured by |
| --- | --- | --- |
| **Vercel** | Builds the branch and serves `dist/` | `vercel.json`, `SITE_URL`, `VITE_POI_BASE` |
| **GitHub Actions** | Refreshes the data on a cron | the data workflows, `POI_BUCKET` + `POI_UPLOAD_TOKEN` |
| **Cell store** | Serves the POI/trail cells and live JSON at runtime | `infra/cell-store/`, a Sites project in front of R2 |

The site and the store are independent: a failed Vercel build never touches the
store, and a failed data run never touches the site. Because the store can lag a
deploy, the app only accepts its live manifest when it is at least as new as the
bundled one; otherwise the bundled counts win.

## Vercel

1. Import the repository as a Vite project.
2. Root directory: the repository root.
3. Install `npm ci`, build `npm run build`, output `dist` — all in `vercel.json`.
4. Node 22 — `.nvmrc` pins it; `engines.node` accepts 20 and newer.
5. Production branch: `main`. Other branches get preview deployments.

`vercel.json` supplies the three things a Vite SPA needs:

- **Rewrite the app paths to `/index.html`**, so `/place/denali`, `/lists` and
  `/coverage` reach the router. Real files in `dist/` are served first, and the
  rewrite explicitly excludes `/assets/*` and `/fonts/*`: a missing hashed asset
  returns 404 instead of the HTML shell with a year-long immutable cache.
- **Caching**: `/assets/*` is content-hashed and immutable for a year; `/fonts/*`
  gets a week.
- **Fresh HTML**: the shell at `/`, `/index.html`, `/place/*`, `/experiences/*`,
  `/log` and `/coverage` is `no-store`, so a deployment switch cannot leave a
  browser on an old shell that points at removed assets.
- **Removed URLs**: `/experiences` (the old catalogue index) and `/collections*`
  answer with a permanent redirect to `/` before the rewrite. `src/lib/router.ts`
  repeats it on hosts without this config; the curated
  `/experiences/:slug` detail pages are not redirected.

### Environment variables

| Name | Required | What it does |
| --- | --- | --- |
| `SITE_URL` | no | Absolute canonical, `og:url`, `og:image` and sitemap, e.g. `https://terrane.app`. Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`, so a deploy works without it; a build with neither writes the sitemap against the documented placeholder origin so the file is never missing. |
| `VITE_POI_BASE` | no | The cell-store origin. Defaults to the published preview store in `src/lib/cells.ts`. Inlined at build time; changing it needs a redeploy. |

Neither is a secret. Do not put a GitHub token or the store's upload token in a
Vercel variable: the browser bundle cannot keep one.

### Preview deployments

A pull request gets a preview URL built with `SITE_URL` unset; the Vercel fallback
keeps canonicals absolute. The preview reads the same public cell store as
production. That is deliberate: the store is read-only to the site.

### Rollback

Vercel → Deployments → the last good one → **Promote to Production**. The build is
static, so a rollback is immediate and does not need a revert commit. If the bad
deploy carried a `src/data/` change, the promoted build carries the older data
with it.

## The cell store

The Worker and its deploy manifest live in `infra/cell-store/`. It uses a Sites
project with an R2 binding named `FILES` and a secret named `UPLOAD_TOKEN`.

Current state, verified 2026-11-19:

- **Preview** is published at
  `https://terrane-poi-cells-mqa53q-preview.freebuff.site` and is the app default.
- **Production** is unpublished and empty.
- Account R2 usage is ~700 MB of a 1 GB allowance (382 MB POI, 317 MB trails).

Do not publish production by copying the bucket: a second full copy would exceed
the quota. Promoting production is a migration decision — move or shrink the
objects first, then update the default in `src/lib/cells.ts` and redeploy. Until
then the preview URL is the canonical data origin, not a temporary accident.

Uploads go through `PUT /upload/{key}` with the `x-upload-token` header. The
Worker only accepts the known prefixes and live keys. `scripts/upload-changed.mjs`
hashes files against `upload-manifest.json` and only sends what changed; it writes
the state file only after every changed file succeeded.

## GitHub Actions

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` | push to `main`, every PR | typecheck, tests, data validate, full build, upload `dist` |
| `data-weekly.yml` | Mondays 03:17 UTC | world OSM harvest, 12 shards, assemble and publish cells |
| `data-daily-us.yml` | daily 05:41 UTC | Recreation.gov export → cells |
| `data-monthly-trails.yml` | 2nd of the month, 04:23 UTC | trail lines from OSM routes, NPS, USFS and BLM |
| `data-monthly-agency.yml` | 3rd of the month, 04:53 UTC | USFS, BLM, Parks Canada and national records |
| `coverage.yml` | daily 07:09 UTC | the gap register from the published manifests |

The data workflows share `concurrency: terrane-data` and never cancel in
progress. None of them push commits; a data refresh cannot block a code merge.

### Repository secrets and variables

| Name | Type | Used by |
| --- | --- | --- |
| `POI_BUCKET` | secret | every data workflow and coverage |
| `POI_UPLOAD_TOKEN` | secret | same |
| `SITE_URL` | variable, optional | `ci.yml`, so the artifact build matches Vercel |

### Checks before a deploy

`ci.yml` runs exactly:

```bash
npm ci
npm run typecheck
npm test
npm run validate
npm run build
```

`npm run check` is typecheck + tests + validate locally. `npm run audit` and
`npm run data:coverage` are reports, not build gates.

## Branches

- `main` is the production branch and must be green.
- Work on a branch, open a PR, let `ci.yml` pass, then merge.
- A data refresh is a separate workflow and never rewrites the app.
