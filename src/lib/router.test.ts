import { describe, expect, it } from "vitest";
import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("is home at the root", () => {
    expect(parseRoute("/")).toEqual({ name: "home" });
  });

  it("ignores a trailing slash", () => {
    expect(parseRoute("/coverage/")).toEqual({ name: "coverage" });
    expect(parseRoute("/place/denali/")).toEqual({ name: "place", slug: "denali" });
  });

  it("reads a place slug", () => {
    expect(parseRoute("/place/mount-rainier")).toEqual({
      name: "place",
      slug: "mount-rainier",
    });
  });

  it("reads the experience routes", () => {
    expect(parseRoute("/experiences")).toEqual({ name: "experiences" });
    expect(parseRoute("/experiences/")).toEqual({ name: "experiences" });
    expect(parseRoute("/experiences/peaks-of-the-alps")).toEqual({
      name: "experience",
      slug: "peaks-of-the-alps",
    });
  });

  it("falls back to home for anything else", () => {
    expect(parseRoute("/nope")).toEqual({ name: "home" });
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("/place/")).toEqual({ name: "home" });
    expect(parseRoute("/place/Mount_Rainier")).toEqual({ name: "home" });
    expect(parseRoute("/place/a/b")).toEqual({ name: "home" });
    expect(parseRoute("/experiences/a/b")).toEqual({ name: "home" });
    expect(parseRoute("/experiences/Peaks_Of_The_Alps")).toEqual({ name: "home" });
  });
});
