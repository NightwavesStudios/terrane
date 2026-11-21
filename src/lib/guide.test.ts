import { describe, expect, it } from "vitest";
import type { GuideCatalogRow } from "../data/guide";
import { guidePick } from "./guide";

const row: GuideCatalogRow = {
  slug: "yosemite-national-park",
  name: "Yosemite National Park",
  kind: "park",
  country: "United States",
  region: "Sierra Nevada",
  lat: 37.742,
  lon: -119.537,
  hue: 148,
  summary: "A national park in the Sierra Nevada.",
  placeCount: 12,
  trailCount: 5,
  associatedNames: ["Yosemite Falls"],
};

describe("guidePick", () => {
  it("turns a curated row into a selected Experience on the Globe", () => {
    expect(guidePick(row)).toMatchObject({
      cat: "experience",
      name: "Yosemite National Park",
      slug: "yosemite-national-park",
      lat: 37.742,
      lon: -119.537,
      region: "Sierra Nevada",
      country: "United States",
      hue: 148,
      experience: { kind: "park", places: 12, trails: 5 },
    });
  });
});
