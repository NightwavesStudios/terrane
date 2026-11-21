import { useEffect, useState } from "react";
import RidgeArt from "../RidgeArt";
import { guideKind, type GuideCatalogRow } from "../../data/guide";
import { guideWhere, kilometresFrom, type GuideNear } from "../../lib/guide";
import { thumbAt } from "../../lib/placeDetails";
import { formatKm } from "../../lib/present";
import { navigate } from "../../lib/router";

/**
 * One curated Experience card.
 *
 * A photograph when the record carries a credited one, ridge art otherwise.
 * No difficulty, no route, no itinerary: a destination and the facts the record
 * actually holds.
 */
export default function GuideCard({
  row,
  near,
}: {
  row: GuideCatalogRow;
  near?: GuideNear | null;
}) {
  const kind = guideKind(row.kind);
  const where = guideWhere(row);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [row.photo?.url]);

  const photo = row.photo && !failed ? row.photo : null;

  return (
    <article className="exp-card guide-card">
      <button
        className="exp-card-open"
        onClick={() => navigate(`/experiences/${row.slug}`)}
        aria-label={`${row.name}, ${kind.one}`}
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
          <span className="exp-card-badge mono">{kind.one}</span>
          {photo ? (
            <span className="exp-card-credit mono">
              {photo.credit} · {photo.licence}
            </span>
          ) : null}
        </span>
        <span className="exp-card-body">
          <span className="exp-card-title">{row.name}</span>
          {where ? <span className="mono exp-card-meta">{where}</span> : null}
          <span className="guide-card-summary">{row.summary}</span>
          <span className="mono exp-card-stats">
            {[
              row.placeCount
                ? `${row.placeCount} place${row.placeCount === 1 ? "" : "s"} nearby`
                : "",
              row.trailCount
                ? `${row.trailCount} named trail${row.trailCount === 1 ? "" : "s"}`
                : "",
              "Wikipedia source",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {near ? (
            <span className="mono exp-card-near">
              {formatKm(kilometresFrom(row, near))} from {near.label}
            </span>
          ) : null}
        </span>
      </button>
    </article>
  );
}
