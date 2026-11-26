import { useMemo, useSyncExternalStore } from "react";
import {
  SUMMIT_LISTS,
  feetToMetres,
  type SummitList,
  type SummitPeak,
} from "../data/summits";

/**
 * The one personal log.
 *
 * A wish and an ascent are the same record in two states. Keys are stable and
 * canonical: a listed summit is `peak:<list>/<slug>`, a page place is
 * `place:<slug>`, and a pin without a page is `pin:<lat>,<lon>`. The store is
 * local to this browser, every read and write is guarded, and a bad row is
 * dropped rather than rendered.
 *
 * The old summit ledger, saved places and saved Experiences are migrated once
 * into this shape, then their keys are removed. No account, no upload.
 */

export type LogKind = "peak" | "place" | "custom";
export type LogState = "want" | "done";

export type LogEntry = {
  key: string;
  kind: LogKind;
  /** Display category: peak, park, experience, camp site, custom… */
  cat: string;
  name: string;
  state: LogState;
  /** When the state last changed, in milliseconds since the epoch. */
  at: number;
  /** The day it was climbed, when it has been. */
  date?: number;
  note?: string;
  lat?: number;
  lon?: number;
  /** Elevation in metres, where the record carries one. */
  elev?: number;
  where?: string;
  /** Page slug, when the place has one. */
  slug?: string;
  listId?: string;
  listName?: string;
  peakName?: string;
  source?: string;
};

export const LOG_KEY = "terrane.log.v2";
export const LOG_MAX = 2000;

const OLD_SUMMITS = "terrane.summits.v1";
const OLD_SAVED = "terrane.saved.v1";
const OLD_GUIDES = "terrane.saved.guide.v1";

const PREFIX = {
  peak: "peak:",
  place: "place:",
  pin: "pin:",
  custom: "custom:",
} as const;

function peakOfId(id: string): { list: SummitList; peak: SummitPeak } | null {
  for (const list of SUMMIT_LISTS) {
    if (!id.startsWith(`${list.id}/`)) continue;
    const slug = id.slice(list.id.length + 1);
    const peak = list.peaks.find(
      (candidate) =>
        candidate.name
          .toLowerCase()
          .replace(/['’]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") === slug,
    );
    if (peak) return { list, peak };
  }
  return null;
}

/** The canonical key for one peak in one list. */
export function peakKey(listId: string, peakName: string): string {
  return `${PREFIX.peak}${listId}/${peakName
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function placeKey(slug: string): string {
  return `${PREFIX.place}${slug}`;
}

export function pinKey(lat: number, lon: number): string {
  return `${PREFIX.pin}${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function isPeakEntry(entry: LogEntry): boolean {
  return entry.kind === "peak" || entry.kind === "custom";
}

/** A listed summit as a log entry, with no coordinate invented. */
export function entryForPeak(
  list: SummitList,
  peak: SummitPeak,
  state: LogState = "want",
  at = Date.now(),
): LogEntry {
  return {
    key: peakKey(list.id, peak.name),
    kind: "peak",
    cat: "peak",
    name: peak.name,
    state,
    at,
    ...(state === "done" ? { date: at } : {}),
    elev: feetToMetres(peak.ft),
    where: peak.where ?? list.region,
    slug: peak.place,
    listId: list.id,
    listName: list.name,
    peakName: peak.name,
  };
}

function valid(value: unknown): value is LogEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.key === "string" &&
    row.key.length > 0 &&
    (row.kind === "peak" || row.kind === "place" || row.kind === "custom") &&
    typeof row.name === "string" &&
    row.name.length > 0 &&
    typeof row.cat === "string" &&
    (row.state === "want" || row.state === "done") &&
    typeof row.at === "number" &&
    Number.isFinite(row.at) &&
    (row.lat === undefined ||
      (typeof row.lat === "number" && Number.isFinite(row.lat))) &&
    (row.lon === undefined ||
      (typeof row.lon === "number" && Number.isFinite(row.lon))) &&
    (row.date === undefined ||
      (typeof row.date === "number" && Number.isFinite(row.date))) &&
    (row.note === undefined || typeof row.note === "string")
  );
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function fromSummits(): LogEntry[] {
  const rows = readJson(OLD_SUMMITS);
  if (!Array.isArray(rows)) return [];
  const out: LogEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as { id?: unknown; at?: unknown };
    if (typeof record.id !== "string" || typeof record.at !== "number") continue;
    const found = peakOfId(record.id);
    if (!found) continue;
    out.push(entryForPeak(found.list, found.peak, "done", record.at));
  }
  return out;
}

function fromSaved(): LogEntry[] {
  const rows = readJson(OLD_SAVED);
  if (!Array.isArray(rows)) return [];
  const out: LogEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (
      typeof record.slug !== "string" ||
      !record.slug ||
      typeof record.name !== "string" ||
      !record.name ||
      typeof record.cat !== "string" ||
      typeof record.lat !== "number" ||
      typeof record.lon !== "number" ||
      typeof record.at !== "number"
    ) {
      continue;
    }
    out.push({
      key: placeKey(record.slug),
      kind: "place",
      cat: record.cat,
      name: record.name,
      state: "want",
      at: record.at,
      lat: record.lat,
      lon: record.lon,
      slug: record.slug,
      where:
        typeof record.region === "string"
          ? record.region
          : typeof record.country === "string"
            ? record.country
            : undefined,
    });
  }
  return out;
}

function fromGuides(): LogEntry[] {
  const rows = readJson(OLD_GUIDES);
  if (!Array.isArray(rows)) return [];
  const out: LogEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (
      typeof record.slug !== "string" ||
      !record.slug ||
      typeof record.name !== "string" ||
      !record.name ||
      typeof record.kind !== "string" ||
      typeof record.at !== "number"
    ) {
      continue;
    }
    out.push({
      key: placeKey(record.slug),
      kind: "place",
      cat: "experience",
      name: record.name,
      state: "want",
      at: record.at,
      slug: record.slug,
      where:
        typeof record.region === "string"
          ? record.region
          : typeof record.country === "string"
            ? record.country
            : undefined,
    });
  }
  return out;
}

