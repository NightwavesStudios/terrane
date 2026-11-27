import PickSheet from "./PickSheet";
import LogActions from "./LogActions";
import { SOURCE_LABEL, category, type Pick } from "../data/features";
import { listsForPlace } from "../data/summits";
import type { Place } from "../data/places";
import { pickFacts, pickTitle } from "../lib/present";
import { targetForPick } from "../lib/logTargets";
import { navigate } from "../lib/router";
import RidgeArt from "./RidgeArt";

/**
 * One card for every point on the map.
 *
 * A peak card carries what the product is for: elevation, its sourced list(s)
 * and the two personal states.
 */
export default function FeatureCard({
  pick,
  nearPlace,
  nearKm,
  related = [],
  onRelated,
  onClose,
  onOpenPlace,
}: {
  pick: Pick;
  nearPlace?: Place;
  nearKm?: number | null;
  related?: Pick[];
  onRelated?: (pick: Pick) => void;
  onClose: () => void;
  onOpenPlace: (slug: string) => void;
}) {
  const cat = category(pick.cat);
  const title = pickTitle(pick, cat.one);
  const near =
    nearPlace && nearKm != null ? { name: nearPlace.name, km: nearKm } : null;
  const source = pick.src ? SOURCE_LABEL[pick.src] ?? pick.src : "";
  const facts = pickFacts(pick, near);
  const lists = listsForPlace(pick.slug);
  const target = targetForPick(pick);
  const osm = `https://www.openstreetmap.org/?mlat=${pick.lat.toFixed(4)}&mlon=${pick.lon.toFixed(
    4,
  )}#map=12/${pick.lat.toFixed(4)}/${pick.lon.toFixed(4)}`;

  return (
    <PickSheet
      className="pick"
      label={title}
      onClose={onClose}
    >
      <div className={`pick-art${pick.slug ? "" : " pick-art--unlinked"}`}>
        {typeof pick.hue === "number" ? (
          <RidgeArt hue={pick.hue} className="pick-art-svg" />
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
