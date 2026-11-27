import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ProgressRing from "../components/ProgressRing";
import { NH48_LIST } from "../data/nh48";
import { useRecord } from "../state/RecordContext";

export default function ListsPage() {
  const { progress, profile } = useRecord();

  return (
    <div className="content-page">
      <PageHeader
        index="03"
        eyebrow="Lists"
        title={
          <>
            Collections with a <span className="display-italic">summit.</span>
          </>
        }
        description="One complete, sourced list is worth more than a hundred partial catalogues. The NH 48 is the first."
        aside={
          <div className="status-card">
            <span className="status-card__label">List library</span>
            <strong>{progress.started ? `${progress.percent}% complete` : "One list ready"}</strong>
            <span>{NH48_LIST.publisher} · {NH48_LIST.edition}</span>
          </div>
        }
      />

      <Link to="/lists/nh48" className="list-card">
        <div className="list-card__body">
          <p className="eyebrow">AMC · New Hampshire</p>
          <h2>{NH48_LIST.title}</h2>
          <p>{NH48_LIST.description}</p>
          <dl className="list-card__facts">
            <div>
              <dt>Peaks</dt>
              <dd>{NH48_LIST.peaks.length}</dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd>2026</dd>
            </div>
            <div>
              <dt>Your record</dt>
              <dd>{profile ? `${progress.completed} climbed` : "Sign in to start"}</dd>
            </div>
          </dl>
          <span className="text-link">
            {progress.started ? "Continue the list" : "Open the list"} <span aria-hidden="true">→</span>
          </span>
        </div>
        {progress.started ? (
          <ProgressRing completed={progress.completed} total={progress.total} />
        ) : (
          <div className="list-card__start">
            <span>Not started</span>
            <small>48 peaks</small>
          </div>
        )}
      </Link>

      <p className="page-footnote">
        More lists arrive only when their membership, edition and rules are complete. No partial list is published.
      </p>
    </div>
  );
}
