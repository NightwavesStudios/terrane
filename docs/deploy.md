# Deploying Terrane

The site is a static Vite build: `npm run build` writes `dist/`, and that
directory is the whole deployment. There is no server, no database and no runtime
API key in the browser.

| Where | What it does | Configured by |
| --- | --- | --- |
| **Vercel** | Builds the branch and serves `dist/` | `vercel.json`, `SITE_URL` |
| **GitHub Actions** | Tests and builds, with typecheck and data validation inside the build | `.github/workflows/ci.yml` |

Both read the same committed data files. There is no separate data origin to keep
in step with a deployment.

## Vercel

1. Import the repository as a Vite project.
2. Root directory: the repository root.
3. Install `npm ci`, build `npm run build`, output `dist` — all in `vercel.json`.
4. Node 22 — `.nvmrc` pins it; `engines.node` accepts 20 and newer.
5. Production branch: `main`. Other branches get preview deployments.

`vercel.json` supplies the four things a Vite SPA needs:

- **Rewrite the app paths to `/index.html`**, so `/place/denali` and `/lists`
  reach the router. Real files in `dist/` are served first, and the rewrite
  explicitly excludes `/assets/*` and `/fonts/*`: a missing hashed asset returns
  404 instead of the HTML shell with a year-long immutable cache.
- **Caching**: `/assets/*` is content-hashed and immutable for a year; `/fonts/*`
  gets a week.
- **Fresh HTML**: the shell at `/`, `/index.html`, `/place/*`, `/experiences/*`,
  `/lists*` and `/log` is `no-store`, so a deployment switch cannot leave a
  browser on an old shell that points at removed assets.
- **Removed URLs**: `/coverage` (the old health register), `/experiences` (the old catalogue index) and
  `/collections*` answer with a permanent redirect to `/` before the rewrite.
  `trailingSlash: false` makes their slash variants redirect as well.
  `src/lib/router.ts` repeats the redirect on hosts without this config; the
  curated `/experiences/:slug` detail pages are not redirected.

### Environment variables

| Name | Required | What it does |
| --- | --- | --- |
| `SITE_URL` | no | Absolute canonical, `og:url`, `og:image` and sitemap, e.g. `https://terrane.app`. Falls back to `https://$VERCEL_PROJECT_PRODUCTION_URL`, so a deploy works without it; a build with neither writes the sitemap against the documented placeholder origin so the file is never missing. |

It is not a secret. Do not put a token in a Vercel variable: the browser bundle
cannot keep one.

### Preview deployments

A pull request gets a preview URL built with `SITE_URL` unset; the Vercel fallback
keeps canonicals absolute. A preview reads the same committed data as production.

### Rollback

Vercel → Deployments → the last good one → **Promote to Production**. The build is
static, so a rollback is immediate and does not need a revert commit. If the bad
deploy carried a `src/data/` change, the promoted build carries the older data
with it.

## GitHub Actions

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` | push to `main`, every PR | typecheck, tests, data validate, full build, upload `dist` |

### Repository variables

| Name | Type | Used by |
| --- | --- | --- |
| `SITE_URL` | variable, optional | `ci.yml`, so the artifact build matches Vercel |

### Checks before a deploy

`ci.yml` runs exactly:

```bash
npm ci
npm test
npm run build
```

`npm run build` includes the data generators, validation and typecheck.
`npm run check` runs typecheck + tests + validate locally without bundling.

## Branches

- `main` is the production branch and must be green.
- Work on a branch, open a PR, let `ci.yml` pass, then merge.
