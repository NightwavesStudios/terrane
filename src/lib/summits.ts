import { useMemo, useSyncExternalStore } from "react";

/**
 * The summit ledger, kept in this browser.
 *
 * One versioned list of `{ id, at }` climbs, where `id` is a peak's stable
 * `list/slug` key from `data/summits.ts`. There is no account and no upload:
 * a corrupt value, a full quota or private mode must never break the page, so
 * every read and write is guarded and bad rows are dropped. The `storage`
 * listener keeps two open tabs in step, like the Saved library does.
 */

export type Climb = {
  /** `listId/peak-slug`, from `peakId()`. */
  id: string;
  /** When the summit was logged, in milliseconds since the epoch. */
  at: number;
};

export const CLIMB_KEY = "terrane.summits.v1";
export const CLIMB_MAX = 1000;

function valid(value: unknown): value is Climb {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    row.id.includes("/") &&
    typeof row.at === "number" &&
    Number.isFinite(row.at)
  );
}

function read(): Climb[] {
  try {
    const raw = localStorage.getItem(CLIMB_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, CLIMB_MAX) : [];
  } catch {
    return [];
  }
}

let items: Climb[] = typeof window === "undefined" ? [] : read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function write() {
  try {
    localStorage.setItem(CLIMB_KEY, JSON.stringify(items));
  } catch {
    /* Quota exceeded or storage blocked: the in-memory list still works. */
  }
}

/** Log or unlog one summit; returns true when it is now logged. */
export function toggleClimbed(id: string, at = Date.now()): boolean {
  const exists = items.some((item) => item.id === id);
  items = exists
    ? items.filter((item) => item.id !== id)
    : [{ id, at }, ...items].slice(0, CLIMB_MAX);
  write();
  emit();
  return !exists;
}

/** When a summit was logged, or null when it is still ahead. */
export function climbedAt(id: string): number | null {
  return items.find((item) => item.id === id)?.at ?? null;
}

export function climbedLog(): Climb[] {
  return items;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Climb[] {
  return items;
}

export function useClimbs(): Climb[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The log as one lookup, newest first. Ignore ids that are not in a list. */
export function useClimbedMap(): Map<string, number> {
  const climbs = useClimbs();
  return useMemo(() => new Map(climbs.map((climb) => [climb.id, climb.at])), [climbs]);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== CLIMB_KEY) return;
    items = read();
    emit();
  });
}
