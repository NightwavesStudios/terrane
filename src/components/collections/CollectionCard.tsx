import { useEffect, useState } from "react";
import RidgeArt from "../RidgeArt";
import {
  collectionScope,
  type CollectionCatalogRow,
} from "../../data/collections";
import {
  kilometresFrom,
  matchedExperience,
  type CollectionNear,
} from "../../lib/collections";
import { thumbAt } from "../../lib/placeDetails";
import { formatKm } from "../../lib/present";
import { navigate } from "../../lib/router";

/**
 * One wide Collection card.
 *
 * A credited photograph when the leading Experience has one, ridge art
 * otherwise. The facts are the ones the generated record holds: how many
 * Experiences it gathers, the countries it spans, how many places sit around
 * them, and the first few names. No route and no day count.
 */
export default function CollectionCard({
  row,
  query,
  near,
}: {
  row: CollectionCatalogRow;
  query?: string;
  near?: CollectionNear | null;
}) {
  const scope = collectionScope(row.scope);
  const [failed, setFailed] = useState(false);
  const match = query ? matchedExperience(row, query) : undefined;
  const names = row.experienceNames.slice(0, 3);

  useEffect(() => {
    setFailed(false);
  }, [row.photo?.url]);

  const photo = row.photo && !failed ? row.photo : null;

  return (
    <article
      className="exp-card collection-card"
      data-collection-slug={row.slug}
      data-collection-scope={row.scope}
    >
      <button
        className="exp-card-open"
        onClick={() => navigate(`/collections/${row.slug}`)}
        aria-label={`${row.title}, ${scope.one}, ${row.experienceCount} Experiences`}
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
          <span className="exp-card-badge mono">{scope.one}</span>
          {photo ? (
            <span className="exp-card-credit mono">
              {photo.credit} · {photo.licence}
            </span>
          ) : null}
        </span>
        <span className="exp-card-body">
          <span className="exp-card-title">{row.title}</span>
          <span className="mono exp-card-meta">{row.where}</span>
          <span className="mono exp-card-stats">
            {[
              `${row.experienceCount} Experience${row.experienceCount === 1 ? "" : "s"}`,
              `${row.countryCount} countr${row.countryCount === 1 ? "y" : "ies"}`,
              `${row.placeCount.toLocaleString()} recorded places`,
            ].join(" · ")}
          </span>
          <span className="collection-card-names">
            {names.length ? `Includes ${names.join(", ")}` : ""}
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
