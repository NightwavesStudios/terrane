import { useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import SearchField from "../components/SearchField";

export default function PeaksPage() {
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState("relevance");
  const [filter, setFilter] = useState("All peaks");

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
        description="A future index of the world's named mountains and summits. There are no peak records loaded in this foundation."
        aside={
          <div className="status-card">
            <span className="status-card__label">Index status</span>
            <strong>Awaiting dataset</strong>
            <span>Phase 02 · no records</span>
          </div>
        }
      />

      <section className="catalog-toolbar" aria-label="Peak discovery controls">
        <SearchField
          label="Search peaks"
          placeholder="Search by peak, range or country"
          hint="Peak search is not connected in Phase 01."
          onSubmit={(query) =>
            setNotice(
              query
                ? `“${query}” is ready for the index, but no peak records are loaded yet.`
                : "Enter a peak name when the index is connected.",
            )
          }
        />

        <label className="select-field">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="relevance">Relevance</option>
            <option value="elevation">Elevation</option>
            <option value="prominence">Prominence</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>

      <FilterChips
        label="Filter peaks"
        items={["All peaks", "Elevation", "Prominence", "Range"]}
        active={filter}
        onSelect={(value) => {
          setFilter(value);
          setNotice(`${value} filters will activate with the peak index.`);
        }}
      />

      <p className={`toolbar-notice${notice ? " toolbar-notice--visible" : ""}`} aria-live="polite">
        {notice}
      </p>

      <div className="results-meta">
        <span>0 peaks indexed</span>
        <span>Global peak index · not connected</span>
      </div>

      <EmptyState
        eyebrow="Peak index"
        title="The mountains are being charted."
        description="No peak records are loaded in Phase 01. This page is structured for thousands of summits, with search, filters, sorting and a stable detail route ready for the dataset."
      >
        <Link to="/peaks/preview" className="text-link">
          Preview the peak template <Icon name="arrow" size={16} />
        </Link>
      </EmptyState>
    </div>
  );
}
