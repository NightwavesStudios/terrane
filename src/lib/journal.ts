/**
 * The journal: the only mutable state in Terrane.
 *
 * A single small store over localStorage. Ascents, attempts and visits live
 * here; goals are adopted from presets. Nothing here plans an outing or tracks
 * one in progress — entries are written after the fact, by hand.
 */
import { useSyncExternalStore } from "react";
import type { GoalMetric } from "../data/goals";

export type Outcome = "summit" | "attempt" | "visit";

export const OUTCOME_META: Record<
  Outcome,
  { label: string; short: string; note: string }
> = {
  summit: { label: "Summit reached", short: "Summit", note: "You stood on the top." },
  attempt: { label: "Turned back", short: "Attempt", note: "An honest attempt, no summit." },
  visit: { label: "Visited", short: "Visit", note: "You were there, without a summit." },
};

export interface JournalEntry {
  id: string;
  adventureId: string;
  date: string;
  outcome: Outcome;
  note?: string;
}

export interface StoredGoal {
  id: string;
  title: string;
  metric: GoalMetric;
  target: number;
  /** Season the goal belongs to; absent means all time. */
  year?: number;
  listId?: string;
  createdAt: string;
  custom?: boolean;
}

export interface JournalState {
  entries: JournalEntry[];
  goals: StoredGoal[];
}

const STORAGE_KEY = "terrane.journal.v1";
const VERSION = 1;

const EMPTY: JournalState = { entries: [], goals: [] };

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function isEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.adventureId === "string" &&
    typeof entry.date === "string" &&
    (entry.outcome === "summit" || entry.outcome === "attempt" || entry.outcome === "visit")
  );
}

function isGoal(value: unknown): value is StoredGoal {
  if (!value || typeof value !== "object") return false;
  const goal = value as Record<string, unknown>;
  return (
    typeof goal.id === "string" &&
    typeof goal.title === "string" &&
    typeof goal.metric === "string" &&
    typeof goal.target === "number"
  );
}

function load(): JournalState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { version?: number; state?: unknown };
    if (parsed.version !== VERSION || !parsed.state) return EMPTY;
    const state = parsed.state as { entries?: unknown; goals?: unknown };
    /* Earlier builds shipped a labelled sample season. Drop it on load so no
       fabricated ascent survives the change to an empty, honest journal. */
    const legacySample = (value: unknown) =>
      Boolean((value as { sample?: boolean }).sample);
    const entries = Array.isArray(state.entries)
      ? state.entries.filter(isEntry).filter((entry) => !legacySample(entry))
      : [];
    const goals = Array.isArray(state.goals)
      ? state.goals.filter(isGoal).filter((goal) => !legacySample(goal))
      : [];
    return { entries, goals };
  } catch {
    return EMPTY;
  }
}

let state: JournalState = load();
const listeners = new Set<() => void>();

function commit(next: JournalState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: VERSION, state: next }),
      );
    } catch {
      // Storage can be unavailable (private mode, quota). The session still works.
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): JournalState {
  return state;
}

function getServerSnapshot(): JournalState {
  return EMPTY;
}

export interface NewEntry {
  adventureId: string;
  date: string;
  outcome: Outcome;
  note?: string;
}

export function addEntry(input: NewEntry): void {
  const entry: JournalEntry = { id: newId("outing"), ...input };
  commit({ ...state, entries: [entry, ...state.entries] });
}

export function removeEntry(id: string): void {
  commit({ ...state, entries: state.entries.filter((entry) => entry.id !== id) });
}

export function clearJournal(): void {
  commit({ ...state, entries: [] });
}

export interface NewGoal {
  title: string;
  metric: GoalMetric;
  target: number;
  year?: number;
  listId?: string;
}

export function addCustomGoal(input: NewGoal): void {
  const goal: StoredGoal = {
    id: newId("goal"),
    createdAt: new Date().toISOString().slice(0, 10),
    custom: true,
    ...input,
  };
  commit({ ...state, goals: [...state.goals, goal] });
}

export function adoptGoal(goal: StoredGoal): void {
  if (state.goals.some((existing) => existing.id === goal.id)) return;
  commit({ ...state, goals: [...state.goals, goal] });
}

export function removeGoal(id: string): void {
  commit({ ...state, goals: state.goals.filter((goal) => goal.id !== id) });
}

export function useJournal() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    entries: snapshot.entries,
    goals: snapshot.goals,
    addEntry,
    removeEntry,
    clearJournal,
    adoptGoal,
    addCustomGoal,
    removeGoal,
  };
}
