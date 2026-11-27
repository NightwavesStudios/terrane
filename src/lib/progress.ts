import { getList } from "../data/lists";
import { NH48_LIST } from "../data/nh48";
import type { Peak } from "../types/geography";
import type { ListProgress, Trip, TripPeak } from "../types/record";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function summitSlugs(trips: Trip[]): Set<string> {
  const slugs = new Set<string>();
  for (const trip of trips) {
    for (const peak of trip.peaks) {
      if (peak.outcome === "summit") slugs.add(peak.slug);
    }
  }
  return slugs;
}

export function listProgress(
  trips: Trip[],
  startedLists: string[],
  listId: string = NH48_LIST.id,
  listPeaks: Peak[] = getList(listId)?.peaks ?? [],
): ListProgress {
  const total = listPeaks.length;
  const climbed = summitSlugs(trips);
  const completedSlugs = new Set(
    listPeaks.filter((peak) => climbed.has(peak.slug)).map((peak) => peak.slug),
  );
  const completed = completedSlugs.size;

  return {
    listId,
    total,
    completed,
    remaining: Math.max(total - completed, 0),
    percent: total ? Math.round((completed / total) * 100) : 0,
    completedSlugs,
    started: startedLists.includes(listId),
  };
}

export function isPeakClimbed(trips: Trip[], slug: string): boolean {
  return trips.some((trip) =>
    trip.peaks.some((peak) => peak.slug === slug && peak.outcome === "summit"),
  );
}

export function getPeakTrips(trips: Trip[], slug: string): Trip[] {
  return trips.filter((trip) => trip.peaks.some((peak) => peak.slug === slug));
}

export function tripPeakLabels(peaks: TripPeak[]): string[] {
  return peaks.map((peak) => peak.slug);
}

export function tripPeakNames(trip: Trip, names: Map<string, string>): string {
  const labels = trip.peaks.map((peak) => names.get(peak.slug) ?? peak.slug);
  if (labels.length === 0) return "No peaks";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]} + ${labels.length - 1} more`;
}

export function formatTripDate(trip: Pick<Trip, "date" | "precision">): string {
  const [year, month, day] = trip.date.split("-").map(Number);
  if (!year) return "Unknown date";
  if (trip.precision === "year") return String(year);
  if (trip.precision === "month") return `${MONTHS[(month || 1) - 1]} ${year}`;
  const safeMonth = MONTHS[(month || 1) - 1];
  return `${safeMonth} ${day || 1}, ${year}`;
}

export function dateForPrecision(value: string, precision: Trip["precision"]): string {
  if (precision === "year") {
    return `${value.slice(0, 4)}-01-01`;
  }
  if (precision === "month") {
    return `${value.slice(0, 7)}-01`;
  }
  return value.slice(0, 10);
}

export function dateInputForPrecision(
  value: string,
  precision: Trip["precision"],
): string {
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") return value.slice(0, 7);
  return value.slice(0, 10);
}

export function statsFor(trips: Trip[]) {
  const climbed = summitSlugs(trips);
  const attempts = trips.flatMap((trip) => trip.peaks).filter((peak) => peak.outcome === "attempt").length;
  const winter = trips.filter((trip) => {
    const month = Number(trip.date.slice(5, 7));
    return month === 12 || month === 1 || month === 2 || month === 3;
  }).length;
  const daysOut = new Set(trips.map((trip) => trip.date)).size;

  return {
    uniquePeaks: climbed.size,
    summits: trips.reduce(
      (total, trip) => total + trip.peaks.filter((peak) => peak.outcome === "summit").length,
      0,
    ),
    trips: trips.length,
    daysOut,
    attempts,
    winterTrips: winter,
  };
}