function dedupe(entries: LogEntry[]): LogEntry[] {
  const map = new Map<string, LogEntry>();
  for (const entry of entries) {
    const previous = map.get(entry.key);
    if (!previous) {
      map.set(entry.key, entry);
      continue;
    }
    /* A climb beats a wish for the same place; the later record wins. */
    if (previous.state !== "done" && entry.state === "done") map.set(entry.key, entry);
    else if (previous.state === entry.state && entry.at > previous.at) {
      map.set(entry.key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.at - a.at).slice(0, LOG_MAX);
}

function migrate(): LogEntry[] {
  return dedupe([...fromSummits(), ...fromSaved(), ...fromGuides()]);
}

function read(): LogEntry[] {
  const raw = readJson(LOG_KEY);
  if (Array.isArray(raw)) return raw.filter(valid).slice(0, LOG_MAX);
  if (raw && typeof raw === "object") {
    const entries = (raw as { entries?: unknown }).entries;
    if (Array.isArray(entries)) return entries.filter(valid).slice(0, LOG_MAX);
  }
  return [];
}

function clearOld(): void {
  try {
    localStorage.removeItem(OLD_SUMMITS);
    localStorage.removeItem(OLD_SAVED);
    localStorage.removeItem(OLD_GUIDES);
  } catch {
    /* Storage blocked: the migrated log is already in memory. */
  }
}

function hasStoredLog(): boolean {
  try {
    return localStorage.getItem(LOG_KEY) !== null;
  } catch {
    return false;
  }
}

let items: LogEntry[] = [];
if (typeof window !== "undefined") {
  items = read();
  if (hasStoredLog()) {
    /* A current log supersedes the old keys. Clear them even when its list is
       empty, so deleting an entry can never re-run the migration. */
    clearOld();
  } else {
    const migrated = migrate();
    if (migrated.length > 0) {
      if (write(migrated)) {
        items = migrated;
        clearOld();
      }
    } else {
      /* There was nothing valid to migrate, or there was nothing at all.
         Remove the keys either way: the one migration attempt is spent. */
      clearOld();
    }
  }
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function write(next: LogEntry[]): boolean {
  items = next.slice(0, LOG_MAX);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(items));
    return true;
  } catch {
    /* Quota exceeded or storage blocked: the in-memory log still works. */
    return false;
  }
}

function upsert(entry: LogEntry): void {
  const next = [entry, ...items.filter((item) => item.key !== entry.key)]
    .sort((a, b) => b.at - a.at)
    .slice(0, LOG_MAX);
  write(next);
  emit();
}

/** Add or remove a want. A bagged place stays bagged. */
export function toggleWant(entry: LogEntry, at = Date.now()): boolean {
  const existing = items.find((item) => item.key === entry.key);
  if (existing?.state === "done") return false;
  if (existing) {
    write(items.filter((item) => item.key !== entry.key));
    emit();
    return false;
  }
  upsert({ ...entry, state: "want", at });
  return true;
}

/** Bag an entry, or change the day it was bagged. */
export function markBagged(entry: LogEntry, date = Date.now()): void {
  const existing = items.find((item) => item.key === entry.key);
  upsert({
    ...entry,
    ...existing,
    state: "done",
    at: Date.now(),
    date,
  });
}

/** Remove an ascent (or a wish). */
export function removeEntry(key: string): void {
  const next = items.filter((item) => item.key !== key);
  if (next.length === items.length) return;
  write(next);
  emit();
}

/** Edit the date and note of one entry without changing its state. */
export function updateEntry(
  key: string,
  patch: { date?: number; note?: string },
): void {
  const existing = items.find((item) => item.key === key);
  if (!existing) return;
  upsert({
    ...existing,
    ...(patch.date !== undefined ? { date: patch.date } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    at: existing.at,
  });
}

/** Log a summit that is not on a sourced list. */
export function addCustom(input: {
  name: string;
  elevationM?: number;
  date?: number;
  note?: string;
  where?: string;
}): LogEntry | null {
  const name = input.name.trim();
  if (!name) return null;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const at = input.date ?? Date.now();
  const entry: LogEntry = {
    key: `${PREFIX.custom}${id}`,
    kind: "custom",
    cat: "peak",
    name,
    state: "done",
    at,
    date: at,
    ...(input.elevationM ? { elev: input.elevationM } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.where ? { where: input.where } : {}),
  };
  upsert(entry);
  return entry;
}

export function logEntry(key: string): LogEntry | undefined {
  return items.find((item) => item.key === key);
}

/** The canonical key for a pick-shaped record, or null for a bare coordinate. */
export function keyForPlace(input: {
  slug?: string;
  lat: number;
  lon: number;
}): string {
  return input.slug ? placeKey(input.slug) : pinKey(input.lat, input.lon);
}

export function logExport(): {
  version: 2;
  exported: string;
  entries: LogEntry[];
} {
  return {
    version: 2,
    exported: new Date().toISOString(),
    entries: items,
  };
}

export function logImport(value: unknown): { ok: boolean; count: number } {
  const rows =
    Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? (value as { entries?: unknown }).entries
        : null;
  if (!Array.isArray(rows)) return { ok: false, count: 0 };
  const entries = dedupe(rows.filter(valid));
  if (entries.length === 0 && rows.length > 0) return { ok: false, count: 0 };
  write(entries);
  emit();
  return { ok: true, count: entries.length };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LogEntry[] {
  return items;
}

export function useLog(): LogEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useLogEntry(key: string | null): LogEntry | undefined {
  const list = useLog();
  return useMemo(
    () => (key ? list.find((entry) => entry.key === key) : undefined),
    [list, key],
  );
}

export type LogStats = {
  bagged: number;
  want: number;
  verticalM: number;
  listsComplete: number;
  listProgress: Record<string, number>;
  places: number;
};

export function logStats(entries: LogEntry[]): LogStats {
  const done = entries.filter((entry) => entry.state === "done");
  const listProgress: Record<string, number> = {};
  for (const list of SUMMIT_LISTS) listProgress[list.id] = 0;
  for (const entry of done) {
    if (entry.kind === "peak" && entry.listId && entry.listId in listProgress) {
      listProgress[entry.listId] += 1;
    }
  }
  return {
    bagged: done.filter(isPeakEntry).length,
    want: entries.filter((entry) => entry.state === "want").length,
    verticalM: Math.round(
      done
        .filter(isPeakEntry)
        .reduce((sum, entry) => sum + (entry.elev ?? 0), 0),
    ),
    listsComplete: SUMMIT_LISTS.filter(
      (list) => listProgress[list.id] === list.peaks.length,
    ).length,
    listProgress,
    places: done.filter((entry) => entry.kind === "place").length,
  };
}

/** The entries that can be drawn on the globe. */
export function mappedEntries(
  entries: LogEntry[],
  resolve?: (slug: string) => { lat: number; lon: number } | undefined,
): (LogEntry & { lat: number; lon: number })[] {
  const out: (LogEntry & { lat: number; lon: number })[] = [];
  for (const entry of entries) {
    if (typeof entry.lat === "number" && typeof entry.lon === "number") {
      out.push(entry as LogEntry & { lat: number; lon: number });
      continue;
    }
    if (entry.slug && resolve) {
      const place = resolve(entry.slug);
      if (place) out.push({ ...entry, lat: place.lat, lon: place.lon });
    }
  }
  return out;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== LOG_KEY) return;
    items = read();
    emit();
  });
}
