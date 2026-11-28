import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import {
  getListForPeak,
  getPeak,
  PEAKS,
  type MountainList,
} from "../data/lists";
import { formatElevation } from "../lib/format";
import { formatTripDate, getPeakTrips } from "../lib/progress";
import { PEAK_NAMES, useRecord } from "../state/RecordContext";

function sourceLabel(listId: string | undefined): string {
  switch (listId) {
    case "nh48":
      return "NH48.info catalog";
    case "co14ers":
      return "14ers.com peak page";
    case "munros":
      return "DoBIH record";
    case "adk46":
      return "Wikipedia peak article";
    case "catskill3500":
      return "Catskill Hiker peak page";
    default:
      return "Catalogue record";
  }
}

export default function PeakDetailPage() {
  const { slug = "" } = useParams();
  const peak = getPeak(slug);
  const navigate = useNavigate();
  const {
    profile,
    progressFor,
    trips,
    completedSlugs,
    startList,
  } = useRecord();

  if (!peak) {
    return (
      <div className="content-page">
        <PageHeader
          eyebrow="Peaks / Not found"
          title={
            <>
              No peak <span className="display-italic">record.</span>
            </>
          }
          description={`“${slug}” is not one of the ${PEAKS.length} indexed peaks.`}
        />
        <Link to="/peaks" className="text-link">
          Back to all peaks <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const lists = getListForPeak(peak);
  const primaryList = lists[0];
  const climbed = completedSlugs.has(peak.slug);
  const peakTrips = getPeakTrips(trips, peak.slug);
  const attempted = !climbed && peakTrips.length > 0;
  const units = profile?.units ?? "imperial";
  const logTarget = `/log?peak=${peak.slug}`;
  const logHref = profile
    ? logTarget
    : `/signin?returnTo=${encodeURIComponent(logTarget)}`;
  const status = climbed ? "Climbed" : attempted ? "Attempted" : "Not climbed";
  const sourceHref = peak.sourceUrl ?? primaryList?.sourceUrl;
  const coordinates =
    typeof peak.lat === "number" && typeof peak.lon === "number"
      ? `${peak.lat.toFixed(4)}, ${peak.lon.toFixed(4)}`
      : "Unknown";

  function startListFor(list: MountainList) {
    if (!profile) {
      navigate(
        `/signin?returnTo=${encodeURIComponent(`/lists/${list.slug}?start=1`)}`,
      );
      return;
    }
    startList(list.id);
    navigate(`/lists/${list.slug}`);
  }

  return (
    <div className="content-page content-page--detail">
      <Link to="/peaks" className="back-link">
        <Icon name="arrow" size={15} /> Back to peaks
      </Link>

      <article className="peak-detail">
        <header className="peak-hero">
          <div className="peak-hero__intro">
            <p className="eyebrow">
              {primaryList?.title ?? "Catalogue"}
              {typeof peak.rank === "number" ? (
                <>
                  {" "}
                  <span aria-hidden="true">·</span> #{peak.rank}
                </>
              ) : null}
            </p>
            <h1>{peak.name}</h1>
            <p className="peak-hero__lede">
              {formatElevation(peak.elevationM, units, peak.elevationFt)}
              {peak.range ? ` · ${peak.range}` : null}
            </p>
          </div>

          <div className="peak-hero__aside">
            <span
              className={`peak-status${climbed ? " is-climbed" : attempted ? " is-attempted" : ""}`}
            >
              <i aria-hidden="true" />
              {status}
            </span>
            <div className="peak-hero__actions">
              <Link to={logHref} className="button button--bright">
                <Icon name="check" size={16} />
                {climbed ? "Log another climb" : "Log this climb"}
              </Link>
              {primaryList ? (
                <Link to={`/lists/${primaryList.slug}`} className="button">
                  <Icon name="list" size={16} /> Open list
                </Link>
              ) : null}
            </div>
            {!profile ? (
              <p className="peak-hero__note">
                Sign in to save this climb to your private record.
              </p>
            ) : null}
          </div>
        </header>

        <dl className="peak-facts" aria-label={`${peak.name} facts`}>
          <div>
            <dt>Elevation</dt>
            <dd>{formatElevation(peak.elevationM, units, peak.elevationFt)}</dd>
          </div>
          <div>
            <dt>Prominence</dt>
            <dd>{formatElevation(peak.prominenceM, units, peak.prominenceFt)}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>{peak.range ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd className="peak-facts__coordinates">{coordinates}</dd>
          </div>
        </dl>

        <div className="peak-body">
          <div className="peak-body__main">
            <section className="peak-section">
              <div className="peak-section__head">
                <h2>Your record</h2>
                <span>
                  {peakTrips.length
                    ? `${peakTrips.length} recorded`
                    : "No climbs yet"}
                </span>
              </div>
              {peakTrips.length ? (
                <div className="trip-list">
                  {peakTrips.slice(0, 4).map((trip) => (
                    <Link key={trip.id} to={`/log?trip=${trip.id}`} className="trip-row">
                      <span>
                        <strong>{formatTripDate(trip)}</strong>
                        <small>
                          {trip.title ||
                            trip.peaks
                              .map((item) => PEAK_NAMES.get(item.slug) ?? item.slug)
                              .join(", ")}
                        </small>
                      </span>
                      <span className="trip-row__outcome">
                        {trip.peaks[0]?.outcome ?? "summit"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="detail-copy">
                  No climb recorded yet. Your ascents, attempts and notes will appear here.
                </p>
              )}
            </section>

            <section className="peak-section">
              <div className="peak-section__head">
                <h2>Lists</h2>
                <span>
                  {lists.length} {lists.length === 1 ? "list" : "lists"}
                </span>
              </div>
              <div className="peak-list-rows">
                {lists.map((list) => {
                  const listState = progressFor(list.id);
                  return (
                    <div className="peak-list-row" key={list.id}>
                      <div className="peak-list-row__copy">
                        <Link to={`/lists/${list.slug}`}>{list.title}</Link>
                        <p>
                          {list.publisher} · {list.edition}
                        </p>
                      </div>
                      {listState.started ? (
                        <div className="peak-list-row__standing">
                          <strong>{listState.percent}%</strong>
                          <span>
                            {listState.completed} of {listState.total}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="button button--small"
                          onClick={() => startListFor(list)}
                        >
                          <Icon name="list" size={14} /> Start list
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="peak-body__aside">
            <section className="peak-sources" aria-labelledby="peak-sources-title">
              <p className="eyebrow">Sources</p>
              <h2 id="peak-sources-title">Where this comes from</h2>
              <p>
                Peak facts from{" "}
                {sourceHref ? (
                  <a href={sourceHref} target="_blank" rel="noreferrer">
                    {sourceLabel(primaryList?.id)}
                  </a>
                ) : (
                  sourceLabel(primaryList?.id)
                )}
                {peak.osmUrl ? (
                  <>
                    {" "}
                    and{" "}
                    <a href={peak.osmUrl} target="_blank" rel="noreferrer">
                      OpenStreetMap
                    </a>
                  </>
                ) : null}
                . Checked 27 November 2026.
              </p>
              {peak.prominenceM === undefined ? (
                <p className="peak-sources__note">
                  Prominence is not supplied by the source.
                </p>
              ) : null}
              <div className="peak-sources__links">
                {sourceHref ? (
                  <a href={sourceHref} target="_blank" rel="noreferrer">
                    Peak record <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                {peak.elevationSourceUrl ? (
                  <a href={peak.elevationSourceUrl} target="_blank" rel="noreferrer">
                    Elevation source <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                {peak.osmUrl ? (
                  <a href={peak.osmUrl} target="_blank" rel="noreferrer">
                    OpenStreetMap <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
                {primaryList ? (
                  <a href={primaryList.sourceUrl} target="_blank" rel="noreferrer">
                    List publisher <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </div>
              {primaryList ? (
                <p className="peak-sources__note">
                  Membership follows {primaryList.publisher}, {primaryList.edition}.
                  {primaryList.license ? ` ${primaryList.license}.` : ""} Terrane is
                  not the official record.
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      </article>
    </div>
  );
}
