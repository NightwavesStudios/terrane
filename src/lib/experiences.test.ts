import { describe, expect, it } from "vitest";
import type { ExperienceCatalogRow } from "../data/experiences";
import {
  durationLabel,
  filterExperiences,
  matchedStop,
  nearbyExperiences,
  straightLineLabel,
} from "./experiences";

const row = (
  overrides: Partial<ExperienceCatalogRow> & { slug: string; title: string },
): ExperienceCatalogRow => ({
  category: "mountain",
  lat: 46,
  lon: 8,
  stopCount: 4,
  distanceKm: 40,
  durationHours: 9,
  days: 2,
  hue: 200,
  stopNames: [],
  ...overrides,
});

const rows: ExperienceCatalogRow[] = [
  row({
    slug: "peaks-of-bernese-alps",
    title: "Peaks of Bernese Alps",
    country: "Switzerland",
    region: "Bernese Alps",
    lat: 46.4,
    lon: 7.9,
    stopNames: ["Jungfrau", "Mönch", "Eiger"],
  }),
  row({
    slug: "camping-around-jasper",
    title: "Camping around Jasper",
    category: "camping",
    country: "Canada",
    region: "Alberta",
    lat: 53,
    lon: -118,
    stopNames: ["Maligne Lake", "Pyramid Mountain"],
  }),
  row({
    slug: "hiking-oregon-cascades",
    title: "Hiking Oregon Cascades",
    category: "hiking",
    country: "United States",
    region: "Oregon",
    lat: 44.2,
    lon: -121.8,
    stopNames: ["Mount Hood", "Three Sisters"],
  }),
];

describe("filterExperiences", () => {
  it("returns everything without a query or category", () => {
    expect(filterExperiences(rows)).toHaveLength(3);
  });

  it("filters by category", () => {
    expect(filterExperiences(rows, { category: "camping" })).toEqual([rows[1]]);
  });

  it("ranks a title match above a stop match", () => {
    const result = filterExperiences(rows, { query: "hiking" });
    expect(result.map((item) => item.slug)).toEqual(["hiking-oregon-cascades"]);
  });

  it("matches an accented stop name without the accent", () => {
    const result = filterExperiences(rows, { query: "monch" });
    expect(result.map((item) => item.slug)).toEqual(["peaks-of-bernese-alps"]);
  });

  it("matches a region or country", () => {
    expect(filterExperiences(rows, { query: "alberta" })).toEqual([rows[1]]);
    expect(filterExperiences(rows, { query: "switzerland" })).toEqual([rows[0]]);
  });

  it("combines a query with a category", () => {
    expect(filterExperiences(rows, { query: "hood", category: "hiking" })).toEqual([
      rows[2],
    ]);
    expect(filterExperiences(rows, { query: "hood", category: "camping" })).toEqual(
      [],
    );
  });

  it("returns nothing for an unknown term", () => {
    expect(filterExperiences(rows, { query: "kerguelen" })).toEqual([]);
  });
});

describe("matchedStop", () => {
  it("names the stop a query matched", () => {
    expect(matchedStop(rows[0], "eiger")).toBe("Eiger");
    expect(matchedStop(rows[0], "smoky")).toBeUndefined();
    expect(matchedStop(rows[0], "  ")).toBeUndefined();
  });
});

describe("labels", () => {
  it("makes the estimate unmistakably an estimate", () => {
    expect(durationLabel(9, 2)).toBe("≈ 9 h · 2 days");
    expect(durationLabel(4, 1)).toBe("≈ 4 h · 1 day");
    expect(durationLabel(0, 1)).toBe("≈ 1 day");
  });

  it("labels the distance as a straight line", () => {
    expect(straightLineLabel(0.4)).toBe("400 m straight line");
    expect(straightLineLabel(42.4)).toBe("42 km straight line");
  });
});

describe("nearbyExperiences", () => {
  it("excludes the current route and sorts by distance", () => {
    const result = nearbyExperiences(rows, { lat: 46.4, lon: 7.9 }, rows[0].slug, 4);
    expect(result.map((item) => item.row.slug)).toEqual([
      "camping-around-jasper",
      "hiking-oregon-cascades",
    ]);
    expect(result[0].km).toBeLessThan(result[1].km);
  });
});
