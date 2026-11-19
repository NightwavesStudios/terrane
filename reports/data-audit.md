# Data audit

Generated 2026-11-19T04:45:22.212Z. Read-only: `npm run audit`.

## Sources

| Source | Records | Updated | Note |
| --- | ---: | --- | --- |
| OpenStreetMap world POIs | 9,371,124 | 2026-11-18 | 437 extracts, 385 countries |
| Wikidata destinations | 24,472 | 2026-11-18 | 1218 atlas + 68 hand-written + 23254 reach |
| Hand-written field entries | 68 | 2026-11-19 | one row with a page each; frozen, not growing |
| Bureau of Land Management recreation sites | 694 | 2026-11-19 | points · Public domain (US Government) |
| Bureau of Land Management GTLF public trails | 42,671 | 2026-11-19 | trails · Public domain (US Government) |
| New Zealand Department of Conservation campsites | 312 | 2026-11-19 | points · CC BY 4.0 |
| National Park Service public trails | 33,906 | 2026-11-19 | trails · Public domain (US Government) |
| OpenStreetMap hiking routes | 269,889 | 2026-11-19 | trails · ODbL 1.0 |
| Parks Canada accommodation | 9,592 | 2026-11-19 | points · Open Government Licence – Canada |
| Recreation.gov RIDB full export | 7,790 | 2026-11-19 | points · Public domain (US Government) |
| US Forest Service recreation sites | 26,534 | 2026-11-19 | points · Public domain (US Government) |
| US Forest Service National Forest System trails | 84,564 | 2026-11-19 | trails · Public domain (US Government) |

## One set, by category

| Category | Destinations | Mapped |
| --- | ---: | ---: |
| Peaks | 7,661 | 0 |
| Volcanoes | 327 | 0 |
| Ranges | 550 | 0 |
| Valleys | 900 | 0 |
| Parks | 2,007 | 0 |
| Reserves | 2,200 | 0 |
| Landmarks | 218 | 0 |
| Waterfalls | 1,305 | 0 |
| Lakes | 3,800 | 0 |
| Glaciers | 1,000 | 0 |
| Caves | 817 | 0 |
| Canyons | 1 | 0 |
| Beaches | 965 | 0 |
| Islands | 2,600 | 0 |
| Deserts | 134 | 0 |
| Hot springs | 55 | 0 |
| Campsites | 0 | 239,120 |
| Mountain huts | 0 | 28,913 |
| Shelters | 0 | 585,409 |
| Water | 0 | 678,605 |
| Parking | 0 | 5,840,666 |
| Viewpoints | 0 | 239,844 |
| Picnic sites | 0 | 141,322 |
| Mountain passes | 0 | 39,267 |
| Caravan sites | 0 | 29,776 |
| Toilets | 0 | 445,756 |
| Showers | 0 | 32,234 |
| Information boards | 0 | 1,053,188 |
| Trailheads | 0 | 17,024 |
| Trails | 0 | 0 |

## Distribution

| Measure | Value |
| --- | ---: |
| Destination countries | 156 |
| Rows per country, median | 3 |
| Countries with one row | 41 |
| Countries with two or fewer | 64 |
| Rows in the fullest country | 57 |
| Populated z6 cells | 1273 |
| Destinations per cell, median | 5 |
| Destinations per cell, max | 2269 |
| Georgia box: atlas / hand-written / Wikidata | 3 / 34 / 71 |
| Georgia (Atlanta) cell | 18 |

### Fullest cells

| Cell | Destinations |
| --- | ---: |
| 6/33/22 | 2269 |
| 6/34/22 | 851 |
| 6/31/19 | 395 |
| 6/35/23 | 352 |
| 6/34/21 | 287 |
| 6/32/23 | 256 |
| 6/33/18 | 255 |
| 6/35/21 | 242 |
| 6/34/23 | 236 |
| 6/34/20 | 199 |
| 6/31/23 | 194 |
| 6/33/23 | 191 |

## Duplicates

- Same category within 50 m: **0**
- Same category within 110 m: **0**

## Coverage and freshness

- Categories with no records: trail
- OSM completeness follows mapping effort, not ground truth; Europe is densest.
- GitHub Actions: daily RIDB, weekly OSM points, monthly trails; see .github/workflows
