import { Link } from "react-router-dom";
import BadgeCase from "../components/BadgeCase";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import ProgressRing from "../components/ProgressRing";
import StatCard from "../components/StatCard";
import { LISTS } from "../data/lists";
import { exportCsv, exportJson } from "../lib/export";
import { formatTripDate, tripPeakNames } from "../lib/progress";
import { recapForYear, recapYears } from "../lib/recap";
import { PEAK_NAMES, useRecord } from "../state/RecordContext";

export default function ProgressPage() {
  const {
    profile,
    trips,
    startedLists,
    listStarts,
    badges,
    listCompletions,
    badgeFacts,
    stats,
    progressFor,
  } = useRecord();
  const units = profile?.units ?? "imperial";
  const record = { profile, startedLists, listStarts, badges, listCompletions, trips };
  const years = recapYears(trips).slice(0, 3);
  const startedCount = LISTS.filter((list) => progressFor(list.id).started).length;

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
          description="Sign in to make a list yours. The first climb is the only prerequisite."
        >
          <Link
            to={`/signin?returnTo=${encodeURIComponent("/lists/nh48?start=1")}`}
            className="button button--bright"
          >
            Start the NH 48
          </Link>
          <Link to="/peaks" className="button">Browse the catalogue</Link>
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
            <span className="status-card__label">Lists</span>
            <strong>{startedCount} of {LISTS.length} started</strong>
            <span>{stats.uniquePeaks} unique summits in the record</span>
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
          label="Days out"
          value={String(stats.daysOut)}
          unit={stats.daysOut === 1 ? "day" : "days"}
          note={`${stats.trips} ${stats.trips === 1 ? "trip" : "trips"} on record`}
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

      <section className="progress-panel" aria-labelledby="lists-progress-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">The lists</p>
            <h2 id="lists-progress-title">Three complete records.</h2>
          </div>
          <span className="panel-heading__meta">Publisher editions · not official</span>
        </div>
        <div className="list-progress-grid">
          {LISTS.map((list) => {
            const progress = progressFor(list.id);
            const completion = listCompletions.find((item) => item.listId === list.id);
            return (
              <article className="list-progress-card" key={list.id}>
                <div>
                  <p className="eyebrow">{list.publisher}</p>
                  <h3>{list.title}</h3>
                  <p>{list.edition}</p>
                </div>
                {progress.started ? (
                  <ProgressRing completed={progress.completed} total={progress.total} />
                ) : (
                  <div className="start-mark start-mark--small" aria-label="List not started">
                    <span>Not started</span>
                    <small>{list.peaks.length} peaks</small>
                  </div>
                )}
                <div className="list-progress-card__foot">
                  <span>
                    {completion
                      ? `Completed ${new Date(completion.completedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                      : progress.started
                        ? `${progress.completed}/${progress.total} · ${progress.percent}%`
                        : `${list.peaks.length} peaks`}
                  </span>
                  <Link to={`/lists/${list.slug}`} className="text-link">
                    {completion ? "View record" : progress.started ? "Continue" : "Start"}{" "}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <BadgeCase facts={badgeFacts} awards={badges} trips={trips} />

      <section className="recap" aria-labelledby="recap-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">The years</p>
            <h2 id="recap-title">Annual record.</h2>
          </div>
          <span className="panel-heading__meta">No projections</span>
        </div>
        <div className="recap-grid">
          {years.map((year) => {
            const recap = recapForYear(trips, year);
            return (
              <article className="recap-card" key={year}>
                <p className="eyebrow">{year}</p>
                <h3>{recap.trips ? `${recap.summits} ${recap.summits === 1 ? "summit" : "summits"}` : "No trips yet"}</h3>
                <p>
                  {recap.trips
                    ? `${recap.trips} ${recap.trips === 1 ? "trip" : "trips"} · ${recap.uniquePeaks} unique ${recap.uniquePeaks === 1 ? "peak" : "peaks"}${recap.attempts ? ` · ${recap.attempts} ${recap.attempts === 1 ? "attempt" : "attempts"}` : ""}`
                    : "The year is open. Nothing is filled in for you."}
                </p>
                <div className="recap-months" aria-label={`${year} months with summits`}>
                  {recap.months.map((count, index) => (
                    <span key={index} title={`${count} summit ${count === 1 ? "trip" : "trips"}`}>
                      <i style={{ height: `${Math.min(100, count * 18 + (count ? 14 : 0))}%` }} />
                      <small>{new Date(2000, index, 1).toLocaleDateString(undefined, { month: "narrow" })}</small>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="progress-layout">
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

        <aside className="progress-side">
          <p className="eyebrow">Portable</p>
          <h2>Export the record.</h2>
          <p>JSON keeps every field and both list progresses. CSV is readable in a spreadsheet.</p>
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

      <p className="page-footnote">
        Units: {units === "imperial" ? "feet and miles" : "metres and kilometres"}. Date precision is preserved:
        a year-only climb is never displayed as an exact day. Started lists only show progress; an unstarted list
        is never presented as 0% complete.
      </p>
    </div>
  );
}
