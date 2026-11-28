import { LISTS, PEAKS } from "../data/lists";
import { NH48_LIST } from "../data/nh48";
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
    listStarts: state.listStarts,
    badges: state.badges ?? [],
    completions: state.listCompletions ?? [],
    lists: LISTS.map((list) => {
      const listState = listProgress(state.trips, state.startedLists, list.id);
      return {
        slug: list.slug,
        title: list.title,
        publisher: list.publisher,
        edition: list.edition,
        version: list.version,
        sourceUrl: list.sourceUrl,
        totalPeaks: list.peaks.length,
        completed: listState.completed,
        remaining: listState.remaining,
        percent: listState.percent,
        started: listState.started,
      };
    }),
    // Kept for clients that read the single NH 48 shape.
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
        name: PEAKS.find((candidate) => candidate.slug === peak.slug)?.name ?? peak.slug,
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

export function buildCsv(state: RecordState): string {
  const rows = [
    ["trip_id", "date", "precision", "source", "peak_slug", "peak_name", "outcome", "title", "notes"],
    ...state.trips.flatMap((trip) =>
      trip.peaks.map((peak) => [
        trip.id,
        trip.date,
        trip.precision,
        trip.source,
        peak.slug,
        PEAKS.find((candidate) => candidate.slug === peak.slug)?.name ?? peak.slug,
        peak.outcome,
        trip.title,
        trip.notes,
      ]),
    ),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function exportCsv(state: RecordState) {
  download(
    "terrane-record.csv",
    buildCsv(state),
    "text/csv;charset=utf-8",
  );
}
