import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ExperienceCard from "../components/experiences/ExperienceCard";
import { PLACES } from "../data/places";
import {
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_DIFFICULTIES,
  type ExperienceCategoryId,
  type ExperienceDifficulty,
} from "../data/experiences";
import {
  filterExperiences,
  useExperienceCatalog,
  type ExperienceNear,
} from "../lib/experiences";
import { setMeta } from "../lib/meta";
import {
  toggleSavedExperience,
  useSavedExperienceSlugs,
} from "../lib/savedExperiences";

const nearLabel = (place: (typeof PLACES)[number]) =>
  `${place.name} — ${place.country}`;

/**
 * The Experiences section.
 *
 * Browse the generated routes, narrow them by kind and by walking difficulty,
 * search a title, a region, a country or a stop, or filter to what is walkable
 * from a named place. The catalog is one compact file; a card opens the route's
 * own shard. No mode tabs: the controls answer different questions and combine.
 */
export default function Experiences() {
  const catalog = useExperienceCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<ExperienceCategoryId | null>(null);
  const [difficulty, setDifficulty] = useState<ExperienceDifficulty | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<ExperienceNear | null>(null);
  const saved = useSavedExperienceSlugs();

  useEffect(() => {
    setMeta({
      title: "Experiences — Terrane",
      description:
        "Walking routes generated from geography: named trails, walking days, distances and difficulty, grouped into weekend, mountain, hiking, camping and national park experiences.",
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
    () => filterExperiences(catalog.rows, { query, category: activeCat, difficulty, near }),
    [catalog.rows, query, activeCat, difficulty, near],
  );

  const categoryCount = useMemo(
    () => filterExperiences(catalog.rows, { category: activeCat, difficulty, near }).length,
    [catalog.rows, activeCat, difficulty, near],
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
    setDifficulty(null);
    setNearTerm("");
    setNear(null);
  };

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head">
        <p className="eyebrow">Experiences</p>
        <h1 className="page-title">Routes the map suggests</h1>
        <p className="page-sub">
          Every route here is walked. Nearby destinations are grouped into a short
          sequence, named from the range, park or region they share, and split into
          walking days with the recorded trails nearest each stop. There is no
          hand-written itinerary in this list.
        </p>
      </div>

      <div className="exp-controls">
        <div className="exp-control-row">
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

          <div className="exp-search exp-search--near">
            <input
              value={nearTerm}
              onChange={(event) => chooseNear(event.target.value)}
              placeholder="Near a place — town, park or peak…"
              aria-label="Filter experiences by a nearby place"
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

        <div className="chips chips--light" role="group" aria-label="Filter experiences by kind">
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

        <div
          className="chips chips--light exp-chips--difficulty"
          role="group"
          aria-label="Filter experiences by difficulty"
        >
          <button
            className={`chip${difficulty ? "" : " on"}`}
            aria-pressed={!difficulty}
            onClick={() => setDifficulty(null)}
          >
            Any difficulty
          </button>
          {EXPERIENCE_DIFFICULTIES.map((level) => (
            <button
              key={level.id}
              className={`chip${difficulty === level.id ? " on" : ""}`}
              aria-pressed={difficulty === level.id}
              onClick={() => setDifficulty(difficulty === level.id ? null : level.id)}
            >
              {level.label}
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
                : "No routes match these filters."}
            </p>
            <button className="btn btn-dark" onClick={resetAll}>
              All experiences →
            </button>
          </div>
        ) : (
          <>
            <p className="mono exp-count">
              {rows.length.toLocaleString()} route{rows.length === 1 ? "" : "s"}
              {activeCat
                ? ` · ${EXPERIENCE_CATEGORIES.find((c) => c.id === activeCat)?.label}`
                : ""}
              {difficulty
                ? ` · ${EXPERIENCE_DIFFICULTIES.find((d) => d.id === difficulty)?.label}`
                : ""}
              {near ? ` · within 150 km of ${near.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · input data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <ExperienceCard
                  key={row.slug}
                  row={row}
                  query={query}
                  near={near}
                  saved={saved.has(row.slug)}
                  onToggleSave={() =>
                    toggleSavedExperience({
                      slug: row.slug,
                      title: row.title,
                      category: row.category,
                      difficulty: row.difficulty,
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
              Generated from {catalog.rows.length.toLocaleString()} walking routes over the
              destination set. Days follow Naismith's rule; distances are straight lines
              between stops, not trail distance.
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
