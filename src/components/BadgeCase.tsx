import { Link } from "react-router-dom";
import { launchBadgeProgress } from "../badges/facts";
import type { Badge as BadgeDefinition, Facts } from "../badges/evaluate";
import type { BadgeAward, Trip as TripRecord } from "../types/record";

interface Props {
  facts: Facts;
  awards: BadgeAward[];
  trips: TripRecord[];
}

function awardFor(badge: BadgeDefinition, awards: BadgeAward[]) {
  return awards.find((award) => award.badgeId === badge.id);
}

function sourceTrip(award: BadgeAward | undefined, trips: TripRecord[]) {
  return award?.sourceTripId ? trips.find((trip) => trip.id === award.sourceTripId) : undefined;
}

function awardDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BadgeCase({ facts, awards, trips }: Props) {
  const items = launchBadgeProgress(facts, awards.map((award) => award.badgeId));
  const earned = items.filter((item) => item.earned).length;

  return (
    <section className="passport" aria-labelledby="passport-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Passport</p>
          <h2 id="passport-title">Marks</h2>
        </div>
        <span className="panel-heading__meta">
          {earned} of {items.length} earned
        </span>
      </div>
      <div className="badge-grid">
        {items.map(({ badge, earned: isEarned, progress }) => {
          const award = awardFor(badge, awards);
          const trip = sourceTrip(award, trips);
          return (
            <article className={`badge-card${isEarned ? " badge-card--earned" : ""}`} key={badge.id}>
              <div className="badge-mark" aria-hidden="true">
                <svg viewBox="0 0 48 48" focusable="false">
                  <rect x="1" y="1" width="46" height="46" rx="23" />
                  <path d="M9 34 18 19l5 8 4-7 12 14H9Z" />
                  <path d="M9 39h30" />
                </svg>
                <span>{badge.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="badge-card__copy">
                <p className="eyebrow">{isEarned ? "Earned" : "Not yet"}</p>
                <h3>{badge.name}</h3>
                {!isEarned ? <p>{badge.description}</p> : null}
                {isEarned && award ? (
                  <p className="badge-card__meta">
                    {awardDate(award.earnedAt)}
                    {trip ? (
                      <>
                        {" "}· <Link to={`/log?trip=${trip.id}`}>{trip.title}</Link>
                      </>
                    ) : null}
                  </p>
                ) : progress ? (
                  <div className="badge-progress" aria-label={`${badge.name} progress`}>
                    <span><i style={{ width: `${progress.pct}%` }} /></span>
                    <small>{progress.current}/{progress.target} {progress.unit}</small>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
