import type { MountainList } from "../data/lists";
import type { ListStart } from "../types/record";

export interface ListVersionChange {
  changed: boolean;
  added: string[];
  removed: string[];
  startedVersion: string;
  currentVersion: string;
}

/**
 * Compare the current published list with the membership captured when the
 * user started it. A later publisher change is shown, never silently applied to
 * the old record.
 */
export function listVersionChange(list: MountainList, start?: ListStart): ListVersionChange {
  if (!start) {
    return {
      changed: false,
      added: [],
      removed: [],
      startedVersion: list.version,
      currentVersion: list.version,
    };
  }

  const current = new Set(list.peaks.map((peak) => peak.slug));
  const original = new Set(start.peakSlugs);
  const added = [...current].filter((slug) => !original.has(slug));
  const removed = [...original].filter((slug) => !current.has(slug));

  return {
    changed: start.version !== list.version || added.length > 0 || removed.length > 0,
    added,
    removed,
    startedVersion: start.version,
    currentVersion: list.version,
  };
}
