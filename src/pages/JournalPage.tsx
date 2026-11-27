import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import LogOutingDialog from "../components/LogOutingDialog";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import {
  ADVENTURES,
  KIND_META,
  adventureById,
  type Adventure,
} from "../data/atlas";
import { formatDate, formatElevation, formatNumber } from "../lib/format";
import {
  OUTCOME_META,
  useJournal,
  type JournalEntry,
} from "../lib/journal";
import {
  computeStats,
  currentSeason,
  goalProgress,
  seasonOf,
} from "../lib/progress";

type YearScope = number | "all";

export default function JournalPage() {
  const { entries, goals, removeEntry } = useJournal();
  const season = currentSeason();
  const [year, setYear] = useState<YearScope>(season);
  const [picking, setPicking] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [logId, setLogId] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(entries, year), [entries, year]);

  const rows = useMemo(() => {
    return entries
      .filter((entry) => year === "all" || seasonOf(entry.date) === year)
      .map((entry) => ({ entry, adventure: adventureById(entry.adventureId) }))
      .filter(
        (row): row is { entry: JournalEntry; adventure: Adventure } =>
          Boolean(row.adventure),
      )
      .sort((a, b) => b.entry.date.localeCompare(a.entry.date));
  }, [entries, year]);

  const logAdventure = adventureById(logId ?? undefined);

  const previewGoals = useMemo(
    () =>
      goals
        .map((goal) => ({ goal, progress: goalProgress(goal, entries) }))
        .filter((item) => item.goal.year === undefined || item.goal.year === season)
        .slice(0, 3),
    [goals, entries, season],
  );

  const scopeLabel = year === "all" ? "All time" : `Season ${year}`;

  return (
    <div className="content-page">
      <PageHeader
        index="05"
        eyebrow="Journal"
        title={
          <>
            The record, not the <span className="display-italic">plan.</span>
          </>
        }
        description="Summits, attempts and visits, written after the fact. The journal is the source every list, goal and marker on the globe reads from — no accounts, no GPS, no live tracking."
        aside={
          <div className="status-card">
            <span className="status-card__label">{scopeLabel}</span>
            <strong>
              {stats.outings} outing{stats.outings === 1 ? "" : "s"}
            </strong>
            <span>{stats.summits} summits · {stats.continents} continents</span>
          </div>
        }
      />

      <section className="stat-grid" aria-label="Journal statistics">
        <StatCard
          label="Summits"
          value={formatNumber(stats.summits)}
          unit="summits"
          note={`${stats.outings} outing${stats.outings === 1 ? "" : "s"} in scope`}
        />
        <StatCard
          label="Distinct places"
          value={formatNumber(stats.places)}
          unit="places"
          note={
            stats.highest
              ? `Highest: ${stats.highest.name}`
              : "Nothing logged in this scope"
          }
        />
        <StatCard
          label="Summit elevation"
          value={formatNumber(stats.elevation)}
          unit="m"
          note="Combined height of distinct summits"
        />
        <StatCard
          label="Lists complete"
          value={formatNumber(stats.listsComplete)}
          unit="lists"
          note="All time, across the library"
        />
      </section>

      <div className="journal-filters">
        <div className="chip-row" role="group" aria-label="Filter journal by season">
          <button
            type="button"
            className={`chip${year === season ? " chip--active" : ""}`}
            aria-pressed={year === season}
            onClick={() => setYear(season)}
          >
            Season {season}
          </button>
          <button
            type="button"
            className={`chip${year === season - 1 ? " chip--active" : ""}`}
            aria-pressed={year === season - 1}
            onClick={() => setYear(season - 1)}
          >
            Season {season - 1}
          </button>
          <button
            type="button"
            className={`chip${year === "all" ? " chip--active" : ""}`}
            aria-pressed={year === "all"}
            onClick={() => setYear("all")}
          >
            All time
          </button>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={() => setPicking((current) => !current)}
          aria-expanded={picking}
        >
          <Icon name="plus" size={15} />
          Log an outing
        </button>
      </div>

      {picking ? (
        <div className="inline-picker">
          <label className="field">
            <span>Place</span>
            <select value={newPlace} onChange={(event) => setNewPlace(event.target.value)}>
              <option value="">Choose a place from the atlas…</option>
              {ADVENTURES.map((adventure) => (
                <option key={adventure.id} value={adventure.id}>
                  {adventure.name} — {adventure.region}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            onClick={() => {
              setPicking(false);
              setNewPlace("");
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!newPlace}
            onClick={() => {
              setLogId(newPlace);
              setNewPlace("");
              setPicking(false);
            }}
          >
            Continue
          </button>
        </div>
      ) : null}

      <section className="journal-panel" aria-labelledby="outings-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{scopeLabel}</p>
            <h2 id="outings-title">Outings</h2>
          </div>
          <span className="panel-heading__meta">
            {rows.length} entr{rows.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {rows.length ? (
          <ul className="journal-list">
            {rows.map(({ entry, adventure }) => (
              <li className="journal-row" key={entry.id}>
                <span className="journal-row__date mono">{formatDate(entry.date)}</span>
                <Link className="journal-row__place" to={`/atlas/${adventure.id}`}>
                  <span
                    className="journal-row__icon"
                    style={{ color: KIND_META[adventure.kind].color }}
                  >
                    <Icon name={KIND_META[adventure.kind].icon} size={17} />
                  </span>
                  <span>
                    <strong>{adventure.name}</strong>
                    <span>
                      {adventure.region} · {adventure.country}
                    </span>
                  </span>
                </Link>
                <span className={`outcome-tag outcome-tag--${entry.outcome}`}>
                  {OUTCOME_META[entry.outcome].short}
                </span>
                <span className="journal-row__elev mono">
                  {formatElevation(adventure.elevationM)}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`Remove outing to ${adventure.name} on ${formatDate(entry.date)}`}
                >
                  ×
                </button>
                {entry.note ? <p className="journal-row__note">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="journal"
            eyebrow="No outings"
            title="Your journal is empty."
            description="Nothing has been logged in this stretch of the season. Add a summit, an attempt or a visit — each one feeds the lists, goals and markers."
          >
            <button type="button" className="text-link" onClick={() => setPicking(true)}>
              Log the first outing <Icon name="arrow" size={16} />
            </button>
          </EmptyState>
        )}
      </section>

      {previewGoals.length ? (
        <section className="journal-goals" aria-labelledby="journal-goals-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Looking ahead</p>
              <h2 id="journal-goals-title">Season goals</h2>
            </div>
            <Link to="/goals" className="text-link">
              All goals <Icon name="arrow" size={15} />
            </Link>
          </div>
          <ul>
            {previewGoals.map(({ goal, progress }) => (
              <li key={goal.id}>
                <Link to="/goals" className="journal-goal">
                  <span className="journal-goal__head">
                    <strong>{goal.title}</strong>
                    <em className="mono">
                      {progress.value.toLocaleString("en-US")} /{" "}
                      {progress.target.toLocaleString("en-US")}
                    </em>
                  </span>
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="page-footnote">
        Entries are stored in this browser, on this device. Clearing site data removes them.
        Terrane has no account system and sends nothing anywhere.
      </p>

      {logAdventure ? (
        <LogOutingDialog adventure={logAdventure} onClose={() => setLogId(null)} />
      ) : null}
    </div>
  );
}
