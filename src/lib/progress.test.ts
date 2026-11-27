import { describe, expect, it } from "vitest";
import {
  dateForPrecision,
  dateInputForPrecision,
  formatTripDate,
  getPeakTrips,
  isPeakClimbed,
  listProgress,
  statsFor,
  summitSlugs,
} from "./progress";
import type { Trip } from "../types/record";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    title: "A day",
    date: "2026-06-01",
    precision: "day",
    source: "manual",
    notes: "",
    peaks: [{ slug: "mount-washington", outcome: "summit" }],
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("record progress", () => {
  it("counts a summit once and ignores attempts", () => {
    const trips = [
      trip(),
      trip({ id: "trip-2", date: "2025-07-01" }),
      trip({
        id: "trip-3",
        peaks: [{ slug: "mount-adams", outcome: "attempt" }],
      }),
    ];

    expect([...summitSlugs(trips)]).toEqual(["mount-washington"]);
    expect(isPeakClimbed(trips, "mount-washington")).toBe(true);
    expect(isPeakClimbed(trips, "mount-adams")).toBe(false);
  });

  it("reports list progress only against the NH 48 and respects start state", () => {
    const trips = [trip()];
    const progress = listProgress(trips, []);

    expect(progress.total).toBe(48);
    expect(progress.completed).toBe(1);
    expect(progress.remaining).toBe(47);
    expect(progress.started).toBe(false);
  });

  it("preserves date precision in display and input values", () => {
    expect(dateForPrecision("2024-08-19", "year")).toBe("2024-01-01");
    expect(dateForPrecision("2024-08-19", "month")).toBe("2024-08-01");
    expect(dateInputForPrecision("2024-08-01", "month")).toBe("2024-08");
    expect(formatTripDate({ date: "2024-08-01", precision: "month" })).toBe("August 2024");
    expect(formatTripDate({ date: "2024-01-01", precision: "year" })).toBe("2024");
  });

  it("finds all trips for a peak and computes honest stats", () => {
    const trips = [
      trip(),
      trip({ id: "trip-2", peaks: [{ slug: "mount-washington", outcome: "attempt" }] }),
    ];

    expect(getPeakTrips(trips, "mount-washington")).toHaveLength(2);
    expect(statsFor(trips)).toMatchObject({
      uniquePeaks: 1,
      summits: 1,
      trips: 2,
      attempts: 1,
      winterTrips: 0,
    });
  });
});
