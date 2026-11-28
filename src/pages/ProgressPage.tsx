import { useState } from "react";
import { Link } from "react-router-dom";
import BadgeCase from "../components/BadgeCase";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import ProgressRing from "../components/ProgressRing";
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
    localRecord,
    importLocalRecord,
  } = useRecord();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const record = { profile, startedLists, listStarts, badges, listCompletions, trips };
  const startedCount = LISTS.filter((list) => progressFor(list.id).started).length;
  const recapYear = recapYears(trips)[0];
  const recap = recapForYear(trips, recapYear);
  const listRows = [...LISTS].sort(
    (a, b) => Number(progressFor(b.id).started) - Number(progressFor(a.id).started),
  );
  const focusList = [...LISTS]
    .filter((list) => progressFor(list.id).started)
    .sort((a, b) => progressFor(b.id).percent - progressFor(a.id).percent)[0];
  const focusProgress = focusList ? progressFor(focusList.id) : null;

  if (!profile) {
    return (
      <div className="content-page">
        <PageHeader
          eyebrow="Progress"
          title={
            <>
              Your first <span className="display-italic">ascent</span> starts here.
            </>
          }
          description="One summit is enough to begin a record. Sign in with a passkey to keep it across devices."
        />
        <EmptyState
          eyebrow="No record yet"
          title="Start with one summit."
          description="Start a list or log a climb. Your account keeps the record private and in sync."
        >
          <Link
            to={`/signin?returnTo=${encodeURIComponent("/lists/nh48?start=1")}`}
            className="button button--bright"
          >
            Start the NH 48
          </Link>
          <Link to="/peaks" className="button">
            Browse the catalogue
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Progress"
        title={
          <>
            Your <span className="display-italic">record.</span>
          </>
        }
        description={`${profile.displayName} · ${stats.trips} ${
          stats.trips === 1 ? "trip" : "trips"
        } · ${startedCount} of ${LISTS.length} lists started`}
      />

      {focusList && focusProgress ? (
        <section className="record-focus" aria-labelledby="focus-list-title">
          <ProgressRing
            completed={focusProgress.completed}
            total={focusProgress.total}
            label="peaks"
          />
          <div className="record-focus__copy">
            <p className="eyebrow">Current list</p>
            <h2 id="focus-list-title">{focusList.title}</h2>
            <p>
              {focusProgress.remaining
                ? `${focusProgress.remaining} ${
                    focusProgress.remaining === 1 ? "peak" : "peaks"
                  } to go`
                : "Complete"}
            </p>
          </div>
          <Link to={`/lists/${focusList.slug}`} className="button">
            Open list <Icon name="arrow" size={15} />
          </Link>
        </section>
      ) : null}

      {localRecord?.trips.length ? (
        <section className="local-migration" aria-label="Import local climbs">
          <div>
            <p className="eyebrow">From this browser</p>
            <strong>
              {localRecord.trips.length} earlier{" "}
              {localRecord.trips.length === 1 ? "climb" : "climbs"} can join this record.
            </strong>
            <span>They stay here until you choose to add them.</span>
            {importError ? (
              <span className="form-error" role="alert">
                {importError}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="button button--bright"
            disabled={importing}
            onClick={() => {
              setImporting(true);
              setImportError("");
              void importLocalRecord()
                .catch((error) => {
                  setImportError(
                    error instanceof Error ? error.message : "The import did not finish.",
                  );
                })
                .finally(() => setImporting(false));
            }}
          >
            {importing ? "Importing…" : "Import climbs"}
          </button>
        </section>
      ) : null}

      <section className="record-stats" aria-label="Record summary">
        <div>
          <strong>{stats.uniquePeaks}</strong>
          <span>Unique summits</span>
        </div>
        <div>
          <strong>{stats.daysOut}</strong>
          <span>{stats.daysOut === 1 ? "Day out" : "Days out"}</span>
        </div>
        <div>
          <strong>{stats.attempts}</strong>
          <span>{stats.attempts === 1 ? "Attempt" : "Attempts"}</span>
        </div>
        <div>
          <strong>
            {startedCount}
            <small>/{LISTS.length}</small>
          </strong>
          <span>Lists started</span>
        </div>
      </section>

      <section className="record-panel" aria-labelledby="lists-progress-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Lists</p>
            <h2 id="lists-progress-title">Progress by list</h2>
          </div>
        </div>

        <div className="progress-table">
          {listRows.map((list) => {
            const progress = progressFor(list.id);
            const completion = listCompletions.find((item) => item.listId === list.id);
            const count = completion
              ? "Complete"
              : progress.started
                ? `${progress.completed}/${progress.total}`
                : "Start";
            return (
              <Link to={`/lists/${list.slug}`} className="progress-row" key={list.id}>
                <span className="progress-row__name">
                  <strong>{list.title}</strong>
                  <small>
                    {list.publisher} · {list.peaks.length} peaks
                  </small>
                </span>
                <span className="progress-row__meter" aria-hidden="true">
                  <i style={{ width: `${progress.started ? progress.percent : 0}%` }} />
                </span>
                <span className={`progress-row__count${completion ? " is-complete" : ""}`}>
                  {count}
                </span>
                <Icon name="arrow" size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="record-columns">
        <section className="record-panel record-recent" aria-labelledby="recent-trips-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Climbs</p>
              <h2 id="recent-trips-title">Recent trips</h2>
            </div>
          </div>
          {trips.length ? (
            <div className="trip-table">
              {trips.slice(0, 6).map((trip) => (
                <Link to={`/log?trip=${trip.id}`} className="trip-table__row" key={trip.id}>
                  <span className="trip-table__date">{formatTripDate(trip)}</span>
                  <span className="trip-table__main">
                    <strong>{trip.title}</strong>
                    <small>{tripPeakNames(trip, PEAK_NAMES)}</small>
                  </span>
                  <span className="trip-table__count">
                    {trip.peaks.length} {trip.peaks.length === 1 ? "peak" : "peaks"}
                  </span>
                  <Icon name="arrow" size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <p>No trips yet. Log one, or add a climb from your history.</p>
            </div>
          )}
        </section>

        <aside className="record-side">
          <section className="side-card">
            <p className="eyebrow">Portable</p>
            <h2>Export</h2>
            <p>JSON or CSV.</p>
            <div className="side-actions">
              <button type="button" className="button" onClick={() => exportJson(record)}>
                JSON
              </button>
              <button type="button" className="button" onClick={() => exportCsv(record)}>
                CSV
              </button>
            </div>
            <Link to="/settings" className="text-link">
              Settings <Icon name="arrow" size={14} />
            </Link>
          </section>

          <section className="side-card side-card--year">
            <p className="eyebrow">{recapYear}</p>
            <h2>{recap.trips ? `${recap.summits} summits` : "No summits yet"}</h2>
            {recap.trips ? (
              <p>
                {recap.trips} {recap.trips === 1 ? "trip" : "trips"} · {recap.uniquePeaks} unique
              </p>
            ) : null}
            <div className="recap-months" aria-label={`${recapYear} months with summits`}>
              {recap.months.map((count, index) => (
                <span key={index} title={`${count} ${count === 1 ? "trip" : "trips"}`}>
                  <i style={{ height: `${Math.min(100, count * 18 + (count ? 14 : 0))}%` }} />
                  <small>{new Date(2000, index, 1).toLocaleDateString(undefined, { month: "narrow" })}</small>
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <BadgeCase facts={badgeFacts} awards={badges} trips={trips} />
    </div>
  );
}
