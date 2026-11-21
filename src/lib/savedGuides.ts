import { useMemo, useSyncExternalStore } from "react";

/**
 * Saved Experiences, kept in this browser.
 *
 * Collections are not part of the Saved library: the product separates the
 * reader's Experiences from thematic groups. The store is a separate versioned
 * key so it never tries to read an older collection-shaped record.
 */

export type SavedGuide = {
  slug: string;
  name: string;
  kind: string;
  country?: string;
  region?: string;
  at: number;
};

export const SAVED_GUIDES_KEY = "terrane.saved.guide.v1";
export const SAVED_GUIDES_MAX = 300;

function valid(value: unknown): value is SavedGuide {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.slug === "string" &&
    row.slug.length > 0 &&
    typeof row.name === "string" &&
    row.name.length > 0 &&
    typeof row.kind === "string" &&
    row.kind.length > 0 &&
    typeof row.at === "number" &&
    Number.isFinite(row.at)
  );
}

function read(): SavedGuide[] {
  try {
    const raw = localStorage.getItem(SAVED_GUIDES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, SAVED_GUIDES_MAX) : [];
  } catch {
    return [];
  }
}

let items: SavedGuide[] = typeof window === "undefined" ? [] : read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function write() {
  try {
    localStorage.setItem(SAVED_GUIDES_KEY, JSON.stringify(items));
  } catch {
    /* Quota exceeded or storage blocked: the in-memory list still works. */
  }
}

export function toggleSavedGuide(
  guide: Omit<SavedGuide, "at"> & { at?: number },
): boolean {
  const exists = items.some((item) => item.slug === guide.slug);
  items = exists
    ? items.filter((item) => item.slug !== guide.slug)
    : [{ ...guide, at: guide.at ?? Date.now() }, ...items].slice(0, SAVED_GUIDES_MAX);
  write();
  emit();
  return !exists;
}

export function savedGuides(): SavedGuide[] {
  return items;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedGuide[] {
  return items;
}

export function useSavedGuides(): SavedGuide[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useSavedGuideSlugs(): Set<string> {
  const list = useSavedGuides();
  return useMemo(() => new Set(list.map((item) => item.slug)), [list]);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SAVED_GUIDES_KEY) return;
    items = read();
    emit();
  });
}
