import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { NH48_LIST, getNh48Peak } from "../data/nh48";
import { formatElevation } from "../lib/format";
import { formatTripDate, getPeakTrips } from "../lib/progress";
import { PEAK_NAMES, useRecord } from "../state/RecordContext";

export default function PeakDetailPage() {
  const { slug = "" } = useParams();
  const peak = getNh48Peak(slug);
  const navigate = useNavigate();
  const {
    profile,
    progress,
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

  const climbed = completedSlugs.has(peak.slug);
  const peakTrips = getPeakTrips(trips, peak.slug);
  const units = profile?.units ?? "imperial";
  const logTarget = `/log?peak=${peak.slug}`;
  const logHref = profile
    ? logTarget
    : `/signin?returnTo=${encodeURIComponent(logTarget)}`;
  const listStarted = startedLists.includes(NH48_LIST.id);

  function start() {
    if (!profile) {
      navigate(`/signin?returnTo=${encodeURIComponent("/lists/nh48?start=1")}`);
      return;
    }
    startList(NH48_LIST.id);
    navigate("/lists/nh48");
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
              Peaks / NH 48 / <span>#{peak.rank}</span>
            </p>
            <h1>{peak.name}</h1>
            <p className="peak-detail__lede">
              A {formatElevation(peak.elevationM, units)} summit in the {peak.range}. Part of the{" "}
              {NH48_LIST.title}, {NH48_LIST.edition}.
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
                  <dd>{formatElevation(peak.elevationM, units)}</dd>
                </div>
                <div className="detail-field">
                  <dt>Prominence</dt>
                  <dd>{formatElevation(peak.prominenceM, units)}</dd>
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
              <p className="detail-copy">
                Required peak in the <Link to="/lists/nh48">{NH48_LIST.title}</Link>, published by{" "}
                {NH48_LIST.publisher}. Terrane is not the official record.
              </p>
              {!listStarted ? (
                <button type="button" className="button button--bright" onClick={start}>
                  <Icon name="list" size={16} /> Start the NH 48
                </button>
              ) : (
                <Link to="/lists/nh48" className="text-link">
                  {progress.percent}% of the list complete <span aria-hidden="true">→</span>
                </Link>
              )}
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
                  <strong>Elevation, prominence:</strong> publisher and USGS GNIS facts via the catalog.
                  Displayed in {units === "imperial" ? "feet" : "metres"}.
                </p>
                <p>
                  <strong>List membership:</strong> {NH48_LIST.publisher}, {NH48_LIST.edition}.{" "}
                  <a href={NH48_LIST.sourceUrl} target="_blank" rel="noreferrer">
                    Publisher source
                  </a>
                  .
                </p>
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
              <Link to="/lists/nh48" className="button">
                <Icon name="list" size={17} /> Open the list
              </Link>
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
