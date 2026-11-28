import { describe, expect, it } from "vitest";
import type { RecordState, Trip } from "../types/record";
import { buildCsv } from "./export";
import { parseImportCsv } from "./import";

const trip: Trip = {
  id: "trip-round-trip",
  title: "A ridge day, with commas",
  date: "2026-06-21",
  precision: "day",
  source: "manual",
  notes: 'Cold, clear and "worth it".',
  peaks: [
    { slug: "mount-washington", outcome: "summit" },
    { slug: "mount-monroe", outcome: "attempt" },
  ],
  createdAt: "2026-06-21T20:00:00.000Z",
  updatedAt: "2026-06-21T20:00:00.000Z",
};

const state: RecordState = {
  profile: null,
  startedLists: [],
  listStarts: {},
  badges: [],
  listCompletions: [],
  trips: [trip],
};

describe("CSV export", () => {
  it("exports importable ISO dates rather than display labels", () => {
    const csv = buildCsv(state);
    expect(csv).toContain('"2026-06-21"');
    expect(csv).not.toContain('"June 21, 2026"');
  });

  it("round-trips a trip back to the duplicate merge path", () => {
    const preview = parseImportCsv(buildCsv(state), [trip]);
    expect(preview.errors).toEqual([]);
    expect(preview.rowCount).toBe(2);
    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].duplicateTripId).toBe(trip.id);
    expect(preview.groups[0].duplicatePeaks).toEqual([
      "mount-washington",
      "mount-monroe",
    ]);
    expect(preview.groups[0].peaks.map((peak) => peak.outcome)).toEqual([
      "summit",
      "attempt",
    ]);
    expect(preview.groups[0].notes).toBe('Cold, clear and "worth it".');
  });
});
