/** Derived progress. Everything here is calculated from the journal. */
import {
  adventureById,
  type Adventure,
  type AdventureKind,
  type Continent,
} from "../data/atlas";
import { LISTS, listById, type AdventureList } from "../data/lists";
import type { GoalMetric } from "../data/goals";
import { formatNumber } from "./format";
import type { JournalEntry, StoredGoal } from "./journal";

export function seasonOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

export function currentSeason(): number {
  return new Date().getFullYear();
}

export function entriesInSeason(entries: JournalEntry[], year: number): JournalEntry[] {
  return entries.filter((entry) => seasonOf(entry.date) === year);
}

export function summitedIds(entries: JournalEntry[]): Set<string> {
  return new Set(
    entries.filter((entry) => entry.outcome === "summit").map((entry) => entry.adventureId),
  );
}

export function visitedIds(entries: JournalEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.adventureId));
}

export function adventuresFor(entries: JournalEntry[]): Adventure[] {
  return entries
    .map((entry) => adventureById(entry.adventureId))
    .filter((adventure): adventure is Adventure => Boolean(adventure));
}

export interface JournalStats {
  outings: number;
  summits: number;
  places: number;
  elevation: number;
  continents: number;
  countries: number;
  listsComplete: number;
  highest?: Adventure;
}

export function computeStats(
  entries: JournalEntry[],
  year?: number | "all",
): JournalStats {
  const scoped =
    typeof year === "number" ? entriesInSeason(entries, year) : entries;
  const summitSet = summitedIds(scoped);
  const visited = adventuresFor(scoped);
  const allVisited = adventuresFor(entries);

  const summitAdventures = [...summitSet]
    .map((id) => adventureById(id))
    .filter((adventure): adventure is Adventure => Boolean(adventure));
  const elevation = summitAdventures.reduce(
    (total, adventure) => total + (adventure.elevationM ?? 0),
    0,
  );
  const highest = summitAdventures.reduce<Adventure | undefined>(
    (best, adventure) =>
      !best || (adventure.elevationM ?? 0) > (best.elevationM ?? 0) ? adventure : best,
    undefined,
  );

  return {
    outings: scoped.length,
    summits: scoped.filter((entry) => entry.outcome === "summit").length,
    places: new Set(visited.map((adventure) => adventure.id)).size,
    elevation,
    continents: new Set(visited.map((adventure) => adventure.continent)).size,
    countries: new Set(allVisited.map((adventure) => adventure.country)).size,
    listsComplete: LISTS.filter((list) => listProgress(list, entries).complete).length,
    highest,
  };
}

export interface ListProgress {
  list: AdventureList;
  done: Adventure[];
  members: Adventure[];
  ratio: number;
  complete: boolean;
}

export function listProgress(
  list: AdventureList,
  entries: JournalEntry[],
): ListProgress {
  const summitSet = summitedIds(entries);
  const members = list.members
    .map((id) => adventureById(id))
    .filter((adventure): adventure is Adventure => Boolean(adventure));
  const done = members.filter((adventure) => summitSet.has(adventure.id));
  return {
    list,
    done,
    members,
    ratio: members.length ? done.length / members.length : 0,
    complete: members.length > 0 && done.length === members.length,
  };
}

export interface GoalProgress {
  value: number;
  target: number;
  unit: string;
  detail: string;
  ratio: number;
  complete: boolean;
  remaining: number;
}

const METRIC_UNIT: Record<GoalMetric, string> = {
  summits: "summits",
  places: "places",
  elevation: "m",
  continents: "continents",
  volcanoes: "volcano sums",
  regions: "regions",
  list: "peaks",
};

export function goalProgress(
  goal: StoredGoal,
  entries: JournalEntry[],
): GoalProgress {
  const scoped = goal.year ? entriesInSeason(entries, goal.year) : entries;
  const visited = adventuresFor(scoped);
  const summitAdventures = [...summitedIds(scoped)]
    .map((id) => adventureById(id))
    .filter((adventure): adventure is Adventure => Boolean(adventure));

  let value = 0;
  let detail = "";

  switch (goal.metric) {
    case "summits":
      value = scoped.filter((entry) => entry.outcome === "summit").length;
      detail = `${value} of ${goal.target} summits logged`;
      break;
    case "places":
      value = new Set(visited.map((adventure) => adventure.id)).size;
      detail = `${value} of ${goal.target} distinct places`;
      break;
    case "elevation":
      value = summitAdventures.reduce(
        (total, adventure) => total + (adventure.elevationM ?? 0),
        0,
      );
      detail = `${formatNumber(value)} m of ${formatNumber(goal.target)} m`;
      break;
    case "continents":
      value = new Set(visited.map((adventure) => adventure.continent as Continent)).size;
      detail = `${value} of ${goal.target} continents visited`;
      break;
    case "volcanoes":
      value = scoped.filter(
        (entry) =>
          entry.outcome === "summit" &&
          adventureById(entry.adventureId)?.kind === ("volcano" as AdventureKind),
      ).length;
      detail = `${value} of ${goal.target} volcano summits`;
      break;
    case "regions":
      value = new Set(visited.map((adventure) => adventure.region)).size;
      detail = `${value} of ${goal.target} ranges or regions`;
      break;
    case "list": {
      const list = listById(goal.listId);
      const progress = list ? listProgress(list, entries) : undefined;
      value = progress?.done.length ?? 0;
      detail = list
        ? `${value} of ${progress?.members.length ?? goal.target} on ${list.name}`
        : `${value} of ${goal.target} peaks`;
      break;
    }
  }

  const target = goal.metric === "list" ? (listById(goal.listId)?.members.length ?? goal.target) : goal.target;
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const remaining = Math.max(0, target - value);

  return {
    value,
    target,
    unit: METRIC_UNIT[goal.metric],
    detail,
    ratio,
    complete: remaining === 0,
    remaining,
  };
}

/** Summits on a place, newest first, with the date that earned it. */
export function summitDates(entries: JournalEntry[], adventureId: string): JournalEntry[] {
  return entries
    .filter((entry) => entry.adventureId === adventureId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
