import { describe, expect, it } from "vitest";
import {
  describeCollection,
  kindPhrase,
  orderExperiences,
  spanKm,
  validateGroups,
} from "./collections.mjs";

const experience = (slug, name, kind, lat, lon) => ({
  slug,
  name,
  kind,
  lat,
  lon,
  placeCount: 2,
  trailCount: 1,
});

const alps = [
  experience("matterhorn", "Matterhorn", "peak", 45.98, 7.66),
  experience("mont-blanc", "Mont Blanc", "peak", 45.83, 6.86),
  experience("lake-bled", "Lake Bled", "lake", 46.36, 14.09),
];

describe("validateGroups", () => {
  const base = {
    slug: "the-alps",
    title: "The Alps",
    scope: "range",
    where: "Central Europe",
    countries: ["Switzerland", "Slovenia"],
    slugs: ["matterhorn", "mont-blanc", "lake-bled"],
  };

  it("accepts a total, non-overlapping grouping", () => {
    expect(
      validateGroups([base], ["matterhorn", "mont-blanc", "lake-bled"]),
    ).toEqual([]);
  });

  it("rejects a missing Experience", () => {
    expect(validateGroups([base], ["matterhorn", "mont-blanc", "lake-bled", "eiger"]))
      .toEqual(["unassigned Experience: eiger"]);
  });

  it("rejects a duplicate membership", () => {
    const errors = validateGroups(
      [base, { ...base, slug: "second", slugs: ["matterhorn"] }],
      ["matterhorn", "mont-blanc", "lake-bled"],
    );
    expect(errors).toContain("second: needs at least two Experiences");
    expect(errors).toContain("second: matterhorn already belongs to the-alps");
  });

  it("requires a basis trail on a trail collection", () => {
    const errors = validateGroups(
      [{ ...base, scope: "trail" }],
      ["matterhorn", "mont-blanc", "lake-bled"],
    );
    expect(errors).toContain("the-alps: trail collection has no basisTrails");
  });
});

describe("collection prose", () => {
  it("counts kinds and names the widest scope", () => {
    expect(kindPhrase(alps)).toBe("2 peaks and a lake");
    const prose = describeCollection({
      experiences: alps,
      where: "Central Europe",
      scope: "range",
      countries: ["Switzerland", "Slovenia"],
    });
    expect(prose.summary).toContain("3 curated Experiences");
    expect(prose.summary).toContain("2 peaks and a lake");
    expect(prose.description[1]).toContain("not itineraries");
  });

  it("names recorded trails only for a trail collection", () => {
    const prose = describeCollection({
      experiences: alps,
      where: "Central Europe",
      scope: "trail",
      basisTrails: ["Via Alpina"],
      countries: ["Switzerland"],
    });
    expect(prose.description[0]).toContain("Via Alpina");
    expect(prose.description[1]).toContain("not verified");
  });
});

describe("ordering and span", () => {
  it("follows the editorial selection order", () => {
    const order = new Map([
      ["lake-bled", 0],
      ["matterhorn", 1],
      ["mont-blanc", 2],
    ]);
    expect(orderExperiences(alps, order).map((item) => item.slug)).toEqual([
      "lake-bled",
      "matterhorn",
      "mont-blanc",
    ]);
  });

  it("reports a positive bounding diagonal", () => {
    expect(spanKm(alps)).toBeGreaterThan(500);
  });
});
