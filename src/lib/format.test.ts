import { describe, expect, it } from "vitest";
import { formatElevation } from "./format";

describe("formatElevation", () => {
  it("uses the source feet value when one is available", () => {
    expect(formatElevation(1344.5, "imperial", 4411)).toBe("4,411 ft");
  });

  it("converts metres to rounded feet when the source has no feet value", () => {
    expect(formatElevation(1000, "imperial")).toBe("3,281 ft");
  });

  it("uses rounded metres for the metric setting", () => {
    expect(formatElevation(4411 / 3.28084, "metric", 4411)).toBe("1,344 m");
  });

  it("keeps a missing elevation explicit", () => {
    expect(formatElevation(undefined, "imperial")).toBe("Unknown");
  });
});
