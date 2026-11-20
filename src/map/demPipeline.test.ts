import { describe, expect, it } from "vitest";
import {
  isPlaceholder,
  LOWLAND_M,
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
