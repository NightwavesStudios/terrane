import { describe, expect, it } from "vitest";
import {
  coverageVerdict,
  demCell,
  FALLBACK,
  isPlaceholder,
  LOWLAND_M,
  needsProbe,
  PRIMARY,
  lowlandWeight,
  OUT_SIZE,
  SEA_FLAT_M,
  SEA_RAMP_M,
  settleSea,
  SHARPEN_AMOUNT,
  sharpenAmountFor,
  touchesLowland,
} from "./demPipeline";

/* The surface conditioning is the part of the DEM pipeline that can be tested
   without a canvas: it is pure arithmetic on decoded elevations. */

describe("settleSea", () => {
  it("reads water as exactly zero, including the negative terrarium values", () => {
    expect(settleSea(0)).toBe(0);
    expect(settleSea(SEA_FLAT_M)).toBe(0);
    expect(settleSea(-12.5)).toBe(0);
    expect(settleSea(-0.01)).toBe(0);
  });

  it("keeps land above the ramp untouched", () => {
    expect(settleSea(SEA_RAMP_M)).toBe(SEA_RAMP_M);
    expect(settleSea(8)).toBe(8);
    expect(settleSea(482)).toBe(482);
  });

  it("ramps instead of stepping, so the coast keeps a slope", () => {
    const near = settleSea(SEA_RAMP_M - 0.01);
    expect(near).toBeGreaterThan(SEA_RAMP_M - 0.05);
    expect(near).toBeLessThan(SEA_RAMP_M);
    /* Just above the flat band the ramp starts at zero slope: no shelf edge. */
    expect(settleSea(SEA_FLAT_M + 0.01)).toBeLessThan(0.05);
    /* Just above the flat band there is no discontinuity either. */
    expect(settleSea(SEA_FLAT_M + 0.001)).toBeLessThan(1e-6);
  });

  it("never goes backwards as the ground rises", () => {
    let last = -1;
    for (let v = -5; v <= 12; v += 0.05) {
      const out = settleSea(v);
      expect(out).toBeGreaterThanOrEqual(last - 1e-6);
      last = out;
    }
  });
});

describe("lowlandWeight", () => {
  it("is full strength at the shore and gone above the lowland band", () => {
    expect(lowlandWeight(0)).toBe(1);
    expect(lowlandWeight(5)).toBe(1);
    expect(lowlandWeight(LOWLAND_M)).toBe(0);
    expect(lowlandWeight(LOWLAND_M + 200)).toBe(0);
  });

  it("fades smoothly in between", () => {
    const mid = lowlandWeight((5 + LOWLAND_M) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(lowlandWeight(10)).toBeGreaterThan(lowlandWeight(30));
  });
});

describe("sharpenAmountFor", () => {
  it("sharpens a full grid and leaves the regional grid alone", () => {
    expect(sharpenAmountFor(OUT_SIZE)).toBe(SHARPEN_AMOUNT);
    expect(sharpenAmountFor(OUT_SIZE / 2)).toBe(0);
  });

  it("cannot amplify facets where there is no detail", () => {
    expect(sharpenAmountFor(OUT_SIZE / 2)).toBe(0);
    expect(sharpenAmountFor(128)).toBe(0);
  });
});

/* The coverage cache is the part of the pipeline that decides *which level* a
   tile comes from. A wrong key is not a slow tile, it is a wrong surface for the
   rest of the session, so the cell maths is pinned here. */
describe("demCell", () => {
  it("keeps a level at or below the global max on its own tile", () => {
    expect(demCell(PRIMARY, 2, 1, 1)).toBe("mapterhorn:2/1/1");
    expect(demCell(PRIMARY, 11, 1024, 700)).toBe("mapterhorn:11/1024/700");
    expect(demCell(PRIMARY, 12, 1024, 700)).toBe("mapterhorn:12/1024/700");
    expect(demCell(FALLBACK, 11, 1024, 700)).toBe("aws:11/1024/700");
  });

  it("groups the deep levels by the global-max cell", () => {
    expect(demCell(PRIMARY, 13, 2048, 1400)).toBe("mapterhorn:12/1024/700");
    expect(demCell(PRIMARY, 14, 4096, 2800)).toBe("mapterhorn:12/1024/700");
    expect(demCell(FALLBACK, 13, 4096, 0)).toBe("aws:11/1024/0");
  });

  it("probes only where a mask can exist", () => {
    /* Nothing to learn below the global level, for either provider. */
    expect(needsProbe(PRIMARY, 2)).toBe(false);
    expect(needsProbe(PRIMARY, 11)).toBe(false);
    expect(needsProbe(FALLBACK, 11)).toBe(false);
    /* Mapterhorn keeps going above z12 on national data, so its global level
       can be a blank plate and must still be checked. AWS stops at z11, so its
       z11 cannot be one. */
    expect(needsProbe(PRIMARY, 12)).toBe(true);
    expect(needsProbe(PRIMARY, 13)).toBe(true);
    expect(needsProbe(FALLBACK, 12)).toBe(true);
  });

  it("learns nothing from a walk whose probes all failed", () => {
    /* The regression: a probe that never answered left `best` at 0, that was
       cached as the cell's coverage, and every later tile in the cell was
       resampled from a z0 planet-scale grid — a spike that outlived the tile. */
    expect(coverageVerdict([])).toEqual({ level: 0, blank: false, learned: false });
  });

  it("takes the deepest level that answered with data", () => {
    expect(coverageVerdict([{ level: 13, bytes: 150_000 }])).toEqual({
      level: 13,
      blank: false,
      learned: true,
    });
    expect(
      coverageVerdict([
        { level: 13, bytes: 90 },
        { level: 12, bytes: 140_000 },
      ]),
    ).toEqual({ level: 12, blank: false, learned: true });
  });

  it("calls a cell blank only when every answering level was blank", () => {
    expect(
      coverageVerdict([
        { level: 13, bytes: 90 },
        { level: 12, bytes: 110 },
      ]),
    ).toEqual({ level: 12, blank: true, learned: true });
  });

  it("never collapses different levels onto one cell", () => {
    /* The regression: a negative shift wrapped modulo 32, so every level from
       z1 to z11 hashed to mapterhorn:12/0/0 and one globe tile capped the
       whole session at z1. */
    const keys = new Set([2, 4, 8, 11, 12].map((z) => demCell(PRIMARY, z, 3, 5)));
    expect(keys.size).toBe(5);
  });
});

describe("touchesLowland", () => {
  it("is true for shore and plain, false for a ridge that never drops", () => {
    expect(touchesLowland(new Float32Array([812, 640, 1]))).toBe(true);
    expect(touchesLowland(new Float32Array([812, 640, LOWLAND_M + 5]))).toBe(false);
  });
});

describe("isPlaceholder", () => {
  it("recognises the provider's blank plate", () => {
    expect(isPlaceholder(new Float32Array(512 * 512))).toBe(true);
  });

  it("does not mistake a real surface for a blank one", () => {
    const sea = new Float32Array(64);
    sea[10] = 1432;
    expect(isPlaceholder(sea)).toBe(false);
    const trench = new Float32Array(64);
    trench[3] = -9.5;
    expect(trench.some((v) => v !== 0)).toBe(true);
    expect(isPlaceholder(trench)).toBe(false);
  });
});
