# Scripts

Node scripts build the app data and the manifest. All of them are offline and
deterministic: the same committed inputs produce the same files, with no network
and no clock.

## Build and checks

| Script | Run by | Purpose |
| --- | --- | --- |
| `build-place-index.mjs` | `npm run build`, `validate`, `place:index` | Compact page records and slugs for every destination. |
| `build-guide.mjs` | `npm run build`, `validate`, `experiences` | Build one curated Experience page for every slug in `guide-selection.json`, from committed details and photos. Fails on an unresolved entry. |
| `build-manifest.mjs` | `npm run build`, `validate`, `manifest` | Derive counts and dates from the data files. |
| `validate-data.mjs` | `npm run build`, `validate` | Schema, category, manifest and duplicate checks; writes the validation block. |
| `gen-seo.mjs` | `npm run build` (after Vite) | Absolute `dist/sitemap.xml` and `dist/robots.txt`. |
| `clean.mjs` | `npm run clean` | Remove `dist` and `tsconfig.tsbuildinfo`. |

`scripts/lib/` holds the shared helpers: the site origin, the destination reader
and the sitemap URL builder.

## Page refresh

```bash
npm run place:index  # rebuild the page index from the committed destinations
npm run experiences  # rebuild the curated Experience catalogue
npm run manifest     # rebuild the counts
npm run validate     # run the data gate
npm run build        # everything, plus the app bundle and SEO files
```

`build-place-index.mjs` reads the committed atlas and reach files; it does not
fetch anything. `build-guide.mjs` reads `guide-selection.json`, the place details
and the destination records.
