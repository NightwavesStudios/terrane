import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import LogOutingDialog from "../components/LogOutingDialog";
import {
  APPROACH_META,
  KIND_META,
  adventureById,
  distanceKm,
  elevationLabel,
  nearbyAdventures,
} from "../data/atlas";
import { LISTS } from "../data/lists";
import { formatCoords, formatDate, formatDistance, formatElevation } from "../lib/format";
import { OUTCOME_META, useJournal } from "../lib/journal";
import { listProgress } from "../lib/progress";

export default function AdventureDetailPage() {
  const { adventureId } = useParams<{ adventureId: string }>();
  const adventure = adventureById(adventureId);
  const { entries, removeEntry } = useJournal();
  const [logging, setLogging] = useState(false);

  if (!adventure) {
    return (
      <div className="content-page">
        <Link to="/atlas" className="back-link">
          <Icon name="arrow" size={15} /> The atlas
        </Link>
        <EmptyState
          icon="compass"
          eyebrow="Atlas / Not found"
          title="That place is not in the atlas."
          description="The link may be out of date, or the place has a different name here. Browse the atlas to find it by range, country or kind."
        >
          <Link to="/atlas" className="text-link">
            Browse all places <Icon name="arrow" size={16} />
          </Link>
        </EmptyState>
      </div>
    );
  }

  const meta = KIND_META[adventure.kind];
  const entriesHere = entries
    .filter((entry) => entry.adventureId === adventure.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const summitEntry = entriesHere.find((entry) => entry.outcome === "summit");
  const listsWith = LISTS.filter((list) => list.members.includes(adventure.id));
  const nearby = nearbyAdventures(adventure, 4);

  const fields = [
    { label: elevationLabel(adventure.kind), value: formatElevation(adventure.elevationM) },
    {
      label: "Prominence",
      value: adventure.prominenceM ? formatElevation(adventure.prominenceM) : "—",
    },
    { label: "Continent", value: adventure.continent },
    { label: "Country", value: adventure.country },
    { label: "Range / region", value: adventure.region },
    { label: "Kind", value: meta.singular },
    { label: "Approach", value: APPROACH_META[adventure.approach].label },
    { label: "Coordinates", value: formatCoords(adventure.lat, adventure.lon) },
  ];

  return (
    <div className="content-page content-page--detail">
      <Link to="/atlas" className="back-link">
        <Icon name="arrow" size={15} /> The atlas
      </Link>

      <article className="peak-detail">
        <header className="peak-detail__header">
          <div>
            <p className="eyebrow">
              <span>02</span> / {meta.singular}
            </p>
            <h1>{adventure.name}</h1>
            <p className="peak-detail__lede">{adventure.note}</p>
            <p className="detail-coords mono">{formatCoords(adventure.lat, adventure.lon)}</p>
          </div>
          <div className="detail-status">
            <span className={`status-pill${summitEntry ? " status-pill--bagged" : ""}`}>
              {summitEntry ? "Summitted" : entriesHere.length ? "In your journal" : "Not logged"}
            </span>
            {summitEntry ? (
              <span className="detail-status__date mono">
                Summited {formatDate(summitEntry.date)}
              </span>
            ) : null}
          </div>
        </header>

        <div className="peak-detail__layout">
          <div className="peak-detail__main">
            <section className="detail-section">
              <div className="section-heading">
                <span>01</span>
                <h2>Profile</h2>
              </div>
              <dl className="detail-fields">
                {fields.map((field) => (
                  <div className="detail-field" key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>02</span>
                <h2>Why it is here</h2>
              </div>
              <p className="detail-copy">
                {meta.blurb} Terrane keeps a place like this in the atlas because it is worth
                knowing about and worth remembering — not because it has a route to follow.
              </p>
              <p className="detail-copy detail-copy--muted">
                There is no approach description, gear list or condition report on this page.
                If you go, the local picture will always be better than anything a discovery
                index can hold.
              </p>
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>03</span>
                <h2>Appears in</h2>
              </div>
              {listsWith.length ? (
                <div className="list-chips">
                  {listsWith.map((list) => {
                    const progress = listProgress(list, entries);
                    return (
                      <Link key={list.id} to="/lists" className="list-chip">
                        <span>{list.name}</span>
                        <em>
                          {progress.done.length}/{progress.members.length}
                        </em>
                        <Icon name="arrow" size={14} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="detail-copy detail-copy--muted">
                  This place is not a member of a list in the current library.
                </p>
              )}
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>04</span>
                <h2>Nearby</h2>
              </div>
              <ul className="nearby-list">
                {nearby.map((place) => (
                  <li key={place.id}>
                    <Link to={`/atlas/${place.id}`} className="nearby-row">
                      <span className="nearby-row__icon" style={{ color: KIND_META[place.kind].color }}>
                        <Icon name={KIND_META[place.kind].icon} size={16} />
                      </span>
                      <span className="nearby-row__name">
                        <strong>{place.name}</strong>
                        <span>
                          {place.country} · {formatDistance(distanceKm(adventure, place))}
                        </span>
                      </span>
                      <span className="nearby-row__elev">{formatElevation(place.elevationM)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="peak-detail__aside">
            <div className="detail-map" aria-label={`Approximate location of ${adventure.name}`}>
              <span className="detail-map__grid" aria-hidden="true" />
              <span className="detail-map__ring detail-map__ring--one" aria-hidden="true" />
              <span className="detail-map__ring detail-map__ring--two" aria-hidden="true" />
              <span className="detail-map__pin" style={{ color: meta.color }}>
                <Icon name={meta.icon} size={24} />
              </span>
              <span className="detail-map__label">{formatCoords(adventure.lat, adventure.lon)}</span>
            </div>

            <div className="detail-actions">
              <button type="button" className="detail-action detail-action--primary" onClick={() => setLogging(true)}>
                <span>Log an outing</span>
                <Icon name="plus" size={17} />
              </button>
              <Link to={`/?place=${adventure.id}`} className="detail-action">
                <span>Show on the globe</span>
                <Icon name="compass" size={17} />
              </Link>
            </div>
            <p className="muted-note">
              Logged outings are stored on this device. No account, no sharing, no tracking.
            </p>

            {entriesHere.length ? (
              <section className="place-entries" aria-label="Your outings here">
                <h3>Your outings</h3>
                <ul>
                  {entriesHere.map((entry) => (
                    <li key={entry.id}>
                      <span className={`entry-dot entry-dot--${entry.outcome}`} aria-hidden="true" />
                      <span className="place-entries__text">
                        <strong>{OUTCOME_META[entry.outcome].short}</strong>
                        <span>{formatDate(entry.date)}</span>
                        {entry.note ? <em>{entry.note}</em> : null}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeEntry(entry.id)}
                        aria-label={`Remove outing from ${formatDate(entry.date)}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="muted-note">
                Nothing logged here yet. An ascent or a visit both count; so does turning back.
              </p>
            )}
          </aside>
        </div>
      </article>

      {logging ? (
        <LogOutingDialog adventure={adventure} onClose={() => setLogging(false)} />
      ) : null}
    </div>
  );
}
