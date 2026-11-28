import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import PageHeader from "../components/PageHeader";
import PeakTable from "../components/PeakTable";
import SearchField from "../components/SearchField";
import { LISTS, PEAKS, peakListLabel } from "../data/lists";
import { useRecord } from "../state/RecordContext";

type Filter = "All peaks" | "NH 48" | "Colorado 14ers" | "Munros" | "ADK 46" | "Catskills" | "Climbed" | "Remaining";

const filters: Filter[] = ["All peaks", "NH 48", "Colorado 14ers", "Munros", "ADK 46", "Catskills", "Climbed", "Remaining"];

export default function PeaksPage() {
  const { completedSlugs, profile, units } = useRecord();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All peaks");
  const [sort, setSort] = useState("elevation");

  const peaks = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = PEAKS.filter((peak) => {
      const matches =
        !term ||
        peak.name.toLowerCase().includes(term) ||
        (peak.range ?? "").toLowerCase().includes(term) ||
        peakListLabel(peak).toLowerCase().includes(term);
      if (!matches) return false;
      if (filter === "NH 48") return peak.listIds?.includes("nh48");
      if (filter === "Colorado 14ers") return peak.listIds?.includes("co14ers");
      if (filter === "Munros") return peak.listIds?.includes("munros");
      if (filter === "ADK 46") return peak.listIds?.includes("adk46");
      if (filter === "Catskills") return peak.listIds?.includes("catskill3500");
      if (filter === "Climbed") return completedSlugs.has(peak.slug);
      if (filter === "Remaining") return !completedSlugs.has(peak.slug);
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return (b.elevationFt ?? b.elevationM * 3.28084) - (a.elevationFt ?? a.elevationM * 3.28084);
    });
  }, [query, filter, sort, completedSlugs]);

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Peak index"
        title={
          <>
            Every <span className="display-italic">summit.</span>
          </>
        }
        description={`${PEAKS.length} peaks across ${LISTS.length} complete lists. Search by name, range or list.`}
      />

      <section className="catalog-toolbar" aria-label="Peak discovery controls">
        <SearchField
          label="Search peaks"
          placeholder="Search a peak, range or list"
          hint="Try “Munros” or “Presidential.”"
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
        items={filters}
        active={filter}
        onSelect={(value) => setFilter(value as Filter)}
      />

      <div className="results-meta">
        <span>
          {peaks.length} {peaks.length === 1 ? "peak" : "peaks"}
        </span>
        <span>{profile ? "Your record is private" : "Sign in to keep a record"}</span>
      </div>

      {peaks.length ? (
        <PeakTable
          peaks={peaks}
          completed={completedSlugs}
          units={units}
        />
      ) : (
        <EmptyState
          eyebrow="No matching peaks"
          title="No summit matches that filter."
          description="Try another name, clear the search, or show the full catalogue."
        >
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setQuery("");
              setFilter("All peaks");
            }}
          >
            Show all {PEAKS.length} <span aria-hidden="true">→</span>
          </button>
        </EmptyState>
      )}

      <p className="page-footnote">
        Sources are linked from every peak page. <Link to="/about/data">Data and sources</Link>.
      </p>
    </div>
  );
}
