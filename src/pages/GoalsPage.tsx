import { useMemo, useState, type FormEvent } from "react";
import GoalCard from "../components/GoalCard";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import {
  CUSTOM_METRICS,
  GOAL_METRICS,
  GOAL_PRESETS,
  type GoalMetric,
} from "../data/goals";
import { type StoredGoal, useJournal } from "../lib/journal";
import { currentSeason, goalProgress } from "../lib/progress";

export default function GoalsPage() {
  const { entries, goals, adoptGoal, addCustomGoal, removeGoal } = useJournal();
  const season = currentSeason();
  const [metric, setMetric] = useState<Exclude<GoalMetric, "list">>("summits");
  const [target, setTarget] = useState("6");
  const [title, setTitle] = useState("");

  const active = useMemo(
    () =>
      goals
        .map((goal) => ({ goal, progress: goalProgress(goal, entries) }))
        .sort((a, b) => {
          if (a.progress.complete !== b.progress.complete) return a.progress.complete ? 1 : -1;
          return b.progress.ratio - a.progress.ratio;
        }),
    [goals, entries],
  );

  const complete = active.filter((item) => item.progress.complete).length;
  const suggestions = GOAL_PRESETS.filter(
    (preset) => !goals.some((goal) => goal.id === preset.id),
  );

  function adopt(presetId: string) {
    const preset = GOAL_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const goal: StoredGoal = {
      id: preset.id,
      title: preset.title,
      metric: preset.metric,
      target: preset.target,
      year: preset.scope === "season" ? season : undefined,
      listId: preset.listId,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    adoptGoal(goal);
  }

  function submitCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = Number(target);
    if (!Number.isFinite(number) || number <= 0) return;
    const meta = GOAL_METRICS[metric];
    addCustomGoal({
      title: title.trim() || `${number.toLocaleString("en-US")} ${meta.unit}`,
      metric,
      target: Math.round(number),
      year: season,
    });
    setTitle("");
    setTarget(String(meta.step * 6));
  }

  return (
    <div className="content-page">
      <PageHeader
        index="04"
        eyebrow="Goals"
        title={
          <>
            Give the season a <span className="display-italic">shape.</span>
          </>
        }
        description="A goal is an intention, measured only by what you have logged. No forecast, no scheduled outings, no promise about the weather — just a direction and an honest count."
        aside={
          <div className="status-card">
            <span className="status-card__label">Season {season}</span>
            <strong>
              {active.length - complete} open · {complete} complete
            </strong>
            <span>Everything derived from the journal</span>
          </div>
        }
      />

      <div className="goal-metrics" aria-label="Goal summary">
        <div>
          <span className="mono">Active</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <span className="mono">Complete</span>
          <strong>{complete}</strong>
        </div>
        <div>
          <span className="mono">Season</span>
          <strong>{season}</strong>
        </div>
        <p>
          Goals are the one place Terrane looks forward. They stay tied to the journal:
          nothing here is a plan, and nothing marks itself done.
        </p>
      </div>

      <section className="goal-section" aria-labelledby="active-goals">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Looking ahead</p>
            <h2 id="active-goals">Your goals</h2>
          </div>
          <span className="panel-heading__meta">{active.length} adopted</span>
        </div>

        {active.length ? (
          <div className="goal-grid">
            {active.map(({ goal, progress }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress}
                onRemove={() => removeGoal(goal.id)}
              />
            ))}
          </div>
        ) : (
          <div className="goal-empty">
            <Icon name="target" size={26} />
            <div>
              <h3>No goals yet.</h3>
              <p>
                Adopt one below, or write your own measure of the season. The journal will
                do the counting.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="goal-builder" aria-labelledby="custom-goal">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">A measure of your own</p>
            <h2 id="custom-goal">Set a goal</h2>
          </div>
          <span className="panel-heading__meta">Counted this season</span>
        </div>

        <form className="goal-form" onSubmit={submitCustom}>
          <label className="field">
            <span>Name <em>optional</em></span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder="e.g. A summer of volcanoes"
            />
          </label>

          <label className="field">
            <span>Measure</span>
            <select
              value={metric}
              onChange={(event) => {
                const next = event.target.value as Exclude<GoalMetric, "list">;
                setMetric(next);
                setTarget(String(GOAL_METRICS[next].step * 6));
              }}
            >
              {CUSTOM_METRICS.map((value) => (
                <option key={value} value={value}>
                  {GOAL_METRICS[value].label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Target</span>
            <input
              type="number"
              inputMode="numeric"
              min={GOAL_METRICS[metric].min}
              step={GOAL_METRICS[metric].step}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
            />
          </label>

          <button type="submit" className="button button--primary goal-form__submit">
            <Icon name="plus" size={15} />
            Add goal
          </button>
        </form>
        <p className="goal-form__hint">{GOAL_METRICS[metric].hint}</p>
      </section>

      <section className="goal-section" aria-labelledby="suggested-goals">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Starting points</p>
            <h2 id="suggested-goals">Suggested goals</h2>
          </div>
          <span className="panel-heading__meta">Adopt one, change nothing about your data</span>
        </div>

        {suggestions.length ? (
          <div className="suggestion-grid">
            {suggestions.map((preset) => (
              <article className="suggestion" key={preset.id}>
                <span className="suggestion__tag mono">
                  {preset.scope === "season" ? `Season ${season}` : "All time"}
                  {preset.listId ? " · list" : ""}
                </span>
                <h3>{preset.title}</h3>
                <p>{preset.note}</p>
                <footer>
                  <span className="mono">
                    {preset.metric === "elevation"
                      ? `${preset.target.toLocaleString("en-US")} m`
                      : preset.metric === "list"
                        ? `${preset.target} peaks`
                        : `${preset.target} ${GOAL_METRICS[preset.metric as Exclude<GoalMetric, "list">]?.unit ?? "places"}`}
                  </span>
                  <button
                    type="button"
                    className="button button--small"
                    onClick={() => adopt(preset.id)}
                  >
                    <Icon name="plus" size={14} />
                    Adopt
                  </button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p className="page-footnote">
            Every suggested goal is already in your list. Write a custom one above when you
            want a different measure.
          </p>
        )}
      </section>
    </div>
  );
}
