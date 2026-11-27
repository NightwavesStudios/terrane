import { describe, expect, it } from "vitest";
import { NH48_LIST, NH48_PEAKS, getNh48Peak } from "./nh48";

describe("NH 48 seed", () => {
  it("has exactly 48 unique peaks in the published list", () => {
    expect(NH48_LIST.peaks).toHaveLength(48);
    expect(NH48_PEAKS).toHaveLength(48);
    expect(new Set(NH48_PEAKS.map((peak) => peak.slug)).size).toBe(48);
  });

  it("is sorted by elevation and ranked without gaps", () => {
    NH48_PEAKS.forEach((peak, index) => {
      expect(peak.rank).toBe(index + 1);
      if (index > 0) expect(peak.elevationM).toBeLessThanOrEqual(NH48_PEAKS[index - 1].elevationM);
    });
  });

  it("has provenance for every peak", () => {
    for (const peak of NH48_PEAKS) {
      expect(peak.sourceUrl).toContain("nh48.info");
      expect(peak.osmUrl).toContain("openstreetmap.org");
      expect(peak.lat).toBeTypeOf("number");
      expect(peak.lon).toBeTypeOf("number");
      expect(peak.listIds).toContain(NH48_LIST.id);
    }
  });

  it("finds Mount Washington and rejects an unknown slug", () => {
    expect(getNh48Peak("mount-washington")?.name).toBe("Mount Washington");
    expect(getNh48Peak("mount-washington")?.elevationM).toBe(1917);
    expect(getNh48Peak("not-a-peak")).toBeUndefined();
  });
});
