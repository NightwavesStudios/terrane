import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import PeakTable from "../components/PeakTable";
import ProgressRing from "../components/ProgressRing";
import { getList, PEAKS } from "../data/lists";
import { exportCsv, exportJson } from "../lib/export";
import { listVersionChange } from "../lib/listVersion";
import { useRecord } from "../state/RecordContext";

export default function ListDetailPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const list = slug ? getList(slug) : undefined;
  const {
    profile,
    trips,
    startedLists,
    listStarts,
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
          index="03"
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
  const backfillHref = profile
    ? `/log?mode=backfill&list=${list.id}`
    : `/signin?returnTo=${encodeURIComponent(`/log?mode=backfill&list=${list.id}`)}`;
  const displayCompleted = started ? progress?.completed ?? 0 : 0;
  const displayRemaining = started ? progress?.remaining ?? list.peaks.length : list.peaks.length;
  const recordState = { profile, startedLists, listStarts, trips };
  const versionChange = listVersionChange(list, listStarts[list.id]);
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
        index="03"
        eyebrow={`Lists / ${list.publisher}`}
        title={
          <>
            The <span className="display-italic">{list.title}.</span>
          </>
        }
        description={list.description}
        aside={
          <div className="status-card">
            <span className="status-card__label">List status</span>
            <strong>{started ? `${progress?.percent ?? 0}% complete` : "Not started"}</strong>
            <span>{list.publisher} · {list.edition}</span>
          </div>
        }
      />

      <section className="list-hero">
        {started ? (
          <ProgressRing
            completed={displayCompleted}
            total={list.peaks.length}
            label="peaks"
          />
        ) : (
          <div className="start-mark" aria-label="List not started">
            <span>Not started</span>
            <small>{list.peaks.length} peaks</small>
          </div>
        )}
        <div className="list-hero__copy">
          <p className="eyebrow">Publisher · {list.publisher}</p>
          <h2>{started ? "Your remaining peaks" : `A finite record of ${list.peaks.length} summits`}</h2>
          <p>
            {started
              ? `${displayRemaining} peaks remain. Your history counts, including the climbs that happened before Terrane.`
              : `Start the list to make it yours. Backfill what you have already climbed; the count follows the ${list.publisher} list and edition shown here.`}
          </p>
          <div className="list-hero__actions">
            {started ? (
              <>
                <Link to={`/log?list=${list.id}`} className="button button--bright">
                  <Icon name="plus" size={16} /> Log a climb
                </Link>
                <Link to={backfillHref} className="button">
                  <Icon name="list" size={16} /> Add history
                </Link>
              </>
            ) : (
              <button type="button" className="button button--bright" onClick={start}>
                <Icon name="check" size={16} /> Start {list.title}
              </button>
            )}
            {profile ? (
              <>
                <button type="button" className="button" onClick={() => exportJson(recordState)}>
                  Export JSON
                </button>
                <button type="button" className="button" onClick={() => exportCsv(recordState)}>
                  Export CSV
                </button>
              </>
            ) : null}
          </div>
          <p className="muted-note">
            {profile
              ? `Signed in as ${profile.displayName}. This local preview stores the record in this browser.`
              : "Sign in to start the list. This preview does not send email or store data on a server."}
          </p>
        </div>
      </section>

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

      <section className="list-rules">
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
      </section>

      <section className="progress-panel" aria-labelledby="list-peaks-title">
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
        “{list.title}” is summarized from {list.publisher}; Terrane does not grant membership, a certificate or a
        finisher number.
        {!profile ? (
          <>
            {" "}
            <Link to={signIn} className="text-link">
              Sign in to start
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
