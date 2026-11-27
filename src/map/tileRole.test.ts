import { describe, expect, it } from "vitest";
import { allowsCoarseStandIn, needsNativeSurface, tileRole } from "./tileRole";

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
