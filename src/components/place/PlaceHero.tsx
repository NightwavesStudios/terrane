import { useEffect, useState } from "react";
import RidgeArt from "../RidgeArt";
import { thumbAt, type PlaceImage } from "../../lib/placeDetails";

/**
 * The page's first screen: a photograph when the source has one, the generated
 * ridge art when it does not. The photo is credited in the corner and links to
 * its Commons file page; a broken image falls back to the art without a gap.
 */
export default function PlaceHero({
  name,
  alt,
  eyebrow,
  elevation,
  hue,
  image,
  logState,
  onToggleWant,
}: {
  name: string;
  alt: string;
  eyebrow: string;
  elevation?: number;
  hue: number;
  image?: PlaceImage;
  logState: "want" | "done" | null;
  onToggleWant: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image?.url]);

  const photo = image && !failed ? image : null;
  const srcSet = photo
    ? [640, 960, 1440]
        .map((width) => `${thumbAt(photo.url, width, photo.max)} ${width}w`)
        .join(", ")
    : undefined;

  return (
    <div className="place-hero">
      {photo ? (
        <img
          className="place-hero-photo"
          src={thumbAt(photo.url, 1440, photo.max)}
          srcSet={srcSet}
          sizes="(max-width: 860px) 100vw, 1240px"
          alt={alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <RidgeArt hue={hue} className="place-hero-art" />
      )}

      <div className="place-hero-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="place-title">{name}</h1>
        {elevation ? <p className="place-tagline">{elevation.toLocaleString()} m</p> : null}
      </div>

      <button
        className={`place-want${logState ? " on" : ""}`}
        onClick={onToggleWant}
        aria-pressed={Boolean(logState)}
        disabled={logState === "done"}
        aria-label={
          logState === "done"
            ? "This place is bagged"
            : logState === "want"
              ? "Remove this place from your list"
              : "Want to go to this place"
        }
      >
        {logState === "done" ? "Bagged ✓" : logState === "want" ? "On your list ✓" : "Want to go"}
      </button>

      {photo && photo.credit ? (
        <a className="place-credit mono" href={photo.page} target="_blank" rel="noreferrer">
          {photo.credit} · {photo.licence}
        </a>
      ) : null}
    </div>
  );
}
