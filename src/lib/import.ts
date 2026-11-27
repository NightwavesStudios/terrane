import { PEAKS } from "../data/lists";
import type { DatePrecision, PeakOutcome, Trip, TripPeak } from "../types/record";

export const IMPORT_HEADERS = [
  "trip_id",
  "date",
  "precision",
  "source",
  "peak_slug",
  "peak_name",
  "outcome",
  "title",
  "notes",
] as const;

export const IMPORT_TEMPLATE = `${IMPORT_HEADERS.join(",")}
nh-2024-01,2024-01-15,day,backfill,mount-washington,,summit,Presidential winter,"Cold, clear, worth it."
nh-2024-01,2024-01-15,day,backfill,mount-monroe,,summit,Presidential winter,"Cold, clear, worth it."
co-2024-08,2024-08-01,month,backfill,mount-elbert,,summit,Colorado road trip,
`;

export interface ImportRow {
  rowNumber: number;
  tripKey: string;
  date: string;
  precision: DatePrecision;
  title: string;
  notes: string;
  peak: TripPeak;
}

export interface ImportError {
  rowNumber: number;
  message: string;
}

export interface ImportGroup {
  key: string;
  date: string;
  precision: DatePrecision;
  title: string;
  notes: string;
  peaks: TripPeak[];
  rows: number[];
  /** An existing trip with at least one of the same peak/date rows. */
  duplicateTripId?: string;
  duplicatePeaks: string[];
}

export interface ImportPreview {
  groups: ImportGroup[];
  errors: ImportError[];
  rowCount: number;
  validRows: number;
}

const OUTCOMES = new Set<PeakOutcome>(["summit", "attempt", "traverse"]);
const PRECISIONS = new Set<DatePrecision>(["day", "month", "year"]);
const PEAK_BY_SLUG = new Map(PEAKS.map((peak) => [peak.slug.toLowerCase(), peak]));
const PEAK_BY_NAME = new Map(PEAKS.map((peak) => [peak.name.toLowerCase(), peak]));

/** RFC 4180-style CSV parsing: quoted cells, doubled quotes and embedded newlines. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function cellAt(row: string[], headers: Map<string, number>, ...names: string[]): string {
  for (const name of names) {
    const index = headers.get(name);
    if (index !== undefined) return (row[index] ?? "").trim();
  }
  return "";
}

function validDate(value: string, precision: DatePrecision): string | null {
  if (precision === "year") {
    if (!/^\d{4}(?:-\d{2}-\d{2})?$/.test(value)) return null;
    return `${value.slice(0, 4)}-01-01`;
  }
  if (precision === "month") {
    if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) return null;
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12 ? `${value.slice(0, 7)}-01` : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function resolvePeak(slug: string, name: string) {
  if (slug) {
    const bySlug = PEAK_BY_SLUG.get(slug.toLowerCase());
    if (bySlug) return bySlug;
  }
  if (name) return PEAK_BY_NAME.get(name.toLowerCase());
  return undefined;
}

function groupKeyFor(row: string[], headers: Map<string, number>, fallback: string): string {
  const tripId = cellAt(row, headers, "trip_id", "trip_ref", "trip");
  if (tripId) return `trip:${tripId}`;
  return fallback;
}

/**
 * Parse and match a CSV without mutating the record. Every bad row is reported;
 * valid rows are grouped into trips by trip_id, or by date/title when absent.
 */
export function parseImportCsv(text: string, existingTrips: Trip[] = []): ImportPreview {
  const rows = parseCsvRows(text);
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim()));
  if (nonEmpty.length === 0) {
    return {
      groups: [],
      errors: [{ rowNumber: 1, message: "The CSV is empty." }],
      rowCount: 0,
      validRows: 0,
    };
  }

  const headers = new Map<string, number>();
  nonEmpty[0].forEach((header, index) => headers.set(headerKey(header), index));
  const errors: ImportError[] = [];
  const required = ["date"];
  for (const name of required) {
    if (!headers.has(name)) {
      return {
        groups: [],
        errors: [{ rowNumber: 1, message: `Missing required column “${name}”.` }],
        rowCount: nonEmpty.length - 1,
        validRows: 0,
      };
    }
  }
  if (!headers.has("peak_slug") && !headers.has("peak_name") && !headers.has("peak")) {
    return {
      groups: [],
      errors: [{ rowNumber: 1, message: "Missing peak column: use peak_slug or peak_name." }],
      rowCount: nonEmpty.length - 1,
      validRows: 0,
    };
  }

  const groups = new Map<string, ImportGroup>();
  let validRows = 0;

  nonEmpty.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const dateText = cellAt(row, headers, "date");
    const precisionText = (cellAt(row, headers, "precision") || "day").toLowerCase();
    if (!PRECISIONS.has(precisionText as DatePrecision)) {
      errors.push({ rowNumber, message: `Unknown precision “${precisionText}”; use day, month or year.` });
      return;
    }
    const precision = precisionText as DatePrecision;
    const date = validDate(dateText, precision);
    if (!date) {
      errors.push({
        rowNumber,
        message: `Invalid ${precision} date “${dateText}”. Use YYYY-MM-DD, YYYY-MM or YYYY.`,
      });
      return;
    }

    const slug = cellAt(row, headers, "peak_slug", "peak");
    const name = cellAt(row, headers, "peak_name");
    const peak = resolvePeak(slug, name);
    if (!peak) {
      errors.push({
        rowNumber,
        message: `No catalogue match for ${slug ? `slug “${slug}”` : `peak “${name}”`}.`,
      });
      return;
    }

    const outcomeText = (cellAt(row, headers, "outcome") || "summit").toLowerCase();
    if (!OUTCOMES.has(outcomeText as PeakOutcome)) {
      errors.push({ rowNumber, message: `Unknown outcome “${outcomeText}”; use summit, attempt or traverse.` });
      return;
    }
    const outcome = outcomeText as PeakOutcome;
    const title = cellAt(row, headers, "title") || "Imported climb";
    const notes = cellAt(row, headers, "notes");
    const fallbackKey = `${date}|${precision}|${title.toLowerCase()}|${notes.toLowerCase()}`;
    const key = groupKeyFor(row, headers, fallbackKey);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        date,
        precision,
        title,
        notes,
        peaks: [],
        rows: [],
        duplicatePeaks: [],
      };
      groups.set(key, group);
    }

    if (group.date !== date || group.precision !== precision) {
      errors.push({ rowNumber, message: "Rows sharing a trip_id must share the same date and precision." });
      return;
    }
    if (group.peaks.some((item) => item.slug === peak.slug)) {
      errors.push({
        rowNumber,
        message: `${peak.name} appears twice in the same imported trip; the duplicate row was ignored.`,
      });
      return;
    }

    group.peaks.push({ slug: peak.slug, outcome });
    group.rows.push(rowNumber);
    validRows += 1;
  });

  for (const group of groups.values()) {
    const candidate = existingTrips.find(
      (trip) =>
        trip.date === group.date &&
        trip.peaks.some((peak) => group.peaks.some((imported) => imported.slug === peak.slug)),
    );
    if (candidate) {
      group.duplicateTripId = candidate.id;
      group.duplicatePeaks = group.peaks
        .filter((peak) => candidate.peaks.some((existing) => existing.slug === peak.slug))
        .map((peak) => peak.slug);
    }
  }

  return {
    groups: [...groups.values()].filter((group) => group.peaks.length > 0),
    errors,
    rowCount: nonEmpty.length - 1,
    validRows,
  };
}
