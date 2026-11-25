import { describe, expect, it } from "vitest";
import {
  SUMMIT_LISTS,
  SUMMIT_PEAK_COUNT,
  feetToMetres,
  peakId,
  summitList,
} from "./summits";

describe("summit lists", () => {
  it("keeps the four committed lists complete", () => {
    expect(SUMMIT_LISTS.map((list) => [list.id, list.peaks.length])).toEqual([
      ["georgia-4000", 32],
      ["new-hampshire-48", 48],
      ["adirondack-46", 46],
      ["colorado-14ers", 58],
    ]);
    expect(SUMMIT_PEAK_COUNT).toBe(184);
  });

  it("has one 4000er, one AMC 48, one 46er and one Colorado fourteener naming", () => {
    expect(summitList("georgia-4000")?.peaks[0]).toMatchObject({
      name: "Brasstown Bald",
      ft: 4784,
    });
    expect(summitList("new-hampshire-48")?.peaks[0].name).toBe("Mount Washington");
    expect(summitList("adirondack-46")?.peaks.at(-1)?.name).toBe(
      "Couchsachraga Peak",
    );
    expect(summitList("colorado-14ers")?.peaks.at(-1)?.name).toBe("Sunshine Peak");
    expect(summitList("nope")).toBeUndefined();
  });

  it("gives every peak a unique stable id", () => {
    const ids = SUMMIT_LISTS.flatMap((list) =>
      list.peaks.map((peak) => peakId(list.id, peak.name)),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(peakId("georgia-4000", "Brasstown Bald")).toBe(
      "georgia-4000/brasstown-bald",
    );
    expect(peakId("new-hampshire-48", "Wildcat Mountain (A Peak)")).toBe(
      "new-hampshire-48/wildcat-mountain-a-peak",
    );
  });

  it("keeps names unique inside a list and elevations plausible", () => {
    for (const list of SUMMIT_LISTS) {
      const names = new Set(list.peaks.map((peak) => peak.name));
      expect(names.size).toBe(list.peaks.length);
      for (const peak of list.peaks) {
        expect(peak.ft).toBeGreaterThan(0);
        expect(peak.name.trim()).toBe(peak.name);
      }
    }
  });

  it("lists the Colorado fourteeners in descending height", () => {
    const list = summitList("colorado-14ers");
    expect(list).toBeDefined();
    for (let index = 1; index < (list?.peaks.length ?? 0); index += 1) {
      expect(list!.peaks[index - 1].ft).toBeGreaterThanOrEqual(list!.peaks[index].ft);
    }
    expect(list!.peaks.every((peak) => peak.ft >= 14000)).toBe(true);
  });

  it("converts published feet to whole metres", () => {
    expect(feetToMetres(4784)).toBe(1458);
    expect(feetToMetres(4000)).toBe(1219);
  });
});
