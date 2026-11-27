import { describe, expect, it } from "vitest";
import { CATSKILL3500_LIST, CATSKILL3500_PEAKS } from "./catskills";

describe("Catskill 3500 seed", () => {
  it("uses the current 33-peak list, not the old 35", () => {
    expect(CATSKILL3500_PEAKS).toHaveLength(33);
    expect(CATSKILL3500_LIST.edition).toContain("33");
    expect(CATSKILL3500_LIST.rules).toContain("Graham and Doubletop");
    expect(CATSKILL3500_PEAKS.some((peak) => peak.name === "Graham")).toBe(false);
    expect(CATSKILL3500_PEAKS.some((peak) => peak.name === "Doubletop")).toBe(false);
  });

  it("has Catskill coordinates and a field source for every entry", () => {
    for (const peak of CATSKILL3500_PEAKS) {
      expect(peak.lat).toBeGreaterThan(41.8);
      expect(peak.lat).toBeLessThan(42.5);
      expect(peak.lon).toBeGreaterThan(-74.8);
      expect(peak.lon).toBeLessThan(-73.9);
      expect(peak.sourceUrl).toContain("catskillhiker.net");
    }
  });

  it("starts at Slide and ranks all entries by current elevation", () => {
    expect(CATSKILL3500_PEAKS[0].name).toBe("Slide");
    expect(CATSKILL3500_PEAKS[0].rank).toBe(1);
    expect(CATSKILL3500_PEAKS[32].rank).toBe(33);
    const heights = CATSKILL3500_PEAKS.map((peak) => peak.elevationFt ?? 0);
    expect([...heights].sort((a, b) => b - a)).toEqual(heights);
  });
});
