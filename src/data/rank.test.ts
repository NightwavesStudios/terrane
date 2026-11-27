import { describe, expect, it } from "vitest";
import { BANDS, gridOf, importance, rankPlaces } from "./rank";
import type { Place } from "./places";

function place(over: Partial<Place> & Pick<Place, "slug" | "lat" | "lon">): Place {
  return {
    name: over.slug,
    type: "peak",
    country: "XX",
    hue: 0,
    ...over,
  };
}

/** Ten summits stacked on one point, so the grid quota is the only thing that
    decides where they land. */
function cluster(n: number): Place[] {
  return Array.from({ length: n }, (_, i) =>
    place({ slug: `p${String(i).padStart(2, "0")}`, lat: 46.85, lon: 8.03 }),
  );
}

describe("gridOf", () => {
  it("puts the equator and the prime meridian in the middle of a z4 world", () => {
    expect(gridOf(0, 0, 4)).toBe("8/8");
  });

  it("clamps latitude to the Web Mercator limit", () => {
    expect(gridOf(89, 10, 4)).toBe(gridOf(85, 10, 4));
    expect(gridOf(-89, 10, 4)).toBe(gridOf(-85, 10, 4));
  });

  it("moves east and north as longitude and latitude grow", () => {
    const [west, westY] = gridOf(0, -170, 4).split("/").map(Number);
    const [east, eastY] = gridOf(0, 170, 4).split("/").map(Number);
    expect(east).toBeGreaterThan(west);
    expect(eastY).toBe(westY);
    expect(gridOf(60, 0, 4)).not.toBe(gridOf(0, 0, 4));
  });
});

describe("importance", () => {
  it("keeps every peak above a park and adds height and prominence", () => {
    expect(importance(place({ slug: "a", lat: 0, lon: 0, elevation: 2500 }))).toBeCloseTo(
      0.7,
      10,
    );
    expect(importance(place({ slug: "b", lat: 0, lon: 0, elevation: 9000 }))).toBeCloseTo(
      0.85,
      10,
    );
    expect(importance(place({ slug: "c", lat: 0, lon: 0 }))).toBe(0.55);
    expect(
      importance(place({ slug: "d", lat: 0, lon: 0, elevation: 2500, prominence: 1500 })),
    ).toBeCloseTo(0.85, 10);
  });

  it("puts a low peak above a park and a landmark", () => {
    const low = importance(place({ slug: "p", lat: 0, lon: 0, elevation: 300 }));
    expect(low).toBeGreaterThan(importance(place({ slug: "park", lat: 0, lon: 0, type: "park" })));
    expect(low).toBeGreaterThan(
      importance(place({ slug: "landmark", lat: 0, lon: 0, type: "landmark" })),
    );
  });

  it("gives a park and a landmark a fixed share", () => {
    expect(importance(place({ slug: "p", lat: 0, lon: 0, type: "park" }))).toBe(0.5);
    expect(importance(place({ slug: "l", lat: 0, lon: 0, type: "landmark" }))).toBe(0.45);
  });
});

describe("rankPlaces", () => {
  it("gives the same bands for the same input", () => {
    const places = cluster(10);
    expect(rankPlaces(places).map((p) => p.band)).toEqual(
      rankPlaces(places).map((p) => p.band),
    );
  });

  it("caps a crowded grid at one band-0 row, two band-1 and six band-2", () => {
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
