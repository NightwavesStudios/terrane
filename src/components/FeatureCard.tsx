import { iconDataUrl, type KitIcon } from "../map/campIcon";
import { SOURCE_LABEL, category, sourceLicence, type Pick } from "../data/features";
import type { Place } from "../data/places";
import RidgeArt from "./RidgeArt";

/**
 * One card for every point on the map.
 *
 * A summit with a page and a campsite without one differ in what the card can
 * offer, not in what the card is. That is why there is no `KitPick` and no
 * `ReachPick` any more: one shape goes in, one card comes out.
 */
export default function FeatureCard({
  pick,
  nearPlace,
  nearKm,
  onClose,
  onOpenPlace,
}: {
  pick: Pick;
  nearPlace?: Place;
  nearKm?: number | null;
  onClose: () => void;
  onOpenPlace: (slug: string) => void;
}) {
  const cat = category(pick.cat);
  const title = pick.name || `Unnamed ${cat.one.toLowerCase()}`;
  const distance =
    nearPlace && nearKm != null
      ? `${nearKm < 10 ? nearKm.toFixed(1) : Math.round(nearKm)} km from ${nearPlace.name}`
      : "";
  const closeTo = nearPlace && nearKm != null && nearKm < 15;
  const source = pick.src ? SOURCE_LABEL[pick.src] ?? pick.src : "";
  const licence = pick.src ? sourceLicence(pick.src) : null;
  const distanceLabel =
    pick.distance && pick.distance > 0
      ? `${Math.round(pick.distance / 100) / 10} km`
      : "";

  return (
    <aside className={`pick pick--feature${pick.slug ? "" : " pick--pin"}`} aria-live="polite">
      <button className="pick-close" onClick={onClose} aria-label="Close place card">
        ×
      </button>
      <div className={`pick-art${pick.slug ? "" : " pick-art--kit"}`}>
        {typeof pick.hue === "number" ? (
          <RidgeArt hue={pick.hue} className="pick-art-svg" />
        ) : cat.icon ? (
          <img src={iconDataUrl(cat.icon as KitIcon, 120)} alt="" width={74} height={74} />
        ) : (
          <span
            className="pick-reach-dot"
            style={{ background: cat.colour ?? "#8ab4d8" }}
          />
        )}
      </div>
      <div className="pick-body">
        <p className="mono pick-eyebrow">
          {cat.one}
          {pick.where ? ` · ${pick.where}` : closeTo ? ` · near ${nearPlace?.name}` : ""}
        </p>
        <h2>{title}</h2>

        {pick.elev ? <p className="mono pick-meta">{pick.elev.toLocaleString()} m</p> : null}
        {pick.note ? <p className="mono pick-meta">{pick.note}</p> : null}
        {distanceLabel || pick.difficulty ? (
          <p className="mono pick-meta">
            {[distanceLabel, pick.difficulty].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {distance && !pick.where ? <p className="mono pick-meta">{distance}</p> : null}
        {source ? (
          <p className="mono pick-source">
            Data: {source}
            {licence ? (
              <>
                {" · "}
                <a href={licence.url} target="_blank" rel="noreferrer">
                  {licence.licence}
                </a>
              </>
            ) : null}
            {pick.url ? (
              <>
                {" · "}
                <a href={pick.url} target="_blank" rel="noreferrer">
                  source
                </a>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="pick-actions">
          {pick.book ? (
            <a className="btn btn-light" href={pick.book} target="_blank" rel="noreferrer">
              Book / reserve →
            </a>
          ) : null}
          {pick.slug ? (
            <button className="btn btn-light" onClick={() => onOpenPlace(pick.slug as string)}>
              View place →
            </button>
          ) : nearPlace ? (
            <button className="btn btn-light" onClick={() => onOpenPlace(nearPlace.slug)}>
              {closeTo ? `Read about ${nearPlace.name}` : `Nearest place: ${nearPlace.name}`} →
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
