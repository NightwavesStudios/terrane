import { describe, expect, it } from "vitest";
import { flyPadding, focusZoomFor, pickZoom, pitchForZoom, radiusZoom, worldZoom } from "./camera";

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
    expect(flyPadding(861)).toEqual({ left: 440, bottom: 40 });
  });

  it("reserves the bottom sheet band on phones, including the breakpoint", () => {
    expect(flyPadding(860)).toEqual({ left: 0, bottom: 300 });
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

describe("pickZoom", () => {
  it("flies to the category frame, not to the reader's zoom", () => {
    expect(pickZoom("park", null, 16, 120)).toBe(9.6);
    expect(pickZoom("peak", 4200, 4, 2000)).toBeCloseTo(12.2, 5);
  });

  it("keeps the zoom of a reader already on the place", () => {
    expect(pickZoom("camp", null, 15.4, 0.4)).toBe(15.4);
  });

  it("still zooms in when the reader is further out than the frame", () => {
    expect(pickZoom("camp", null, 11, 0.4)).toBe(14.6);
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
