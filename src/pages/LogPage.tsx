import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { getList, PEAKS } from "../data/lists";
import { dateForPrecision, dateInputForPrecision } from "../lib/progress";
import { useRecord } from "../state/RecordContext";
import type { Peak } from "../types/geography";
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

const outcomes: { value: PeakOutcome; label: string }[] = [
  { value: "summit", label: "Summit" },
  { value: "attempt", label: "Attempt" },
  { value: "traverse", label: "Traverse" },
];

interface FormProps {
  editing?: Trip;
  initialPeak?: string;
  mode: TripSource;
  listPeaks: Peak[];
  returnTo: string;
}

function LogForm({ editing, initialPeak, mode, listPeaks, returnTo }: FormProps) {
  const navigate = useNavigate();
  const { addTrip, updateTrip, deleteTrip } = useRecord();
  const [selected, setSelected] = useState<string[]>(() => {
    if (editing) return editing.peaks.map((peak) => peak.slug);
    return initialPeak && listPeaks.some((peak) => peak.slug === initialPeak)
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
  const [detailsOpen, setDetailsOpen] = useState(Boolean(editing?.title || editing?.notes));
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  function save() {
    if (!validate()) return;
    if (editing) {
      updateTrip(editing.id, buildInput());
    } else {
      addTrip(buildInput());
    }
    navigate(returnTo, { replace: true });
  }

  function remove() {
    if (!editing) return;
    deleteTrip(editing.id);
    navigate(returnTo, { replace: true });
  }

  const available = listPeaks.filter((peak) => !selected.includes(peak.slug));

  return (
    <div className="log-page">
      <form
        className="log-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <section className="form-section">
          <div className="form-section__head">
            <h2>Peak</h2>
            <span className="form-hint">{selected.length} selected</span>
          </div>
          {selected.length ? (
            <div className="selected-peaks">
              {selected.map((slug) => {
                const peak = listPeaks.find((item) => item.slug === slug);
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
            <h2>When</h2>
            <span className="form-hint">Date precision is kept</span>
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

          <div className="outcome-field">
            <span>Outcome</span>
            <div className="segmented" role="group" aria-label="Outcome">
              {outcomes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={outcome === item.value ? "is-active" : ""}
                  aria-pressed={outcome === item.value}
                  onClick={() => setOutcome(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <details
          className="form-extra"
          open={detailsOpen}
          onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>Add a title or notes</span>
            <small>Optional</small>
          </summary>
          <label className="form-field">
            <span>Trip title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                selected.length > 1
                  ? "A ridge day"
                  : selected.length === 1
                    ? `Climbing ${listPeaks.find((peak) => peak.slug === selected[0])?.name ?? "a summit"}`
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
        </details>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-actions form-actions--log">
          <button type="submit" className="button button--bright">
            <Icon name="check" size={16} /> {editing ? "Save changes" : "Save climb"}
          </button>
          <Link to={returnTo} className="button button--quiet">
            Cancel
          </Link>
          {editing ? (
            confirmingDelete ? (
              <span className="delete-confirm" role="group" aria-label="Confirm deletion">
                <span>Remove this trip?</span>
                <button type="button" className="text-button text-button--danger" onClick={remove}>
                  Delete
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete trip
              </button>
            )
          ) : null}
        </div>
      </form>
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
  const list = listId ? getList(listId) : undefined;
  const listPeaks = list?.peaks ?? PEAKS;
  const initialPeak = params.get("peak") ?? undefined;
  const returnTo = safeReturnTo(
    params.get("returnTo") ??
      (list ? `/lists/${list.slug}` : "/progress"),
  );
  const current = `${location.pathname}${location.search}`;

  if (!hydrated) return <div className="content-page" aria-busy="true" />;
  if (!profile) {
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(current)}`} replace />;
  }

  return (
    <div className="content-page">
      <PageHeader
        eyebrow={editing ? "Edit climb" : mode === "backfill" ? "Past climb" : "Quick log"}
        title={
          <>
            {editing ? (
              <>
                Edit <span className="display-italic">climb.</span>
              </>
            ) : mode === "backfill" ? (
              <>
                Add a <span className="display-italic">past climb.</span>
              </>
            ) : (
              <>
                Log a <span className="display-italic">climb.</span>
              </>
            )}
          </>
        }
        description={
          list
            ? `Inside ${list.title}. Choose one or more peaks, then save.`
            : "Choose the peak, the date and the outcome. Notes can wait."
        }
      />

      <LogForm
        key={editing?.id ?? `${initialPeak ?? "new"}-${mode}-${listId ?? "all"}`}
        editing={editing}
        initialPeak={initialPeak}
        mode={mode}
        listPeaks={listPeaks}
        returnTo={returnTo}
      />
    </div>
  );
}
