import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ExperienceCard from "../components/experiences/ExperienceCard";
import {
  EXPERIENCE_CATEGORIES,
  type ExperienceCategoryId,
} from "../data/experiences";
import {
  filterExperiences,
  useExperienceCatalog,
} from "../lib/experiences";
import { setMeta } from "../lib/meta";
import {
  toggleSavedExperience,
  useSavedExperienceSlugs,
} from "../lib/savedExperiences";

/**
 * The Experiences section.
 *
 * Browse the generated routes, narrow them by kind, or search for a title, a
 * region, a country or a stop. The catalog is one compact file; a card opens the
 * route's own shard. No mode tabs: the query and the category chip answer
 * different questions and can both be on.
 */
export default function Experiences() {
  const catalog = useExperienceCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ExperienceCategoryId | null>(null);
  const saved = useSavedExperienceSlugs();

  useEffect(() => {
    setMeta({
      title: "Experiences — Terrane",
      description:
        "Routes generated from geography: peaks, parks, lakes and trails grouped into weekend adventures, mountain exploration, hiking, camping and national park experiences.",
      path: "/experiences",
    });
  }, []);

  /* 150 ms swallows a word typed normally and is short enough that the first
     result is there before the eye reaches the grid. */
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(term), 150);
    return () => window.clearTimeout(id);
  }, [term]);

  const rows = useMemo(
    () => filterExperiences(catalog.rows, { query, category: activeCat }),
    [catalog.rows, query, activeCat],
  );

  const categoryCount = useMemo(
    () => filterExperiences(catalog.rows, { category: activeCat }).length,
    [catalog.rows, activeCat],
  );

  const searching = query.trim().length > 0;

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head">
        <p className="eyebrow">Experiences</p>
        <h1 className="page-title">Routes the map suggests</h1>
        <p className="page-sub">
          Every route here is generated from the geography: nearby destinations are
          grouped into a short sequence, named from the range, park or region they
          share, and measured stop to stop. There is no hand-written itinerary in
          this list.
        </p>
      </div>

      <div className="exp-controls">
        <div className="exp-search">
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search a route, park, range, country or stop…"
            aria-label="Search experiences"
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

        <div className="chips chips--light" role="group" aria-label="Filter experiences">
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
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="exp-results">
        {catalog.status === "loading" ? (
          <p className="mono exp-note">Loading the generated routes…</p>
        ) : catalog.status === "error" ? (
          <p className="mono exp-note">
            The experience index could not be loaded. The globe is unaffected.
          </p>
        ) : rows.length === 0 ? (
          <div className="exp-empty">
            <p>
              {searching
                ? `Nothing matches “${query.trim()}” in ${categoryCount.toLocaleString()} route${categoryCount === 1 ? "" : "s"}.`
                : "No routes in this category."}
            </p>
            <button
              className="btn btn-dark"
              onClick={() => {
                setTerm("");
                setActiveCat(null);
              }}
            >
              All experiences →
            </button>
          </div>
        ) : (
          <>
            <p className="mono exp-count">
              {rows.length.toLocaleString()} route{rows.length === 1 ? "" : "s"}
              {activeCat ? ` · ${EXPERIENCE_CATEGORIES.find((c) => c.id === activeCat)?.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · input data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <ExperienceCard
                  key={row.slug}
                  row={row}
                  query={query}
                  saved={saved.has(row.slug)}
                  onToggleSave={() =>
                    toggleSavedExperience({
                      slug: row.slug,
                      title: row.title,
                      category: row.category,
                      stopCount: row.stopCount,
                      days: row.days,
                      country: row.country,
                      region: row.region,
                    })
                  }
                />
              ))}
            </div>
            <p className="mono exp-note exp-note--foot">
              Generated from {catalog.rows.length.toLocaleString()} routes over the
              destination set. Distances are straight lines between stops; durations
              are estimates.
            </p>
          </>
        )}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          EXPERIENCES ARE GENERATED FROM DESTINATION, DETAIL AND TRAIL DATA · MAP ©
          OPENSTREETMAP · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
