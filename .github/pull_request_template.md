## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Why

## Checks

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run validate` if anything under `src/data/` or `scripts/` changed
- [ ] `npm run build` passes
- [ ] Looked at the changed page with `npm run dev` if the UI changed
- [ ] Regenerated data is committed (`src/data/`); generated SEO files are
      **not** staged

## Deploy

- [ ] No new environment variable, or `docs/deploy.md` documents it
- [ ] No new GitHub secret, or `docs/deploy.md` documents it and it is set on the repo
