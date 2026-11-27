import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import { KIND_META } from "../data/atlas";
import { LISTS } from "../data/lists";
import { formatElevation } from "../lib/format";
import { useJournal } from "../lib/journal";
import { listProgress } from "../lib/progress";

export default function ListsPage() {
  const { entries } = useJournal();
  const progress = LISTS.map((list) => listProgress(list, entries));
  const completed = progress.filter((item) => item.complete).length;
  const canonical = LISTS.filter((list) => list.kind === "canonical").length;

  return (
    <div className="content-page">
      <PageHeader
        index="03"
        eyebrow="Lists"
        title={
          <>
            A list is a way of <span className="display-italic">looking.</span>
          </>
        }
        description="Canonical challenges and Terrane collections. A list never invents progress: it reads the summits in your journal and leaves the rest open."
        aside={
          <div className="status-card">
            <span className="status-card__label">List library</span>
            <strong>
              {completed} of {LISTS.length} complete
            </strong>
            <span>{canonical} canonical · {LISTS.length - canonical} collections</span>
          </div>
        }
      />

      <div className="list-overview" aria-label="List library summary">
        <div>
          <span className="mono">Canonical</span>
          <strong>{canonical}</strong>
          <em>Lists the world already agrees on</em>
        </div>
        <div>
          <span className="mono">Collections</span>
          <strong>{LISTS.length - canonical}</strong>
          <em>Curated by Terrane, not by committee</em>
        </div>
        <div>
          <span className="mono">Progress</span>
          <strong>
            {progress.reduce((total, item) => total + item.done.length, 0)}
          </strong>
          <em>Summits across every list</em>
        </div>
      </div>

      <div className="list-library">
        {progress.map((item, index) => {
          const { list, members, done, ratio, complete } = item;
          return (
            <details className="list-card" key={list.id} open={index === 0}>
              <summary className="list-card__summary">
                <span className="list-card__tag mono">
                  {list.kind === "canonical" ? "Canonical" : "Collection"}
                </span>
                <span className="list-card__title">
                  <strong>{list.name}</strong>
                  <span>{list.scope}</span>
                </span>
                <span className="list-card__progress">
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>
                  <em className={complete ? "is-complete" : ""}>
                    {done.length}/{members.length}
                    {complete ? " · complete" : ""}
                  </em>
                </span>
                <span className="list-card__toggle" aria-hidden="true">
                  <Icon name="plus" size={16} />
                </span>
              </summary>

              <div className="list-card__body">
                <p className="list-card__desc">{list.description}</p>
                <ul className="list-members">
                  {members.map((adventure, memberIndex) => {
                    const bagged = done.some((itemDone) => itemDone.id === adventure.id);
                    return (
                      <li key={adventure.id}>
                        <Link to={`/atlas/${adventure.id}`} className="list-member">
                          <span className="list-member__index mono">
                            {String(memberIndex + 1).padStart(2, "0")}
                          </span>
                          <span
                            className="list-member__icon"
                            style={{ color: KIND_META[adventure.kind].color }}
                          >
                            <Icon name={KIND_META[adventure.kind].icon} size={16} />
                          </span>
                          <span className="list-member__name">
                            <strong>{adventure.name}</strong>
                            <span>
                              {adventure.region} · {adventure.country}
                            </span>
                          </span>
                          <span className="list-member__elev mono">
                            {formatElevation(adventure.elevationM)}
                          </span>
                          <span className={`list-member__state${bagged ? " is-bagged" : ""}`}>
                            {bagged ? (
                              <>
                                <Icon name="check" size={13} /> Summitted
                              </>
                            ) : (
                              "Open"
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </div>

      <p className="page-footnote">
        A summit counts for a list when your journal records one for that place — on any
        date. Attempts and visits are kept in the record but do not close a list.
      </p>
    </div>
  );
}
