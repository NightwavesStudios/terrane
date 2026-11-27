# ADR-002: Data licensing and provenance

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** Terrane product/engineering
- **Related:** ADR-001; `docs/product-plan.md` §8.3 and §9

## Context

Terrane's peak index is assembled from open geodata:

- OpenStreetMap (`natural=peak`) is under the **Open Database License (ODbL) 1.0**, a share-alike licence for databases.
- GeoNames is **CC BY 4.0**.
- Wikidata is **CC0**.
- Natural Earth is **public domain**.
- Copernicus DEM is free to use with attribution; USGS 3DEP is public domain in the US.
- National mapping agencies and list publishers have their own terms.

The product promise is that every number has a source. That promise is also a legal posture: we must be able to say which fields came from which source, under which licence, and what a user may do with the derived data. A peak database assembled from OSM may itself be a derived database under ODbL. Getting this wrong risks a takedown, a forced relicense, or a provenance claim we cannot defend.

## Decision

Adopt **Option A: a separately licensed, ODbL-compatible derived layer** for the peak index.

1. **Field-level provenance.** Every accepted field (`name`, `geom`, `elevation_m`, `prominence_m`, `isolation_km`, `parent_place_id`, `region_id`, `country_code`, `is_highpoint`, `is_continental_highpoint`, `first_ascent_year`) has a `place_provenance` row naming the source, source reference, method (source / DEM / derived / human), confidence and check date. No field is accepted without a source row.
2. **Separate the layers.** The OSM-derived peak database is treated as its own ODbL-licensed database, with the required attribution ("© OpenStreetMap contributors") and a derived-data offer. User content (trips, photos, notes, condition reports, badges) is under separate terms and is not mixed into the ODbL layer.
3. **Attribution everywhere.** The map, every peak page's data panel, every dataset export and `/about/data` carry the source's exact attribution string and licence link. The dataset manifest is versioned with the snapshot.
4. **No proprietary claim over the derived layer.** We do not claim exclusive rights in the OSM-derived database. Terrane's proprietary assets are the software, the editorial content, the list summaries (facts + our words), the badge art, the user content and the brand.
5. **List publishers are cited, not cloned.** Membership and ranks are facts; descriptions, rules text and artwork are not copied. Every list version links to the publisher's official source and carries a "not the official record" note.
6. **Legal review before public launch.** A lawyer reviews the attribution, the ODbL derived-data offer, the user-content terms and the list-publisher posture. The review is a release gate, not a nice-to-have.
7. **Public export.** Where ODbL requires it, the OSM-derived layer is downloadable with the same licence and manifest. The user's own content is exportable regardless.
8. **No fabrication as a licensing safeguard.** A peak is never invented to complete a list; a missing field is null. This keeps the provenance ledger truthful and the derived database defensible.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| **Use OSM data and keep the whole database proprietary** | Likely incompatible with ODbL share-alike; undermines the provenance promise and creates legal risk. |
| **Public-domain sources only (USGS, Natural Earth, Wikidata)** | Clean licensing but insufficient global coverage and name quality for launch; would make the atlas US-centric. |
| **License a commercial peak database** | Expensive, opaque provenance, and the product's differentiation is inspectable data. |
| **Scrape a competitor's peak pages** | Legally and ethically unacceptable; violates the no-fabrication and citation principles. |
| **Treat list membership as our content** | Membership is factual, but descriptions, rules and art belong to publishers; facts-only, link-and-credit is the defensible line. |

## Consequences

- **Positive:** a defensible, auditable dataset; a visible trust differentiator; a clear path to publish the open layer; user content stays under Terrane's terms; list publishers can be partnered with rather than copied.
- **Negative:** ODbL obligations (attribution, share-alike, derived-data offer) constrain how the peak database can be relicensed or sold; field-level provenance adds ingest and storage cost; a legal review gates launch; some sources (OSM) are noisy and need QA.
- **Operational:** every snapshot writes a licence manifest; `/about/data` is generated from `data_source` + `place_provenance`; the export job refuses to run without a manifest; a source removal request is handled by re-tiering/removing the affected fields and publishing a new snapshot.
- **Non-negotiable:** no source without a licence row; no field without provenance; no public launch before the legal review; no user content in the ODbL layer without a deliberate decision.
