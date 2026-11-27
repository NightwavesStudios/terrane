import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

const stats = [
  { label: "Peaks climbed", value: "—", unit: "peaks", note: "No ascents recorded" },
  { label: "Elevation gained", value: "—", unit: "m", note: "No ascents recorded" },
  { label: "Lists completed", value: "—", unit: "lists", note: "No lists completed" },
  { label: "Goals active", value: "—", unit: "goals", note: "No goals set" },
];

export default function ProgressPage() {
  return (
    <div className="content-page">
      <PageHeader
        index="04"
        eyebrow="Progress"
        title={
          <>
            Your <span className="display-italic">vertical</span> record.
          </>
        }
        description="A personal climbing dashboard for ascents, elevation, completed lists and the high places still ahead."
        aside={
          <div className="status-card">
            <span className="status-card__label">Climbing log</span>
            <strong>No ascents</strong>
            <span>Accounts are out of scope</span>
          </div>
        }
      />

      <section className="stat-grid" aria-label="Climbing statistics">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="progress-panel" aria-labelledby="history-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Personal record</p>
            <h2 id="history-title">Climbing history</h2>
          </div>
          <span className="panel-heading__meta">Newest first</span>
        </div>

        <div className="history-head" aria-hidden="true">
          <span>Date</span>
          <span>Peak</span>
          <span>Elevation gain</span>
          <span>List</span>
        </div>

        <EmptyState
          icon="progress"
          eyebrow="No ascents recorded"
          title="Your first ascent starts here."
          description="Once accounts and peak data arrive, every climb will build a personal record of elevation, lists and places returned to."
        />
      </section>

      <section className="progress-panel" aria-labelledby="goals-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Looking ahead</p>
            <h2 id="goals-title">Goals</h2>
          </div>
          <span className="panel-heading__meta">No goals set</span>
        </div>
        <div className="panel-empty">
          <p>
            Goals will connect a chosen list or peak to a date, a season or a personal
            intention. Nothing is fabricated here in Phase 01.
          </p>
        </div>
      </section>

      <p className="page-footnote">
        Accounts, saved peaks and synchronization are intentionally out of scope for this
        foundation. The dashboard structure is ready for them.
      </p>
    </div>
  );
}
