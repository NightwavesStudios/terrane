import { describe, expect, it } from "vitest";
import { homeScope, matches } from "./filters";
import type { Place } from "../data/places";

const place = (over: Partial<Place>): Place => ({
  slug: "x",
  name: "X",
  type: "peak",
  country: "Nowhere",
  lat: 0,
  lon: 0,
  hue: 0,
  ...over,
});

describe("homeScope", () => {
  it("returns null without a location", () => {
    expect(homeScope(null)).toBeNull();
  });

  it("falls back to the country when the atlas has no region rows", () => {
    const scope = homeScope({
      lat: 37,
      lon: -119,
      region: "California",
      country: "United States",
    });
    expect(scope?.label).toBe("United States");
    expect(scope?.test(place({ country: "United States" }))).toBe(true);
    expect(scope?.test(place({ country: "Canada" }))).toBe(false);
  });

  it("falls back to the country when the region has no rows", () => {
    const scope = homeScope({
      lat: 0,
      lon: 0,
      region: "Nowhere-shire",
      country: "United States",
    });
    expect(scope?.label).toBe("United States");
  });

  it("returns null when neither region nor country is in the atlas", () => {
    expect(homeScope({ lat: 0, lon: 0, region: "Atlantis", country: "Atlantis" })).toBeNull();
  });
});

describe("matches", () => {
  const scope = { label: "California", test: (p: Place) => p.region === "California" };

  it("keeps everything for all", () => {
    expect(matches(place({}), "all", null)).toBe(true);
  });

  it("filters by type", () => {
    expect(matches(place({ type: "park" }), "park", null)).toBe(true);
    expect(matches(place({ type: "peak" }), "park", null)).toBe(false);
  });

  it("uses the home scope, and does not hide the world without one", () => {
    expect(matches(place({ region: "California" }), "home", scope)).toBe(true);
    expect(matches(place({ region: "Utah" }), "home", scope)).toBe(false);
    expect(matches(place({ region: "Utah" }), "home", null)).toBe(true);
  });
});
