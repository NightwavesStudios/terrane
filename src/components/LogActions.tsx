import { markBagged, removeEntry, toggleWant, useLogEntry, type LogEntry } from "../lib/log";
import type { LogTarget } from "../lib/logTargets";

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function asEntry(target: LogTarget): LogEntry {
  return { ...target, state: "want", at: Date.now() };
}

/**
 * The two personal actions, wherever a place is shown.
 *
 * Want and Bagged are one record in two states, never a separate save control.
 * The date is captured on bagging and can be edited in the Log.
 */
export default function LogActions({
  target,
  compact = false,
  hideWant = false,
}: {
  target: LogTarget;
  compact?: boolean;
  hideWant?: boolean;
}) {
  const entry = useLogEntry(target.key);
  const done = entry?.state === "done";
  const want = entry?.state === "want";

  return (
    <div className={`log-actions${compact ? " log-actions--compact" : ""}`}>
      {hideWant ? null : (
        <button
          className={`btn btn-light${want ? " btn-want" : ""}`}
          onClick={() => toggleWant(asEntry(target))}
          aria-pressed={want}
          disabled={done}
        >
          {done ? "Bagged ✓" : want ? "Want ✓" : "Want to go"}
        </button>
      )}

      {done ? (
        <span className="log-done-stamp mono">
          {formatDate(entry?.date ?? entry?.at ?? Date.now())}
        </span>
      ) : (
        <button className="btn btn-light" onClick={() => markBagged(asEntry(target))}>
          I&apos;ve been
        </button>
      )}

      {done ? (
        <button
          className="log-undo mono"
          onClick={() => removeEntry(target.key)}
          aria-label={`Remove ${target.name} from the log`}
        >
          Undo
        </button>
      ) : null}

      {entry?.note ? <p className="log-note">{entry.note}</p> : null}
    </div>
  );
}
