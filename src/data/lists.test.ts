import { describe, expect, it } from "vitest";
import { CO14ERS_LIST, CO14ERS_PEAKS } from "./co14ers";
import { LISTS, PEAKS, getList, getListForPeak, getPeak } from "./lists";
import { NH48_LIST } from "./nh48";

describe("complete list registry", () => {
  it("has the NH 48 and 58 named Colorado 14ers", () => {
    expect(LISTS.map((list) => list.id)).toEqual(["nh48", "co14ers"]);
    expect(NH48_LIST.peaks).toHaveLength(48);
    expect(CO14ERS_LIST.peaks).toHaveLength(58);
    expect(CO14ERS_PEAKS).toHaveLength(58);
    expect(PEAKS).toHaveLength(106);
  });

  it("keeps peak identity unique across lists", () => {
    expect(new Set(PEAKS.map((peak) => peak.slug)).size).toBe(PEAKS.length);
  });

  it("exposes list membership and exact elevations", () => {
    const elbert = getPeak("mount-elbert");
    const washington = getPeak("mount-washington");
    expect(elbert?.elevationFt).toBe(14437.6);
    expect(washington?.elevationFt).toBe(6288);
    expect(elbert && getListForPeak(elbert).map((list) => list.id)).toEqual(["co14ers"]);
    expect(washington && getListForPeak(washington).map((list) => list.id)).toEqual(["nh48"]);
    expect(getList("co14ers")?.title).toBe("Colorado 14ers");
    expect(getList("missing")).toBeUndefined();
  });

  it("states the Colorado 58/53/54 rule rather than flattening it", () => {
    expect(CO14ERS_LIST.rules).toContain("58 named");
    expect(CO14ERS_LIST.rules).toContain("53");
    expect(CO14ERS_LIST.rules).toContain("54");
    expect(CO14ERS_LIST.publisher).toBe("14ers.com");
  });
});
