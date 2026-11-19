import { describe, expect, it } from "vitest";
import { kmBetween } from "./geo";

describe("kmBetween", () => {
  it("is zero for the same point", () => {
    expect(kmBetween(46.85, 8.03, 46.85, 8.03)).toBe(0);
  });

  it("is symmetric", () => {
    expect(kmBetween(46.85, 8.03, 45.98, 7.66)).toBeCloseTo(
      kmBetween(45.98, 7.66, 46.85, 8.03),
      9,
    );
  });

  it("matches the known Matterhorn–Jungfrau distance", () => {
    // Matterhorn 45.9763/7.6586, Jungfrau 46.5368/7.9625.
    expect(kmBetween(45.9763, 7.6586, 46.5368, 7.9625)).toBeGreaterThan(66);
    expect(kmBetween(45.9763, 7.6586, 46.5368, 7.9625)).toBeLessThan(70);
  });

  it("handles the antimeridian without wrapping the long way", () => {
    expect(kmBetween(0, 179.9, 0, -179.9)).toBeLessThan(25);
  });
});
