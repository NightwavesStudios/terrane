import { describe, expect, it } from "vitest";
import { LISTS, type MountainList } from "../data/lists";
import { NH48_PEAKS } from "../data/nh48";
import { listVersionChange } from "./listVersion";
import type { ListStart } from "../types/record";

const start: ListStart = {
  version: "amc-2026",
  edition: "2026 edition",
  peakSlugs: NH48_PEAKS.map((peak) => peak.slug),
  startedAt: "2026-01-01T00:00:00.000Z",
};

describe("list version changes", () => {
  it("reports no change when the edition and membership match", () => {
    const change = listVersionChange(LISTS[0], start);
    expect(change.changed).toBe(false);
    expect(change.added).toEqual([]);
    expect(change.removed).toEqual([]);
  });

  it("shows new and removed peaks without altering the start snapshot", () => {
    const changed: MountainList = {
      ...LISTS[0],
      version: "amc-2027",
      peaks: [...LISTS[0].peaks.slice(0, 47)],
    };
    changed.peaks.push({
      ...NH48_PEAKS[0],
      slug: "new-peak",
      name: "New Peak",
    });

    const result = listVersionChange(changed, start);
    expect(result.changed).toBe(true);
    expect(result.startedVersion).toBe("amc-2026");
    expect(result.currentVersion).toBe("amc-2027");
    expect(result.added).toEqual(["new-peak"]);
    expect(result.removed).toEqual(["mount-tecumseh"]);
    expect(start.peakSlugs).toHaveLength(48);
  });

  it("treats a legacy start without a snapshot as current", () => {
    const change = listVersionChange(LISTS[0]);
    expect(change.changed).toBe(false);
  });
});
