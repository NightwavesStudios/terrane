import { describe, expect, it } from "vitest";
import { MUNROS_LIST, MUNROS_PEAKS, getMunro } from "./munros";

describe("Munros seed", () => {
  it("has all 282 published Munros with unique slugs", () => {
    expect(MUNROS_PEAKS).toHaveLength(282);
    expect(new Set(MUNROS_PEAKS.map((peak) => peak.slug)).size).toBe(282);
    expect(MUNROS_LIST.publisher).toBe("Scottish Mountaineering Club");
    expect(MUNROS_LIST.rules).toContain("282");
  });

  it("keeps every peak at or above the 3,000-foot Munro threshold", () => {
    expect(MUNROS_PEAKS.every((peak) => peak.elevationM >= 914.4)).toBe(true);
    expect(MUNROS_PEAKS.every((peak) => peak.elevationFt === undefined || peak.elevationFt >= 3000)).toBe(true);
  });

  it("has a point and field source for every entry", () => {
    for (const peak of MUNROS_PEAKS) {
      expect(peak.lat).toBeGreaterThan(54);
      expect(peak.lat).toBeLessThan(61);
      expect(peak.lon).toBeGreaterThan(-8);
      expect(peak.lon).toBeLessThan(0);
      expect(peak.sourceUrl).toContain("hill-bagging.co.uk");
      expect(peak.elevationSourceUrl).toContain("dobih");
    }
  });

  it("ranks Ben Nevis first and Beinn Teallach last", () => {
    expect(MUNROS_PEAKS[0].name).toContain("Ben Nevis");
    expect(MUNROS_PEAKS[0].rank).toBe(1);
    expect(getMunro(MUNROS_PEAKS[0].slug)?.isHighpoint).toBe(true);
    expect(MUNROS_PEAKS[MUNROS_PEAKS.length - 1].name).toBe("Beinn Teallach");
    expect(MUNROS_PEAKS[MUNROS_PEAKS.length - 1].rank).toBe(282);
  });
});
