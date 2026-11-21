import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import GuideCard from "../components/guide/GuideCard";
import { PLACES } from "../data/places";
import { GUIDE_KINDS, type GuideKindId } from "../data/guide";
import { filterGuides, useGuideCatalog, type GuideNear } from "../lib/guide";
import { setMeta } from "../lib/meta";

const nearLabel = (place: (typeof PLACES)[number]) =>
  `${place.name} — ${place.country}`;

/**
 * The curated Experiences catalogue.
 *
 * These are the destinations Terrane has chosen to feature: a few hundred of the
 * most significant peaks, parks, falls, lakes and coastlines in the destination
 * database, each with its own editorial page. The full database remains on the
 * Globe. Collections are elsewhere, and gather Experiences at wide scope.
 */
export default function Experiences() {
  const catalog = useGuideCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<GuideKindId | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<GuideNear | null>(null);

  useEffect(() => {
    setMeta({
      title: "Experiences — Terrane",
      description:
        "A curated catalogue of the world's most significant outdoor destinations: parks, peaks, waterfalls, lakes and coastlines, each with an editorial page grounded in recorded geography.",
      path: "/experiences",
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(term), 150);
    return () => window.clearTimeout(id);
  }, [term]);

  const rows = useMemo(
    () => filterGuides(catalog.rows, { query, kind: activeKind, near }),
    [catalog.rows, query, activeKind, near],
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
    setActiveKind(null);
    setNearTerm("");
    setNear(null);
  };

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head guide-head">
        <p className="eyebrow">Experiences</p>
        <h1 className="page-title">The places worth the journey</h1>
        <p className="page-sub">
          A curated catalogue of significant outdoor destinations — not every
          mountain, lake or waterfall on the map. Each Experience is one real
          place, chosen for its scale, recorded features or protected status, and
          given a page built from its own geography. The Globe remains the full
          database; Collections gather these Experiences by country, great range,
          area or recorded long-distance trail.
        </p>
      </div>

      <div className="exp-controls">
        <div className="exp-control-row">
          <div className="exp-search">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search an Experience, country or nearby place…"
              aria-label="Search Experiences"
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
              aria-label="Filter Experiences by a nearby place"
              list="guide-near-options"
              spellCheck={false}
              autoComplete="off"
            />
            <datalist id="guide-near-options">
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

        <div className="chips chips--light" role="group" aria-label="Filter Experiences by kind">
          <button
            className={`chip${activeKind ? "" : " on"}`}
            aria-pressed={!activeKind}
            onClick={() => setActiveKind(null)}
          >
            All
          </button>
          {GUIDE_KINDS.map((kind) => (
            <button
              key={kind.id}
              className={`chip${activeKind === kind.id ? " on" : ""}`}
              aria-pressed={activeKind === kind.id}
              onClick={() => setActiveKind(activeKind === kind.id ? null : kind.id)}
              title={kind.blurb}
            >
              {kind.label}
            </button>
          ))}
        </div>

        {nearTerm && !near ? (
          <p className="mono exp-note">Pick a place from the list to measure from it.</p>
        ) : null}
      </div>

      <div className="exp-results">
        {catalog.status === "loading" ? (
          <p className="mono exp-note">Loading the curated catalogue…</p>
        ) : catalog.status === "error" ? (
          <p className="mono exp-note">
            The Experience index could not be loaded. The globe is unaffected.
          </p>
        ) : rows.length === 0 ? (
          <div className="exp-empty">
            <p>
              {searching
                ? `Nothing matches “${query.trim()}”.`
                : "No Experiences match these filters."}
            </p>
            <button className="btn btn-dark" onClick={resetAll}>
              All Experiences →
            </button>
          </div>
        ) : (
          <>
            <p className="mono exp-count">
              {rows.length.toLocaleString()} Experience{rows.length === 1 ? "" : "s"}
              {activeKind
                ? ` · ${GUIDE_KINDS.find((kind) => kind.id === activeKind)?.label}`
                : ""}
              {near ? ` · within 250 km of ${near.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <GuideCard key={row.slug} row={row} near={near} />
              ))}
            </div>
            <p className="mono exp-note exp-note--foot">
              {catalog.rows.length.toLocaleString()} curated destinations selected
              from the full catalogue. Every page links its Wikipedia source and
              includes only recorded features; access, closures and seasonal
              conditions are not verified.
            </p>
          </>
        )}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          EXPERIENCES ARE CURATED DESTINATIONS, NOT ITINERARIES · MAP ©
          OPENSTREETMAP · DATA: WIKIDATA · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
