import { SUMMIT_LISTS, type SummitList } from "../data/summits";
import { logStats, useLog } from "../lib/log";

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="listlens-progress" aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * The list lens over the globe.
 *
 * Four sourced lists, their progress, and a button that flies the globe to the
 * region they cover. The full list page is one click away; the point of this
 * panel is to keep the map underneath the challenge.
 */
export default function ListLens({
  onClose,
  onFocus,
  onOpen,
}: {
  onClose: () => void;
  onFocus: (list: SummitList) => void;
  onOpen: (id: string) => void;
}) {
  const stats = logStats(useLog());

  return (
    <section className="listlens" role="dialog" aria-label="Peakbagging lists">
      <div className="listlens-head">
        <div>
          <p className="mono listlens-eyebrow">Sourced lists</p>
          <h2 className="listlens-title">The lists</h2>
        </div>
        <button className="discover-close" onClick={onClose} aria-label="Close lists">
          ×
        </button>
      </div>

      <p className="listlens-note">
        Every peak, source and elevation follows the publishing club. Progress is
        stored in this browser.
      </p>

      <ol className="listlens-list">
        {SUMMIT_LISTS.map((list) => {
          const done = stats.listProgress[list.id] ?? 0;
          return (
            <li key={list.id} className="listlens-card">
              <button className="listlens-open" onClick={() => onOpen(list.id)}>
                <span className="listlens-card-top">
                  <span className="mono listlens-badge">{list.badge}</span>
                  <span className="mono listlens-count">
                    {done}/{list.peaks.length}
                  </span>
                </span>
                <span className="listlens-name">{list.name}</span>
                <span className="mono listlens-region">
                  {list.region} · {list.country}
                </span>
                <Progress done={done} total={list.peaks.length} />
              </button>
              <div className="listlens-actions">
                <button className="btn btn-light" onClick={() => onFocus(list)}>
                  Show region
                </button>
                <button className="mono listlens-page" onClick={() => onOpen(list.id)}>
                  Open list →
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
