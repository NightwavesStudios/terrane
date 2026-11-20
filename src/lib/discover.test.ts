import { describe, expect, it } from "vitest";
import { hiddenGems, nearby, notable, radiusForZoom, relatedPlaces, relatedRows } from "./discover";
import type { CatalogRow } from "./catalog";

function row(
  over: Partial<CatalogRow> & Pick<CatalogRow, "name" | "cat" | "lat" | "lon" | "tier">,
): CatalogRow {
  return {
    key: over.key ?? `${over.name}-${over.lat}-${over.lon}`,
    pick: {
      cat: over.cat,
      name: over.name,
      lat: over.lat,
      lon: over.lon,
      region: over.region,
      country: over.country,
      slug: over.pick?.slug,
      elev: over.pick?.elev,
    },
    name: over.name,
    norm: over.name.toLowerCase(),
    cat: over.cat,
    lat: over.lat,
    lon: over.lon,
    region: over.region,
    country: over.country,
    tier: over.tier,
    hasPage: over.hasPage ?? false,
    near: over.near,
    source: over.source ?? "reach",
  };
}

const CENTER = { lat: 46, lon: 8 };

/** Roughly `km` north of the centre. */
function north(km: number): number {
  return CENTER.lat + km / 111.32;
}

describe("radiusForZoom", () => {
  it("narrows as the camera closes in", () => {
    const zooms = [2, 4, 6, 7, 9, 10, 12];
    const radii = zooms.map(radiusForZoom);
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]).toBeLessThan(radii[i - 1]);
    }
  });
});

describe("nearby", () => {
  it("sorts by distance, keeps the radius, and caps each category", () => {
    const rows = [
      row({ name: "Camp A", cat: "camp", lat: north(1), lon: 8, tier: 4 }),
      row({ name: "Camp B", cat: "camp", lat: north(2), lon: 8, tier: 4 }),
      row({ name: "Camp C", cat: "camp", lat: north(3), lon: 8, tier: 4 }),
      row({ name: "Lake", cat: "lake", lat: north(4), lon: 8, tier: 3 }),
      row({ name: "Far", cat: "peak", lat: north(500), lon: 8, tier: 3 }),
    ];
    const result = nearby(rows, CENTER, 100, null, 4);
    expect(result.map((item) => item.row.name)).toEqual(["Camp A", "Camp B", "Lake"]);
    expect(result[0].km).toBeCloseTo(1, 0);
  });

  it("honours the category filter", () => {
    const rows = [
      row({ name: "Lake", cat: "lake", lat: north(1), lon: 8, tier: 3 }),
      row({ name: "Peak", cat: "peak", lat: north(2), lon: 8, tier: 3 }),
    ];
    expect(nearby(rows, CENTER, 50, new Set(["peak"])).map((item) => item.row.name)).toEqual([
      "Peak",
    ]);
  });
});

describe("notable", () => {
  it("prefers a famous row over a closer local one", () => {
    const rows = [
      row({ name: "Famous", cat: "peak", lat: north(20), lon: 8, tier: 0, hasPage: true }),
      row({ name: "Local", cat: "lake", lat: north(1), lon: 8, tier: 4 }),
    ];
    expect(notable(rows, CENTER, 100, null, 1)[0].row.name).toBe("Famous");
  });

  it("falls back to the world when the frame is empty", () => {
    const rows = [row({ name: "Alps", cat: "range", lat: 60, lon: 60, tier: 1 })];
    expect(notable(rows, CENTER, 1, null, 2)).toHaveLength(1);
  });

  it("leaves out rows another section already shows", () => {
    const rows = [
      row({ name: "Near", cat: "peak", lat: north(1), lon: 8, tier: 0 }),
      row({ name: "Detour", cat: "range", lat: north(20), lon: 8, tier: 1 }),
    ];
    const excluded = new Set([rows[0].key]);
    expect(notable(rows, CENTER, 100, null, 2, excluded).map((item) => item.row.name)).toEqual([
      "Detour",
    ]);
  });
});

