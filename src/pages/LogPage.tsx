import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { NH48_LIST, NH48_PEAKS } from "../data/nh48";
import { dateForPrecision, dateInputForPrecision } from "../lib/progress";
import { useRecord } from "../state/RecordContext";
import type { DatePrecision, PeakOutcome, Trip, TripSource } from "../types/record";

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function safeReturnTo(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/progress";
}

interface FormProps {
  editing?: Trip;
  initialPeak?: string;
  mode: TripSource;
  listId?: string;
  returnTo: string;
}

function LogForm({ editing, initialPeak, mode, listId, returnTo }: FormProps) {
  const navigate = useNavigate();
  const { addTrip, updateTrip, deleteTrip } = useRecord();
  const [selected, setSelected] = useState<string[]>(() => {
    if (editing) return editing.peaks.map((peak) => peak.slug);
    return initialPeak && NH48_PEAKS.some((peak) => peak.slug === initialPeak)
      ? [initialPeak]
      : [];
  });
  const [picker, setPicker] = useState("");
  const [precision, setPrecision] = useState<DatePrecision>(editing?.precision ?? "day");
  const [date, setDate] = useState(editing?.date ?? today());
  const [outcome, setOutcome] = useState<PeakOutcome>(
    editing?.peaks[0]?.outcome ?? "summit",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const source: TripSource = editing?.source ?? mode;

  function addPeak(slug: string) {
    if (!slug || selected.includes(slug)) return;
    setSelected((current) => [...current, slug]);
    setPicker("");
    setError("");
  }

  function removePeak(slug: string) {
    setSelected((current) => current.filter((item) => item !== slug));
  }

  function buildInput() {
    return {
      title,
      date: dateForPrecision(date, precision),
      precision,
      source,
      notes,
      peakSlugs: selected,
      outcome,
    };
  }

  function validate(): boolean {
    if (!selected.length) {
      setError("Add at least one peak.");
      return false;
    }
    if (!/^\d{4}/.test(date)) {
      setError("Add a valid date.");
      return false;
    }
    return true;
  }

  function save(andAnother = false) {
    if (!validate()) return;
    if (editing) {
      updateTrip(editing.id, buildInput());
      navigate(returnTo, { replace: true });
      return;
    }
    addTrip(buildInput());
    if (andAnother) {
      setSelected([]);
      setNotes("");
      setSaved("Saved. Add another climb from your history.");
      return;
    }
    navigate(returnTo, { replace: true });
  }

  function remove() {
    if (!editing) return;
    if (!window.confirm("Delete this trip from the record?")) return;
    deleteTrip(editing.id);
    navigate(returnTo, { replace: true });
  }

  const available = NH48_PEAKS.filter((peak) => !selected.includes(peak.slug));

  return (
    <div className="log-layout">
      <form
        className="log-form"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        <section className="form-section">
          <div className="form-section__head">
            <span className="eyebrow">01 / Peaks</span>
            <span className="form-hint">{selected.length} selected</span>
          </div>
          {selected.length ? (
            <div className="selected-peaks">
              {selected.map((slug) => {
                const peak = NH48_PEAKS.find((item) => item.slug === slug);
                return (
                  <span className="selected-peak" key={slug}>
                    {peak?.name ?? slug}
                    <button
                      type="button"
                      onClick={() => removePeak(slug)}
                      aria-label={`Remove ${peak?.name ?? slug}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="form-empty">Choose the summit or summits in this trip.</p>
          )}
          <label className="form-field">
            <span>Add a peak</span>
            <select
              value={picker}
              onChange={(event) => addPeak(event.target.value)}
              aria-label="Add a peak"
            >
              <option value="">Choose a peak</option>
              {available.map((peak) => (
                <option value={peak.slug} key={peak.slug}>
                  {peak.name} · {peak.range}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <span className="eyebrow">02 / When</span>
            <span className="form-hint">Precision is preserved</span>
          </div>
          <div className="form-grid">
            <label className="form-field">
              <span>Date precision</span>
              <select
                value={precision}
                onChange={(event) => setPrecision(event.target.value as DatePrecision)}
              >
                <option value="day">Exact day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </label>
            <label className="form-field">
              <span>When</span>
              {precision === "day" ? (
                <input
                  type="date"
                  value={dateInputForPrecision(date, precision)}
                  onChange={(event) => setDate(dateForPrecision(event.target.value, "day"))}
                  required
                />
              ) : precision === "month" ? (
                <input
                  type="month"
                  value={dateInputForPrecision(date, precision)}
                  onChange={(event) => setDate(dateForPrecision(`${event.target.value}-01`, "month"))}
                  required
                />
              ) : (
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={dateInputForPrecision(date, precision)}
                  onChange={(event) => setDate(dateForPrecision(`${event.target.value}-01-01`, "year"))}
                  required
                />
              )}
            </label>
          </div>
          <label className="form-field">
            <span>Outcome</span>
            <select value={outcome} onChange={(event) => setOutcome(event.target.value as PeakOutcome)}>
              <option value="summit">Summit</option>
              <option value="attempt">Attempt</option>
              <option value="traverse">Traverse</option>
            </select>
          </label>
        </section>

        <section className="form-section">
          <div className="form-section__head">
            <span className="eyebrow">03 / The record</span>
            <span className="form-hint">Optional</span>
          </div>
          <label className="form-field">
            <span>Trip title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                selected.length > 1
                  ? "A ridge day"
                  : selected.length === 1
                    ? `Climbing ${NH48_PEAKS.find((peak) => peak.slug === selected[0])?.name ?? "a summit"}`
                    : "Climbing day"
              }
            />
          </label>
          <label className="form-field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Conditions, companions, the thing you want to remember."
            />
          </label>
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {saved ? <p className="form-success" role="status">{saved}</p> : null}

        <div className="form-actions">
          <button type="submit" className="button button--bright">
            <Icon name="check" size={16} /> {editing ? "Save changes" : source === "backfill" ? "Add to history" : "Save climb"}
          </button>
          {!editing ? (
            <button type="button" className="button" onClick={() => save(true)}>
              Save &amp; add another
            </button>
          ) : (
            <button type="button" className="button button--danger" onClick={remove}>
              Delete trip
            </button>
          )}
          <Link to={returnTo} className="button">
            Cancel
          </Link>
        </div>
      </form>

      <aside className="log-aside">
        <p className="eyebrow">The principle</p>
        <h2>Fast enough for the trailhead.</h2>
        <p>
          A climb is a trip, not a checkmark. One date, one outcome and the peaks are enough; notes can wait.
          Past climbs are equal to new ones.
        </p>
        <dl className="log-facts">
          <div>
            <dt>List</dt>
            <dd>{listId === NH48_LIST.id ? NH48_LIST.title : "Your record"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{source === "backfill" ? "History backfill" : "Manual log"}</dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>Private in this browser</dd>
          </div>
        </dl>
        <p className="muted-note">
          The Phase A preview stores the record locally. Export before clearing the browser or deleting the record.
        </p>
      </aside>
    </div>
  );
}

export default function LogPage() {
  const { profile, trips, hydrated } = useRecord();
  const location = useLocation();
  const [params] = useSearchParams();
  const tripId = params.get("trip");
  const editing = tripId ? trips.find((trip) => trip.id === tripId) : undefined;
  const mode: TripSource = params.get("mode") === "backfill" ? "backfill" : "manual";
  const listId = params.get("list") ?? undefined;
  const initialPeak = params.get("peak") ?? undefined;
  const returnTo = safeReturnTo(
    params.get("returnTo") ??
      (listId === NH48_LIST.id ? "/lists/nh48" : "/progress"),
  );
  const current = `${location.pathname}${location.search}`;

  if (!hydrated) return <div className="content-page" aria-busy="true" />;
  if (!profile) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(current)}`} replace />;
  }

  return (
    <div className="content-page">
      <PageHeader
        index={editing ? "04 / Edit" : mode === "backfill" ? "04 / History" : "04 / Log"}
        eyebrow={mode === "backfill" ? "Add history" : "Quick log"}
        title={
          <>
            {mode === "backfill" && !editing ? (
              <>
                Put the <span className="display-italic">past</span> back.
              </>
            ) : (
              <>
                Mark the <span className="display-italic">summit.</span>
              </>
            )}
          </>
        }
        description={
          mode === "backfill"
            ? "Add a climb you already did. Use the precision you actually know; an approximate year is a valid record."
            : "The fast path: peak, date, outcome, save. Add notes only if they matter."
        }
        aside={
          <div className="status-card">
            <span className="status-card__label">Record</span>
            <strong>{profile.displayName}</strong>
            <span>{trips.length} trips saved</span>
          </div>
        }
      />

      <LogForm
        key={editing?.id ?? `${initialPeak ?? "new"}-${mode}`}
        editing={editing}
        initialPeak={initialPeak}
        mode={mode}
        listId={listId}
        returnTo={returnTo}
      />
    </div>
  );
}
