import { useEffect, useState } from "react";
import RidgeArt from "../RidgeArt";
import {
  experienceCategory,
  type ExperienceCatalogRow,
} from "../../data/experiences";
import {
  experienceWhere,
  kilometresFrom,
  matchedStop,
  type ExperienceNear,
} from "../../lib/experiences";
import { thumbAt } from "../../lib/placeDetails";
import { formatKm } from "../../lib/present";
import { navigate } from "../../lib/router";

/**
 * One collection card.
 *
 * A photograph when a place has a credited one, the generated ridge art when it
 * does not. The facts under the title are the ones the record actually holds:
 * where the collection is, how many places it gathers, how far apart they are,
 * and how many carry a Wikipedia reference. A search that matched a place says
 * so, because "includes Dufourspitze" is a better answer than a title that
 * happens not to contain the query.
 */
export default function ExperienceCard({
  row,
  query,
  near,
}: {
  row: ExperienceCatalogRow;
  query?: string;
  near?: ExperienceNear | null;
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
        onClick={() => navigate(`/collections/${row.slug}`)}
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
              `${row.stopCount} places`,
              `${formatKm(row.spanKm)} across`,
              `${row.sourceCount} Wikipedia sources`,
            ].join(" · ")}
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

    </article>
  );
}
