# Terrane

A quiet record of mountains: a blue-hour globe, five complete peak lists, a
private climbing journal, a quiet passport and a portable archive. The home page remains the
camera, terrain and a small Discover panel; the record is the through-line.

## Sections

- **Explore** — the interactive globe, Discover search and all catalogue peaks.
- **Peaks** — 467 sourced summits with search, list filters, sorting and detail pages.
- **Lists** — the New Hampshire 48, 58 named Colorado 14ers, 282 Munros, Adirondack 46 and current 33-peak Catskill 3500, each with explicit start, rules, edition and progress.
- **Progress** — started-list rings, days out, ten launch marks, annual recaps, list completions and JSON/CSV export.
- **Log** — quick log, history backfill, edit and delete, with date precision preserved.
- **Import** — documented CSV import with unmatched-row reporting and duplicate merge/keep/skip review.
- **Settings** — local profile, units, export and deletion.

## What is local

This is a working local-first build, not a production deployment. The profile,
started lists, list-start edition snapshots and trips live in `localStorage`
under `terrane.record.v1`. Nothing is uploaded, and no server auth, database,
email or backup is configured. Export before clearing the browser.

## Data

Only real sourced data is seeded. New Hampshire membership is from the AMC 2026
list via NH48.info; Colorado is 58 named fourteeners from 14ers.com with NGS
2024 elevations; the Munros are the SMC 282 list with DoBIH v18 facts (CC BY
4.0); the Adirondack 46 follows the 46ers list; the Catskills use the current
33-peak club list, not the old 35. The Colorado 58/53/54 prominence distinction
and the Catskill 2021 revision are stated rather than hidden. See [docs/data-sources.md](docs/data-sources.md) and the in-app
`/about/data` page.

## Commands

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3001 --strictPort
npm test
npx tsc -b
npm run build
```

Node 20+ is required. The globe uses MapLibre, the blue-hour OpenFreeMap style
and public Mapzen terrarium terrain; allow a few seconds for the first render.
MapLibre is a separate lazy-loaded chunk, so the production build warns about
its chunk size.
