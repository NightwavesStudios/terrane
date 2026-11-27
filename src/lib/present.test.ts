import { describe, expect, it } from "vitest";
import { coordinates, formatKm, pickContext, pickFacts, pickTitle } from "./present";
import type { Pick } from "../data/features";

const base: Pick = {
  cat: "peak",
  name: "Matterhorn",
  lat: 45.976,
  lon: 7.658,
  region: "Valais",
  country: "Switzerland",
  elev: 4478,
};

describe("formatKm", () => {
  it("uses metres under a kilometre, one decimal under ten, round above", () => {
    expect(formatKm(0.25)).toBe("250 m");
    expect(formatKm(2.44)).toBe("2.4 km");
    expect(formatKm(42.6)).toBe("43 km");
    expect(formatKm(-1)).toBe("");
  });
});

describe("pickContext", () => {
  it("prefers structured region and country", () => {
    expect(pickContext(base)).toBe("Valais, Switzerland");
  });

  it("does not repeat a country used as its own region", () => {
    expect(pickContext({ ...base, region: "Iceland", country: "Iceland" })).toBe(
      "Iceland",
    );
  });

  it("falls back to a named neighbour, then a location string, then coordinates", () => {
    expect(
      pickContext({ ...base, region: undefined, country: undefined }, { name: "Zermatt", km: 9.4 }),
    ).toBe("9.4 km from Zermatt");
    expect(
      pickContext({ ...base, region: undefined, country: undefined, where: "Dolomites" }),
    ).toBe("Dolomites");
    expect(pickContext({ ...base, region: undefined, country: undefined })).toBe(
      coordinates(45.976, 7.658),
    );
  });
});

describe("pickFacts", () => {
  it("adds prominence after elevation when the record has it", () => {
    expect(pickFacts({ ...base, prom: 1042 })).toEqual([
      "Valais, Switzerland",
      "4,478 m",
      "1,042 m prominence",
    ]);
  });
});

describe("pickTitle", () => {
  it("names an unnamed record by its category", () => {
    expect(pickTitle({ ...base, name: "  " }, "Lake")).toBe("Unnamed lake");
    expect(pickTitle(base, "Peak")).toBe("Matterhorn");
  });
});
