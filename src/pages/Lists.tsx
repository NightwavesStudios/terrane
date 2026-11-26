import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import BackLink from "../components/BackLink";
import StateNotice from "../components/StateNotice";
import {
  SUMMIT_LISTS,
  SUMMIT_PEAK_COUNT,
  feetToMetres,
  peakId,
  summitList,
  type SummitList,
  type SummitPeak,
} from "../data/summits";
import { bySlug, useAtlas } from "../data/places";
import { logStats, markBagged, removeEntry, toggleWant, useLog, type LogEntry } from "../lib/log";
import { targetForPeak } from "../lib/logTargets";
import { setMeta } from "../lib/meta";
import { navigate } from "../lib/router";

type View = "all" | "climbed" | "remaining";
type Sort = "height" | "name";

type PeakRow = { list: SummitList; peak: SummitPeak; key: string };

const ALL_PEAKS: PeakRow[] = SUMMIT_LISTS.flatMap((list) =>
  list.peaks.map((peak) => ({
    list,
    peak,
    key: peakId(list.id, peak.name),
  })),
);

const PEAK_BY_ID = new Map(ALL_PEAKS.map((row) => [row.key, row]));

const height = (peak: SummitPeak) =>
  `${peak.ft.toLocaleString("en-US")} ft · ${feetToMetres(peak.ft).toLocaleString("en-US")} m`;

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="summit-progress">
      <div
        className="summit-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label ?? `${done} of ${total} summits`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="mono summit-progress-line">
        <span>
          {done}/{total} summits
        </span>
        <span>{pct}%</span>
      </p>
    </div>
  );
}

/**
 * The sourced peakbagging lists.
 *
 * Every row is a peak from the publishing club's list, not a generated subset.
 * A row can be wanted or bagged without a page of its own; only a peak with a
 * real place record gets a globe link. The list source and its quirks stay on
 * the page.
 */
