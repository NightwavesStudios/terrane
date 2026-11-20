import { describe, expect, it } from "vitest";
import { shouldShowBootFailure } from "./bootGuard";

const failed = { booted: false, styleLoaded: false, loaded: false, hidden: false };

describe("shouldShowBootFailure", () => {
  it("reports a genuine visible boot failure", () => {
    expect(shouldShowBootFailure(failed)).toBe(true);
  });

  it("never accuses a hidden or suspended tab", () => {
    expect(shouldShowBootFailure({ ...failed, hidden: true })).toBe(false);
  });

  it("accepts a booted map, even if it is still fetching tiles", () => {
    expect(shouldShowBootFailure({ ...failed, booted: true })).toBe(false);
    expect(shouldShowBootFailure({ ...failed, loaded: true })).toBe(false);
  });

  it("accepts a style that has loaded but has not reported boot yet", () => {
    expect(shouldShowBootFailure({ ...failed, styleLoaded: true })).toBe(false);
  });
});
