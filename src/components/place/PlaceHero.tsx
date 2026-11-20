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
  saved,
  onToggleSave,
}: {
  name: string;
  alt: string;
  eyebrow: string;
  elevation?: number;
  hue: number;
  image?: PlaceImage;
  saved: boolean;
  onToggleSave: () => void;
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
        className={`place-save${saved ? " on" : ""}`}
        onClick={onToggleSave}
        aria-pressed={saved}
      >
        {saved ? "Saved ✓" : "Save"}
      </button>

      {photo && photo.credit ? (
        <a className="place-credit mono" href={photo.page} target="_blank" rel="noreferrer">
          {photo.credit} · {photo.licence}
        </a>
      ) : null}
    </div>
  );
}
