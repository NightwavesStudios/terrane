import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import PageHeader from "../components/PageHeader";
import PeakTable from "../components/PeakTable";
import SearchField from "../components/SearchField";
import { NH48_LIST, NH48_PEAKS } from "../data/nh48";
import { useRecord } from "../state/RecordContext";

type Filter = "All peaks" | "Climbed" | "Remaining";

export default function PeaksPage() {
  const { completedSlugs, profile } = useRecord();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All peaks");
  const [sort, setSort] = useState("elevation");

  const peaks = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = NH48_PEAKS.filter((peak) => {
      const matches =
        !term ||
        peak.name.toLowerCase().includes(term) ||
        (peak.range ?? "").toLowerCase().includes(term);
      if (!matches) return false;
      if (filter === "Climbed") return completedSlugs.has(peak.slug);
      if (filter === "Remaining") return !completedSlugs.has(peak.slug);
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.elevationM - a.elevationM;
    });
  }, [query, filter, sort, completedSlugs]);

  return (
    <div className="content-page">
      <PageHeader
        index="02"
        eyebrow="Peaks"
        title={
          <>
            The <span className="display-italic">high</span> places.
          </>
        }
        description="The 48 New Hampshire summits above 4,000 feet, with identity, elevation, range and list membership sourced. Unknown fields stay unknown."
        aside={
          <div className="status-card">
            <span className="status-card__label">Peak index</span>
            <strong>48 peaks indexed</strong>
            <span>{NH48_LIST.publisher} · 2026</span>
          </div>
        }
      />

      <section className="catalog-toolbar" aria-label="Peak discovery controls">
        <SearchField
          label="Search peaks"
          placeholder="Search by peak or range"
          hint="Search the NH 48. No global index is loaded in this slice."
          onChange={setQuery}
          onSubmit={setQuery}
        />

        <label className="select-field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="elevation">Elevation</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      <FilterChips
        label="Filter peaks"
        items={["All peaks", "Climbed", "Remaining"]}
        active={filter}
        onSelect={(value) => setFilter(value as Filter)}
      />

      <div className="results-meta">
        <span>{peaks.length} peaks</span>
        <span>{profile ? "Your record is private" : "Sign in to keep a record"}</span>
      </div>

      {peaks.length ? (
        <PeakTable
          peaks={peaks}
          completed={completedSlugs}
          units={profile?.units ?? "imperial"}
        />
      ) : (
        <EmptyState
          eyebrow="No matching peaks"
          title="No summit matches that filter."
          description="Try a different name, clear the search, or show all 48 peaks."
        >
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setQuery("");
              setFilter("All peaks");
            }}
          >
            Show all 48 <span aria-hidden="true">→</span>
          </button>
        </EmptyState>
      )}

      <p className="page-footnote">
        Elevations and coordinates are facts from the <a href={NH48_LIST.sourceUrl}>AMC list</a> and the{" "}
        <a href="https://nh48.info/catalog">NH48.info catalog</a>; OpenStreetMap node links are on each peak page.
        This index is intentionally not global in Phase A.
      </p>
      <Link to="/lists/nh48" className="text-link">
        Open the NH 48 list <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
