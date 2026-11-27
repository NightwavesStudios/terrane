# Data licences and attribution

Terrane's code is MIT-licensed (see `LICENSE`). The **data** is not: each source
keeps its own licence. This file records the source, licence, required
attribution and the practical obligation for each one.

## Sources

| Source | Used for | Licence | Attribution | Obligation |
| --- | --- | --- | --- | --- |
| [Wikidata](https://www.wikidata.org/) | Destination atlas, long tail, coordinates, elevations and one-line descriptions | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Wikidata contributors (courtesy) | No legal requirement; attribution is good practice. |
| [Wikidata](https://www.wikidata.org/) / [Wikipedia](https://www.wikipedia.org/) | Curated Experience articles and links | [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) for article text excerpts; CC0 for facts | Wikipedia contributors, linked on every Experience page | Facts are used, not copied prose; each page links its article. |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Destination photographs | Per file (CC BY, CC BY-SA, CC0 or public domain) | The photographer named on the file page | Credit and licence link on every image; the file page is linked. No image is copied into the repository. |

The basemap is [OpenFreeMap](https://openfreemap.org/) vector tiles from
OpenStreetMap data, with [Mapterhorn](https://mapterhorn.com/) terrain. The map
keeps the OpenStreetMap and OpenFreeMap attribution visible at all times, as the
ODbL and the tile provider require.

## Photographs

The sharded `src/data/place-details/` files store a thumbnail URL, the
photographer credit, the licence name and the licence URL for each image Commons
reports. The page links the credit to the file page and the licence to its deed;
an image without either is not emitted. Thumbnails are loaded from Wikimedia's
image hosts at request time, not mirrored, so the repository does not grow.

## Adding a source

Before a new feed is added:

1. Confirm the endpoint and that the licence permits reuse and redistribution.
2. Record the licence, attribution and obligations in this file.
3. Add the fetch/build step and a validator check that fails on a truncated
   response.
4. Run `npm run validate` and `npm run build` before committing the output.

This file is a practical record, not legal advice. If a source's terms change,
this table changes with it.
