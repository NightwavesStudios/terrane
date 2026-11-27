import { describe, expect, it } from "vitest";
import { missingLaunchAwards, sourceTripForBadge } from "./awards";
import { buildFacts } from "./facts";
import type { Trip } from "../types/record";

function trip(overrides: Partial<Trip> & Pick<Trip, "id" | "date" | "peaks">): Trip {
  return {
    title: "Trip",
    precision: "day",
    source: "manual",
    notes: "",
    createdAt: `${overrides.date}T12:00:00.000Z`,
    updatedAt: `${overrides.date}T12:00:00.000Z`,
    ...overrides,
  };
}

const input = {
  profile: {
    id: "p1",
    displayName: "Avery",
    email: "",
    units: "imperial" as const,
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  startedLists: ["nh48"],
  listStarts: {},
  completions: [],
};

describe("badge facts", () => {
  it("derives summit, winter, highpoint, range and trip facts without inventing others", () => {
    const facts = buildFacts({
      ...input,
      trips: [
        trip({
          id: "winter",
          date: "2024-01-15",
          source: "backfill",
          peaks: [
            { slug: "mount-washington", outcome: "summit" },
            { slug: "mount-monroe", outcome: "summit" },
            { slug: "mount-eisenhower", outcome: "summit" },
          ],
        }),
      ],
    });

    expect(facts["ascents.summits"]).toBe(3);
    expect(facts["ascents.unique_peaks"]).toBe(3);
    expect(facts["ascents.winter_summits"]).toBe(3);
    expect(facts["ascents.max_peaks_in_trip"]).toBe(3);
    expect(facts["ascents.has_highpoint"]).toBe(true);
    expect(facts["ascents.has_pre_account_ascent"]).toBe(true);
    expect(facts["ascents.ranges"]).toBeGreaterThan(0);
    expect(facts["ascents.countries"]).toBe(0);
    expect(facts["ascents.has_dawn_start"]).toBe(false);
    expect(facts["lists.started"]).toBe(1);
  });

  it("counts a comeback only when a summit follows an attempt", () => {
    const comeback = buildFacts({
      ...input,
      trips: [
        trip({ id: "a", date: "2024-02-01", peaks: [{ slug: "mount-adams", outcome: "attempt" }] }),
        trip({ id: "b", date: "2024-06-01", peaks: [{ slug: "mount-adams", outcome: "summit" }] }),
      ],
    });
    expect(comeback["ascents.has_summitted_previous_attempt"]).toBe(true);

    const reverse = buildFacts({
      ...input,
      trips: [
        trip({ id: "a", date: "2024-06-01", peaks: [{ slug: "mount-adams", outcome: "summit" }] }),
        trip({ id: "b", date: "2024-12-01", peaks: [{ slug: "mount-adams", outcome: "attempt" }] }),
      ],
    });
    expect(reverse["ascents.has_summitted_previous_attempt"]).toBe(false);
  });

  it("counts repeated ascents and distinct seasons", () => {
    const facts = buildFacts({
      ...input,
      trips: [
        trip({ id: "1", date: "2022-01-01", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
        trip({ id: "2", date: "2023-01-01", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
        trip({ id: "3", date: "2024-01-01", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
        trip({ id: "4", date: "2025-01-01", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
        trip({ id: "5", date: "2025-02-01", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
      ],
    });
    expect(facts["ascents.max_ascents_on_single_peak"]).toBe(5);
    expect(facts["ascents.seasons_on_single_peak"]).toBe(4);
  });

  it("awards nothing on empty facts and is idempotent", () => {
    const empty = buildFacts({ ...input, profile: null, startedLists: [], trips: [] });
    expect(missingLaunchAwards(empty, [])).toEqual([]);

    const facts = buildFacts({
      ...input,
      trips: [
        trip({
          id: "winter",
          date: "2024-01-15",
          source: "backfill",
          peaks: [
            { slug: "mount-washington", outcome: "summit" },
            { slug: "mount-monroe", outcome: "summit" },
            { slug: "mount-eisenhower", outcome: "summit" },
          ],
        }),
      ],
    });
    const first = missingLaunchAwards(facts, [], "2024-01-16T00:00:00.000Z");
    expect(first.map((award) => award.badgeId).sort()).toEqual([
      "first-light",
      "grand-traverse",
      "highpoint",
      "paper-trail",
    ]);
    expect(first[0].criteriaVersion).toBe(1);
    expect(first[0].sourceTripId).toBeUndefined();
    expect(
      sourceTripForBadge("first-light", {
        ...input,
        completions: [],
        trips: [
          trip({ id: "winter", date: "2024-01-15", peaks: [{ slug: "mount-washington", outcome: "summit" }] }),
        ],
      }),
    ).toBe("winter");
    expect(missingLaunchAwards(facts, first)).toEqual([]);
  });
});
