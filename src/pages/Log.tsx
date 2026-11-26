import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import StateNotice from "../components/StateNotice";
import { SUMMIT_LISTS } from "../data/summits";
import { category } from "../data/features";
import {
  addCustom,
  logExport,
  logImport,
  logStats,
  markBagged,
  removeEntry,
  toggleWant,
  updateEntry,
  useLog,
  type LogEntry,
} from "../lib/log";
import { setMeta } from "../lib/meta";
import { navigate } from "../lib/router";

type View = "done" | "want";
type Undo = { entry: LogEntry; wasDone: boolean };

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateValue(at?: number): string {
  if (!at) return "";
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function entryWhere(entry: LogEntry): string {
  if (entry.listName) return entry.listName;
  if (entry.cat === "experience") return "Curated place";
  if (entry.kind === "custom") return "Custom ascent";
  return entry.where ?? category(entry.cat).one;
}

function entryHref(entry: LogEntry): string {
  if (entry.slug) {
    return entry.cat === "experience"
      ? `/experiences/${entry.slug}`
      : `/place/${entry.slug}`;
  }
  if (entry.listId) return `/lists/${entry.listId}`;
  if (typeof entry.lat === "number" && typeof entry.lon === "number") {
    return `/?at=${entry.lat.toFixed(3)},${entry.lon.toFixed(3)},12`;
  }
  return "/";
}

function statLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? singular : plural}`;
}

/**
 * The personal ledger.
 *
 * Bagged and want-to-go are the two states of one list. Dates and notes can be
 * edited here; the export/import pair exists because the log is local and no
 * server is holding a copy.
 */
export default function Log() {
  const entries = useLog();
  const stats = useMemo(() => logStats(entries), [entries]);
  const [view, setView] = useState<View>("done");
  const [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [elevation, setElevation] = useState("");
  const [customDate, setCustomDate] = useState(dateValue(Date.now()));
  const [note, setNote] = useState("");

  useEffect(() => {
    setMeta({
      title: "Your log — Terrane",
      description: "The peaks and places you have bagged or want to go to, kept in this browser.",
      path: "/log",
    });
  }, []);

  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), 7000);
    return () => window.clearTimeout(id);
  }, [undo]);

  const visible = useMemo(
    () =>
      entries
        .filter((entry) => entry.state === view)
        .sort((a, b) => (b.date ?? b.at) - (a.date ?? a.at)),
    [entries, view],
  );

  function remove(entry: LogEntry) {
    setUndo({ entry, wasDone: entry.state === "done" });
    removeEntry(entry.key);
  }

  function restore() {
    if (!undo) return;
    if (undo.wasDone) markBagged(undo.entry, undo.entry.date ?? undo.entry.at);
    else toggleWant(undo.entry);
    setUndo(null);
  }

  function saveCustom() {
    const added = addCustom({
      name,
      elevationM: Number(elevation) > 0 ? Number(elevation) : undefined,
      date: customDate ? new Date(`${customDate}T12:00:00`).getTime() : Date.now(),
      note: note.trim() || undefined,
    });
    if (!added) {
      setNotice("A name is required.");
      return;
    }
    setName("");
    setElevation("");
    setNote("");
    setCustomDate(dateValue(Date.now()));
    setNotice("");
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(logExport(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "terrane-log.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importLog(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = logImport(parsed);
      setNotice(
        result.ok
          ? `Imported ${statLabel(result.count, "entry", "entries")}.`
          : "That file is not a Terrane log.",
      );
    } catch {
      setNotice("That file could not be read.");
    }
  }

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head log-head">
        <p className="eyebrow">Log</p>
        <h1 className="page-title">Your log</h1>
        <p className="page-sub">
          The summits and places you have bagged, and the ones you want next.
          Everything is stored in this browser; no account and no upload.
        </p>
        <div className="log-head-actions">
          <button className="btn btn-light" onClick={() => navigate("/")}>
            Open the globe →
          </button>
          <button className="btn btn-light" onClick={exportLog}>
            Export JSON
          </button>
          <label className="btn btn-light log-import">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importLog(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <main className="summits log">
        <div className="summit-stats">
          <div className="summit-stat">
            <span className="mono summit-stat-label">Bagged</span>
            <strong>{stats.bagged.toLocaleString("en-US")}</strong>
            <span className="mono summit-stat-note">summits in your log</span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Want to go</span>
            <strong>{stats.want.toLocaleString("en-US")}</strong>
            <span className="mono summit-stat-note">peaks and places queued</span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Vertical</span>
            <strong>{stats.verticalM.toLocaleString("en-US")} m</strong>
            <span className="mono summit-stat-note">summed recorded elevation</span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Lists complete</span>
            <strong>{stats.listsComplete}</strong>
            <span className="mono summit-stat-note">of {SUMMIT_LISTS.length} sourced lists</span>
          </div>
        </div>

        <section className="log-lists" aria-labelledby="log-lists-title">
          <div className="summit-section-head">
            <h2 id="log-lists-title" className="mono summit-section-title">
              List progress
            </h2>
            <button className="mono summit-section-link" onClick={() => navigate("/lists")}>
              All lists →
            </button>
          </div>
          <div className="log-list-bars">
            {SUMMIT_LISTS.map((list) => {
              const done = stats.listProgress[list.id] ?? 0;
              const pct = Math.round((done / list.peaks.length) * 100);
              return (
                <button
                  key={list.id}
                  className="log-list-bar"
                  onClick={() => navigate(`/lists/${list.id}`)}
                >
                  <span className="log-list-name">{list.name}</span>
                  <span className="mono log-list-count">
                    {done}/{list.peaks.length}
                  </span>
                  <span className="log-bar" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="log-toolbar" role="group" aria-label="Show log entries">
          {(
            [
              ["done", `Bagged ${stats.bagged}`],
              ["want", `Want ${stats.want}`],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={`chip chip--small${view === id ? " on" : ""}`}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <StateNotice
            kind="empty"
            title={view === "done" ? "Nothing bagged yet." : "Nothing on the want list."}
            body={
              view === "done"
                ? "Bag a summit from the globe or a list, or add an ascent below."
                : "Open a peak or place and press Want to go. It will appear here."
            }
            action={{ label: "Open the globe →", onClick: () => navigate("/") }}
          />
        ) : (
          <ol className="log-rows">
            {visible.map((entry) => {
              const editingThis = editing === entry.key;
              return (
                <li key={entry.key} className="log-row">
                  <button className="log-row-main" onClick={() => navigate(entryHref(entry))}>
                    <span className="log-row-name">{entry.name}</span>
                    <span className="mono log-row-meta">
                      {[entryWhere(entry), entry.where && entry.listName ? entry.where : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <span className="mono log-row-elev">
                    {entry.elev ? `${entry.elev.toLocaleString("en-US")} m` : "—"}
                  </span>
                  <span className="mono log-row-date">
                    {entry.state === "done" ? formatDate(entry.date ?? entry.at) : "Want"}
                  </span>
                  <div className="log-row-actions">
                    <button
                      className="mono log-edit"
                      onClick={() => setEditing(editingThis ? null : entry.key)}
                    >
                      {editingThis ? "Close" : "Edit"}
                    </button>
                    <button
                      className="mono log-remove"
                      onClick={() => remove(entry)}
                      aria-label={`Remove ${entry.name} from the log`}
                    >
                      Remove
                    </button>
                  </div>

                  {entry.note && !editingThis ? (
                    <p className="log-row-note">{entry.note}</p>
                  ) : null}

                  {editingThis ? (
                    <form
                      className="log-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        const date = String(form.get("date") ?? "");
                        const nextNote = String(form.get("note") ?? "").trim();
                        updateEntry(entry.key, {
                          ...(date
                            ? { date: new Date(`${date}T12:00:00`).getTime() }
                            : {}),
                          note: nextNote,
                        });
                        setEditing(null);
                      }}
                    >
                      <label>
                        <span className="mono">Date</span>
                        <input
                          type="date"
                          name="date"
                          defaultValue={dateValue(entry.date ?? entry.at)}
                        />
                      </label>
                      <label>
                        <span className="mono">Note</span>
                        <input
                          name="note"
                          defaultValue={entry.note ?? ""}
                          placeholder="Conditions, companions, the view…"
                          maxLength={240}
                        />
                      </label>
                      <button className="btn btn-dark" type="submit">
                        Save
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        <section className="log-add" aria-labelledby="log-add-title">
          <h2 id="log-add-title" className="mono summit-section-title">
            Log an ascent not on a list
          </h2>
          <p className="mono log-add-note">
            A peak of your own, with the date you stood on it. It counts in your
            totals and stays local.
          </p>
          <form
            className="log-add-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveCustom();
            }}
          >
            <label>
              <span className="mono">Peak name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="A summit, a hill, a high point"
                required
                maxLength={80}
              />
            </label>
            <label>
              <span className="mono">Elevation (m)</span>
              <input
                value={elevation}
                onChange={(event) => setElevation(event.target.value)}
                inputMode="numeric"
                placeholder="optional"
              />
            </label>
            <label>
              <span className="mono">Date</span>
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
              />
            </label>
            <label className="log-add-note-field">
              <span className="mono">Note</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="optional"
                maxLength={240}
              />
            </label>
            <button className="btn btn-dark" type="submit">
              Add to log
            </button>
          </form>
          {notice ? (
            <p className="mono log-notice" role="status">
              {notice}
            </p>
          ) : null}
        </section>
      </main>

      {undo ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>Removed {undo.entry.name}</span>
          <button className="undo-action mono" onClick={restore}>
            Undo
          </button>
          <button className="undo-dismiss" onClick={() => setUndo(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          LOCAL TO THIS BROWSER · NO ACCOUNT · YOUR ASCENTS, NOT A CERTIFICATE
        </span>
      </footer>
    </div>
  );
}
