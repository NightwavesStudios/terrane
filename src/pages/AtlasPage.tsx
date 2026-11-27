import { useMemo, useState } from "react";
import AdventureCard from "../components/AdventureCard";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import SearchField from "../components/SearchField";
import {
  ADVENTURES,
  CONTINENTS,
  KIND_META,
  KINDS,
  searchAdventures,
  type AdventureKind,
  type Continent,
} from "../data/atlas";
import { useJournal } from "../lib/journal";
import { summitedIds, visitedIds } from "../lib/progress";

type Sort = "az" | "height" | "journal";

const kindOptions: { label: string; value: AdventureKind | "all" }[] = [
  { label: "All places", value: "all" },
  ...KINDS.map((kind) => ({ label: KIND_META[kind].label, value: kind })),
];

export default function AtlasPage() {
  const { entries } = useJournal();
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<AdventureKind | "all">("all");
  const [continent, setContinent] = useState<Continent | "all">("all");
  const [sort, setSort] = useState<Sort>("az");

  const visited = useMemo(() => visitedIds(entries), [entries]);
  const summits = useMemo(() => summitedIds(entries), [entries]);

  const results = useMemo(() => {
    const matches = searchAdventures(term, { kind, continent });
    return [...matches].sort((a, b) => {
      if (sort === "height") return (b.elevationM ?? 0) - (a.elevationM ?? 0);
      if (sort === "journal") {
        const score = (id: string) => (summits.has(id) ? 2 : visited.has(id) ? 1 : 0);
        return score(b.id) - score(a.id) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [term, kind, continent, sort, visited, summits]);

  const activeKindLabel =
    kindOptions.find((option) => option.value === kind)?.label ?? "All places";

  const filtering = Boolean(term) || kind !== "all" || continent !== "all";

  function reset() {
    setTerm("");
    setKind("all");
    setContinent("all");
  }

  return (
    <div className="content-page">
      <PageHeader
        index="02"
        eyebrow="Atlas"
        title={
          <>
            Every way the <span className="display-italic">ground</span> rises.
          </>
        }
        description={`${ADVENTURES.length} places worth crossing the world for — summits first, then the volcanoes, deserts, ice, lakes and coast around them. A discovery index, not a guidebook: no routes, approach notes or conditions.`}
        aside={
          <div className="status-card">
            <span className="status-card__label">Atlas status</span>
            <strong>{ADVENTURES.length} places charted</strong>
            <span>
              {visited.size} in your journal · 7 continents
            </span>
          </div>
        }
      />

      <section className="catalog-toolbar" aria-label="Atlas filters">
        <SearchField
          label="Search the atlas"
          placeholder="Search a peak, range, country or kind"
          value={term}
          onChange={setTerm}
          hint="Filters as you type. Try “Andes”, “volcano” or “Japan”."
        />

        <label className="select-field">
          <span>Continent</span>
          <select
            value={continent}
            onChange={(event) => setContinent(event.target.value as Continent | "all")}
          >
            <option value="all">All continents</option>
            {CONTINENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="select-field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="az">A – Z</option>
            <option value="height">Highest first</option>
            <option value="journal">Your journal first</option>
          </select>
        </label>
      </section>

      <FilterChips
        label="Kind"
        items={kindOptions.map((option) => option.label)}
        active={activeKindLabel}
        onSelect={(label) => {
          const option = kindOptions.find((item) => item.label === label);
          if (option) setKind(option.value);
        }}
      />

      <div className="results-meta">
        <span>
          {results.length} of {ADVENTURES.length} places
        </span>
        <span>
          {visited.size} visited · {summits.size} summited
        </span>
      </div>

      {results.length ? (
        <div className="adventure-grid">
          {results.map((adventure) => (
            <AdventureCard
              key={adventure.id}
              adventure={adventure}
              visited={visited.has(adventure.id)}
              summit={summits.has(adventure.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="compass"
          eyebrow="No matches"
          title="Nothing on this line of the map."
          description="No place in the atlas matches that search and filter together. Widen the kind or clear the search to see all of the places."
        >
          <button type="button" className="text-link" onClick={reset}>
            Clear filters <Icon name="arrow" size={16} />
          </button>
        </EmptyState>
      )}

      {filtering && results.length ? (
        <p className="page-footnote">
          Showing a filtered atlas. Every place here can be logged from its profile; the
          journal, lists and goals all read from the same record.
        </p>
      ) : null}
    </div>
  );
}
