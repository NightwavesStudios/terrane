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

  it("reads the lists routes and keeps the old summit links alive", () => {
    expect(parseRoute("/lists")).toEqual({ name: "lists" });
    expect(parseRoute("/lists/georgia-4000")).toEqual({
      name: "lists",
      list: "georgia-4000",
    });
    expect(parseRoute("/summits")).toEqual({ name: "lists" });
    expect(parseRoute("/summits/georgia-4000")).toEqual({
      name: "lists",
      list: "georgia-4000",
    });
    expect(parseRoute("/lists/nope/extra")).toEqual({ name: "home" });
  });

  it("reads the log and keeps the old saved link alive", () => {
    expect(parseRoute("/log")).toEqual({ name: "log" });
    expect(parseRoute("/log/")).toEqual({ name: "log" });
    expect(parseRoute("/saved")).toEqual({ name: "log" });
  });

  it("reads a curated experience detail", () => {
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
