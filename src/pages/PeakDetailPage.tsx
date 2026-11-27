import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { getListForPeak, getPeak } from "../data/lists";
import { formatElevation } from "../lib/format";
import { formatTripDate, getPeakTrips } from "../lib/progress";
import { PEAK_NAMES, useRecord } from "../state/RecordContext";

export default function PeakDetailPage() {
  const { slug = "" } = useParams();
  const peak = getPeak(slug);
  const navigate = useNavigate();
  const {
    profile,
    progressFor,
    trips,
    completedSlugs,
    startedLists,
    startList,
  } = useRecord();

  if (!peak) {
    return (
      <div className="content-page">
        <PageHeader
          index="02"
          eyebrow="Peaks / Not found"
          title={
            <>
              No peak <span className="display-italic">record.</span>
            </>
          }
          description={`“${slug}” is not one of the 48 indexed peaks.`}
        />
        <Link to="/peaks" className="text-link">
          Back to all peaks <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const lists = getListForPeak(peak);
  const primaryList = lists[0];
  const climbed = completedSlugs.has(peak.slug);
  const peakTrips = getPeakTrips(trips, peak.slug);
  const units = profile?.units ?? "imperial";
  const logTarget = `/log?peak=${peak.slug}`;
  const logHref = profile
    ? logTarget
    : `/signin?returnTo=${encodeURIComponent(logTarget)}`;
  const listStarted = primaryList ? startedLists.includes(primaryList.id) : false;
  const progress = primaryList ? progressFor(primaryList.id) : null;

  function start() {
    if (!primaryList) return;
    if (!profile) {
      navigate(
        `/signin?returnTo=${encodeURIComponent(`/lists/${primaryList.slug}?start=1`)}`,
      );
      return;
    }
    startList(primaryList.id);
    navigate(`/lists/${primaryList.slug}`);
  }

  return (
    <div className="content-page content-page--detail">
      <Link to="/peaks" className="back-link">
        <Icon name="arrow" size={15} /> Back to peaks
      </Link>

      <article className="peak-detail">
        <header className="peak-detail__header">
          <div>
            <p className="eyebrow">
              Peaks / {primaryList?.title ?? "Catalogue"} / <span>#{peak.rank}</span>
            </p>
            <h1>{peak.name}</h1>
            <p className="peak-detail__lede">
              A {formatElevation(peak.elevationM, units, peak.elevationFt)} summit in the {peak.range}.{" "}
              {primaryList ? `Part of ${primaryList.title}, ${primaryList.edition}.` : null}
            </p>
          </div>
          <span className="status-pill">{climbed ? "In your record" : "On your list"}</span>
        </header>

        <div className="peak-detail__layout">
          <div className="peak-detail__main">
            <section className="detail-section">
              <div className="section-heading">
                <span>01</span>
                <h2>Profile</h2>
              </div>
              <dl className="detail-fields">
                <div className="detail-field">
                  <dt>Elevation</dt>
                  <dd>{formatElevation(peak.elevationM, units, peak.elevationFt)}</dd>
                </div>
                <div className="detail-field">
                  <dt>Prominence</dt>
                  <dd>{formatElevation(peak.prominenceM, units, peak.prominenceFt)}</dd>
                </div>
                <div className="detail-field">
                  <dt>Range</dt>
                  <dd>{peak.range}</dd>
                </div>
                <div className="detail-field">
                  <dt>Coordinates</dt>
                  <dd>
                    {peak.lat?.toFixed(4)}, {peak.lon?.toFixed(4)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>02</span>
                <h2>List membership</h2>
              </div>
              {lists.map((list) => (
                <p className="detail-copy" key={list.id}>
                  Required peak in the <Link to={`/lists/${list.slug}`}>{list.title}</Link>, published by{" "}
                  {list.publisher}. {list.rules}
                </p>
              ))}
              {primaryList ? (
                !listStarted ? (
                  <button type="button" className="button button--bright" onClick={start}>
                    <Icon name="list" size={16} /> Start {primaryList.title}
                  </button>
                ) : (
                  <Link to={`/lists/${primaryList.slug}`} className="text-link">
                    {progress?.percent ?? 0}% of the list complete <span aria-hidden="true">→</span>
                  </Link>
                )
              ) : null}
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>03</span>
                <h2>Your record</h2>
              </div>
              {peakTrips.length ? (
                <div className="trip-list">
                  {peakTrips.slice(0, 4).map((trip) => (
                    <Link key={trip.id} to={`/log?trip=${trip.id}`} className="trip-row">
                      <span>
                        <strong>{formatTripDate(trip)}</strong>
                        <small>{trip.peaks.map((item) => PEAK_NAMES.get(item.slug) ?? item.slug).join(", ")}</small>
                      </span>
                      <span className="trip-row__outcome">{trip.peaks[0]?.outcome ?? "summit"}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="detail-copy">
                  No recorded climb yet. Log this summit or add it from your history.
                </p>
              )}
            </section>

            <section className="detail-section">
              <div className="section-heading">
                <span>04</span>
                <h2>How we know</h2>
              </div>
              <div className="source-panel">
                <p>
                  <strong>Name, coordinates:</strong>{" "}
                  <a href={peak.sourceUrl} target="_blank" rel="noreferrer">
                    NH48.info catalog
                  </a>{" "}
                  /{" "}
                  <a href={peak.osmUrl} target="_blank" rel="noreferrer">
                    OpenStreetMap
                  </a>
                  , checked 27 November 2026.
                </p>
                <p>
                  <strong>Elevation, prominence:</strong> publisher facts via the catalog.{" "}
                  {peak.elevationSourceUrl ? (
                    <a href={peak.elevationSourceUrl} target="_blank" rel="noreferrer">
                      Elevation source
                    </a>
                  ) : null}{" "}
                  Displayed in {units === "imperial" ? "feet" : "metres"}.
                </p>
                {lists.map((list) => (
                  <p key={list.id}>
                    <strong>List membership:</strong> {list.publisher}, {list.edition}.{" "}
                    <a href={list.sourceUrl} target="_blank" rel="noreferrer">
                      Publisher source
                    </a>
                    .
                  </p>
                ))}
              </div>
            </section>
          </div>

          <aside className="peak-detail__aside">
            <div className="detail-map" aria-label={`Location of ${peak.name}`}>
              <span className="detail-map__grid" aria-hidden="true" />
              <span className="detail-map__ring detail-map__ring--one" aria-hidden="true" />
              <span className="detail-map__ring detail-map__ring--two" aria-hidden="true" />
              <span className="detail-map__pin">
                <Icon name="pin" size={24} />
              </span>
              <span className="detail-map__label">
                {peak.lat?.toFixed(3)}, {peak.lon?.toFixed(3)} · White Mountains
              </span>
            </div>

            <div className="detail-actions">
              <Link to={logHref} className="button button--bright">
                <Icon name="check" size={17} /> Log this climb
              </Link>
              <Link to={`/log?mode=backfill&peak=${peak.slug}`} className="button">
                <Icon name="plus" size={17} /> Add from history
              </Link>
              {primaryList ? (
                <Link to={`/lists/${primaryList.slug}`} className="button">
                  <Icon name="list" size={17} /> Open the list
                </Link>
              ) : null}
            </div>
            <p className="muted-note">
              {profile
                ? "Your record is private and stored in this browser for the Phase A preview."
                : "Sign in to keep a private record. No email is sent in this local preview."}
            </p>
          </aside>
        </div>
      </article>
    </div>
  );
}
