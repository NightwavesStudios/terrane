import { useEffect, useState } from "react";
import RidgeArt from "../RidgeArt";
import {
  experienceCategory,
  type ExperienceCatalogRow,
} from "../../data/experiences";
import {
  difficultyLabel,
  durationLabel,
  experienceWhere,
  formatKmMiles,
  kilometresFrom,
  matchedStop,
  type ExperienceNear,
} from "../../lib/experiences";
import { thumbAt } from "../../lib/placeDetails";
import { formatKm } from "../../lib/present";
import { navigate } from "../../lib/router";

/**
 * One experience card.
 *
 * A photograph when a stop has a credited one, the generated ridge art when it
 * does not. The facts under the title are the same ones the page uses: where the
 * route is, how many stops, how far, and the labelled estimate. A search that
 * matched a stop says so, because "includes Dufourspitze" is a better answer
 * than a title that happens not to contain the query.
 */
export default function ExperienceCard({
  row,
  query,
  near,
  saved,
  onToggleSave,
}: {
  row: ExperienceCatalogRow;
  query?: string;
  near?: ExperienceNear | null;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const category = experienceCategory(row.category);
  const [failed, setFailed] = useState(false);
  const match = query ? matchedStop(row, query) : undefined;
  const where = experienceWhere(row);

  useEffect(() => {
    setFailed(false);
  }, [row.photo?.url]);

  const photo = row.photo && !failed ? row.photo : null;

  return (
    <article className="exp-card">
      <button
        className="exp-card-open"
        onClick={() => navigate(`/experiences/${row.slug}`)}
        aria-label={`${row.title}, ${category.one}`}
      >
        <span className="exp-card-art">
          {photo ? (
            <img
              src={thumbAt(photo.url, 720, photo.max)}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          ) : (
            <RidgeArt hue={row.hue} className="exp-card-art-svg" />
          )}
          <span className="exp-card-badge mono">{category.one}</span>
          <span className={`exp-card-diff exp-card-diff--${row.difficulty}`}>
            {difficultyLabel(row.difficulty)}
          </span>
          {photo ? (
            <span className="exp-card-credit mono">
              {photo.credit} · {photo.licence}
            </span>
          ) : null}
        </span>
        <span className="exp-card-body">
          <span className="exp-card-title">{row.title}</span>
          {where ? <span className="mono exp-card-meta">{where}</span> : null}
          <span className="mono exp-card-stats">
            {[
              `${row.stopCount} stops`,
              formatKmMiles(row.distanceKm),
              durationLabel(row.durationHours, row.days),
            ].join(" · ")}
          </span>
          <span className="mono exp-card-day">
            Up to {formatKmMiles(row.maxDayKm)} a day
          </span>
          {near ? (
            <span className="mono exp-card-near">
              {formatKm(kilometresFrom(row, near))} from {near.label}
            </span>
          ) : null}
          {match ? (
            <span className="mono exp-card-match">Includes {match}</span>
          ) : null}
        </span>
      </button>

      <button
        className={`exp-card-save${saved ? " on" : ""}`}
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${row.title} from saved` : `Save ${row.title}`}
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </article>
  );
}