export default function Lists({ listId }: { listId?: string }) {
  const entries = useLog();
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("height");
  useAtlas();

  const byKey = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );
  const stats = useMemo(() => logStats(entries), [entries]);
  const listedBagged = Object.values(stats.listProgress).reduce(
    (sum, count) => sum + count,
    0,
  );
  const list = listId ? summitList(listId) : undefined;

  useEffect(() => {
    setView("all");
    setSort("height");
  }, [listId]);

  const recent = useMemo(
    () =>
      entries
        .filter((entry) => entry.state === "done" && entry.kind === "peak")
        .sort((a, b) => (b.date ?? b.at) - (a.date ?? a.at))
        .slice(0, 8)
        .map((entry) => ({ entry, row: PEAK_BY_ID.get(entry.key.replace(/^peak:/, "")) })),
    [entries],
  );

  const rows = useMemo(() => {
    if (!list) return [];
    return list.peaks
      .map((peak) => ({ peak, key: peakId(list.id, peak.name) }))
      .filter((row) => {
        const done = byKey.get(`peak:${row.key}`)?.state === "done";
        if (view === "climbed") return done;
        if (view === "remaining") return !done;
        return true;
      })
      .sort((a, b) =>
        sort === "name"
          ? a.peak.name.localeCompare(b.peak.name)
          : b.peak.ft - a.peak.ft || a.peak.name.localeCompare(b.peak.name),
      );
  }, [byKey, list, sort, view]);

  useEffect(() => {
    if (listId && !list) {
      setMeta({
        title: "List not found — Terrane",
        description: "That peakbagging list is not part of the Terrane ledger.",
        path: `/lists/${listId}`,
      });
      return;
    }
    setMeta({
      title: list ? `${list.name} — Terrane` : "Lists — Terrane",
      description: list
        ? `${list.name}: ${list.peaks.length} summits in ${list.region}. Track every peak you have climbed in this browser.`
        : `A local peakbagging ledger for ${SUMMIT_PEAK_COUNT} sourced summits across ${SUMMIT_LISTS.length} classic mountain lists.`,
      path: list ? `/lists/${list.id}` : "/lists",
    });
  }, [list, listId]);

  if (listId && !list) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <p className="eyebrow">Lists</p>
          <h1 className="page-title">That list isn’t here.</h1>
          <p className="page-sub">
            It may have been renamed, or the link may be incomplete. The four lists
            on the ledger are still there.
          </p>
          <button className="btn btn-dark" onClick={() => navigate("/lists")}>
            All lists →
          </button>
        </div>
      </div>
    );
  }

  if (list) {
    const done = list.peaks.filter(
      (peak) => byKey.get(`peak:${peakId(list.id, peak.name)}`)?.state === "done",
    ).length;
    const complete = done === list.peaks.length;

    return (
      <div className="page">
        <Header tone="light" />

        <main className="summits">
          <BackLink to="/lists" label="Lists" />

          <div className="summit-detail-head">
            <p className="eyebrow">
              {list.badge} · {list.region}
            </p>
            <h1 className="page-title">{list.name}</h1>
            <p className="page-sub">{list.blurb}</p>
            <Progress
              done={done}
              total={list.peaks.length}
              label={`${done} of ${list.peaks.length} ${list.name} summits bagged`}
            />
            <button
              className="btn btn-dark summit-globe-cta"
              onClick={() => navigate(`/?list=${list.id}`)}
            >
              Show this region on the globe →
            </button>
          </div>

          <div className="summit-toolbar">
            <div className="summit-toolbar-group" role="group" aria-label="Show summits">
              {(
                [
                  ["all", "All"],
                  ["climbed", "Bagged"],
                  ["remaining", "Remaining"],
                ] as [View, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`chip chip--small${view === id ? " on" : ""}`}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="summit-toolbar-group" role="group" aria-label="Sort summits">
              {(
                [
                  ["height", "Highest"],
                  ["name", "A–Z"],
                ] as [Sort, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`chip chip--small${sort === id ? " on" : ""}`}
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="mono summit-toolbar-count" role="status">
              {rows.length} of {list.peaks.length}
            </span>
          </div>

          {complete ? (
            <div className="summit-complete" role="status">
              <span className="summit-complete-mark" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>{list.name} complete.</strong> Every summit on the list is in
                your log. The club patch and completer list are theirs, not
                Terrane’s — this page only keeps your record.
              </span>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <StateNotice
              kind="empty"
              title={view === "climbed" ? "No summits bagged yet." : "Every summit is bagged."}
              body={
                view === "climbed"
                  ? "Bag a summit below and it will show up here, with the date and the running total."
                  : "Switch to Bagged to read the list you have finished."
              }
              action={{ label: "Show all summits →", onClick: () => setView("all") }}
            />
          ) : (
            <ol className="summit-rows">
              {rows.map(({ peak, key }) => {
                const fullKey = `peak:${key}`;
                const entry = byKey.get(fullKey);
                const done = entry?.state === "done";
                const wanted = entry?.state === "want";
                const target = targetForPeak(list, peak, bySlug.get(peak.place ?? "") ?? null);
                return (
                  <li key={key} className={`summit-row${done ? " on" : ""}`}>
                    <button
                      className={`summit-check${done ? " on" : ""}`}
                      aria-pressed={Boolean(done)}
                      aria-label={`${done ? "Unbag" : "Bag"} ${peak.name}`}
                      onClick={() => {
                        const next: LogEntry = { ...target, state: "want", at: Date.now() };
                        if (done) removeEntry(fullKey);
                        else markBagged(next);
                      }}
                    >
                      <span aria-hidden="true">{done ? "✓" : ""}</span>
                    </button>
                    <button
                      className={`summit-want${wanted ? " on" : ""}`}
                      aria-pressed={wanted}
                      disabled={done}
                      aria-label={`${wanted ? "Remove" : "Add"} ${peak.name} to your wanted peaks`}
                      onClick={() => toggleWant({ ...target, state: "want", at: Date.now() })}
                    >
                      <span aria-hidden="true">{wanted ? "★" : "☆"}</span>
                    </button>
                    <div className="summit-row-main">
                      <span className="summit-name">{peak.name}</span>
                      <span className="mono summit-row-meta">{peak.where ?? list.region}</span>
                    </div>
                    <span className="mono summit-elev">{height(peak)}</span>
                    <span className="mono summit-date">
                      {done ? formatDate(entry?.date ?? entry?.at ?? Date.now()) : "—"}
                    </span>
                    {peak.place ? (
                      <button
                        className="mono summit-globe"
                        onClick={() => navigate(`/?place=${peak.place}`)}
                      >
                        Globe →
                      </button>
                    ) : (
                      <span className="summit-globe summit-globe--none" aria-hidden="true">
                        ·
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <section className="summit-source">
            <h2 className="mono summit-section-title">The list</h2>
            <p className="summit-note">{list.note}</p>
            <p className="mono summit-source-line">
              Source:{" "}
              <a href={list.source.url} target="_blank" rel="noreferrer">
                {list.source.label}
              </a>{" "}
              · {list.peaks.length} summits · elevations as published by the list
            </p>
            <p className="mono summit-source-line">
              Ticks are stored in this browser only. Terrane does not verify a climb,
              issue a patch or send your log anywhere. Peaks without a place record
              have no globe point; they are still part of the list.
            </p>
          </section>
        </main>

        <footer className="foot">
          <span>Terrane — the world, worth the detour</span>
          <span className="mono">
            SOURCED LISTS · LOCAL TO THIS BROWSER · GATC, AMC, ADK 46ERS, COLORADO DNR
          </span>
        </footer>
      </div>
    );
  }

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head summit-head">
        <p className="eyebrow">Lists</p>
        <h1 className="page-title">Your peakbagging ledger</h1>
        <p className="page-sub">
          {SUMMIT_PEAK_COUNT} peaks across {SUMMIT_LISTS.length} sourced club lists:
          Georgia 4,000, the New Hampshire 48, the Adirondack 46ers and the Colorado
          14ers. Want a summit, then bag it when you stand on it. The log stays in
          this browser — no account, no upload — and completion is your record, not
          a certificate.
        </p>
      </div>

      <main className="summits">
        <div className="summit-stats">
          <div className="summit-stat">
            <span className="mono summit-stat-label">Summits bagged</span>
            <strong>{listedBagged.toLocaleString("en-US")}</strong>
            <span className="mono summit-stat-note">
              of {SUMMIT_PEAK_COUNT.toLocaleString("en-US")} listed peaks
            </span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Lists complete</span>
            <strong>{stats.listsComplete}</strong>
            <span className="mono summit-stat-note">
              of {SUMMIT_LISTS.length} sourced lists
            </span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Vertical logged</span>
            <strong>{stats.verticalM.toLocaleString("en-US")} m</strong>
            <span className="mono summit-stat-note">
              the summed elevation of every bagged summit
            </span>
          </div>
        </div>

        <section aria-labelledby="lists-title">
          <div className="summit-section-head">
            <h2 id="lists-title" className="mono summit-section-title">
              The lists
            </h2>
            <span className="mono summit-section-note">
              Every peak on each list, not a selection
            </span>
          </div>

          <div className="summit-grid">
            {SUMMIT_LISTS.map((candidate) => {
              const done = stats.listProgress[candidate.id] ?? 0;
              const highest = [...candidate.peaks].sort((a, b) => b.ft - a.ft)[0];
              const complete = done === candidate.peaks.length;
              return (
                <button
                  key={candidate.id}
                  className={`summit-card${complete ? " on" : ""}`}
                  onClick={() => navigate(`/lists/${candidate.id}`)}
                >
                  <span className="summit-card-top">
                    <span className="mono summit-badge">{candidate.badge}</span>
                    <span className="mono summit-card-count">
                      {done}/{candidate.peaks.length}
                    </span>
                  </span>
                  <span className="summit-card-title">{candidate.name}</span>
                  <span className="mono summit-card-region">
                    {candidate.region} · {candidate.country}
                  </span>
                  <span className="summit-card-blurb">{candidate.blurb}</span>
                  <Progress
                    done={done}
                    total={candidate.peaks.length}
                    label={`${done} of ${candidate.peaks.length} ${candidate.name} summits bagged`}
                  />
                  <span className="mono summit-card-high">
                    High point · {highest.name} · {height(highest)}
                  </span>
                  <span className="summit-card-open mono">
                    {complete ? "Read the finished list →" : "Open the list →"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {recent.length > 0 ? (
          <section className="summit-recent" aria-labelledby="recent-title">
            <div className="summit-section-head">
              <h2 id="recent-title" className="mono summit-section-title">
                Latest ascents
              </h2>
              <span className="mono summit-section-note">Newest first · local log</span>
            </div>
            <ol className="summit-recent-list">
              {recent.map(({ entry, row }) => (
                <li key={`${entry.key}-${entry.date ?? entry.at}`}>
                  <button
                    className="summit-recent-row"
                    onClick={() => navigate(row ? `/lists/${row.list.id}` : "/log")}
                  >
                    <span className="summit-recent-name">{entry.name}</span>
                    <span className="mono summit-recent-meta">
                      {entry.listName ?? "Custom ascent"} ·{" "}
                      {formatDate(entry.date ?? entry.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <p className="mono summit-source-line summit-source-line--foot">
          Lists follow the publishing club&apos;s own membership and elevations.
          Elevation is not route difficulty, access or permission; several listed
          summits cross private land or need a bushwhack. The log makes no claim
          about conditions.
        </p>
      </main>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          SOURCED LISTS · LOCAL TO THIS BROWSER · GATC, AMC, ADK 46ERS, COLORADO DNR
        </span>
      </footer>
    </div>
  );
}
