# Changelog

## 2026-11-15 — Phase 1: the map becomes terrain

Relief, colour and camera, reworked so the map reads as landscape at every zoom
level rather than only at world view.

### Relief

- The hillshade now sits **above** the vegetation and landuse fills and **below**
  water. It used to sit underneath, where a translucent green fill covered the
  shading and mid zooms collapsed into one flat teal sheet.
- The DEM source is declared in the style, not added at runtime. A layer that
  references a source added later makes MapLibre reject the whole style, which is
  what had made static hillshade declarations produce a blank map.
- The DEM pyramid runs to **z15** instead of stopping at z10, so deep zooms have
  real data rather than one overzoomed blob.
- Exaggeration **scales with zoom** (1.15 at z3.2 → 3.4 at z15). Terra's deep
  tiles are bilinearly upsampled, so the slope between neighbouring texels shrinks
  as you zoom in; at a fixed exaggeration the shading flattened to a grey wash.
- The light is a deep green (`#46603f`) against near-black shadow, so lit slopes
  keep their colour instead of washing out pale.
- Glacier polygons fade to 22% with zoom, so shaded rock shows through an icefield
  instead of being covered by a pale sheet.

### Colour

- Base land, forest and pasture each carry a distinct hue, so regional views stay
  coloured when the fills cover the frame.
- Rivers fade in over z6→z7 instead of snapping on at full opacity mid-flight.

### Map furniture

- Layer control (relief, contours, detail, labels, places), ⌘K/Ctrl-K search,
  contour generation from the DEM, and selection that only flies if the camera is
  further out than z6.4, so you never lose context.

### Data

- 1,288 places across 157 countries: 650 peaks ranked by topographic prominence,
  380 parks, 190 natural landmarks and 68 curated entries. No cities, no buildings,
  no cultural sites — outdoor places only.
