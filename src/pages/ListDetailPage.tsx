import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import PeakTable from "../components/PeakTable";
import ProgressRing from "../components/ProgressRing";
import { NH48_LIST, NH48_PEAKS } from "../data/nh48";
import { exportCsv, exportJson } from "../lib/export";
import { useRecord } from "../state/RecordContext";

export default function ListDetailPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    profile,
    trips,
    startedLists,
    startList,
    progress,
    completedSlugs,
  } = useRecord();
  const valid = slug === NH48_LIST.slug;
  const started = startedLists.includes(NH48_LIST.id);
  const wantsStart = params.get("start") === "1";

  useEffect(() => {
    if (!valid || !wantsStart || !profile || started) return;
    startList(NH48_LIST.id);
    navigate("/lists/nh48", { replace: true });
  }, [valid, wantsStart, profile, started, startList, navigate]);

  if (!valid) {
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

  const returnTo = "/lists/nh48?start=1";
  const signIn = `/signin?returnTo=${encodeURIComponent(returnTo)}`;
  const backfillHref = profile
    ? "/log?mode=backfill&list=nh48"
    : `/signin?returnTo=${encodeURIComponent("/log?mode=backfill&list=nh48")}`;
  const displayCompleted = started ? progress.completed : 0;
  const displayRemaining = started ? progress.remaining : NH48_PEAKS.length;
  const recordState = { profile, startedLists, trips };

  function start() {
    if (!profile) {
      navigate(signIn);
      return;
    }
    startList(NH48_LIST.id);
  }

  return (
    <div className="content-page content-page--detail">
      <Link to="/lists" className="back-link">
        <Icon name="arrow" size={15} /> Back to lists
      </Link>

      <PageHeader
        index="03"
        eyebrow="Lists / New Hampshire"
        title={
          <>
            The <span className="display-italic">NH 48.</span>
          </>
        }
        description={NH48_LIST.description}
        aside={
          <div className="status-card">
            <span className="status-card__label">List status</span>
            <strong>{started ? `${progress.percent}% complete` : "Not started"}</strong>
            <span>{NH48_LIST.publisher} · {NH48_LIST.edition}</span>
          </div>
        }
      />

      <section className="list-hero">
        {started ? (
          <ProgressRing
            completed={displayCompleted}
            total={NH48_PEAKS.length}
            label="peaks"
          />
        ) : (
          <div className="start-mark" aria-label="List not started">
            <span>Not started</span>
            <small>48 peaks</small>
          </div>
        )}
        <div className="list-hero__copy">
          <p className="eyebrow">Publisher · {NH48_LIST.publisher}</p>
          <h2>{started ? "Your remaining peaks" : "A finite record of 48 summits"}</h2>
          <p>
            {started
              ? `${displayRemaining} peaks remain. Your history counts, including the climbs that happened before Terrane.`
              : "Start the list to make it yours. Backfill what you have already climbed; the count follows the publisher's 2026 edition."}
          </p>
          <div className="list-hero__actions">
            {started ? (
              <>
                <Link to="/log" className="button button--bright">
                  <Icon name="plus" size={16} /> Log a climb
                </Link>
                <Link to={backfillHref} className="button">
                  <Icon name="list" size={16} /> Add history
                </Link>
              </>
            ) : (
              <button type="button" className="button button--bright" onClick={start}>
                <Icon name="check" size={16} /> Start the NH 48
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

      <section className="list-rules">
        <div>
          <p className="eyebrow">Rules</p>
          <p>{NH48_LIST.rules}</p>
        </div>
        <div>
          <p className="eyebrow">Source</p>
          <p>
            <a href={NH48_LIST.sourceUrl} target="_blank" rel="noreferrer">
              {NH48_LIST.publisher} · {NH48_LIST.edition}
            </a>
            . Terrane is not the official record.
          </p>
        </div>
      </section>

      <section className="progress-panel" aria-labelledby="list-peaks-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">The list</p>
            <h2 id="list-peaks-title">All 48 peaks</h2>
          </div>
          <span className="panel-heading__meta">
            {started ? `${progress.completed} climbed · ${progress.remaining} remaining` : "Not started"}
          </span>
        </div>
        <PeakTable
          peaks={NH48_PEAKS}
          completed={started ? completedSlugs : new Set()}
          units={profile?.units ?? "imperial"}
        />
      </section>

      <p className="page-footnote">
        “{NH48_LIST.title}” is a publication of {NH48_LIST.publisher}. Terrane summarizes the list and links to the
        publisher; it does not grant membership, a certificate or a finisher number.
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
