import { describe, expect, it } from "vitest";
import { NH48_PEAKS } from "../data/nh48";
import { missingCompletions } from "./completions";
import type { ListStart, Trip } from "../types/record";

const start: ListStart = {
  version: "amc-2026",
  edition: "2026 edition",
  peakSlugs: NH48_PEAKS.map((peak) => peak.slug),
  startedAt: "2024-01-01T00:00:00.000Z",
};

const all: Trip = {
  id: "all",
  title: "The round",
  date: "2024-09-01",
  precision: "day",
  source: "backfill",
  notes: "",
  peaks: NH48_PEAKS.map((peak) => ({ slug: peak.slug, outcome: "summit" as const })),
  createdAt: "2024-09-02T00:00:00.000Z",
  updatedAt: "2024-09-02T00:00:00.000Z",
};

describe("list completions", () => {
  it("writes one snapshot against the version captured at start", () => {
    const completions = missingCompletions(
      [all],
      ["nh48"],
      { nh48: start },
      [],
      "2024-09-02T00:00:00.000Z",
    );
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      listId: "nh48",
      listVersion: "amc-2026",
      edition: "2026 edition",
      completedAt: "2024-09-02T00:00:00.000Z",
      evidenceTripId: "all",
    });
    expect(completions[0].peakSlugs).toHaveLength(48);
  });

  it("is idempotent for the same list version", () => {
    const first = missingCompletions([all], ["nh48"], { nh48: start }, []);
    expect(missingCompletions([all], ["nh48"], { nh48: start }, first)).toEqual([]);
  });

  it("keeps the old completion when the trips are removed", () => {
    const first = missingCompletions([all], ["nh48"], { nh48: start }, []);
    expect(first).toHaveLength(1);
    expect(missingCompletions([], ["nh48"], { nh48: start }, first)).toEqual([]);
    expect(first[0].listVersion).toBe("amc-2026");
  });

  it("does not complete an unstarted list", () => {
    expect(missingCompletions([all], [], { nh48: start }, [])).toEqual([]);
  });
});
