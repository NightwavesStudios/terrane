# Deploying Terrane

The site is a static build: `npm run build` writes `dist/`, and that directory is
the whole deployment. There is no server, no database and no runtime API key.

Three things sit outside this repository and together they serve a visitor:

| Where | What it does | Configured by |
| --- | --- | --- |
| **Vercel** | Builds `main` and serves `dist/` | `vercel.json`, `SITE_URL` |
| **GitHub Actions** | Refreshes the data on a cron | the four `data-*` workflows, `POI_BUCKET` + `POI_UPLOAD_TOKEN` secrets |
| **Cell store** | Serves the POI and trail cells the app fetches at runtime | `poi-bucket/worker.js`, a Cloudflare Worker in front of R2 |

Nothing else is involved. The cell store is independent of the deploy: a failed Vercel
build never touches the cells, and a failed data run never touches the site.

---

## Vercel

The project is not linked yet. To create it:

1. **Add New → Project → Import** `NightwavesStudios/terrane`.
2. Framework preset: **Vite** (Vercel reads the rest from `vercel.json`).
3. Root directory: the repository root. Install `npm ci`, build `npm run build`,
   output `dist` — all already set in `vercel.json`; only override if the panel
   disagrees.
4. Node version: **22**. Vercel reads `engines.node` from `package.json`; `.nvmrc`
   pins the same version for local work and CI.
5. Production branch: `main`. Every other branch gets a preview deployment.

`vercel.json` also does the two things a Vite SPA needs and a bare static host
does not:

- **Rewrite `/(.*)` → `/index.html`**, so `/place/denali` and `/coverage` reach the
  router instead of a 404. Rewrites run after the filesystem, so real files in
  `public/` and `dist/assets/` are served as themselves.
- **Caching**: `/assets/*` is content-hashed by Vite and served `immutable` for a
  year; `/fonts/*` is not hashed and gets a week.

### Environment variables (Vercel)

| Name | Required | What it does |
| --- | --- | --- |
| `SITE_URL` | no | Absolute canonical, `og:url`, `og:image` and sitemap, e.g. `https://terrane.app`. Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`, so a deploy works without it; set it when a custom domain is the real address. |
| `VITE_POI_BASE` | no | Where the POI/trail cells are read from. Defaults to the cell store URL in `src/map/mapped.ts`. Set it to point a fork or a preview at a different bucket. **Inlined at build time** — changing it needs a redeploy, not a restart. |

Neither is a secret. No Vercel environment variable should ever hold a GitHub token
or the cell store's upload token: the browser bundle cannot keep one.

### Preview deployments

A pull request gets a preview URL, built the same way with `SITE_URL` unset — the
fallback keeps canonicals absolute rather than pointing at `localhost`. The preview
reads the **production** cells, because `VITE_POI_BASE` defaults to the one store;
that is deliberate (the cells are read-only to the site) and it means a preview
shows real data.

### Rollback

Vercel → Deployments → the last good one → **Promote to Production**. The build is
static, so a rollback is immediate and does not need a revert commit. If the bad
deploy carried a `src/data/` change, the promoted build carries the older data with
it, which is the point.

---

## GitHub Actions

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` | every push to `main`, every PR | typecheck, unit tests, data validate, full build; uploads `dist` as an artifact |
| `data-weekly.yml` | Mondays 03:17 UTC | the world OSM harvest, 12 shards, assemble and publish cells |
| `data-daily-us.yml` | daily 05:41 UTC | Recreation.gov export → cells |
| `data-monthly-trails.yml` | 2nd of the month, 04:23 UTC | trail lines from NPS, USFS and BLM |
| `data-monthly-agency.yml` | 3rd of the month, 04:53 UTC | USFS, BLM, Parks Canada and national records |
| `coverage.yml` | daily 07:09 UTC | the gap register, from the manifests the data jobs published |

The four data workflows share `concurrency: terrane-data` and never cancel in
progress, so a long harvest is never cut off by the next scheduled run.

### Repository secrets

Set under **Settings → Secrets and variables → Actions**:

| Name | Used by | What it is |
| --- | --- | --- |
| `POI_BUCKET` | every data workflow, `coverage` | Base URL of the cell store, e.g. `https://terrane-poi-cells-….freebuff.site` |
| `POI_UPLOAD_TOKEN` | same | The `x-upload-token` value the Worker compares against its `UPLOAD_TOKEN` secret |

Both are needed by `scripts/upload-changed.mjs` and `scripts/poi-upload.sh`. A
missing one fails the job at the first upload rather than publishing half a store:
`upload-changed.mjs` writes a manifest only after every changed file succeeded.

### Repository variable

| Name | Used by | What it is |
| --- | --- | --- |
| `SITE_URL` | `ci.yml` | Optional. Makes the artifact build's sitemap and canonicals absolute, so the CI build matches the Vercel one. Not a secret. |

---

## The data pipeline, in order

The scheduled jobs are the only writers to the cell store. Run them by hand from
**Actions → the workflow → Run workflow**, or locally:

```bash
npm run data:state      # read the published manifests: what is current
npm run data:merge      # merge adapter output into the cell set
npm run data:coverage   # the gap register → reports/coverage.md
npm run data:upload     # PUT changed cells + manifest to the bucket
```

`data-weekly.yml` is the expensive one: 437 Geofabrik extracts, ~70 GB, split over
12 shards by `--shard I/12` (a crc32 partition, so the split is stable). The
assemble job refuses to publish unless every extract in the plan produced rows —
there is no `--allow-partial`, because a partial store must never replace a whole
one.

Details of the cells, their paths and the loader constant live in
[`poi-cells.md`](poi-cells.md).

---

## Checks before a deploy

`ci.yml` runs exactly these, in this order:

```bash
npm ci
npm run typecheck     # tsc -b
npm test              # vitest: router, cell maths, ranking
npm run validate      # build-manifest + data schema, categories, duplicates
npm run build         # seo + manifest + validate + tsc + vite
```

`npm run check` is typecheck + tests + validate in one command. `npm run audit`
and `npm run data:coverage` are reports, not gates — they write to `reports/` and
do not fail the build.

The suite is deliberately small: pure modules only. The globe needs WebGL and the
map style needs the network, so it is checked by the build and by opening the page.

---

## Branches

- `main` is the production branch; it must be green.
- Work on a branch, open a PR, let `ci.yml` pass, then merge. Vercel builds the PR
  as a preview and `main` as production.
- Data workflows never push commits. The generated `src/data/` files change only
  when someone runs the pipeline locally and commits the result, so a data refresh
  cannot block a code merge.
