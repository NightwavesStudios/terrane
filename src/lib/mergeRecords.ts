import type { BadgeAward, ListCompletion, RecordState, Trip } from "../types/record";

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/** Merge two copies without dropping either copy's trips or list starts. */
export function mergeRecords(base: RecordState, incoming: RecordState): RecordState {
  const listStarts = { ...incoming.listStarts, ...base.listStarts };
  const startedLists = [...new Set([...base.startedLists, ...incoming.startedLists])];

  return {
    profile: base.profile,
    startedLists,
    listStarts,
    trips: uniqueBy<Trip>([...base.trips, ...incoming.trips], (trip) => trip.id),
    badges: uniqueBy<BadgeAward>(
      [...(base.badges ?? []), ...(incoming.badges ?? [])],
      (badge) => badge.badgeId,
    ),
    listCompletions: uniqueBy<ListCompletion>(
      [...(base.listCompletions ?? []), ...(incoming.listCompletions ?? [])],
      (completion) => `${completion.listId}:${completion.listVersion}`,
    ),
  };
}

export function recordData(record: RecordState): Omit<RecordState, "profile"> {
  return {
    startedLists: record.startedLists,
    listStarts: record.listStarts,
    badges: record.badges ?? [],
    listCompletions: record.listCompletions ?? [],
    trips: record.trips,
  };
}
