import { describe, expect, it } from "vitest";
import { LINVILLE_CAMERA_ZOOM, LINVILLE_LEDGER } from "./__fixtures__/ledgerLinville";
import { allowsCoarseStandIn, needsNativeSurface, seamCandidates, tileRole } from "./tileRole";

describe("tileRole", () => {
  it("names the camera's own level, its refinement, and the parents behind it", () => {
    expect(tileRole(12, 12.49, false)).toBe("camera");
    expect(tileRole(13, 12.49, false)).toBe("child");
    expect(tileRole(11, 12.49, false)).toBe("under");
    expect(tileRole(9, 12.49, false)).toBe("under");
    expect(tileRole(14, 12.49, false)).toBe("over");
  });

  it("rounds the camera zoom to the level MapLibre asks at", () => {
    expect(tileRole(11, 11.4, false)).toBe("camera");
    expect(tileRole(12, 11.4, false)).toBe("child");
    expect(tileRole(10, 11.4, false)).toBe("under");
  });

  it("has no role mid-gesture or before the camera reports a zoom", () => {
    expect(tileRole(12, 12.49, true)).toBe("unknown");
    expect(tileRole(12, -1, false)).toBe("unknown");
  });
});

describe("allowsCoarseStandIn", () => {
  it("never lets a coarse surface stand in for an on-screen tile", () => {
    expect(allowsCoarseStandIn("camera", false)).toBe(false);
    expect(allowsCoarseStandIn("child", false)).toBe(false);
    expect(needsNativeSurface("camera")).toBe(true);
    expect(needsNativeSurface("child")).toBe(true);
  });

  it("still answers the levels behind the camera from an ancestor", () => {
    expect(allowsCoarseStandIn("under", false)).toBe(true);
    expect(allowsCoarseStandIn("over", false)).toBe(true);
    expect(needsNativeSurface("under")).toBe(false);
    expect(needsNativeSurface("over")).toBe(false);
  });

  it("keeps the old behaviour while the camera is moving", () => {
    expect(allowsCoarseStandIn("camera", true)).toBe(true);
    expect(allowsCoarseStandIn("child", true)).toBe(true);
    expect(allowsCoarseStandIn("unknown", false)).toBe(false);
  });
});

/* The fixture is the ledger of one settled deep frame at the view the fins were
   reported on: 44 requests, source loaded, nothing queued. It is the evidence
   that the rule above is needed, not a hypothetical. */
describe("the real Linville ledger", () => {
  it("records the three z13 tiles that were replaced by a z12 ancestor crop", () => {
    const offenders = seamCandidates(LINVILLE_LEDGER, LINVILLE_CAMERA_ZOOM);
    expect(offenders.map((line) => `${line.z}/${line.x}/${line.y}:${line.state}`)).toEqual([
      "13/2234/3214:ancestor:from12",
      "13/2235/3214:ancestor:from12",
      "13/2236/3214:ancestor:from12",
    ]);
  });

  it("never puts a camera-level tile on a coarse stand-in", () => {
    const cameraLevel = seamCandidates(LINVILLE_LEDGER, LINVILLE_CAMERA_ZOOM).filter(
      (line) => line.z === 12,
    );
    expect(cameraLevel).toEqual([]);
  });

  it("passes once the on-screen levels are answered natively", () => {
    /* What the pipeline does now: the same requests, every z13 tile answered by
       its own native fetch instead of the parent crop. */
    const after = LINVILLE_LEDGER.map((line) =>
      line.z === 13 && line.state.startsWith("ancestor:")
        ? { ...line, state: "done:native" }
        : line,
    );
    expect(seamCandidates(after, LINVILLE_CAMERA_ZOOM)).toEqual([]);
  });

  it("still allows the coarser parents behind the camera surface", () => {
    /* z5–z7 are drawn behind the camera level and are allowed to be resampled
       or ancestor-answered; the rule must not starve them. */
    const behind = LINVILLE_LEDGER.filter((line) => line.z < 12);
    expect(behind.some((line) => line.state.startsWith("ancestor:"))).toBe(true);
    expect(seamCandidates(behind, LINVILLE_CAMERA_ZOOM)).toEqual([]);
  });
});
