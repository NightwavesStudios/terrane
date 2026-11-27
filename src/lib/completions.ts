import { LISTS } from "../data/lists";
import type { ListCompletion, ListStart, Trip } from "../types/record";
import { listProgress } from "./progress";

/**
 * A completion is a snapshot against the edition the user is on. Once written it
 * is never recalculated or deleted; a later publisher change leaves it intact.
 */
export function missingCompletions(
  trips: Trip[],
  startedLists: string[],
  listStarts: Record<string, ListStart>,
  existing: ListCompletion[],
  now = new Date().toISOString(),
): ListCompletion[] {
  const existingKeys = new Set(
    existing.map((completion) => `${completion.listId}:${completion.listVersion}`),
  );
  const missing: ListCompletion[] = [];

  for (const list of LISTS) {
    if (!startedLists.includes(list.id)) continue;
    const progress = listProgress(trips, startedLists, list.id, list.peaks);
    if (progress.total === 0 || progress.completed !== progress.total) continue;

    const start = listStarts[list.id];
    const listVersion = start?.version ?? list.version;
    const key = `${list.id}:${listVersion}`;
    if (existingKeys.has(key)) continue;

    const snapshotSlugs = new Set(start?.peakSlugs ?? list.peaks.map((peak) => peak.slug));
    const evidenceTrip = [...trips]
      .map((trip) => ({
        trip,
        matches: trip.peaks.filter(
          (peak) => peak.outcome === "summit" && snapshotSlugs.has(peak.slug),
        ).length,
      }))
      .filter((candidate) => candidate.matches > 0)
      .sort((a, b) => b.matches - a.matches)[0]?.trip;
    missing.push({
      id: `completion_${list.id}_${listVersion}`,
      listId: list.id,
      listVersion,
      edition: start?.edition ?? list.edition,
      completedAt: now,
      peakSlugs: start?.peakSlugs ?? list.peaks.map((peak) => peak.slug),
      evidenceTripId: evidenceTrip?.id,
    });
    existingKeys.add(key);
  }

  return missing;
}
