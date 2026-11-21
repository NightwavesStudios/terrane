import type { ReactNode } from "react";

type Kind = "loading" | "empty" | "error";

/**
 * One surface for the three states a data-backed view can be in.
 *
 * The app used to answer them with a bare `<p class="mono">` per page, which is
 * why an empty filter, a failed index and a slow first load all looked like the
 * same grey sentence. A loading state reserves the space it will fill; an error
 * says what failed and what still works; an empty state offers the way out.
 */
export default function StateNotice({
  kind,
  title,
  body,
  action,
  rows = 3,
  compact = false,
}: {
  kind: Kind;
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** How many skeleton bars a loading state reserves. */
  rows?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`state state--${kind}${compact ? " state--compact" : ""}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-busy={kind === "loading" ? "true" : undefined}
    >
      {kind === "loading" ? (
        <div className="state-skeleton" aria-hidden="true">
          {Array.from({ length: rows }).map((_, index) => (
            <span key={index} className="state-skeleton-bar" />
          ))}
        </div>
      ) : (
        <span className={`state-mark state-mark--${kind}`} aria-hidden="true">
          {kind === "error" ? "!" : "·"}
        </span>
      )}
      <p className="state-title">{title}</p>
      {body ? <p className="state-body">{body}</p> : null}
      {action ? (
        <button className="btn btn-dark state-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
