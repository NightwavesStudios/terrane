import { useSyncExternalStore } from "react";

export interface Collection {
  id: string;
  name: string;
  slugs: string[];
}

const KEY = "terrane.collections.v1";
const DEFAULT_ID = "want-to-go";

function read(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [{ id: DEFAULT_ID, name: "Want to go", slugs: [] }];
    const parsed = JSON.parse(raw) as Collection[];
    if (!Array.isArray(parsed) || !parsed.length) {
      return [{ id: DEFAULT_ID, name: "Want to go", slugs: [] }];
    }
    return parsed;
  } catch {
    return [{ id: DEFAULT_ID, name: "Want to go", slugs: [] }];
  }
}

let state: Collection[] = read();
const subs = new Set<() => void>();

function write(next: Collection[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked — keep the in-memory copy */
  }
  subs.forEach((f) => f());
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useCollections(): Collection[] {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function toggleIn(collectionId: string, slug: string) {
  const collections = state.map((c) => {
    if (c.id !== collectionId) return c;
    const has = c.slugs.includes(slug);
    return {
      ...c,
      slugs: has ? c.slugs.filter((s) => s !== slug) : [...c.slugs, slug],
    };
  });
  write(collections);
}

export function removeFromAll(slug: string) {
  write(state.map((c) => ({ ...c, slugs: c.slugs.filter((s) => s !== slug) })));
}

export function createCollection(name: string): string {
  const id = `c-${Date.now().toString(36)}`;
  write([...state, { id, name: name.trim() || "Untitled", slugs: [] }]);
  return id;
}

export function removeCollection(id: string) {
  if (state.length === 1) {
    write([{ ...state[0], slugs: [] }]);
    return;
  }
  write(state.filter((c) => c.id !== id));
}
