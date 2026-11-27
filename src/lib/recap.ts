import type { Trip } from "../types/record";

export interface YearRecap {
  year: number;
  trips: number;
  summits: number;
  uniquePeaks: number;
  attempts: number;
  winterTrips: number;
  months: number[];
}

export function recapForYear(trips: Trip[], year: number): YearRecap {
  const inYear = trips.filter((trip) => trip.date.startsWith(`${year}-`));
  const summits = inYear.flatMap((trip) =>
    trip.peaks.filter((peak) => peak.outcome === "summit"),
  );
  const attempts = inYear.flatMap((trip) =>
    trip.peaks.filter((peak) => peak.outcome === "attempt"),
  );
  const months = Array.from({ length: 12 }, () => 0);
  for (const trip of inYear) {
    if (trip.peaks.some((peak) => peak.outcome === "summit")) {
      const month = Number(trip.date.slice(5, 7));
      if (month >= 1 && month <= 12) months[month - 1] += 1;
    }
  }

  return {
    year,
    trips: inYear.length,
    summits: summits.length,
    uniquePeaks: new Set(summits.map((peak) => peak.slug)).size,
    attempts: attempts.length,
    winterTrips: inYear.filter((trip) => {
      const month = Number(trip.date.slice(5, 7));
      return month === 12 || month === 1 || month === 2 || month === 3;
    }).length,
    months,
  };
}

export function recapYears(trips: Trip[], currentYear = new Date().getFullYear()): number[] {
  const years = new Set<number>([currentYear]);
  for (const trip of trips) {
    const year = Number(trip.date.slice(0, 4));
    if (Number.isInteger(year) && year >= 1900) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}
