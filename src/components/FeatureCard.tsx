import { iconDataUrl, type KitIcon } from "../map/campIcon";
import { SOURCE_LABEL, category, sourceLicence, type Pick } from "../data/features";
import type { Place } from "../data/places";
import { pickFacts, pickTitle } from "../lib/present";
import { toggleSaved, useSavedSlugs } from "../lib/saved";
import RidgeArt from "./RidgeArt";

/**
 * One card for every point on the map.
 *
 * A summit with a page and a campsite without one differ in what the card can
 * offer, not in what the card is: one eyebrow, one title, one ordered fact
 * block, one provenance line. The facts come from `lib/present`, the same
 * helpers the Discover rows and the place page use, so a place cannot describe
 * itself two ways.
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
  /** Same-kind places nearby, from the bundled atlas. */
  related?: Pick[];
  onRelated?: (pick: Pick) => void;
  onClose: () => void;
  onOpenPlace: (slug: string) => void;
}) {
  const cat = category(pick.cat);
  const title = pickTitle(pick, cat.one);
  const savedSlugs = useSavedSlugs();
  const saved = pick.slug ? savedSlugs.has(pick.slug) : false;
  const near =
    nearPlace && nearKm != null ? { name: nearPlace.name, km: nearKm } : null;
  const source = pick.src ? SOURCE_LABEL[pick.src] ?? pick.src : "";
  const licence = pick.src ? sourceLicence(pick.src) : null;
  const facts = pickFacts(pick, near);

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
        <p className="mono pick-eyebrow">{cat.one}</p>
        <h2>{title}</h2>

        {facts.map((fact) => (
          <p className="mono pick-meta" key={fact}>
            {fact}
          </p>
        ))}

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

        {related.length > 0 ? (
          <div className="pick-related">
            <p className="mono pick-related-title">More {cat.label.toLowerCase()} nearby</p>
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

        <div className="pick-actions">
          {pick.slug ? (
            <button
              className={`btn btn-light${saved ? " btn-saved" : ""}`}
              onClick={() => {
                if (!pick.slug) return;
                toggleSaved({
                  slug: pick.slug,
                  name: title,
                  cat: pick.cat,
                  lat: pick.lat,
                  lon: pick.lon,
                  country: pick.country,
                  region: pick.region,
                });
              }}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          ) : null}
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
              {near && near.km < 15
                ? `Read about ${nearPlace.name}`
                : `Nearest place: ${nearPlace.name}`}{" "}
              →
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
