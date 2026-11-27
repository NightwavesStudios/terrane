import type { BadgeAward, ListCompletion, ListStart, Profile, Trip } from "../types/record";
import { evaluateBadge, type Facts } from "./evaluate";
import { buildFacts, LAUNCH_BADGES } from "./facts";

const LIST_MARKS = new Set(["halfway", "finisher"]);

/**
 * Return only awards that are newly earned. Existing awards are never recreated,
 * so a later criteria change cannot silently re-award or revoke a mark.
 */
export function missingLaunchAwards(
  facts: Facts,
  existing: BadgeAward[],
  now = new Date().toISOString(),
): BadgeAward[] {
  const earned = new Set(existing.map((award) => award.badgeId));
  return LAUNCH_BADGES.filter(
    (badge) => !earned.has(badge.id) && evaluateBadge(badge, facts),
  ).map((badge) => ({
    badgeId: badge.id,
    criteriaVersion: badge.criteriaVersion,
    earnedAt: now,
  }));
}

/**
 * Replay the record chronologically to find the trip where a mark first became
 * true. List marks have no single source trip, so they stay unattributed.
 */
export function sourceTripForBadge(
  badgeId: string,
  input: {
    trips: Trip[];
    profile: Profile | null;
    startedLists: string[];
    listStarts: Record<string, ListStart>;
    completions: ListCompletion[];
  },
): string | undefined {
  if (LIST_MARKS.has(badgeId)) return undefined;
  const badge = LAUNCH_BADGES.find((item) => item.id === badgeId);
  if (!badge) return undefined;

  const chronological = [...input.trips].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  for (let index = 0; index < chronological.length; index += 1) {
    const facts = buildFacts({ ...input, trips: chronological.slice(0, index + 1) });
    if (evaluateBadge(badge, facts)) return chronological[index].id;
  }
  return undefined;
}
