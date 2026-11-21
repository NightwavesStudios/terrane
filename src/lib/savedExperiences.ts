import { useMemo, useSyncExternalStore } from "react";

/**
 * Saved experiences, kept in this browser.
 *
 * The same contract as `saved.ts`: one versioned `localStorage` array, every read
 * and write guarded, a corrupt value or a full quota never breaks a page, and a
 * `storage` listener keeps two tabs in step. The place list and the experience
 * list are separate keys so neither has to migrate the other's shape.
 */

export type SavedExperience = {
  slug: string;
  title: string;
  category: string;
  stopCount: number;
  days: number;
  country?: string;
  region?: string;
  /** When it was saved, for ordering and the date on the list. */
  at: number;
};

export const SAVED_EXPERIENCES_KEY = "terrane.saved.experiences.v1";
export const SAVED_EXPERIENCES_MAX = 300;

function valid(value: unknown): value is SavedExperience {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    row.slug.length > 0 &&
    typeof row.title === "string" &&
    row.title.length > 0 &&
    typeof row.category === "string" &&
    row.category.length > 0 &&
    typeof row.stopCount === "number" &&
    Number.isFinite(row.stopCount) &&
    typeof row.days === "number" &&
    Number.isFinite(row.days) &&
    typeof row.at === "number" &&
    Number.isFinite(row.at)
  );
}

function read(): SavedExperience[] {
  try {
    const raw = localStorage.getItem(SAVED_EXPERIENCES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(valid).slice(0, SAVED_EXPERIENCES_MAX)
      : [];
  } catch {
    return [];
  }
}

let items: SavedExperience[] = typeof window === "undefined" ? [] : read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function write() {
  try {
    localStorage.setItem(SAVED_EXPERIENCES_KEY, JSON.stringify(items));
  } catch {
    /* Quota exceeded or storage blocked: the in-memory list still works. */
  }
}

/** Add or remove one experience; returns true when it is now saved. */
export function toggleSavedExperience(
  experience: Omit<SavedExperience, "at"> & { at?: number },
): boolean {
  const exists = items.some((item) => item.slug === experience.slug);
  items = exists
    ? items.filter((item) => item.slug !== experience.slug)
    : [{ ...experience, at: experience.at ?? Date.now() }, ...items].slice(
        0,
        SAVED_EXPERIENCES_MAX,
      );
  write();
  emit();
  return !exists;
}

export function savedExperiences(): SavedExperience[] {
  return items;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedExperience[] {
  return items;
}

export function useSavedExperiences(): SavedExperience[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSavedExperienceSlugs(): Set<string> {
  const list = useSavedExperiences();
  return useMemo(() => new Set(list.map((item) => item.slug)), [list]);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SAVED_EXPERIENCES_KEY) return;
    items = read();
    emit();
  });
}
