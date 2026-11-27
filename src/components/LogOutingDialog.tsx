import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { KIND_META, type Adventure } from "../data/atlas";
import { formatElevation, todayISO } from "../lib/format";
import { OUTCOME_META, useJournal, type Outcome } from "../lib/journal";
import Icon from "./Icon";

interface Props {
  adventure: Adventure;
  onClose: () => void;
}

const OUTCOMES: Outcome[] = ["summit", "attempt", "visit"];

export default function LogOutingDialog({ adventure, onClose }: Props) {
  const { addEntry } = useJournal();
  const [date, setDate] = useState(todayISO());
  const [outcome, setOutcome] = useState<Outcome>(
    adventure.kind === "peak" || adventure.kind === "volcano" ? "summit" : "visit",
  );
  const [note, setNote] = useState("");
  const titleId = useId();
  const dateField = useRef<HTMLInputElement>(null);
  const meta = KIND_META[adventure.kind];

  useEffect(() => {
    dateField.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) return;
    addEntry({
      adventureId: adventure.id,
      date,
      outcome,
      note: note.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="dialog-layer" role="presentation" onClick={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__head">
          <span className="kind-tag">
            <span className="kind-dot" style={{ background: meta.color }} />
            <Icon name={meta.icon} size={13} />
            {meta.singular}
          </span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <h2 id={titleId}>Log {adventure.name}</h2>
        <p className="dialog__lede">
          {adventure.region} · {adventure.country} · {formatElevation(adventure.elevationM)}
        </p>

        <form className="dialog__form" onSubmit={submit}>
          <label className="field">
            <span>Date</span>
            <input
              ref={dateField}
              type="date"
              value={date}
              max={todayISO()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>

          <fieldset className="field field--choices">
            <legend>Outcome</legend>
            <div className="outcome-row">
              {OUTCOMES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`outcome${outcome === value ? " outcome--active" : ""}`}
                  aria-pressed={outcome === value}
                  onClick={() => setOutcome(value)}
                >
                  <strong>{OUTCOME_META[value].short}</strong>
                  <span>{OUTCOME_META[value].note}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Note <em>optional</em></span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={280}
              placeholder="Weather, company, the thing you want to remember."
            />
          </label>

          <div className="dialog__actions">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary">
              Add to journal
            </button>
          </div>
          <p className="dialog__note">
            Written after the fact. Terrane records what happened; it never plans or tracks a
            route.
          </p>
        </form>
      </section>
    </div>
  );
}
