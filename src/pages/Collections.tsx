import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import CollectionCard from "../components/collections/CollectionCard";
import CatalogControls, {
  type CatalogNear,
} from "../components/catalog/CatalogControls";
import StateNotice from "../components/StateNotice";
import {
  COLLECTION_SCOPES,
  type CollectionScopeId,
} from "../data/collections";
import { filterCollections, useCollectionCatalog } from "../lib/collections";
import { setMeta } from "../lib/meta";

/**
 * The Collections section.
 *
 * Browse wide groups of curated Experiences: countries, great ranges, large
 * areas and recorded long-distance trails. A Collection is not an itinerary and
 * not a group of raw destinations; every member is an Experience with its own
 * page and Wikipedia source. The controls are the same ones the Experiences
 * catalogue uses.
 */
export default function Collections() {
  const catalog = useCollectionCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeScope, setActiveScope] = useState<CollectionScopeId | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<CatalogNear | null>(null);

  useEffect(() => {
    setMeta({
      title: "Collections — Terrane",
      description:
        "Wide groups of curated Experiences by country, great mountain range, area or recorded long-distance trail. Every Experience keeps its own page and Wikipedia source; collections are not itineraries.",
      path: "/collections",
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(term), 150);
    return () => window.clearTimeout(id);
  }, [term]);

  const rows = useMemo(
    () =>
      filterCollections(catalog.rows, {
        query,
        scope: activeScope,
        near,
      }),
    [catalog.rows, query, activeScope, near],
  );

  const scopeCount = useMemo(
    () => filterCollections(catalog.rows, { scope: activeScope, near }).length,
    [catalog.rows, activeScope, near],
  );

  const searching = query.trim().length > 0;
  const experienceTotal = catalog.rows.reduce(
    (sum, row) => sum + row.experienceCount,
    0,
  );

  const resetAll = () => {
    setTerm("");
    setQuery("");
    setActiveScope(null);
    setNearTerm("");
    setNear(null);
  };

  const scopeLabel = activeScope
    ? COLLECTION_SCOPES.find((scope) => scope.id === activeScope)?.label
    : null;

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head">
        <p className="eyebrow">Collections</p>
        <h1 className="page-title">The world, in wide strokes</h1>
        <p className="page-sub">
          A collection gathers curated Experiences — not raw destinations — at
          the scale where a journey actually takes shape: a country, a great
          mountain range, a large area inside a big country, or the route of a
          recorded long-distance trail. Every Experience keeps its own page and
          Wikipedia source. These are not itineraries: no walking days, no
          invented distances, no claim about how to travel between them.
        </p>
      </div>

      <div className="exp-controls">
        <CatalogControls
          searchLabel="Search Collections"
          searchPlaceholder="Search a collection, country, range or Experience…"
          term={term}
          onTerm={setTerm}
          nearPlaceholder="Near a place — town, park or peak…"
          nearTerm={nearTerm}
          onNearTerm={setNearTerm}
          near={near}
          onNear={setNear}
          chipsLabel="Filter Collections by scope"
          chips={COLLECTION_SCOPES.map((scope) => ({
            id: scope.id,
            label: scope.label,
            title: scope.blurb,
          }))}
          activeChip={activeScope}
          onChip={(id) => setActiveScope(id as CollectionScopeId | null)}
          onReset={resetAll}
        />
      </div>

      <div className="exp-results">
        {catalog.status === "loading" ? (
          <StateNotice kind="loading" title="Loading the collections" rows={3} />
        ) : catalog.status === "error" ? (
          <StateNotice
            kind="error"
            title="The collection index could not be loaded"
            body="Discover and Experiences are unaffected; this list is the only surface that needs it."
            action={{ label: "Retry", onClick: () => window.location.reload() }}
          />
        ) : rows.length === 0 ? (
          <StateNotice
            kind="empty"
            title={
              searching
                ? `Nothing matches “${query.trim()}” in ${scopeCount.toLocaleString()} collection${scopeCount === 1 ? "" : "s"}.`
                : "No collections match these filters."
            }
            body={
              searching
                ? "Try a country, a range, or the name of a member Experience."
                : "Widen the scope or clear the nearby place."
            }
            action={{ label: "All collections →", onClick: resetAll }}
          />
        ) : (
          <>
            <p className="mono exp-count" role="status">
              {rows.length.toLocaleString()} collection
              {rows.length === 1 ? "" : "s"}
              {scopeLabel ? ` · ${scopeLabel}` : ""}
              {near ? ` · within 750 km of ${near.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · input data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <CollectionCard
                  key={row.slug}
                  row={row}
                  query={query}
                  near={near}
                />
              ))}
            </div>
            <p className="mono exp-note exp-note--foot">
              {catalog.rows.length.toLocaleString()} wide collections over{" "}
              {experienceTotal.toLocaleString()} curated Experiences. Each
              Experience has a Terrane page and a Wikipedia reference; distances
              describe the extent of the group, not a route.
            </p>
          </>
        )}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          COLLECTIONS GATHER EXPERIENCES, NOT DESTINATIONS · MAP © OPENSTREETMAP
          · DATA: WIKIDATA · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
