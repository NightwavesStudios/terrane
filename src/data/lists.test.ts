import { describe, expect, it } from "vitest";
import { ADK46_LIST, ADK46_PEAKS } from "./adk46";
import { CATSKILL3500_LIST, CATSKILL3500_PEAKS } from "./catskills";
import { CO14ERS_LIST, CO14ERS_PEAKS } from "./co14ers";
import { LISTS, PEAKS, getList, getListForPeak, getPeak } from "./lists";
import { MUNROS_LIST, MUNROS_PEAKS } from "./munros";
import { NH48_LIST } from "./nh48";

describe("complete list registry", () => {
  it("has all five complete lists", () => {
    expect(LISTS.map((list) => list.id)).toEqual(["nh48", "co14ers", "munros", "adk46", "catskill3500"]);
    expect(NH48_LIST.peaks).toHaveLength(48);
    expect(CO14ERS_LIST.peaks).toHaveLength(58);
    expect(CO14ERS_PEAKS).toHaveLength(58);
    expect(MUNROS_LIST.peaks).toHaveLength(282);
    expect(MUNROS_PEAKS).toHaveLength(282);
    expect(ADK46_LIST.peaks).toHaveLength(46);
    expect(ADK46_PEAKS).toHaveLength(46);
    expect(CATSKILL3500_LIST.peaks).toHaveLength(33);
    expect(CATSKILL3500_PEAKS).toHaveLength(33);
    expect(PEAKS).toHaveLength(467);
  });

  it("keeps peak identity unique across all 467 entries", () => {
    expect(PEAKS).toHaveLength(467);
    expect(new Set(PEAKS.map((peak) => peak.slug)).size).toBe(467);
    expect(getPeak("mount-marcy")?.listIds).toEqual(["adk46"]);
    expect(getPeak("slide")?.listIds).toEqual(["catskill3500"]);
  });

  it("exposes list membership and exact elevations", () => {
    const elbert = getPeak("mount-elbert");
    const washington = getPeak("mount-washington");
    expect(elbert?.elevationFt).toBe(14437.6);
    expect(washington?.elevationFt).toBe(6288);
    expect(elbert && getListForPeak(elbert).map((list) => list.id)).toEqual(["co14ers"]);
    expect(washington && getListForPeak(washington).map((list) => list.id)).toEqual(["nh48"]);
    expect(getList("co14ers")?.title).toBe("Colorado 14ers");
    expect(getList("munros")?.title).toBe("Munros");
    expect(getList("adk46")?.title).toBe("Adirondack 46");
    expect(getList("catskills")?.title).toBe("Catskill 3500");
    expect(getList("missing")).toBeUndefined();
  });

  it("states the Colorado 58/53/54 rule rather than flattening it", () => {
    expect(CO14ERS_LIST.rules).toContain("58 named");
    expect(CO14ERS_LIST.rules).toContain("53");
    expect(CO14ERS_LIST.rules).toContain("54");
    expect(CO14ERS_LIST.publisher).toBe("14ers.com");
  });

  it("keeps the Munro membership complete and the data licence visible", () => {
    const munros = getList("munros");
    expect(munros?.publisher).toBe("Scottish Mountaineering Club");
    expect(munros?.license).toBe("DoBIH data CC BY 4.0");
    expect(MUNROS_PEAKS.every((peak) => peak.sourceUrl && peak.lat !== undefined && peak.lon !== undefined)).toBe(true);
  });
});
