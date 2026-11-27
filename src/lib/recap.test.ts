import { describe, expect, it } from "vitest";
import { recapForYear, recapYears } from "./recap";
import type { Trip } from "../types/record";

function trip(id: string, date: string, slugs: string[]): Trip {
  return {
    id,
    title: id,
    date,
    precision: "day",
    source: "manual",
    notes: "",
    peaks: slugs.map((slug) => ({ slug, outcome: "summit" as const })),
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe("annual recap", () => {
  it("renders an empty year without inventing content", () => {
    const recap = recapForYear([], 2026);
    expect(recap.trips).toBe(0);
    expect(recap.summits).toBe(0);
    expect(recap.uniquePeaks).toBe(0);
    expect(recap.months.every((month) => month === 0)).toBe(true);
  });

  it("counts three trips, unique peaks and attempts", () => {
    const recap = recapForYear(
      [
        trip("a", "2024-01-15", ["mount-washington", "mount-monroe"]),
        trip("b", "2024-06-15", ["mount-washington"]),
        trip("c", "2024-09-15", ["mount-adams"]),
      ],
      2024,
    );
    expect(recap.trips).toBe(3);
    expect(recap.summits).toBe(4);
    expect(recap.uniquePeaks).toBe(3);
    expect(recap.months[0]).toBe(1);
    expect(recap.months[5]).toBe(1);
    expect(recap.months[8]).toBe(1);
    expect(recap.winterTrips).toBe(1);
  });

  it("handles fifty trips and lists available years newest first", () => {
    const trips = Array.from({ length: 50 }, (_, index) =>
      trip(`t${index}`, `2024-${String((index % 12) + 1).padStart(2, "0")}-01`, ["mount-washington"]),
    );
    const recap = recapForYear(trips, 2024);
    expect(recap.trips).toBe(50);
    expect(recap.summits).toBe(50);
    expect(recap.uniquePeaks).toBe(1);
    expect(recapYears(trips, 2026)).toEqual([2026, 2024]);
  });
});
