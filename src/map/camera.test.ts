import { describe, expect, it } from "vitest";
import { pitchForZoom, worldZoom } from "./camera";

describe("worldZoom", () => {
  it("keeps the opening globe inside the card", () => {
    expect(worldZoom(1280, 800)).toBeGreaterThan(0.6);
    expect(worldZoom(1280, 800)).toBeLessThan(2.2);
  });

  it("fits a phone by width", () => {
    expect(worldZoom(390, 844)).toBeLessThan(worldZoom(1280, 800));
  });
});

describe("pitchForZoom", () => {
  it("is level at planet scale", () => {
    expect(pitchForZoom(1.9)).toBe(0);
    expect(pitchForZoom(0.6)).toBe(0);
  });

  it("tilts with zoom and stops at 55 degrees", () => {
    expect(pitchForZoom(5)).toBeGreaterThan(0);
    expect(pitchForZoom(14)).toBe(55);
    expect(pitchForZoom(20)).toBe(55);
  });
});
