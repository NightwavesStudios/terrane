import { NH48_LIST, NH48_PEAKS } from "../data/nh48";
import { formatTripDate, listProgress } from "./progress";
import type { RecordState } from "../types/record";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildExport(state: RecordState) {
  const progress = listProgress(state.trips, state.startedLists);
  return {
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    list: {
      slug: NH48_LIST.slug,
      title: NH48_LIST.title,
      publisher: NH48_LIST.publisher,
      edition: NH48_LIST.edition,
      sourceUrl: NH48_LIST.sourceUrl,
      totalPeaks: NH48_LIST.peaks.length,
    },
    progress: {
      completed: progress.completed,
      remaining: progress.remaining,
      percent: progress.percent,
      started: progress.started,
    },
    trips: state.trips.map((trip) => ({
      ...trip,
      displayDate: formatTripDate(trip),
      peakNames: trip.peaks.map((peak) => ({
        slug: peak.slug,
        name:
          NH48_PEAKS.find((candidate) => candidate.slug === peak.slug)?.name ??
          peak.slug,
        outcome: peak.outcome,
      })),
    })),
  };
}

export function exportJson(state: RecordState) {
  download(
    "terrane-record.json",
    JSON.stringify(buildExport(state), null, 2),
    "application/json",
  );
}

export function exportCsv(state: RecordState) {
  const rows = [
    ["trip_id", "date", "precision", "source", "peak_slug", "peak_name", "outcome", "title", "notes"],
    ...state.trips.flatMap((trip) =>
      trip.peaks.map((peak) => [
        trip.id,
        formatTripDate(trip),
        trip.precision,
        trip.source,
        peak.slug,
        NH48_PEAKS.find((candidate) => candidate.slug === peak.slug)?.name ?? peak.slug,
        peak.outcome,
        trip.title,
        trip.notes,
      ]),
    ),
  ];
  download(
    "terrane-record.csv",
    rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}
