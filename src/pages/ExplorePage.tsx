import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import Discover from "../components/Discover";
import Icon from "../components/Icon";
import { LISTS, PEAKS, peakListLabel } from "../data/lists";
import { formatElevation } from "../lib/format";
import { useRecord } from "../state/RecordContext";

const Globe = lazy(() => import("../components/MapGlobe"));

export default function ExplorePage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const { profile, units } = useRecord();
  const selected = selectedSlug ? PEAKS.find((peak) => peak.slug === selectedSlug) : undefined;
  const logTarget = selected ? `/log?peak=${selected.slug}` : "/log";
  const logHref = profile
    ? logTarget
    : `/signin?returnTo=${encodeURIComponent(logTarget)}`;

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

      <div className="explore-meta" aria-label={`${LISTS.length} complete lists and ${PEAKS.length} peaks`}>
        <Link to="/lists">
          <strong>{LISTS.length}</strong> lists
        </Link>
        <span aria-hidden="true">/</span>
        <span>
          <strong>{PEAKS.length}</strong> peaks
        </span>
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
            {peakListLabel(selected)} · #{selected.rank}
          </p>
          <h2>{selected.name}</h2>
          <p className="globe-preview__meta">
            {formatElevation(selected.elevationM, units, selected.elevationFt)} ·{" "}
            {selected.range}
          </p>
          <div className="globe-preview__actions">
            <Link to={`/peaks/${selected.slug}`} className="button">
              View peak
            </Link>
            <Link to={logHref} className="button button--bright">
              <Icon name="plus" size={15} /> Log climb
            </Link>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
