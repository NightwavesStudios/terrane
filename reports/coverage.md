# Source coverage

Generated 2026-11-19T12:19:57.464Z. Strict run.

Coverage is measured against the union of open sources Terrane ingests, not against a non-existent global census. A missing source, a zero source, an unaccounted row or a stale source is a gap.

| Source | Family | Fetched | Placed | Rejected | Unaccounted | Age | Status |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| OpenStreetMap, via Geofabrik extracts | points | 9,371,124 | 9,371,124 | 0 | 0 | 1d | ok |
| OpenStreetMap hiking routes | trails | 270,499 | 269,889 | 610 | 0 | 0d | ok |
| Recreation.gov RIDB full export | points | 7,790 | 7,790 | 0 | 0 | 0d | ok |
| US Forest Service recreation sites | points | 26,534 | 26,534 | 0 | 0 | 0d | ok |
| Bureau of Land Management recreation sites | points | 694 | 694 | 0 | 0 | 0d | ok |
| National Park Service public trails | trails | 33,909 | 33,906 | 3 | 0 | 0d | ok |
| US Forest Service National Forest System trails | trails | 89,900 | 84,564 | 5,336 | 0 | 0d | ok |
| Bureau of Land Management GTLF public trails | trails | 42,671 | 42,671 | 0 | 0 | 0d | ok |
| Parks Canada accommodation | points | 11,740 | 9,592 | 2,148 | 0 | 0d | ok |
| New Zealand Department of Conservation campsites | points | 312 | 312 | 0 | 0 | 0d | ok |

## Gates

| Source | Gate | Result | Problems |
| --- | --- | --- | --- |
| osm | total ≥ 9,000,000 | pass | — |
| osm_routes | fetched ≥ 250,000 | pass | — |
| ridb | fetched ≥ 5,400 | pass | — |
| usfs_sites | raw ≥ 28,000 | pass | — |
| blm_sites | raw ≥ 1,000 | pass | — |
| nps_trails | raw ≥ 25,000 | pass | — |
| usfs_trails | raw ≥ 70,000 | pass | — |
| blm_trails | raw ≥ 15,000 | pass | — |
| parks_canada | fetched ≥ 10,000 | pass | — |
| doc_nz | raw ≥ 200 | pass | — |

## What is not in any source

- private and commercial campgrounds
- informal/dispersed sites nobody has mapped
- closures and seasonal status
- trails on private land
- countries with no open inventory
- RIDB records without coordinates
- OSM mapping-effort gaps
- camping/hut multipolygons counted but not placed

## Merge

- Points: 44,922 in, 44,409 kept, 513 merged, 0 OSM rows replaced by agency rows.
- Trails: 431,030 lines, 449,576 segments, 1,029 cells.
