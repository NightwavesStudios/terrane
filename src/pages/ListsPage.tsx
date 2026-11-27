import { useState } from "react";
import EmptyState from "../components/EmptyState";
import FilterChips from "../components/FilterChips";
import PageHeader from "../components/PageHeader";
import SearchField from "../components/SearchField";

export default function ListsPage() {
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("All lists");

  return (
    <div className="content-page">
      <PageHeader
        index="03"
        eyebrow="Lists"
        title={
          <>
            Collections with a <span className="display-italic">summit.</span>
          </>
        }
        description="Peak-bagging lists will turn geography into a pursuit: regional challenges, elevation lists and personal collections."
        aside={
          <div className="status-card">
            <span className="status-card__label">List library</span>
            <strong>Awaiting lists</strong>
            <span>No completions recorded</span>
          </div>
        }
      />

      <section className="catalog-toolbar" aria-label="List discovery controls">
        <SearchField
          label="Search lists"
          placeholder="Search challenges, regions or collections"
          hint="List search is not connected in Phase 01."
          onSubmit={(query) =>
            setNotice(
              query
                ? `“${query}” will search the list library when it is connected.`
                : "List search is a visual placeholder for the coming library.",
            )
          }
        />
      </section>

      <FilterChips
        label="List categories"
        items={["All lists", "Regional", "Elevation", "State high points"]}
        active={category}
        onSelect={(value) => {
          setCategory(value);
          setNotice(`${value} lists are coming with the library.`);
        }}
      />

      <p className={`toolbar-notice${notice ? " toolbar-notice--visible" : ""}`} aria-live="polite">
        {notice}
      </p>

      <div className="list-anatomy" aria-label="Structure of a future list card">
        <span>List name</span>
        <span>Region</span>
        <span>Peak count</span>
        <span>Completion</span>
      </div>

      <EmptyState
        icon="list"
        eyebrow="List library"
        title="The lists are being drawn."
        description="No challenge memberships or completion counts are loaded in Phase 01. The page is ready for established lists, custom collections and progress indicators."
      />
    </div>
  );
}
