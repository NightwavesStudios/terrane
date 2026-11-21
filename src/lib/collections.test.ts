import { describe, expect, it } from "vitest";
import type { CollectionCatalogRow } from "../data/collections";
import {
  collectionForExperience,
  filterCollections,
  kilometresFrom,
  matchedExperience,
  nearbyCollections,
  type CollectionNear,
} from "./collections";

const row = (
  overrides: Partial<CollectionCatalogRow> & { slug: string; title: string },
): CollectionCatalogRow => ({
  scope: "area",
  where: "The Alps",
  countries: ["Switzerland"],
  lat: 46,
  lon: 8,
  experienceCount: 4,
  countryCount: 1,
  placeCount: 40,
  trailCount: 12,
  kinds: { peak: 3, park: 1 },
  hue: 148,
  experienceNames: [],
  experienceSlugs: [],
  ...overrides,
});

const rows: CollectionCatalogRow[] = [
  row({
    slug: "the-alps",
    title: "The Alps",
    scope: "range",
    where: "Central Europe",
    countries: ["Austria", "France", "Italy", "Switzerland"],
    lat: 46.4,
    lon: 7.9,
    experienceNames: ["Matterhorn", "Mont Blanc", "Eiger"],
    experienceSlugs: ["matterhorn", "mont-blanc", "eiger"],
  }),
  row({
    slug: "the-rocky-mountains",
    title: "The Rocky Mountains",
    scope: "range",
    where: "Western North America",
    countries: ["Canada", "United States"],
    lat: 45,
    lon: -113,
    experienceNames: ["Grand Teton", "Banff National Park"],
    experienceSlugs: ["grand-teton", "banff-national-park"],
  }),
  row({
    slug: "new-zealand",
    title: "New Zealand",
    scope: "country",
    where: "Aotearoa New Zealand",
    countries: ["New Zealand"],
    lat: -43.5,
    lon: 170,
    experienceNames: ["Aoraki / Mount Cook National Park", "Tongariro National Park"],
    experienceSlugs: ["aoraki-mount-cook", "tongariro"],
  }),
];

describe("filterCollections", () => {
  it("returns everything without a query or scope", () => {
    expect(filterCollections(rows)).toHaveLength(3);
  });

  it("filters by scope", () => {
    expect(filterCollections(rows, { scope: "range" })).toEqual([rows[0], rows[1]]);
  });

  it("ranks a title match above a geography match", () => {
    const result = filterCollections(rows, { query: "alps" });
    expect(result.map((item) => item.slug)).toEqual(["the-alps"]);
  });

  it("matches a country, range and member Experience", () => {
    expect(filterCollections(rows, { query: "switzerland" })).toEqual([rows[0]]);
    expect(filterCollections(rows, { query: "aotearoa" })).toEqual([rows[2]]);
    expect(filterCollections(rows, { query: "eiger" })).toEqual([rows[0]]);
  });

  it("matches an accented member name without the accent", () => {
    expect(filterCollections(rows, { query: "aoraki" })).toEqual([rows[2]]);
  });

  it("combines a query with a scope", () => {
    expect(filterCollections(rows, { query: "teton", scope: "range" })).toEqual([
      rows[1],
    ]);
    expect(filterCollections(rows, { query: "teton", scope: "country" })).toEqual(
      [],
    );
  });

  it("returns nothing for an unknown term", () => {
    expect(filterCollections(rows, { query: "kerguelen" })).toEqual([]);
  });
});

describe("near a place", () => {
  const near: CollectionNear = { lat: 46.4, lon: 7.9, label: "The Alps" };

  it("keeps collections within the wide radius and orders them by distance", () => {
    const result = filterCollections(rows, { near });
    expect(result.map((item) => item.slug)).toEqual(["the-alps"]);
    expect(kilometresFrom(rows[0], near)).toBeLessThan(1);
  });

  it("drops everything outside the radius", () => {
    const far: CollectionNear = { lat: -40, lon: 100, label: "Indian Ocean" };
    expect(filterCollections(rows, { near: far })).toEqual([]);
  });

  it("still ranks a query match first inside a place", () => {
    const close = row({
      slug: "southern-europe",
      title: "Southern Europe",
      lat: 45.9,
      lon: 7.8,
      experienceNames: ["Dolomites"],
    });
    const result = filterCollections([...rows, close], {
      near,
      query: "eiger",
    });
    expect(result.map((item) => item.slug)).toEqual(["the-alps"]);
  });
});

describe("matchedExperience", () => {
  it("names the member a query matched", () => {
    expect(matchedExperience(rows[0], "eiger")).toBe("Eiger");
    expect(matchedExperience(rows[0], "everest")).toBeUndefined();
    expect(matchedExperience(rows[0], "  ")).toBeUndefined();
  });
});

describe("collectionForExperience", () => {
  it("finds the one collection containing an Experience", () => {
    expect(collectionForExperience(rows, "eiger")?.slug).toBe("the-alps");
    expect(collectionForExperience(rows, "grand-teton")?.slug).toBe(
      "the-rocky-mountains",
    );
    expect(collectionForExperience(rows, "kerguelen")).toBeUndefined();
  });
});

describe("nearbyCollections", () => {
  it("excludes the current collection and sorts by distance", () => {
    const result = nearbyCollections(rows, { lat: 46.4, lon: 7.9 }, rows[0].slug, 4);
    expect(result.map((item) => item.row.slug)).toEqual([
      "the-rocky-mountains",
      "new-zealand",
    ]);
    expect(result[0].km).toBeLessThan(result[1].km);
  });
});
