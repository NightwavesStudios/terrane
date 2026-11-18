# World POI coverage

Generated 2026-11-18T20:25:03Z by `scripts/harvest-poi-bulk.py --report`.

Source: [Geofabrik](https://download.geofabrik.de/) `.osm.pbf` extracts of
OpenStreetMap, streamed through pyosmium. Licence: ODbL 1.0.
Attribution: **© OpenStreetMap contributors**.

## Extracts

| | |
| --- | --- |
| Extracts in plan | 437 |
| Countries in plan | 385 |
| Countries parsed | 385 |
| Parsed | 437 |
| Failed | 0 |
| Still pending | 0 |
| Source bytes parsed | 75.5 GB |
| Cells written | 1869 |
| Cell bytes | 382.2 MB |
| Parking rows (separate files) | 5,840,666 |
| Partial merge | no |

## Features

`extracted` counts rows as they came out of the PBF files; `in cells` is what
survived deduplication, the radius-harvest exclusion and the cell merge.

| Category | Extracted | In cells |
| --- | ---: | ---: |
| camp | 282,102 | 239,120 |
| hut | 31,239 | 28,913 |
| shelter | 650,562 | 585,409 |
| water | 706,927 | 678,605 |
| parking | 6,229,757 | 5,840,666 |
| view | 251,322 | 239,844 |
| picnic | 151,346 | 141,322 |
| pass | 44,849 | 39,267 |
| caravan | 30,557 | 29,776 |
| toilets | 496,060 | 445,756 |
| shower | 35,660 | 32,234 |
| info | 1,203,376 | 1,053,188 |
| trailhead | 17,444 | 17,024 |

## Duplicates and drops

| Reason | Rows |
| --- | ---: |
| Same OSM element seen twice (overlapping extracts) | 237,618 |
| Same ground, same kind, within 25 m | 513,869 |
| Within ~60 m of the radius harvest | 8,590 |
| Unreadable rows | 0 |

Two rows closer than 25 m with different names are kept as two places.

## By region

| Region | Extracts parsed | Campsites | Caravan sites | Huts | Shelters | Water | Viewpoints | Parking |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| africa | 55/55 | 8,382 | 629 | 1,340 | 15,398 | 65,153 | 9,366 | 66,622 |
| antarctica | 1/1 | 4 | 0 | 10 | 74 | 9 | 26 | 9 |
| asia | 88/88 | 24,635 | 1,602 | 3,970 | 90,748 | 66,348 | 42,311 | 790,220 |
| australia-oceania | 36/36 | 15,239 | 2,417 | 2,391 | 31,337 | 16,390 | 11,430 | 174,131 |
| central-america | 11/11 | 697 | 14 | 317 | 1,638 | 3,091 | 1,647 | 19,540 |
| europe | 155/155 | 78,649 | 15,561 | 16,215 | 353,095 | 390,757 | 136,025 | 3,219,424 |
| north-america | 65/65 | 127,409 | 9,321 | 1,836 | 128,332 | 65,661 | 27,868 | 1,580,129 |
| russia | 10/10 | 18,417 | 740 | 2,881 | 19,185 | 31,084 | 10,193 | 268,093 |
| south-america | 16/16 | 8,670 | 273 | 2,279 | 10,755 | 68,434 | 12,456 | 111,589 |

## Trail network observed

Route relations are counted, not drawn: the basemap already serves OSM's path
network as vector tiles and the Footpaths switch shows it.

- hiking routes: 249,752
- foot routes: 69,017
- bicycle routes: 113,024

Camping or hut features mapped as relations (multipolygons) and not placed:
86,373 — they are rarer than the same ground mapped as a node or way.

## Largest extracts

| Extract | Region | Rows | Download |
| --- | --- | ---: | ---: |
| nord-ovest | europe | 220,085 | 595.7 MB |
| austria | europe | 214,797 | 815.9 MB |
| switzerland | europe | 210,008 | 551.4 MB |
| kanto | asia | 188,699 | 524.8 MB |
| nord-est | europe | 172,009 | 627.4 MB |
| sweden | europe | 157,042 | 986.5 MB |
| niedersachsen | europe | 152,612 | 510.6 MB |
| rhone-alpes | europe | 145,949 | 533.4 MB |
| chubu | asia | 135,986 | 520.0 MB |
| brandenburg | europe | 121,005 | 297.4 MB |
| ontario | north-america | 118,781 | 1.0 GB |
| kansai | asia | 114,720 | 356.1 MB |
| belgium | europe | 113,482 | 699.6 MB |
| central-fed-district | russia | 107,613 | 886.3 MB |
| finland | europe | 106,422 | 777.8 MB |
| hessen | europe | 103,876 | 348.1 MB |
| us/texas | north-america | 102,347 | 728.4 MB |
| slovakia | europe | 96,600 | 348.7 MB |
| portugal | europe | 95,082 | 428.8 MB |
| sachsen | europe | 94,243 | 270.1 MB |

## Validation

Every cell was read back after the merge and checked: valid coordinates, a known category, an id for every item, detail records pointing at real items, and the category table matching the client.
