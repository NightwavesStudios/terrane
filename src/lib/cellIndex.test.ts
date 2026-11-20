import { describe, expect, it } from "vitest";
import { cellPresence } from "./cellIndex";

/* A slice of the store's upload manifest: the cells it lists are the cells it has. */
const index = new Set([
  "trails/7/70/48.json",
  "trails/7/70/50.json",
  "poi/6/33/22.json",
  "poi/6/33/23.json",
  "manifest.json",
]);

describe("cellPresence", () => {
  it("confirms a cell the store lists", () => {
    expect(cellPresence(index, "trails/7/70/48.json")).toBe(true);
    expect(cellPresence(index, "poi/6/33/22.json")).toBe(true);
  });

  it("reports an absent cell in a tracked family as absent, never as an error", () => {
    expect(cellPresence(index, "trails/7/70/49.json")).toBe(false);
    expect(cellPresence(index, "poi/6/33/24.json")).toBe(false);
  });

  it("has no opinion about families the manifest does not track", () => {
    /* Parking cells are published outside the manifest: they must still be fetched. */
    expect(cellPresence(index, "poi/6/33/22.parking.json")).toBe(null);
    /* A zoom the uploader never wrote is unknown, not empty. */
    expect(cellPresence(index, "trails/6/35/24.json")).toBe(null);
  });

  it("has no opinion without an index, so nothing is hidden", () => {
    expect(cellPresence(null, "trails/7/70/49.json")).toBe(null);
    expect(cellPresence(new Set(), "trails/7/70/49.json")).toBe(null);
  });
});
