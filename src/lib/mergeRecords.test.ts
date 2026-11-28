import { describe, expect, it } from "vitest";
import type { RecordState, Trip } from "../types/record";
import { mergeRecords, recordData } from "./mergeRecords";

function trip(id: string, slug = "mount-washington"): Trip {
  return {
    id,
    title: "A climb",
    date: "2024-07-01",
    precision: "day",
    source: "manual",
    notes: "",
    peaks: [{ slug, outcome: "summit" }],
    createdAt: "2024-07-01T10:00:00.000Z",
    updatedAt: "2024-07-01T10:00:00.000Z",
  };
}

function record(overrides: Partial<RecordState> = {}): RecordState {
  return {
    profile: {
      id: "user-1",
      displayName: "Avery",
      email: "avery@example.com",
      units: "imperial",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    startedLists: [],
    listStarts: {},
    badges: [],
    listCompletions: [],
    trips: [],
    ...overrides,
  };
}

describe("mergeRecords", () => {
  it("keeps cloud data and adds local data", () => {
    const cloud = record({ trips: [trip("cloud")], startedLists: ["nh48"] });
    const local = record({
      profile: null,
      trips: [trip("local", "mount-adams")],
      startedLists: ["munros"],
      listStarts: {
        munros: {
          version: "2026",
          edition: "2026",
          peakSlugs: ["ben-nevis-beinn-nibheis"],
          startedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    });

    const merged = mergeRecords(cloud, local);
    expect(merged.profile?.id).toBe("user-1");
    expect(merged.trips.map((item) => item.id)).toEqual(["cloud", "local"]);
    expect(merged.startedLists).toEqual(["nh48", "munros"]);
    expect(merged.listStarts.munros).toBeDefined();
  });

  it("does not duplicate a trip imported twice", () => {
    const cloud = record({ trips: [trip("same")] });
    const local = record({ profile: null, trips: [trip("same")] });
    expect(mergeRecords(cloud, local).trips).toHaveLength(1);
  });

  it("strips profile from the server payload", () => {
    expect(recordData(record())).not.toHaveProperty("profile");
  });
});
