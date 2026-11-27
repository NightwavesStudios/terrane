import catalogJson from "../../data/badges.json";
import { getList, getPeak, LISTS } from "../data/lists";
import { listProgress } from "../lib/progress";
import type { ListCompletion, ListStart, Profile, Trip } from "../types/record";
import {
  getBadgeProgress,
  type Badge,
  type BadgeCatalog,
  type BadgeProgress,
  type Facts,
} from "./evaluate";

const catalog = catalogJson as unknown as BadgeCatalog;

export const LAUNCH_BADGES: Badge[] = catalog.badges.filter((badge) => badge.launch);

function monthOf(trip: Trip): number {
  return Number(trip.date.slice(5, 7));
}

function isSolstice(trip: Trip): boolean {
  const month = monthOf(trip);
  const day = Number(trip.date.slice(8, 10));
  return (month === 6 && (day === 20 || day === 21)) || (month === 12 && (day === 21 || day === 22));
}

/**
 * Build the factual snapshot used by badge criteria. Unknown attributes
 * (country, continent, time of day) stay zero/false rather than being
 * estimated from a name or coordinates.
 */
export function buildFacts(input: {
  trips: Trip[];
  profile: Profile | null;
  startedLists: string[];
  listStarts: Record<string, ListStart>;
  completions: ListCompletion[];
}): Facts {
  const { trips, profile, startedLists, completions } = input;
  const summitOccurrences = trips.flatMap((trip) =>
    trip.peaks
      .filter((peak) => peak.outcome === "summit")
      .map((peak) => ({ trip, slug: peak.slug })),
  );
  const unique = new Set(summitOccurrences.map((occurrence) => occurrence.slug));
  const ranges = new Set(
    summitOccurrences
      .map((occurrence) => getPeak(occurrence.slug)?.range)
      .filter((range): range is string => Boolean(range)),
  );

  const ascentsByPeak = new Map<string, number>();
  const yearsByPeak = new Map<string, Set<string>>();
  for (const occurrence of summitOccurrences) {
    ascentsByPeak.set(occurrence.slug, (ascentsByPeak.get(occurrence.slug) ?? 0) + 1);
    const years = yearsByPeak.get(occurrence.slug) ?? new Set<string>();
    years.add(occurrence.trip.date.slice(0, 4));
    yearsByPeak.set(occurrence.slug, years);
  }

  const attemptOccurrences = trips.flatMap((trip) =>
    trip.peaks
      .filter((peak) => peak.outcome === "attempt")
      .map((peak) => ({ trip, slug: peak.slug })),
  );
  const hasComeback = attemptOccurrences.some((attempt) =>
    summitOccurrences.some(
      (summit) => summit.slug === attempt.slug && summit.trip.date >= attempt.trip.date,
    ),
  );

  const progress = startedLists.map((listId) =>
    listProgress(trips, startedLists, listId, getList(listId)?.peaks),
  );
  const currentYear = new Date().getFullYear();
  const monthsThisYear = new Set(
    summitOccurrences
      .filter((occurrence) => occurrence.trip.date.startsWith(`${currentYear}-`))
      .map((occurrence) => occurrence.trip.date.slice(5, 7)),
  );
  const elevationM = summitOccurrences.map(
    (occurrence) => getPeak(occurrence.slug)?.elevationM ?? 0,
  );
  const prominenceM = summitOccurrences.map(
    (occurrence) => getPeak(occurrence.slug)?.prominenceM ?? 0,
  );
  const completionCounts = LISTS.map(
    (list) => completions.filter((completion) => completion.listId === list.id).length,
  );

  return {
    "ascents.summits": summitOccurrences.length,
    "ascents.unique_peaks": unique.size,
    "ascents.attempts": attemptOccurrences.length,
    "ascents.gpx_tracks": 0,
    "ascents.winter_summits": summitOccurrences.filter((occurrence) => {
      const month = monthOf(occurrence.trip);
      return month === 12 || month === 1 || month === 2 || month === 3;
    }).length,
    "ascents.seasons_on_single_peak": Math.max(0, ...[...yearsByPeak.values()].map((years) => years.size)),
    "ascents.max_ascents_on_single_peak": Math.max(0, ...ascentsByPeak.values()),
    "ascents.countries": 0,
    "ascents.continents": 0,
    "ascents.ranges": ranges.size,
    "ascents.max_peaks_in_trip": Math.max(
      0,
      ...trips.map((trip) => trip.peaks.filter((peak) => peak.outcome === "summit").length),
    ),
    "ascents.max_elevation_m": Math.max(0, ...elevationM),
    "ascents.max_prominence_m": Math.max(0, ...prominenceM),
    "ascents.has_pre_account_ascent": trips.some((trip) => trip.source === "backfill"),
    "ascents.has_solstice_summit": trips.some(
      (trip) => trip.precision === "day" && trip.peaks.some((peak) => peak.outcome === "summit") && isSolstice(trip),
    ),
    "ascents.has_dawn_start": false,
    "ascents.has_night_summit": false,
    "ascents.has_highpoint": summitOccurrences.some((occurrence) => getPeak(occurrence.slug)?.isHighpoint),
    "ascents.has_continental_highpoint": false,
    "ascents.has_lonely_summit": summitOccurrences.some(
      (occurrence) => (getPeak(occurrence.slug)?.prominenceM ?? 0) >= 1000,
    ),
    "ascents.has_summitted_previous_attempt": hasComeback,
    "lists.started": startedLists.length,
    "lists.completed": completions.length,
    "lists.distinct_completed": new Set(completions.map((completion) => completion.listId)).size,
    "lists.max_progress_pct": Math.max(
      0,
      ...progress.map((item) => item.percent),
      ...(completions.length ? [100] : []),
    ),
    "lists.max_completed_rounds": Math.max(0, ...completionCounts),
    "contributions.photos": 0,
    "contributions.reports": 0,
    "contributions.corrections_accepted": 0,
    "time.months_with_summits_in_year": monthsThisYear.size,
    "time.current_year_complete": false,
    "profile.has_home_region_and_units": Boolean(profile),
  };
}

export function launchBadgeProgress(
  facts: Facts,
  existing: string[],
): Array<{ badge: Badge; earned: boolean; progress: BadgeProgress | null }> {
  return LAUNCH_BADGES.map((badge) => ({
    badge,
    earned: existing.includes(badge.id),
    progress: getBadgeProgress(badge, facts),
  }));
}

export { catalog };
