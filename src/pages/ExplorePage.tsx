import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import Discover from "../components/Discover";
import { NH48_PEAKS } from "../data/nh48";
import { formatElevation } from "../lib/format";

const Globe = lazy(() => import("../components/MapGlobe"));

export default function ExplorePage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = selectedSlug
    ? NH48_PEAKS.find((peak) => peak.slug === selectedSlug)
    : undefined;

  return (
    <section className="home" aria-label="Terrane globe">
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe peaks={NH48_PEAKS} onSelect={setSelectedSlug} />
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
          <p className="eyebrow">NH 48 · #{selected.rank}</p>
          <h2>{selected.name}</h2>
          <p className="globe-preview__meta">
            {formatElevation(selected.elevationM, "imperial")} · {selected.range}
          </p>
          <Link to={`/peaks/${selected.slug}`} className="text-link">
            Open peak <span aria-hidden="true">→</span>
          </Link>
        </aside>
      ) : (
        <aside className="globe-brief" aria-label="NH 48 list">
          <p className="eyebrow">The first complete list</p>
          <h2>New Hampshire 48</h2>
          <p>Forty-eight sourced summits. One record that can leave with you.</p>
          <Link to="/lists/nh48" className="text-link">
            Open the list <span aria-hidden="true">→</span>
          </Link>
        </aside>
      )}
    </section>
  );
}
