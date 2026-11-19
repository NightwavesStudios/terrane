import { describe, expect, it } from "vitest";
import { BANDS, cellOf, importance, rankPlaces } from "./rank";
import type { Place } from "./places";

function place(over: Partial<Place> & Pick<Place, "slug" | "lat" | "lon">): Place {
  return {
    name: over.slug,
    type: "peak",
    country: "XX",
    tagline: "",
    hue: 0,
    ...over,
  };
}

/** Ten summits stacked on one point, so the cell quota is the only thing that
    decides where they land. */
function cluster(n: number): Place[] {
  return Array.from({ length: n }, (_, i) =>
    place({ slug: `p${String(i).padStart(2, "0")}`, lat: 46.85, lon: 8.03 }),
  );
}

describe("cellOf", () => {
  it("puts the equator and the prime meridian in the middle of a z4 world", () => {
    expect(cellOf(0, 0, 4)).toBe("8/8");
  });

  it("clamps latitude to the Web Mercator limit", () => {
    expect(cellOf(89, 10, 4)).toBe(cellOf(85, 10, 4));
    expect(cellOf(-89, 10, 4)).toBe(cellOf(-85, 10, 4));
  });

  it("moves east and north as longitude and latitude grow", () => {
    const [west, westY] = cellOf(0, -170, 4).split("/").map(Number);
    const [east, eastY] = cellOf(0, 170, 4).split("/").map(Number);
    expect(east).toBeGreaterThan(west);
    expect(eastY).toBe(westY);
    expect(cellOf(60, 0, 4)).not.toBe(cellOf(0, 0, 4));
  });
});

describe("importance", () => {
  it("is height for a peak, capped at 5,000 m", () => {
    expect(importance(place({ slug: "a", lat: 0, lon: 0, elevation: 2500 }))).toBe(0.5);
    expect(importance(place({ slug: "b", lat: 0, lon: 0, elevation: 9000 }))).toBe(1);
    expect(importance(place({ slug: "c", lat: 0, lon: 0 }))).toBe(0);
  });

  it("gives a park and a landmark a fixed share", () => {
    expect(importance(place({ slug: "p", lat: 0, lon: 0, type: "park" }))).toBe(0.62);
    expect(importance(place({ slug: "l", lat: 0, lon: 0, type: "landmark" }))).toBe(0.55);
    expect(importance(place({ slug: "g", lat: 0, lon: 0, type: "gem" }))).toBe(0.4);
  });

  it("does not reward provenance or a hand-written entry", () => {
    const curated = place({ slug: "x", lat: 0, lon: 0, elevation: 1200, curated: true, editorial: true });
    const atlas = place({ slug: "y", lat: 0, lon: 0, elevation: 1200 });
    expect(importance(curated)).toBe(importance(atlas));
  });
});

describe("rankPlaces", () => {
  it("gives the same bands for the same input", () => {
    const places = cluster(10);
    expect(rankPlaces(places).map((p) => p.band)).toEqual(
      rankPlaces(places).map((p) => p.band),
    );
  });

  it("caps a crowded cell at one band-0 row, two band-1 and six band-2", () => {
    const counts = BANDS.map(() => 0);
    for (const p of rankPlaces(cluster(10))) counts[p.band ?? 3] += 1;
    expect(counts[0]).toBe(1);
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(6);
    expect(counts[3]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("keeps every place in its original order and never mutates the input", () => {
    const places = cluster(10);
    const ranked = rankPlaces(places);
    expect(ranked.map((p) => p.slug)).toEqual(places.map((p) => p.slug));
    expect(places.every((p) => p.band === undefined)).toBe(true);
  });

  it("only assigns bands that exist in band.json", () => {
    const known = new Set(BANDS.map((b) => b.band));
    for (const p of rankPlaces(cluster(30))) {
      expect(known.has(p.band ?? -1)).toBe(true);
    }
  });
});
