import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import ProgressRing from "../components/ProgressRing";
import StatCard from "../components/StatCard";
import { NH48_LIST } from "../data/nh48";
import { exportCsv, exportJson } from "../lib/export";
import { formatTripDate, tripPeakNames } from "../lib/progress";
import { PEAK_NAMES, useRecord } from "../state/RecordContext";

export default function ProgressPage() {
  const { profile, trips, startedLists, stats, progress } = useRecord();
  const units = profile?.units ?? "imperial";
  const record = { profile, startedLists, trips };

  if (!profile) {
    return (
      <div className="content-page">
        <PageHeader
          index="04"
          eyebrow="Progress"
          title={
            <>
              Your first <span className="display-italic">ascent</span> starts here.
            </>
          }
          description="A private record of the mountains you have stood on, with the dates and precision you actually know."
        />
        <EmptyState
          eyebrow="No record yet"
          title="Start with one summit."
          description="Sign in to make the NH 48 yours. The first climb is the only prerequisite."
        >
          <Link
            to={`/signin?returnTo=${encodeURIComponent("/lists/nh48?start=1")}`}
            className="button button--bright"
          >
            Start the NH 48
          </Link>
          <Link to="/peaks" className="button">Browse the 48</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="content-page">
      <PageHeader
        index="04"
        eyebrow="Progress"
        title={
          <>
            The shape of <span className="display-italic">a record.</span>
          </>
        }
        description={`${profile.displayName}'s climbs, attempts and started lists. This preview keeps the record in this browser; export before clearing it.`}
        aside={
          <div className="status-card">
            <span className="status-card__label">NH 48</span>
            <strong>{progress.started ? `${progress.percent}% complete` : "Not started"}</strong>
            <span>{progress.completed} of {progress.total} peaks</span>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Unique summits"
          value={String(stats.uniquePeaks)}
          unit="peaks"
          note="Summits, not attempts"
        />
        <StatCard
          label="Trips"
          value={String(stats.trips)}
          unit={stats.trips === 1 ? "trip" : "trips"}
          note="Each climb is a trip"
        />
        <StatCard
          label="Attempts"
          value={String(stats.attempts)}
          unit="on record"
          note="Attempts count as history"
        />
        <StatCard
          label="Winter trips"
          value={String(stats.winterTrips)}
          unit="Dec–Mar"
          note="Date precision respected"
        />
      </div>

      <div className="progress-layout">
        <section className="progress-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">The list</p>
              <h2>{NH48_LIST.title}</h2>
            </div>
            <span className="panel-heading__meta">{NH48_LIST.publisher}</span>
          </div>
          <div className="progress-panel__body">
            <ProgressRing completed={progress.completed} total={progress.total} />
            <div>
              <p className="detail-copy">
                {progress.started
                  ? progress.remaining
                    ? `${progress.remaining} peaks remain. The record includes every trip in this browser.`
                    : "Every required peak is in the record. The publisher remains the official source."
                  : "The list is not started. Open it to make it yours."}
              </p>
              <div className="form-actions">
                <Link to="/lists/nh48" className="button button--bright">
                  {progress.started ? "Open the list" : "Start the list"}
                </Link>
                <Link to="/log" className="button">
                  Log a climb
                </Link>
              </div>
            </div>
          </div>
        </section>

        <aside className="progress-side">
          <p className="eyebrow">Portable</p>
          <h2>Export the record.</h2>
          <p>JSON keeps every field. CSV is readable in a spreadsheet.</p>
          <div className="form-actions">
            <button type="button" className="button" onClick={() => exportJson(record)}>
              JSON
            </button>
            <button type="button" className="button" onClick={() => exportCsv(record)}>
              CSV
            </button>
          </div>
          <Link to="/settings" className="text-link">
            Settings and units <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>

      <section className="panel" aria-labelledby="recent-trips-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">The record</p>
            <h2 id="recent-trips-title">Recent trips</h2>
          </div>
          <span className="panel-heading__meta">{trips.length} total</span>
        </div>
        {trips.length ? (
          <div className="trip-list">
            {trips.slice(0, 8).map((trip) => (
              <Link to={`/log?trip=${trip.id}`} className="trip-row" key={trip.id}>
                <span>
                  <strong>{trip.title}</strong>
                  <small>{tripPeakNames(trip, PEAK_NAMES)} · {formatTripDate(trip)}</small>
                </span>
                <span className="trip-row__outcome">
                  {trip.peaks.length} {trip.peaks.length === 1 ? "peak" : "peaks"} · edit
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="detail-copy">
            No trips in the record yet. <Link to="/log">Log the first climb</Link> or{" "}
            <Link to="/log?mode=backfill">add a climb from your history</Link>.
          </p>
        )}
      </section>

      <p className="page-footnote">
        Units: {units === "imperial" ? "feet and miles" : "metres and kilometres"}. Date precision is preserved:
        a year-only climb is never displayed as an exact day.
      </p>
    </div>
  );
}
