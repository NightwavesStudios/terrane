import { useState } from "react";
import type { PlaceImage } from "../../lib/placeDetails";

/**
 * The sticky column on a place page: one save, one jump to the globe, the
 * coordinates, provenance and the photograph credit.
 *
 * It used to carry a second save button with a different label from the one on
 * the hero, which read as a different action on the same record. Saving belongs
 * to the hero; this column keeps the secondary work.
 */
export default function PlaceAside({
  onOpenGlobe,
  coordinatesText,
  site,
  wiki,
  commons,
  wd,
  photo,
}: {
  onOpenGlobe: () => void;
  coordinatesText: string;
  site?: string;
  wiki?: string;
  commons?: string;
  wd?: string;
  photo?: PlaceImage;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(coordinatesText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard permission is the reader's choice; do nothing. */
    }
  }

  return (
    <aside className="place-aside">
      <div className="aside-card">
        <button className="btn btn-light btn-full" onClick={onOpenGlobe}>
          See it on the globe →
        </button>
        <button className="btn btn-light btn-full" onClick={copy}>
          {copied ? "Coordinates copied" : "Copy coordinates"}
        </button>

        {site || wiki || commons || wd ? (
          <div className="place-links">
            {site ? (
              <a className="place-link" href={site} target="_blank" rel="noreferrer">
                <span>Official website</span>
                <span className="mono">↗</span>
              </a>
            ) : null}
            {wiki ? (
              <a className="place-link" href={wiki} target="_blank" rel="noreferrer">
                <span>Wikipedia</span>
                <span className="mono">↗</span>
              </a>
            ) : null}
            {commons ? (
              <a className="place-link" href={commons} target="_blank" rel="noreferrer">
                <span>Commons</span>
                <span className="mono">↗</span>
              </a>
            ) : null}
            {wd ? (
              <a
                className="place-link"
                href={`https://www.wikidata.org/wiki/${wd}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>Wikidata {wd}</span>
                <span className="mono">↗</span>
              </a>
            ) : null}
          </div>
        ) : null}

        {photo ? (
          <p className="mono place-source">
            Photo:{" "}
            <a href={photo.page} target="_blank" rel="noreferrer">
              {photo.credit}
            </a>{" "}
            ·{" "}
            <a href={photo.licenceUrl} target="_blank" rel="noreferrer">
              {photo.licence}
            </a>
          </p>
        ) : null}
        <p className="mono place-source">Data: Wikidata (CC0)</p>
      </div>
    </aside>
  );
}
