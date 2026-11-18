import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import FilterChips, { matches, type Filter } from "../components/FilterChips";
import PlaceCard from "../components/PlaceCard";
import { PLACES } from "../data/places";

const PAGE = 60;

export default function Explore() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLACES.filter((p) => matches(p, filter)).filter((p) =>
      q
        ? `${p.name} ${p.region ?? ""} ${p.country} ${p.tagline}`
            .toLowerCase()
            .includes(q)
        : true,
    );
  }, [filter, query]);

  useEffect(() => setLimit(PAGE), [filter, query]);

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head">
        <p className="eyebrow eyebrow--light">Explore</p>
        <h1 className="page-title">{PLACES.length.toLocaleString()} places.</h1>
        <p className="page-sub">
          Peaks, national parks, landmarks and hidden gems, each with real coordinates
          and a high point. Search by name, filter by type.
        </p>

        <div className="page-tools">
          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search peaks, parks, landmarks…"
            aria-label="Search places"
          />
          <FilterChips value={filter} onChange={setFilter} tone="light" />
        </div>
      </div>

      <div className="page-body">
        <p className="result-line mono">
          {places.length.toLocaleString()} {places.length === 1 ? "place" : "places"}
        </p>

        {places.length === 0 ? (
          <p className="empty">Nothing matches “{query}”. Try “gorge” or “falls”.</p>
        ) : (
          <>
            <div className="grid">
              {places.slice(0, limit).map((p, i) => (
                <PlaceCard key={p.slug} place={p} index={i} />
              ))}
            </div>
            {limit < places.length && (
              <div className="load-more">
                <button className="btn btn-dark" onClick={() => setLimit(limit + PAGE)}>
                  Load {Math.min(PAGE, places.length - limit)} more →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="foot">
        <span>
          Map © OpenStreetMap · OpenFreeMap · Terrain: Mapterhorn · Places © Wikidata (CC0)
        </span>
        <span className="mono">TERRANE · THE WORLD, WORTH THE DETOUR</span>
      </footer>
    </div>
  );
}
