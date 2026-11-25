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
import { setMeta } from "../lib/meta";
import { navigate } from "../lib/router";
import { toggleClimbed, useClimbedMap } from "../lib/summits";

type View = "all" | "climbed" | "remaining";
type Sort = "height" | "name";

type PeakRow = { list: SummitList; peak: SummitPeak; id: string };

const ALL_PEAKS: PeakRow[] = SUMMIT_LISTS.flatMap((list) =>
  list.peaks.map((peak) => ({ list, peak, id: peakId(list.id, peak.name) })),
);

const PEAK_BY_ID = new Map(ALL_PEAKS.map((row) => [row.id, row]));

const height = (peak: SummitPeak) => `${peak.ft.toLocaleString("en-US")} ft · ${feetToMetres(peak.ft).toLocaleString("en-US")} m`;

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Progress({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label?: string;
}) {
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
 * The summit ledger.
 *
 * Two surfaces, one route family. `/summits` is the shelf of challenge lists and
 * the running total; `/summits/:id` is one list, its peaks and a log button for
 * each. Climbs are local to the browser, so the page says what it can and cannot
 * claim: a tick means "I logged this", not "a source verified it".
 *
 * The lists are complete club lists, not a generated subset. A summit links to
 * the globe only when the destination database actually has that peak's page;
 * everything else stays a name in the ledger rather than an invented map slug.
 */
export default function Summits({ listId }: { listId?: string }) {
  const climbed = useClimbedMap();
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("height");

  const list = listId ? summitList(listId) : undefined;

  useEffect(() => {
    setView("all");
    setSort("height");
  }, [listId]);

  const logged = useMemo(
    () => [...climbed.keys()].filter((id) => PEAK_BY_ID.has(id)),
    [climbed],
  );

  const completeLists = useMemo(
    () =>
      SUMMIT_LISTS.filter((candidate) =>
        candidate.peaks.every((peak) => climbed.has(peakId(candidate.id, peak.name))),
      ).length,
    [climbed],
  );

  const vertical = useMemo(
    () =>
      logged.reduce((sum, id) => {
        const row = PEAK_BY_ID.get(id);
        return sum + (row ? row.peak.ft * 0.3048 : 0);
      }, 0),
    [logged],
  );

  const recent = useMemo(
    () =>
      [...climbed.entries()]
        .map(([id, at]) => ({ row: PEAK_BY_ID.get(id), at }))
        .filter((entry): entry is { row: PeakRow; at: number } => Boolean(entry.row))
        .sort((a, b) => b.at - a.at)
        .slice(0, 8),
    [climbed],
  );

  const rows = useMemo(() => {
    if (!list) return [];
    return list.peaks
      .map((peak) => ({ peak, id: peakId(list.id, peak.name) }))
      .filter((row) => {
        const at = climbed.get(row.id);
        if (view === "climbed") return Boolean(at);
        if (view === "remaining") return !at;
        return true;
      })
      .sort((a, b) =>
        sort === "name"
          ? a.peak.name.localeCompare(b.peak.name)
          : b.peak.ft - a.peak.ft || a.peak.name.localeCompare(b.peak.name),
      );
  }, [climbed, list, sort, view]);

  useEffect(() => {
    if (listId && !list) {
      setMeta({
        title: "Summit list not found — Terrane",
        description: "That summit list is not part of the Terrane ledger.",
        path: `/summits/${listId}`,
      });
      return;
    }
    setMeta({
      title: list ? `${list.name} — Terrane` : "Summits — Terrane",
      description: list
        ? `${list.name}: ${list.peaks.length} summits in ${list.region}. Track every peak you have climbed in this browser.`
        : `A local summit ledger for ${SUMMIT_PEAK_COUNT} peaks across ${SUMMIT_LISTS.length} classic mountain lists.`,
      path: list ? `/summits/${list.id}` : "/summits",
    });
  }, [list, listId]);

  if (listId && !list) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <p className="eyebrow">Summits</p>
          <h1 className="page-title">That summit list isn’t here.</h1>
          <p className="page-sub">
            It may have been renamed, or the link may be incomplete. The four
            lists on the ledger are still there.
          </p>
          <button className="btn btn-dark" onClick={() => navigate("/summits")}>
            All summit lists →
          </button>
        </div>
      </div>
    );
  }

  if (list) {
    const done = list.peaks.filter((peak) =>
      climbed.has(peakId(list.id, peak.name)),
    ).length;
    const complete = done === list.peaks.length;

    return (
      <div className="page">
        <Header tone="light" />

        <main className="summits">
          <BackLink to="/summits" label="Summits" />

          <div className="summit-detail-head">
            <p className="eyebrow">
              {list.badge} · {list.region}
            </p>
            <h1 className="page-title">{list.name}</h1>
            <p className="page-sub">{list.blurb}</p>
            <Progress
              done={done}
              total={list.peaks.length}
              label={`${done} of ${list.peaks.length} ${list.name} summits logged`}
            />
          </div>

          <div className="summit-toolbar">
            <div className="summit-toolbar-group" role="group" aria-label="Show summits">
              {(
                [
                  ["all", "All"],
                  ["climbed", "Climbed"],
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
                <strong>{list.name} complete.</strong> Every summit on the list
                is in your ledger. The club patch and completer list are theirs,
                not Terrane’s — this page only keeps your record.
              </span>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <StateNotice
              kind="empty"
              title={view === "climbed" ? "No summits logged yet." : "Every summit is logged."}
              body={
                view === "climbed"
                  ? "Tick a summit below and it will show up here, with the date and the running total."
                  : "Switch to Climbed to read the list you have finished."
              }
              action={{ label: "Show all summits →", onClick: () => setView("all") }}
            />
          ) : (
            <ol className="summit-rows">
              {rows.map(({ peak, id }) => {
                const at = climbed.get(id);
                return (
                  <li key={id} className={`summit-row${at ? " on" : ""}`}>
                    <button
                      className={`summit-check${at ? " on" : ""}`}
                      aria-pressed={Boolean(at)}
                      aria-label={`${at ? "Unlog" : "Log"} ${peak.name}`}
                      onClick={() => toggleClimbed(id)}
                    >
                      <span aria-hidden="true">{at ? "✓" : ""}</span>
                    </button>
                    <div className="summit-row-main">
                      <span className="summit-name">{peak.name}</span>
                      <span className="mono summit-row-meta">
                        {peak.where ?? list.region}
                      </span>
                    </div>
                    <span className="mono summit-elev">{height(peak)}</span>
                    <span className="mono summit-date">
                      {at ? formatDate(at) : "—"}
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
              Ticks are stored in this browser only. Terrane does not verify a
              climb, issue a patch or send your log anywhere.
            </p>
          </section>
        </main>

        <footer className="foot">
          <span>Terrane — the world, worth the detour</span>
          <span className="mono">
            SUMMIT LEDGER · LOCAL TO THIS BROWSER · LISTS: GATC, AMC, ADK 46ERS,
            COLORADO DNR
          </span>
        </footer>
      </div>
    );
  }

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head summit-head">
        <p className="eyebrow">Summits</p>
        <h1 className="page-title">Your summit ledger</h1>
        <p className="page-sub">
          {SUMMIT_PEAK_COUNT} peaks across {SUMMIT_LISTS.length} classic club
          lists: Georgia 4,000, the New Hampshire 48, the Adirondack 46ers and
          the Colorado 14ers. Tick each summit as you stand on it. The ledger
          stays in this browser — no account, no upload — and completion is your
          record, not a certificate.
        </p>
      </div>

      <main className="summits">
        <div className="summit-stats">
          <div className="summit-stat">
            <span className="mono summit-stat-label">Summits logged</span>
            <strong>{logged.length.toLocaleString("en-US")}</strong>
            <span className="mono summit-stat-note">
              of {SUMMIT_PEAK_COUNT.toLocaleString("en-US")} listed peaks
            </span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Lists complete</span>
            <strong>{completeLists}</strong>
            <span className="mono summit-stat-note">
              of {SUMMIT_LISTS.length} challenge lists
            </span>
          </div>
          <div className="summit-stat">
            <span className="mono summit-stat-label">Vertical logged</span>
            <strong>{Math.round(vertical).toLocaleString("en-US")} m</strong>
            <span className="mono summit-stat-note">
              the summed elevation of every ticked summit
            </span>
          </div>
        </div>

        <section aria-labelledby="summit-lists-title">
          <div className="summit-section-head">
            <h2 id="summit-lists-title" className="mono summit-section-title">
              The lists
            </h2>
            <span className="mono summit-section-note">
              Every peak on each list, not a selection
            </span>
          </div>

          <div className="summit-grid">
            {SUMMIT_LISTS.map((candidate) => {
              const done = candidate.peaks.filter((peak) =>
                climbed.has(peakId(candidate.id, peak.name)),
              ).length;
              const highest = [...candidate.peaks].sort((a, b) => b.ft - a.ft)[0];
              const complete = done === candidate.peaks.length;
              return (
                <button
                  key={candidate.id}
                  className={`summit-card${complete ? " on" : ""}`}
                  onClick={() => navigate(`/summits/${candidate.id}`)}
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
                    label={`${done} of ${candidate.peaks.length} ${candidate.name} summits logged`}
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
          <section className="summit-recent" aria-labelledby="summit-recent-title">
            <div className="summit-section-head">
              <h2 id="summit-recent-title" className="mono summit-section-title">
                Latest ascents
              </h2>
              <span className="mono summit-section-note">Newest first · local log</span>
            </div>
            <ol className="summit-recent-list">
              {recent.map(({ row, at }) => (
                <li key={`${row.id}-${at}`}>
                  <button
                    className="summit-recent-row"
                    onClick={() => navigate(`/summits/${row.list.id}`)}
                  >
                    <span className="summit-recent-name">{row.peak.name}</span>
                    <span className="mono summit-recent-meta">
                      {row.list.name} · {formatDate(at)}
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
          summits cross private land or need a bushwhack. The ledger makes no
          claim about conditions.
        </p>
      </main>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          SUMMIT LEDGER · LOCAL TO THIS BROWSER · LISTS: GATC, AMC, ADK 46ERS,
          COLORADO DNR
        </span>
      </footer>
    </div>
  );
}
