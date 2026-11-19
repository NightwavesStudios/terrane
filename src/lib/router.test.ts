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

  it("falls back to home for anything else", () => {
    expect(parseRoute("/nope")).toEqual({ name: "home" });
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("/place/")).toEqual({ name: "home" });
    expect(parseRoute("/place/Mount_Rainier")).toEqual({ name: "home" });
    expect(parseRoute("/place/a/b")).toEqual({ name: "home" });
  });
});
