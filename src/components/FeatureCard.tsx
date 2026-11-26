import PickSheet from "./PickSheet";
import LogActions from "./LogActions";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import { SOURCE_LABEL, category, sourceLicence, type Pick } from "../data/features";
import { listsForPlace } from "../data/summits";
import type { Place } from "../data/places";
import { pickFacts, pickTitle, formatKm } from "../lib/present";
import { targetForPick } from "../lib/logTargets";
import { useTrailLinks } from "../lib/trailLinks";
import { navigate } from "../lib/router";
import RidgeArt from "./RidgeArt";

/**
 * One card for every point on the map.
 *
 * A peak card carries what the product is for: elevation, its sourced list(s),
 * the recorded trails around it, and the two personal states. A campsite card
 * carries the same facts and actions without pretending to be a summit.
 */
export default function FeatureCard({
  pick,
  nearPlace,
  nearKm,
  related = [],
  onRelated,
  onClose,
  onOpenPlace,
  onShowAround,
}: {
  pick: Pick;
  nearPlace?: Place;
  nearKm?: number | null;
  related?: Pick[];
  onRelated?: (pick: Pick) => void;
  onClose: () => void;
  onOpenPlace: (slug: string) => void;
  onShowAround?: () => void;
}) {
  const cat = category(pick.cat);
  const title = pickTitle(pick, cat.one);
  const near =
    nearPlace && nearKm != null ? { name: nearPlace.name, km: nearKm } : null;
  const source = pick.src ? SOURCE_LABEL[pick.src] ?? pick.src : "";
  const licence = pick.src ? sourceLicence(pick.src) : null;
  const facts = pickFacts(pick, near);
  const lists = listsForPlace(pick.slug);
  const trails = useTrailLinks(pick.slug ?? "");
  const target = targetForPick(pick);
  const osm = `https://www.openstreetmap.org/?mlat=${pick.lat.toFixed(4)}&mlon=${pick.lon.toFixed(
    4,
  )}#map=12/${pick.lat.toFixed(4)}/${pick.lon.toFixed(4)}`;

  return (
    <PickSheet
      className={`pick pick--feature${pick.slug ? "" : " pick--pin"}`}
      label={title}
      onClose={onClose}
    >
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
        <p className="mono pick-eyebrow">{cat.one}</p>
        <h2>{title}</h2>

        {lists.length > 0 ? (
          <div className="pick-lists">
            {lists.map(({ list, peak }) => (
              <button
                key={list.id}
                className="pick-list-badge mono"
                onClick={() => navigate(`/lists/${list.id}`)}
                title={`${list.name}: ${peak.name}`}
              >
                {list.name}
              </button>
            ))}
          </div>
        ) : null}

        {facts.map((fact) => (
          <p className="mono pick-meta" key={fact}>
            {fact}
          </p>
        ))}

        {lists.length > 0 ? (
          <p className="mono pick-meta pick-list-elevation">
            List elevation · {lists[0].peak.ft.toLocaleString("en-US")} ft
          </p>
        ) : null}

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

        {trails.length > 0 ? (
          <div className="pick-around">
            <p className="mono pick-related-title">Trails recorded nearby</p>
            <ul className="pick-around-list">
              {trails.slice(0, 4).map((trail) => (
                <li key={`${trail.name}-${trail.km}`}>
                  <span>{trail.name}</span>
                  <span className="mono">{formatKm(trail.km)}</span>
                </li>
              ))}
            </ul>
            <p className="mono pick-around-note">
              Named trails from the recorded trail links. Access and conditions are
              not verified.
            </p>
          </div>
        ) : null}

        {related.length > 0 ? (
          <div className="pick-related">
            <p className="mono pick-related-title">
              {pick.cat === "peak" ? "More peaks nearby" : `More ${cat.label.toLowerCase()} nearby`}
            </p>
            <div className="pick-related-list">
              {related.map((other) => (
                <button
                  key={other.slug ?? `${other.lat}-${other.lon}-${other.name}`}
                  className="pick-related-chip"
                  onClick={() => onRelated?.(other)}
                >
                  {other.name}
                  {other.country ? (
                    <span className="mono pick-related-meta"> · {other.country}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {onShowAround ? (
          <button className="pick-around-cta mono" onClick={onShowAround}>
            Show mapped camps, huts and trailheads →
          </button>
        ) : null}

        <LogActions target={target} />

        <div className="pick-actions">
          {pick.slug ? (
            <button className="btn btn-light" onClick={() => onOpenPlace(pick.slug as string)}>
              Read the full place →
            </button>
          ) : nearPlace ? (
            <button className="btn btn-light" onClick={() => onOpenPlace(nearPlace.slug)}>
              {near && near.km < 15
                ? `Read about ${nearPlace.name}`
                : `Nearest place: ${nearPlace.name}`}{" "}
              →
            </button>
          ) : null}
          <a
            className="btn btn-light"
            href={osm}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${title} in OpenStreetMap`}
          >
            Open in maps ↗
          </a>
        </div>
      </div>
    </PickSheet>
  );
}
