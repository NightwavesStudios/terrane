import RidgeArt from "./RidgeArt";
import { DIFFICULTY_LABEL, TYPE_LABEL, type Place } from "../data/places";
import { navigate } from "../lib/router";

export default function PlaceCard({
  place,
  index,
}: {
  place: Place;
  index?: number;
}) {
  return (
    <button
      className="card"
      onClick={() => navigate(`/place/${place.slug}`)}
      aria-label={`${place.name}, ${place.country}`}
    >
      <div className="card-art">
        <RidgeArt hue={place.hue} className="card-art-svg" />
        <span className="card-type">{TYPE_LABEL[place.type]}</span>
        {typeof index === "number" && (
          <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
        )}
      </div>
      <div className="card-body">
        <h3>{place.name}</h3>
        <p className="card-region">
          {[place.region, place.country].filter(Boolean).join(" · ")}
        </p>
        <div className="card-meta">
          <span>
            {place.elevation ? `${place.elevation.toLocaleString()} m` : TYPE_LABEL[place.type]}
          </span>
          {place.difficulty ? (
            <span className={`grade grade-${place.difficulty}`}>
              {DIFFICULTY_LABEL[place.difficulty]}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
