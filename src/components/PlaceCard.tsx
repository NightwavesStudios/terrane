import { Link } from "react-router-dom";
import { KIND_META, APPROACH_META, type Adventure } from "../data/atlas";
import { formatCoords, formatDate, formatElevation } from "../lib/format";
import { useJournal } from "../lib/journal";
import Icon from "./Icon";

interface Props {
  adventure: Adventure;
  onClose: () => void;
  onLog: () => void;
}

export default function PlaceCard({ adventure, onClose, onLog }: Props) {
  const { entries } = useJournal();
  const mine = entries
    .filter((entry) => entry.adventureId === adventure.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const summit = mine.find((entry) => entry.outcome === "summit");
  const meta = KIND_META[adventure.kind];

  return (
    <article className="place-card" aria-live="polite">
      <header className="place-card__head">
        <span className="kind-tag">
          <span className="kind-dot" style={{ background: meta.color }} />
          <Icon name={meta.icon} size={13} />
          {meta.singular}
        </span>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Clear selection">
          ×
        </button>
      </header>

      <h2 className="place-card__name">{adventure.name}</h2>
      <p className="place-card__place">
        {adventure.region} · {adventure.country}
      </p>

      <dl className="place-card__stats">
        <div>
          <dt>Elevation</dt>
          <dd>{formatElevation(adventure.elevationM)}</dd>
        </div>
        <div>
          <dt>Continent</dt>
          <dd>{adventure.continent}</dd>
        </div>
        <div>
          <dt>Approach</dt>
          <dd>{APPROACH_META[adventure.approach].label}</dd>
        </div>
      </dl>

      <p className="place-card__coords mono">{formatCoords(adventure.lat, adventure.lon)}</p>
      <p className="place-card__note">{adventure.note}</p>

      {summit ? (
        <p className="place-card__status place-card__status--bagged">
          <Icon name="check" size={14} /> Summitted {formatDate(summit.date)}
        </p>
      ) : mine.length ? (
        <p className="place-card__status">
          <Icon name="pin" size={14} /> In your journal · {mine.length} outing
          {mine.length === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="place-card__status place-card__status--none">Not in your journal yet</p>
      )}

      <div className="place-card__actions">
        <button type="button" className="button button--primary" onClick={onLog}>
          <Icon name="plus" size={15} />
          Log an outing
        </button>
        <Link to={`/atlas/${adventure.id}`} className="button">
          Open profile
          <Icon name="arrow" size={15} />
        </Link>
      </div>
    </article>
  );
}
