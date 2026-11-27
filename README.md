# Terrane

A global geographic discovery and peak-bagging platform. The home page is the
old blue-hour globe: just the camera, terrain and a small Discover panel. No
peak, list or user records are loaded.

## Sections

- **Explore** — the interactive globe and the Discover surface.
- **Peaks** — the peak index layout, search, filters, sorting and empty state.
- **Lists** — the future peak-bagging list library and completion structure.
- **Progress** — the personal climbing dashboard and ascent history structure.
- **Peak detail** — a reusable detail template at `/peaks/preview`.

## Commands

```bash
npm ci
npm run dev
npm run build
npm test
```

Node 20+ is required. The globe uses MapLibre, the old blue-hour OpenFreeMap
style, and the public Mapzen terrarium terrain tiles. The old Sora, Plus Jakarta
Sans, Fraunces and JetBrains Mono wordmark faces are served locally.
