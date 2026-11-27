import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import Discover from "../components/Discover";
import { LISTS, PEAKS } from "../data/lists";
import { formatElevation } from "../lib/format";

const Globe = lazy(() => import("../components/MapGlobe"));

export default function ExplorePage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = selectedSlug ? PEAKS.find((peak) => peak.slug === selectedSlug) : undefined;

  return (
    <section className="home" aria-label="Terrane globe">
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe peaks={PEAKS} onSelect={setSelectedSlug} />
      </Suspense>
      <div className="globe-veil" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="map-tools">
        <Discover />
      </div>

      {selected ? (
        <aside className="globe-preview" aria-label={`${selected.name} preview`}>
          <button
            type="button"
            className="globe-preview__close"
            onClick={() => setSelectedSlug(null)}
            aria-label="Close peak preview"
          >
            ×
          </button>
          <p className="eyebrow">
            {selected.listIds?.includes("nh48") ? "NH 48" : "Colorado 14ers"} · #{selected.rank}
          </p>
          <h2>{selected.name}</h2>
          <p className="globe-preview__meta">
            {formatElevation(selected.elevationM, "imperial", selected.elevationFt)} · {selected.range}
          </p>
          <Link to={`/peaks/${selected.slug}`} className="text-link">
            Open peak <span aria-hidden="true">→</span>
          </Link>
        </aside>
      ) : (
        <aside className="globe-brief" aria-label="Complete lists">
          <p className="eyebrow">Two complete lists</p>
          <h2>From New England to the Rockies.</h2>
          <p>
            {PEAKS.length} sourced summits, {LISTS.length} publishers, one portable record. More lists arrive only
            when their membership and rules are complete.
          </p>
          <Link to="/lists" className="text-link">
            Open the lists <span aria-hidden="true">→</span>
          </Link>
        </aside>
      )}
    </section>
  );
}
