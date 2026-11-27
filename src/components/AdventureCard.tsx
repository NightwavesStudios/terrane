import { Link } from "react-router-dom";
import { KIND_META, type Adventure } from "../data/atlas";
import { formatElevation } from "../lib/format";
import Icon from "./Icon";

interface Props {
  adventure: Adventure;
  summit?: boolean;
  visited?: boolean;
}

export default function AdventureCard({ adventure, summit = false, visited = false }: Props) {
  const meta = KIND_META[adventure.kind];

  return (
    <Link
      to={`/atlas/${adventure.id}`}
      className={`adventure-card${visited ? " adventure-card--visited" : ""}`}
    >
      <div className="adventure-card__top">
        <span className="kind-tag">
          <span className="kind-dot" style={{ background: meta.color }} />
          <Icon name={meta.icon} size={13} />
          {meta.singular}
        </span>
        <span className="adventure-card__elev">{formatElevation(adventure.elevationM)}</span>
      </div>

      <h3 className="adventure-card__name">{adventure.name}</h3>
      <p className="adventure-card__place">
        {adventure.region} · {adventure.country}
      </p>
      <p className="adventure-card__note">{adventure.note}</p>

      <div className="adventure-card__foot">
        <span>{adventure.continent}</span>
        {summit ? (
          <span className="visit-mark visit-mark--summit">
            <Icon name="check" size={13} /> Summitted
          </span>
        ) : visited ? (
          <span className="visit-mark">
            <Icon name="pin" size={13} /> Visited
          </span>
        ) : (
          <span className="card-arrow" aria-hidden="true">
            <Icon name="arrow" size={15} />
          </span>
        )}
      </div>
    </Link>
  );
}
