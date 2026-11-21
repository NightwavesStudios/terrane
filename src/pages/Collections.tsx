import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import CollectionCard from "../components/collections/CollectionCard";
import { PLACES } from "../data/places";
import {
  COLLECTION_SCOPES,
  type CollectionScopeId,
} from "../data/collections";
import {
  filterCollections,
  useCollectionCatalog,
  type CollectionNear,
} from "../lib/collections";
import { setMeta } from "../lib/meta";

const nearLabel = (place: (typeof PLACES)[number]) =>
  `${place.name} — ${place.country}`;

/**
 * The Collections section.
 *
 * Browse wide groups of curated Experiences: countries, great ranges, large
 * areas and recorded long-distance trails. A Collection is not an itinerary and
 * not a group of raw destinations; every member is an Experience with its own
 * page and Wikipedia source.
 */
export default function Collections() {
  const catalog = useCollectionCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeScope, setActiveScope] = useState<CollectionScopeId | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<CollectionNear | null>(null);

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
    () =>
      filterCollections(catalog.rows, { scope: activeScope, near }).length,
    [catalog.rows, activeScope, near],
  );

  const searching = query.trim().length > 0;
  const experienceTotal = catalog.rows.reduce(
    (sum, row) => sum + row.experienceCount,
    0,
  );

  const chooseNear = (value: string) => {
    setNearTerm(value);
    const place = PLACES.find((candidate) => nearLabel(candidate) === value);
    setNear(
      place ? { lat: place.lat, lon: place.lon, label: place.name } : null,
    );
  };

  const resetAll = () => {
    setTerm("");
    setActiveScope(null);
    setNearTerm("");
    setNear(null);
  };

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
        <div className="exp-control-row">
          <div className="exp-search">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search a collection, country, range or Experience…"
              aria-label="Search collections"
              spellCheck={false}
              autoComplete="off"
            />
            {term ? (
              <button
                className="exp-search-clear mono"
                onClick={() => setTerm("")}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="exp-search exp-search--near">
            <input
              value={nearTerm}
              onChange={(event) => chooseNear(event.target.value)}
              placeholder="Near a place — town, park or peak…"
              aria-label="Filter collections by a nearby place"
              list="collection-near-options"
              spellCheck={false}
              autoComplete="off"
            />
            <datalist id="collection-near-options">
              {PLACES.map((place) => (
                <option key={place.slug} value={nearLabel(place)} />
              ))}
            </datalist>
            {near ? (
              <button
                className="exp-search-clear mono"
                onClick={() => {
                  setNearTerm("");
                  setNear(null);
                }}
                aria-label="Clear the nearby place"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="chips chips--light" role="group" aria-label="Filter collections by scope">
          <button
            className={`chip${activeScope ? "" : " on"}`}
            aria-pressed={!activeScope}
            onClick={() => setActiveScope(null)}
          >
            All
          </button>
          {COLLECTION_SCOPES.map((scope) => (
            <button
              key={scope.id}
              className={`chip${activeScope === scope.id ? " on" : ""}`}
              aria-pressed={activeScope === scope.id}
              onClick={() =>
                setActiveScope(activeScope === scope.id ? null : scope.id)
              }
              title={scope.blurb}
            >
              {scope.label}
            </button>
          ))}
        </div>

        {nearTerm && !near ? (
          <p className="mono exp-note">
            Pick a place from the list to measure from it.
          </p>
        ) : null}
      </div>

      <div className="exp-results">
        {catalog.status === "loading" ? (
          <p className="mono exp-note">Loading the collections…</p>
        ) : catalog.status === "error" ? (
          <p className="mono exp-note">
            The collection index could not be loaded. The globe is unaffected.
          </p>
        ) : rows.length === 0 ? (
          <div className="exp-empty">
            <p>
              {searching
                ? `Nothing matches “${query.trim()}” in ${scopeCount.toLocaleString()} collection${scopeCount === 1 ? "" : "s"}.`
                : "No collections match these filters."}
            </p>
            <button className="btn btn-dark" onClick={resetAll}>
              All collections →
            </button>
          </div>
        ) : (
          <>
            <p className="mono exp-count">
              {rows.length.toLocaleString()} collection{rows.length === 1 ? "" : "s"}
              {activeScope
                ? ` · ${COLLECTION_SCOPES.find((scope) => scope.id === activeScope)?.label}`
                : ""}
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