describe("hiddenGems", () => {
  it("keeps only the lesser-known tiers", () => {
    const rows = [
      row({ name: "Famous", cat: "peak", lat: north(1), lon: 8, tier: 0, hasPage: true }),
      row({ name: "Regional", cat: "lake", lat: north(2), lon: 8, tier: 2 }),
      row({ name: "Local A", cat: "waterfall", lat: north(3), lon: 8, tier: 3 }),
      row({ name: "Local B", cat: "cave", lat: north(4), lon: 8, tier: 4 }),
    ];
    expect(hiddenGems(rows, CENTER, 100).map((item) => item.row.name)).toEqual([
      "Local A",
      "Local B",
    ]);
  });

  it("leaves out rows already listed elsewhere", () => {
    const rows = [
      row({ name: "A", cat: "waterfall", lat: north(1), lon: 8, tier: 3 }),
      row({ name: "B", cat: "cave", lat: north(2), lon: 8, tier: 3 }),
    ];
    expect(
      hiddenGems(rows, CENTER, 100, null, 4, new Set([rows[0].key])).map(
        (item) => item.row.name,
      ),
    ).toEqual(["B"]);
  });

  it("does not flood a list with one category", () => {
    const rows = [
      row({ name: "A", cat: "waterfall", lat: north(1), lon: 8, tier: 3 }),
      row({ name: "B", cat: "waterfall", lat: north(2), lon: 8, tier: 3 }),
      row({ name: "C", cat: "waterfall", lat: north(3), lon: 8, tier: 3 }),
      row({ name: "D", cat: "cave", lat: north(4), lon: 8, tier: 3 }),
    ];
    expect(hiddenGems(rows, CENTER, 100).map((item) => item.row.name)).toEqual([
      "A",
      "B",
      "D",
    ]);
  });
});

describe("relatedRows", () => {
  it("returns the same kind nearby, never the point itself", () => {
    const rows = [
      row({ name: "Me", cat: "peak", lat: 46, lon: 8, tier: 3 }),
      row({ name: "Neighbour", cat: "peak", lat: north(20), lon: 8, tier: 3 }),
      row({ name: "Too far", cat: "peak", lat: north(500), lon: 8, tier: 3 }),
      row({ name: "A lake", cat: "lake", lat: north(1), lon: 8, tier: 3 }),
    ];
    const result = relatedRows({ cat: "peak", lat: 46, lon: 8 }, rows, 3, 200);
    expect(result.map((item) => item.row.name)).toEqual(["Neighbour"]);
  });
});

describe("relatedPlaces", () => {
  function catalogRow(
    over: Partial<CatalogRow> & Pick<CatalogRow, "name" | "cat" | "lat" | "lon" | "tier">,
  ): CatalogRow {
    return row(over);
  }

  it("groups nearby, same kind and same region from catalog rows", () => {
    const base = catalogRow({
      name: "Here",
      cat: "peak",
      lat: 46,
      lon: 8,
      tier: 0,
      region: "Valais",
      country: "Switzerland",
    });
    const rows = [
      base,
      catalogRow({
        name: "Near Peak",
        cat: "peak",
        lat: north(10),
        lon: 8,
        tier: 1,
        region: "Valais",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Far Peak",
        cat: "peak",
        lat: north(500),
        lon: 8,
        tier: 1,
        region: "Bern",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Valley Lake",
        cat: "lake",
        lat: north(5),
        lon: 8,
        tier: 2,
        region: "Valais",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Local Falls",
        cat: "waterfall",
        lat: north(20),
        lon: 8,
        tier: 3,
        region: "Valais",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Hidden Cave",
        cat: "cave",
        lat: north(25),
        lon: 8,
        tier: 4,
        region: "Valais",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Far Lake",
        cat: "lake",
        lat: north(100),
        lon: 8,
        tier: 2,
        region: "Valais",
        country: "Switzerland",
      }),
    ];
    const result = relatedPlaces(base, rows, 1);
    expect(result.areaLabel).toBe("Valais");
    expect(result.nearby.map((item) => item.row.name)).toEqual(["Valley Lake"]);
    expect(result.sameKind.map((item) => item.row.name)).toEqual(["Near Peak"]);
    expect(result.lesser.map((item) => item.row.name)).toEqual([
      "Local Falls",
      "Hidden Cave",
    ]);
    expect(result.sameArea.map((item) => item.row.name)).toEqual(["Far Lake"]);
    expect(result.sameArea.map((item) => item.row.name)).not.toContain("Far Peak");
  });

  it("falls back to the country when no row shares the region", () => {
    const base = catalogRow({
      name: "Here",
      cat: "peak",
      lat: 46,
      lon: 8,
      tier: 0,
      region: "Valais",
      country: "Switzerland",
    });
    const rows = [
      base,
      catalogRow({
        name: "Other",
        cat: "peak",
        lat: north(10),
        lon: 8,
        tier: 1,
        region: "Bern",
        country: "Switzerland",
      }),
      catalogRow({
        name: "Second",
        cat: "lake",
        lat: north(30),
        lon: 8,
        tier: 2,
        region: "Bern",
        country: "Switzerland",
      }),
    ];
    const result = relatedPlaces(base, rows, 1);
    expect(result.areaLabel).toBe("Switzerland");
    expect(result.sameArea.map((item) => item.row.name)).toEqual(["Second"]);
  });
});
