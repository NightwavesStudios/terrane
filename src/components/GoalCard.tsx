import type { GoalProgress } from "../lib/progress";
import type { StoredGoal } from "../lib/journal";
import Icon from "./Icon";

interface Props {
  goal: StoredGoal;
  progress: GoalProgress;
  onRemove?: () => void;
}

export default function GoalCard({ goal, progress, onRemove }: Props) {
  const percent = Math.round(progress.ratio * 100);

  return (
    <article className={`goal-card${progress.complete ? " goal-card--complete" : ""}`}>
      <header className="goal-card__head">
        <span className="goal-card__scope">
          {goal.year ? `Season ${goal.year}` : "All time"}
        </span>
        {onRemove ? (
          <button
            type="button"
            className="icon-button"
            onClick={onRemove}
            aria-label={`Remove goal: ${goal.title}`}
          >
            ×
          </button>
        ) : null}
      </header>

      <h3>{goal.title}</h3>
      <p className="goal-card__detail">{progress.detail}</p>

      <div
        className="meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${goal.title}: ${percent}% complete`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <footer className="goal-card__foot">
        <strong>
          {progress.value.toLocaleString("en-US")}
          <span> / {progress.target.toLocaleString("en-US")}</span>
        </strong>
        <span>{progress.complete ? "Complete" : `${progress.remaining} to go`}</span>
      </footer>

      {progress.complete ? (
        <p className="goal-card__complete">
          <Icon name="check" size={14} /> Goal met in the journal
        </p>
      ) : null}
    </article>
  );
}
