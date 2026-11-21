import { describe, expect, it } from "vitest";
import { cellPresence } from "./cellIndex";

/* A slice of the store's upload manifest. It is the uploader's incremental state,
   so it lists some cells and knows nothing about the rest. */
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

  it("never declares an unlisted cell absent", () => {
    /* Regression: the manifest listed 98 `poi/6/…` cells while the store served
       `poi/6/33/22.json` and most others — an unlisted cell is unknown, not empty,
       and inferring absence from the tracked family hid nearly every real pin. */
    expect(cellPresence(index, "poi/6/31/21.json")).toBe(null);
    expect(cellPresence(index, "trails/7/70/49.json")).toBe(null);
    /* A cell whose directory has no sibling at all is still only unknown. */
    expect(cellPresence(index, "poi/6/25/43.json")).toBe(null);
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
