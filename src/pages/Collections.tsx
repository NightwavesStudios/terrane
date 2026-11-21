import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ExperienceCard from "../components/experiences/ExperienceCard";
import { PLACES } from "../data/places";
import {
  EXPERIENCE_CATEGORIES,
  type ExperienceCategoryId,
} from "../data/experiences";
import {
  filterExperiences,
  useExperienceCatalog,
  type ExperienceNear,
} from "../lib/experiences";
import { setMeta } from "../lib/meta";


const nearLabel = (place: (typeof PLACES)[number]) =>
  `${place.name} — ${place.country}`;

/**
 * The Collections section.
 *
 * Browse generated groups of remarkable places, narrow them by kind, search a
 * title, region, country or place, or filter to what is near a named place. The
 * catalog is one compact file; a card opens the collection's own shard.
 *
 * There is deliberately no difficulty filter and no walking plan: a collection
 * is a group of verified places, not an itinerary, and it is not saved to the
 * personal library.
 */
export default function Collections() {
  const catalog = useExperienceCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ExperienceCategoryId | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<ExperienceNear | null>(null);


  useEffect(() => {
    setMeta({
      title: "Collections — Terrane",
      description:
        "Curated groups of remarkable places: peaks, lakes, parks and trails grouped by region, with a Wikipedia source for every place. Not itineraries.",
      path: "/collections",
    });
  }, []);

  /* 150 ms swallows a word typed normally and is short enough that the first
     result is there before the eye reaches the grid. */
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(term), 150);
    return () => window.clearTimeout(id);
  }, [term]);

  const rows = useMemo(
    () => filterExperiences(catalog.rows, { query, category: activeCat, near }),
    [catalog.rows, query, activeCat, near],
  );

  const categoryCount = useMemo(
    () => filterExperiences(catalog.rows, { category: activeCat, near }).length,
    [catalog.rows, activeCat, near],
  );

  const searching = query.trim().length > 0;

  const chooseNear = (value: string) => {
    setNearTerm(value);
    const place = PLACES.find((candidate) => nearLabel(candidate) === value);
    setNear(
      place ? { lat: place.lat, lon: place.lon, label: place.name } : null,
    );
  };

  const resetAll = () => {
    setTerm("");
    setActiveCat(null);
    setNearTerm("");
    setNear(null);
  };

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head">
        <p className="eyebrow">Collections</p>
        <h1 className="page-title">Groups worth the detour</h1>
        <p className="page-sub">
          A collection gathers a few remarkable destinations the data can vouch for
          — peaks, lakes, parks and valleys — in one region, and links every place
          to its own page and a Wikipedia article. These are not itineraries: no
          walking days, no invented distances, no claim about how to travel
          between them.
        </p>
      </div>

      <div className="exp-controls">
        <div className="exp-control-row">
          <div className="exp-search">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search a collection, region, country or place…"
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
              list="exp-near-options"
              spellCheck={false}
              autoComplete="off"
            />
            <datalist id="exp-near-options">
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

        <div className="chips chips--light" role="group" aria-label="Filter collections by kind">
          <button
            className={`chip${activeCat ? "" : " on"}`}
            aria-pressed={!activeCat}
            onClick={() => setActiveCat(null)}
          >
            All
          </button>
          {EXPERIENCE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`chip${activeCat === category.id ? " on" : ""}`}
              aria-pressed={activeCat === category.id}
              onClick={() =>
                setActiveCat(activeCat === category.id ? null : category.id)
              }
              title={category.blurb}
            >
              {category.label}
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
                ? `Nothing matches “${query.trim()}” in ${categoryCount.toLocaleString()} collection${categoryCount === 1 ? "" : "s"}.`
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
              {activeCat
                ? ` · ${EXPERIENCE_CATEGORIES.find((c) => c.id === activeCat)?.label}`
                : ""}
              {near ? ` · within 150 km of ${near.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · input data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <ExperienceCard key={row.slug} row={row} query={query} near={near} />
              ))}
            </div>
            <p className="mono exp-note exp-note--foot">
              Generated from {catalog.rows.length.toLocaleString()} collections over
              the destination set. Every place has a Terrane page and a Wikipedia
              reference; distances describe the extent of the group, not a route.
            </p>
          </>
        )}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          COLLECTIONS ARE GROUPS, NOT ITINERARIES · MAP © OPENSTREETMAP · DATA:
          WIKIDATA · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
