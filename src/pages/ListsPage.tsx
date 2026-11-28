import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { LISTS } from "../data/lists";
import { useRecord } from "../state/RecordContext";

export default function ListsPage() {
  const { profile, progressFor } = useRecord();
  const startedCount = LISTS.filter((list) => progressFor(list.id).started).length;

  return (
    <div className="content-page">
      <PageHeader
        eyebrow="Lists"
        title={
          <>
            The <span className="display-italic">lists.</span>
          </>
        }
        description={`${LISTS.length} complete publisher lists. Start anywhere, take your time.`}
        aside={
          <div className="status-card">
            <span className="status-card__label">Your record</span>
            <strong>
              {startedCount} of {LISTS.length} started
            </strong>
            <span>Current editions · not official</span>
          </div>
        }
      />

      <div className="list-index">
        {LISTS.map((list) => {
          const progress = progressFor(list.id);
          return (
            <Link to={`/lists/${list.slug}`} className="list-index__row" key={list.id}>
              <div className="list-index__main">
                <p className="eyebrow">
                  {list.publisher} · {list.edition}
                </p>
                <h2>{list.title}</h2>
                <p>{list.description}</p>
                <span className="list-index__meta">
                  {list.peaks.length} peaks ·{" "}
                  {progress.started
                    ? `${progress.completed} climbed`
                    : profile
                      ? "Not started"
                      : "Open to browse"}
                </span>
              </div>

              <div className="list-index__progress">
                <span className="list-index__value">
                  {progress.started ? `${progress.percent}%` : "—"}
                </span>
                <span className="list-index__meter" aria-hidden="true">
                  <i style={{ width: `${progress.started ? progress.percent : 0}%` }} />
                </span>
                <small>
                  {progress.started
                    ? `${progress.completed} of ${progress.total}`
                    : `${list.peaks.length} peaks`}
                </small>
              </div>

              <Icon name="arrow" size={18} />
            </Link>
          );
        })}
      </div>

      <p className="page-footnote">
        Each list keeps its publisher&apos;s edition and rules. <Link to="/about/data">Data and sources</Link>.
      </p>
    </div>
  );
}
