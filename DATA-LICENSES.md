# Data licences and attribution

Terrane's code is MIT-licensed (see `LICENSE`). The **data** is not: each source
keeps its own licence, and the derived cell files carry the obligations of every
source that contributed to them. This file records the source, licence, required
attribution and the practical obligation for each feed.

The machine-readable registry is `src/data/sources.json`; `scripts/validate-data.mjs`
refuses a source without `licence`, `licenceUrl`, `attribution` and `terms`.
`/coverage` links every licence, and every feature card prints its source and
licence.

## Sources

| Source | Used for | Licence | Attribution | Obligation |
| --- | --- | --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), via [Geofabrik](https://download.geofabrik.de/) | Points and hiking routes | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | © OpenStreetMap contributors | Attribution; share-alike for a derived database. Keep the notice on any redistributed extract. |
| [Wikidata](https://www.wikidata.org/) | Destination atlas, long tail and one-line descriptions | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Wikidata contributors (courtesy) | No legal requirement; attribution is good practice. |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Destination photographs | Per file (CC BY, CC BY-SA, CC0 or public domain) | The photographer named on the file page | Credit and licence link on every image; the file page is linked. No image is copied into the repository or the cell store. |
| [Recreation.gov RIDB](https://ridb.recreation.gov/) | US federal facilities and campsites | Public domain (US Government) | Recreation.gov / RIDB | None; retain provenance. |
| [US Forest Service](https://www.fs.usda.gov/about-agency/open-data) | Recreation sites and NFS trails | Public domain (US Government) | USDA Forest Service | None; retain provenance. |
| [Bureau of Land Management](https://www.blm.gov/about/data) | Recreation sites and GTLF trails | Public domain (US Government) | Bureau of Land Management | None; retain provenance. |
| [National Park Service](https://www.nps.gov/aboutus/open-data.htm) | Public trails | Public domain (US Government) | National Park Service | None; retain provenance. |
| [Parks Canada](https://open.canada.ca/en/open-government-licence-canada) | Accommodation | [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada) | Parks Canada | Attribution; do not imply endorsement. |
| [NZ Department of Conservation](https://www.doc.govt.nz/) | Campsites | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | NZ Department of Conservation | Attribution; indicate changes. |

The basemap is [OpenFreeMap](https://openfreemap.org/) vector tiles from
OpenStreetMap data, with [Mapterhorn](https://mapterhorn.com/) terrain. The map
keeps the OpenStreetMap and OpenFreeMap attribution visible at all times, as the
ODbL and the tile provider require.

## Photographs

The sharded `src/data/place-details/` files store a thumbnail URL, the
photographer credit, the licence name and the licence URL for each image Commons
reports. The page links the credit to the file page and the licence to its deed;
an image without either is not emitted. Thumbnails are loaded from Wikimedia's
image hosts at request time, not mirrored, so the repository and the R2 bucket do
not grow.

## What the derived cells are

`public/poi/6/{x}/{y}.json` and `public/trails/7/{x}/{y}.json` are extracted,
clipped and simplified subsets of the sources above. They are not a new database
of facts: names, positions and classifications still come from the named source.
The trail merge does add derived geometry (cell clipping, Douglas–Peucker
simplification, gap splitting and deduplication) and a per-piece distance. That
derived trail database is offered under the ODbL where OSM contributes, and under
the relevant public-domain/OGL/CC terms otherwise.

If you redistribute the cells, keep this file and the per-source attribution.
ODbL share-alike applies to a publicly used derived database that mixes OSM data;
the safest way to comply is to keep the derived cells ODbL and publish the
attribution and licence notice with them.

## Adding a source

Before a new feed is added:

1. Confirm the endpoint and that the licence permits commercial reuse and
   redistribution.
2. Record `licence`, `licenceUrl`, `attribution` and `terms` in
   `src/data/sources.json`, plus a gate that fails on a truncated response.
3. Add the adapter and a manifest at `data/sources/{id}.json` with `fetched`,
   `placed`, `rejected` and `updated`.
4. Run `npm run validate`, `npm run data:coverage -- --strict` and
   `npm run trail:quality` (for trail feeds) before publishing.

This file is a practical record, not legal advice. If a source's terms change,
the registry and this table change with it.
