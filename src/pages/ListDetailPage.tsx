import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import PeakTable from "../components/PeakTable";
import ProgressRing from "../components/ProgressRing";
import { getList, PEAKS } from "../data/lists";
import { listVersionChange } from "../lib/listVersion";
import { useRecord } from "../state/RecordContext";

export default function ListDetailPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const list = slug ? getList(slug) : undefined;
  const {
    profile,
    startedLists,
    listStarts,
    listCompletions,
    startList,
    progressFor,
    completedSlugs,
  } = useRecord();
  const started = list ? startedLists.includes(list.id) : false;
  const wantsStart = params.get("start") === "1";
  const progress = list ? progressFor(list.id) : null;

  useEffect(() => {
    if (!list || !wantsStart || !profile || started) return;
    startList(list.id);
    navigate(`/lists/${list.slug}`, { replace: true });
  }, [list, wantsStart, profile, started, startList, navigate]);

  if (!list) {
    return (
      <div className="content-page">
        <PageHeader
          eyebrow="Lists / Not found"
          title={
            <>
              No list <span className="display-italic">record.</span>
            </>
          }
          description={`“${slug}” is not a published list. Only complete lists are shown.`}
        />
        <Link to="/lists" className="text-link">
          Back to lists <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const returnTo = `/lists/${list.slug}?start=1`;
  const signIn = `/signin?returnTo=${encodeURIComponent(returnTo)}`;
  const displayCompleted = started ? progress?.completed ?? 0 : 0;
  const displayRemaining = started ? progress?.remaining ?? list.peaks.length : list.peaks.length;
  const versionChange = listVersionChange(list, listStarts[list.id]);
  const completion = listCompletions.find((item) => item.listId === list.id);
  const peakNames = new Map(PEAKS.map((peak) => [peak.slug, peak.name]));

  function start() {
    if (!profile) {
      navigate(signIn);
      return;
    }
    startList(list!.id);
  }

  return (
    <div className="content-page content-page--detail">
      <Link to="/lists" className="back-link">
        <Icon name="arrow" size={15} /> Back to lists
      </Link>

      <PageHeader
        eyebrow={`Lists / ${list.publisher}`}
        title={<>{list.title}.</>}
        description={list.description}
      />

      <section className="list-summary">
        <div className="list-summary__progress">
          {started ? (
            <ProgressRing
              completed={displayCompleted}
              total={list.peaks.length}
              label="peaks"
            />
          ) : (
            <div className="start-mark start-mark--small" aria-label="List not started">
              <span>Not started</span>
              <small>{list.peaks.length} peaks</small>
            </div>
          )}
        </div>
        <div className="list-summary__copy">
          <p className="eyebrow">{started ? "In progress" : "Your list"}</p>
          <h2>
            {completion
              ? "Complete."
              : started
                ? `${displayRemaining} ${displayRemaining === 1 ? "peak" : "peaks"} to go.`
                : `${list.peaks.length} peaks, one list.`}
          </h2>
          <p>
            {started
              ? `${displayCompleted} climbed, ${displayRemaining} remaining. Your history counts.`
              : "Start the list, then add the climbs you already have."}
          </p>
          <div className="list-summary__actions">
            {started ? (
              <Link to={`/log?list=${list.id}`} className="button button--bright">
                <Icon name="plus" size={16} /> Log a climb
              </Link>
            ) : (
              <button type="button" className="button button--bright" onClick={start}>
                <Icon name="check" size={16} /> Start {list.title}
              </button>
            )}
            {started && profile ? (
              <Link to="/import" className="button button--quiet">
                Import history
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {completion ? (
        <section className="completion-mark" aria-label="List completion">
          <span className="completion-mark__seal" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="eyebrow">
              Complete · {completion.edition}
            </p>
            <h2>{list.title} finished.</h2>
            <p>
              Recorded{" "}
              {new Date(completion.completedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              against version {completion.listVersion}. The snapshot is kept if the publisher changes
              the list.
            </p>
          </div>
        </section>
      ) : null}

      {started && versionChange.changed ? (
        <section className="version-notice" aria-label="List version change">
          <p className="eyebrow">Publisher change</p>
          <p>
            You started against <strong>{versionChange.startedVersion}</strong>; this is{" "}
            <strong>{versionChange.currentVersion}</strong>. The old record is unchanged.
          </p>
          {versionChange.added.length ? (
            <p>
              New peaks: {versionChange.added.map((slug) => peakNames.get(slug) ?? slug).join(", ")}
            </p>
          ) : null}
          {versionChange.removed.length ? (
            <p>
              Removed peaks: {versionChange.removed.map((slug) => peakNames.get(slug) ?? slug).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <details className="list-notes">
        <summary>
          <span>Rules &amp; source</span>
          <small>{list.publisher}</small>
        </summary>
        <div className="list-notes__body">
          <div>
            <p className="eyebrow">Rules</p>
            <p>{list.rules}</p>
          </div>
          <div>
            <p className="eyebrow">Source</p>
            <p>
              <a href={list.sourceUrl} target="_blank" rel="noreferrer">
                {list.publisher} · {list.edition}
              </a>
              . Terrane is not the official record.
            </p>
          </div>
        </div>
      </details>

      <section className="record-panel" aria-labelledby="list-peaks-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">The list</p>
            <h2 id="list-peaks-title">All {list.peaks.length} peaks</h2>
          </div>
          <span className="panel-heading__meta">
            {started
              ? `${progress?.completed ?? 0} climbed · ${progress?.remaining ?? 0} remaining`
              : "Not started"}
          </span>
        </div>
        <PeakTable
          peaks={list.peaks}
          completed={started ? completedSlugs : new Set()}
          units={profile?.units ?? "imperial"}
        />
      </section>

      <p className="page-footnote">
        Terrane does not grant membership or a finisher number.
        {!profile ? (
          <>
            {" "}
            <Link to={signIn} className="text-link">
              Start this list
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
