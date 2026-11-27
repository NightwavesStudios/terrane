# Terrane

An atlas of outdoor places and a logbook for the ones you have stood on. Built
around peaks first, then the volcanoes, treks, canyons, deserts, lakes, ice and
coast around them. Discovery, lists, goals and a personal journal — not a route
guide, not a planner and not a live tracker.

## Sections

- **Explore** — the blue-hour globe with every place in the atlas as a marker.
  Filter by kind, search or drift somewhere, open a place, log it.
- **Atlas** — the full discovery index: search, kind and continent filters,
  sorting, and visited/summited state from the journal.
- **Adventure profile** — elevation, prominence, coordinates, lists and nearby
  places; log a summit, an attempt or a visit.
- **Lists** — canonical challenges (Seven Summits, Volcanic Seven) and Terrane
  collections, with progress read from the journal.
- **Goals** — season intentions measured only by what has been logged, plus
  custom measures.
- **Journal** — outings by season, statistics and the source of truth for every
  list, goal and marker.

## Data and tracking

The atlas is a curated, static dataset (`src/data/atlas.ts`): coordinates are
approximate centres for globe discovery, not survey points. The product carries
no routes, approach beta, conditions, GPS or live tracking by design.

Journal entries and adopted goals are stored in this browser under
`terrane.journal.v1`. The app starts empty: no outings, no goals, no fabricated
progress. Lists, stats and goal meters read zero until you log a real outing.

## Commands

```bash
npm ci
npm run dev
npm run build
npm test
```

Node 20+ is required. The globe uses MapLibre, the old blue-hour OpenFreeMap
style and the public Mapzen terrarium terrain tiles. The old Sora, Plus Jakarta
Sans, Fraunces and JetBrains Mono wordmark faces are served locally.
