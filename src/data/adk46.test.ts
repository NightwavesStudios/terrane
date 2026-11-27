import { describe, expect, it } from "vitest";
import { ADK46_LIST, ADK46_PEAKS, getAdk46 } from "./adk46";

describe("Adirondack 46 seed", () => {
  it("has all 46 peaks with unique slugs", () => {
    expect(ADK46_PEAKS).toHaveLength(46);
    expect(new Set(ADK46_PEAKS.map((peak) => peak.slug)).size).toBe(46);
    expect(ADK46_LIST.publisher).toBe("Adirondack 46ers");
  });

  it("has a plausible Adirondack point and a source for every peak", () => {
    for (const peak of ADK46_PEAKS) {
      expect(peak.lat).toBeGreaterThan(43.7);
      expect(peak.lat).toBeLessThan(44.7);
      expect(peak.lon).toBeGreaterThan(-74.6);
      expect(peak.lon).toBeLessThan(-73.5);
      expect(peak.sourceUrl).toContain("wikipedia.org");
    }
  });

  it("ranks Mount Marcy first and marks it as the state highpoint", () => {
    expect(ADK46_PEAKS[0].name).toBe("Mount Marcy");
    expect(ADK46_PEAKS[0].rank).toBe(1);
    expect(getAdk46("mount-marcy")?.isHighpoint).toBe(true);
    expect(ADK46_PEAKS[45].name).toBe("Couchsachraga Peak");
  });
});
