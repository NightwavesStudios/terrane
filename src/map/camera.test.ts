import { describe, expect, it } from "vitest";
import {
  flyPadding,
  focusFor,
  focusZoomFor,
  pitchForZoom,
  radiusZoom,
  terrainExaggeration,
  worldZoom,
} from "./camera";

describe("worldZoom", () => {
  it("keeps the opening globe inside the card", () => {
    expect(worldZoom(1280, 800)).toBeGreaterThan(0.6);
    expect(worldZoom(1280, 800)).toBeLessThan(2.2);
  });

  it("fits a phone by width", () => {
    expect(worldZoom(390, 844)).toBeLessThan(worldZoom(1280, 800));
  });
});

describe("flyPadding", () => {
  it("reserves the card column on desktop", () => {
    expect(flyPadding(1281)).toEqual({ left: 440, bottom: 40 });
    expect(flyPadding(901)).toEqual({ left: 440, bottom: 40 });
  });

  it("reserves the bottom sheet band on phones, including the breakpoint", () => {
    expect(flyPadding(900)).toEqual({ left: 0, bottom: 300 });
    expect(flyPadding(603)).toEqual({ left: 0, bottom: 300 });
    expect(flyPadding(390)).toEqual({ left: 0, bottom: 300 });
  });
});

describe("focusZoomFor", () => {
  it("frames a category by what it is", () => {
    expect(focusZoomFor("park")).toBe(9.6);
    expect(focusZoomFor("peak")).toBe(13.4);
    expect(focusZoomFor("camp")).toBe(14.6);
    expect(focusZoomFor("something-new")).toBe(13.2);
  });

  it("stands back for a continental summit and not for a shoulder", () => {
    expect(focusZoomFor("peak", 900)).toBe(13.4);
    expect(focusZoomFor("peak", 1200)).toBe(13.4);
    expect(focusZoomFor("peak", 4200)).toBeCloseTo(12.2, 5);
    // Capped at 1.2 levels however high the summit.
    expect(focusZoomFor("peak", 9000)).toBeCloseTo(12.2, 5);
  });
});

describe("radiusZoom", () => {
  it("frames the radius instead of a continent", () => {
    const tight = radiusZoom(120, 37, 1280, 800);
    const wide = radiusZoom(400, 37, 1280, 800);
    expect(tight).toBeGreaterThan(wide);
    expect(tight).toBeGreaterThan(7);
    expect(tight).toBeLessThan(11);
  });

  it("stands further back on a small screen", () => {
    expect(radiusZoom(120, 37, 390, 844)).toBeLessThan(radiusZoom(120, 37, 1280, 800));
  });
});

describe("focusFor", () => {
  it("flies to the category frame from far away, even backwards", () => {
    expect(focusFor("park", null, 16, 120)).toBe(9.6);
    expect(focusFor("peak", 4200, 4, 2000)).toBeCloseTo(12.2, 5);
  });

  it("steps in when the place is already under the camera", () => {
    expect(focusFor("camp", null, 15.4, 0.4)).toBe(16);
    expect(focusFor("camp", null, 11, 0.4)).toBe(14.6);
    expect(focusFor("peak", null, 12, 1.2)).toBe(13.4);
  });

  it("never asks for a zoom the map cannot show", () => {
    expect(focusFor("camp", null, 3, 1)).toBeGreaterThanOrEqual(3);
    expect(focusFor("camp", null, 20, 0)).toBe(16);
  });
});

describe("pitchForZoom", () => {
  it("is level at planet scale", () => {
    expect(pitchForZoom(2.2)).toBe(0);
    expect(pitchForZoom(0.6)).toBe(0);
  });

  it("tilts early, then stops at 58 degrees", () => {
    expect(pitchForZoom(4)).toBeCloseTo(30, 5);
    expect(pitchForZoom(6)).toBeCloseTo(48, 5);
    expect(pitchForZoom(13)).toBe(58);
    expect(pitchForZoom(20)).toBe(58);
  });
});

describe("terrainExaggeration", () => {
  it("stands the mesh up at wide zooms and lets it settle close in", () => {
    expect(terrainExaggeration(0)).toBe(2.8);
    expect(terrainExaggeration(6)).toBeCloseTo(2.1, 5);
    expect(terrainExaggeration(9)).toBeCloseTo(1.6, 5);
    expect(terrainExaggeration(14)).toBeCloseTo(1.25, 5);
    expect(terrainExaggeration(18)).toBeCloseTo(1.25, 5);
  });
});
