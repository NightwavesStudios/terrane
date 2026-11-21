import { describe, expect, it } from "vitest";
import type { ExperienceCatalogRow } from "../data/experiences";
import {
  experienceWhere,
  filterExperiences,
  kilometresFrom,
  matchedStop,
  nearbyExperiences,
  type ExperienceNear,
} from "./experiences";

const row = (
  overrides: Partial<ExperienceCatalogRow> & { slug: string; title: string },
): ExperienceCatalogRow => ({
  category: "mountain",
  lat: 46,
  lon: 8,
  stopCount: 4,
  spanKm: 40,
  hue: 200,
  sourceCount: 4,
  stopNames: [],
  ...overrides,
});

const rows: ExperienceCatalogRow[] = [
  row({
    slug: "exploring-bernese-alps",
    title: "Exploring Bernese Alps",
    country: "Switzerland",
    region: "Bernese Alps",
    lat: 46.4,
    lon: 7.9,
    stopNames: ["Jungfrau", "Mönch", "Eiger"],
  }),
  row({
    slug: "exploring-jasper",
    title: "Exploring Jasper",
    category: "camping",
    country: "Canada",
    region: "Alberta",
    lat: 53,
    lon: -118,
    stopNames: ["Maligne Lake", "Pyramid Mountain"],
  }),
  row({
    slug: "exploring-oregon-cascades",
    title: "Exploring Oregon Cascades",
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

  it("ranks a title match above a place match", () => {
    const result = filterExperiences(rows, { query: "oregon" });
    expect(result.map((item) => item.slug)).toEqual(["exploring-oregon-cascades"]);
  });

  it("matches an accented place name without the accent", () => {
    const result = filterExperiences(rows, { query: "monch" });
    expect(result.map((item) => item.slug)).toEqual(["exploring-bernese-alps"]);
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

describe("place search", () => {
  const near: ExperienceNear = { lat: 46.4, lon: 7.9, label: "Bernese Alps" };

  it("keeps collections within the radius and orders them by distance", () => {
    const result = filterExperiences(rows, { near });
    expect(result.map((item) => item.slug)).toEqual(["exploring-bernese-alps"]);
    expect(kilometresFrom(rows[0], near)).toBeLessThan(1);
  });

  it("drops everything outside the radius", () => {
    const far: ExperienceNear = { lat: -40, lon: 100, label: "Indian Ocean" };
    expect(filterExperiences(rows, { near: far })).toEqual([]);
  });

  it("still ranks a query match first inside a place", () => {
    const wider: ExperienceNear = { lat: 46.4, lon: 7.9, label: "Bernese Alps" };
    const close = row({
      slug: "exploring-aletsch",
      title: "Exploring Aletsch",
      lat: 46.45,
      lon: 7.95,
      stopNames: ["Aletschhorn"],
    });
    const result = filterExperiences([...rows, close], {
      near: wider,
      query: "eiger",
    });
    expect(result.map((item) => item.slug)).toEqual(["exploring-bernese-alps"]);
  });
});

describe("matchedStop", () => {
  it("names the place a query matched", () => {
    expect(matchedStop(rows[0], "eiger")).toBe("Eiger");
    expect(matchedStop(rows[0], "smoky")).toBeUndefined();
    expect(matchedStop(rows[0], "  ")).toBeUndefined();
  });
});

describe("experienceWhere", () => {
  it("does not repeat a region that is the country", () => {
    expect(experienceWhere({ region: "Switzerland", country: "Switzerland" })).toBe(
      "Switzerland",
    );
  });

  it("joins region and country, and tolerates either alone", () => {
    expect(experienceWhere({ region: "Valais", country: "Switzerland" })).toBe(
      "Valais, Switzerland",
    );
    expect(experienceWhere({ country: "Georgia" })).toBe("Georgia");
    expect(experienceWhere({})).toBe("");
  });
});

describe("nearbyExperiences", () => {
  it("excludes the current collection and sorts by distance", () => {
    const result = nearbyExperiences(rows, { lat: 46.4, lon: 7.9 }, rows[0].slug, 4);
    expect(result.map((item) => item.row.slug)).toEqual([
      "exploring-jasper",
      "exploring-oregon-cascades",
    ]);
    expect(result[0].km).toBeLessThan(result[1].km);
  });
});
