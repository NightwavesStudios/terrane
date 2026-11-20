import { useMemo, useSyncExternalStore } from "react";

/**
 * Saved destinations, kept in this browser.
 *
 * There is no account and no server: the list is one versioned localStorage
 * array. A corrupt value, a full quota or private mode must never break a page,
 * so every read and write is guarded and a bad row is dropped rather than
 * rendered. The `storage` listener keeps two open tabs in step.
 */

export type SavedPlace = {
  slug: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  country?: string;
  region?: string;
  /** When it was saved, for ordering and the date on the list. */
  at: number;
};

export const SAVED_KEY = "terrane.saved.v1";
export const SAVED_MAX = 500;

function valid(value: unknown): value is SavedPlace {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    row.slug.length > 0 &&
    typeof row.name === "string" &&
    row.name.length > 0 &&
    typeof row.cat === "string" &&
    row.cat.length > 0 &&
    typeof row.lat === "number" &&
    Number.isFinite(row.lat) &&
    typeof row.lon === "number" &&
    Number.isFinite(row.lon) &&
    typeof row.at === "number" &&
    Number.isFinite(row.at)
  );
}

function read(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, SAVED_MAX) : [];
  } catch {
    return [];
  }
}

let items: SavedPlace[] = typeof window === "undefined" ? [] : read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function write() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  } catch {
    /* Quota exceeded or storage blocked: the in-memory list still works. */
  }
}

/** Add or remove one place; returns true when it is now saved. */
export function toggleSaved(place: Omit<SavedPlace, "at"> & { at?: number }): boolean {
  const exists = items.some((item) => item.slug === place.slug);
  items = exists
    ? items.filter((item) => item.slug !== place.slug)
    : [{ ...place, at: place.at ?? Date.now() }, ...items].slice(0, SAVED_MAX);
  write();
  emit();
  return !exists;
}

export function isSaved(slug: string): boolean {
  return items.some((item) => item.slug === slug);
}

export function savedPlaces(): SavedPlace[] {
  return items;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedPlace[] {
  return items;
}

export function useSaved(): SavedPlace[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSavedSlugs(): Set<string> {
  const list = useSaved();
  return useMemo(() => new Set(list.map((item) => item.slug)), [list]);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SAVED_KEY) return;
    items = read();
    emit();
  });
}
