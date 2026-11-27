import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import ProgressRing from "../components/ProgressRing";
import { LISTS } from "../data/lists";
import { useRecord } from "../state/RecordContext";

export default function ListsPage() {
  const { profile, progressFor } = useRecord();
  const startedCount = LISTS.filter((list) => progressFor(list.id).started).length;

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
        description="Two complete, sourced lists. Start both or take them one mountain at a time; each publisher's rules stay visible."
        aside={
          <div className="status-card">
            <span className="status-card__label">List library</span>
            <strong>{startedCount} of {LISTS.length} started</strong>
            <span>2026 editions · not official</span>
          </div>
        }
      />

      <div className="lists-grid">
        {LISTS.map((list) => {
          const progress = progressFor(list.id);
          return (
            <Link to={`/lists/${list.slug}`} className="list-card" key={list.id}>
              <div className="list-card__body">
                <p className="eyebrow">{list.publisher} · {list.edition}</p>
                <h2>{list.title}</h2>
                <p>{list.description}</p>
                <dl className="list-card__facts">
                  <div>
                    <dt>Peaks</dt>
                    <dd>{list.peaks.length}</dd>
                  </div>
                  <div>
                    <dt>Publisher</dt>
                    <dd>{list.publisher}</dd>
                  </div>
                  <div>
                    <dt>Your record</dt>
                    <dd>{profile ? `${progress.completed} climbed` : "Sign in to start"}</dd>
                  </div>
                </dl>
                <span className="text-link">
                  {progress.started ? "Continue the list" : "Open the list"}{" "}
                  <span aria-hidden="true">→</span>
                </span>
              </div>
              {progress.started ? (
                <ProgressRing completed={progress.completed} total={progress.total} />
              ) : (
                <div className="list-card__start">
                  <span>Not started</span>
                  <small>{list.peaks.length} peaks</small>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <p className="page-footnote">
        More lists arrive only when their membership, edition and rules are complete. No partial list is published.
        The CMC recognises 54 Colorado 14ers for completion; this list shows 58 named summits and states that
        difference on the list page.
      </p>
    </div>
  );
}
