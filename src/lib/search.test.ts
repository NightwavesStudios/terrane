import { describe, expect, it } from "vitest";
import { search } from "./search";
import { normalize } from "./text";
import type { AreaRow, CatalogRow } from "./catalog";

function row(
  over: Partial<CatalogRow> & Pick<CatalogRow, "name" | "cat" | "lat" | "lon">,
): CatalogRow {
  const pick = {
    cat: over.cat,
    name: over.name,
    lat: over.lat,
    lon: over.lon,
    region: over.region,
    country: over.country,
    elev: over.pick?.elev,
  };
  return {
    key: over.key ?? `${over.name}-${over.lat}-${over.lon}`,
    pick,
    name: over.name,
    norm: normalize(over.name),
    cat: over.cat,
    lat: over.lat,
    lon: over.lon,
    region: over.region,
    country: over.country,
    tier: over.tier ?? 3,
    hasPage: over.hasPage ?? false,
    near: over.near,
    source: over.source ?? "reach",
  };
}

function area(
  name: string,
  country: string,
  count: number,
  lat = 65,
  lon = -18,
  kind: "country" | "region" = "country",
): AreaRow {
  return {
    kind,
    name,
    label: country,
    norm: normalize(country),
    count,
    lat,
    lon,
    zoom: 4,
  };
}

function run(query: string, rows: CatalogRow[], extra: Partial<Parameters<typeof search>[0]> = {}) {
  return search({ rows, areas: [], query, ...extra });
}

describe("normalize", () => {
  it("folds accents, punctuation and case", () => {
    expect(normalize("Zürich’s Peak")).toBe("zurichs peak");
  });
});

describe("search", () => {
  it("does nothing for a single character", () => {
    const result = run("m", [row({ name: "Matterhorn", cat: "peak", lat: 0, lon: 0 })]);
    expect(result.active).toBe(false);
    expect(result.hits).toEqual([]);
  });

  it("finds an accented name typed without accents", () => {
    const result = run("zurich", [
      row({ name: "Zürich Viewpoint", cat: "view", lat: 47.37, lon: 8.54 }),
    ]);
    expect(result.hits).toHaveLength(1);
  });

  it("treats a category synonym as that category", () => {
    const result = run("falls", [
      row({ name: "Gullfoss", cat: "waterfall", lat: 64.3, lon: -20.1 }),
      row({ name: "Some Peak", cat: "peak", lat: 0, lon: 0 }),
    ]);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].kind).toBe("place");
  });

  it("requires every word to match, including a country", () => {
    const result = run("waterfalls iceland", [
      row({
        name: "Gullfoss",
        cat: "waterfall",
        lat: 64.3,
        lon: -20.1,
        country: "Iceland",
        region: "Suðurland",
      }),
      row({
        name: "Cascade de Gavarnie",
        cat: "waterfall",
        lat: 42.7,
        lon: -0.01,
        country: "France",
      }),
    ]);
    expect(result.hits.map((hit) => (hit.kind === "place" ? hit.row.name : ""))).toEqual([
      "Gullfoss",
    ]);
  });

  it("ranks an exact name over a longer name", () => {
    const result = run("matterhorn", [
      row({ name: "Matterhorn Glacier", cat: "glacier", lat: 45.98, lon: 7.66 }),
      row({ name: "Matterhorn", cat: "peak", lat: 45.976, lon: 7.658 }),
    ]);
    expect(result.hits[0].kind).toBe("place");
    expect(result.hits[0].kind === "place" && result.hits[0].row.name).toBe("Matterhorn");
  });

  it("honours the category chips", () => {
    const rows = [
      row({ name: "Blue Lake", cat: "lake", lat: 1, lon: 1 }),
      row({ name: "Blue Peak", cat: "peak", lat: 1, lon: 1 }),
    ];
    const result = run("blue", rows, { cats: new Set(["peak"]) });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].kind === "place" && result.hits[0].row.cat).toBe("peak");
  });

  it("breaks a tie by distance to the camera", () => {
    const rows = [
      row({ name: "Blue Lake", cat: "lake", lat: 10, lon: 10 }),
      row({ name: "Blue Lake", cat: "lake", lat: 10.01, lon: 10.01 }),
    ];
    const result = run("blue lake", rows, { center: { lat: 10.011, lon: 10.011 } });
    expect(result.hits[0].kind).toBe("place");
    expect(result.hits[0].kind === "place" && result.hits[0].row.lat).toBe(10.01);
  });

  it("parses coordinates into a fly-to hit", () => {
    const result = run("46.5, 8.0", []);
    expect(result.hits).toEqual([
      { kind: "point", lat: 46.5, lon: 8, label: "46.50, 8.00" },
    ]);
  });

  it("puts a matching country before its places and can fly to it", () => {
    const rows = [
      row({ name: "Gullfoss", cat: "waterfall", lat: 64.3, lon: -20.1, country: "Iceland" }),
    ];
    const result = search({
      rows,
      areas: [area("Iceland", "Iceland", 42)],
      query: "iceland",
    });
    expect(result.hits[0].kind).toBe("area");
    expect(result.hits[0].kind === "area" && result.hits[0].area.name).toBe("Iceland");
  });

  it("returns a region hit with its own fit zoom", () => {
    const result = search({
      rows: [],
      areas: [area("Valais", "Valais, Switzerland", 42, 46.1, 7.7, "region")],
      query: "VALAIS",
    });
    expect(result.hits[0].kind).toBe("area");
    expect(result.hits[0].kind === "area" && result.hits[0].area.kind).toBe("region");
    expect(result.hits[0].kind === "area" && result.hits[0].area.zoom).toBe(4);
  });

  it("understands a multi-word category phrase", () => {
    const result = run("hot springs", [
      row({ name: "Landmannalaugar", cat: "spring", lat: 63.9, lon: -19.0 }),
      row({ name: "Some Camp", cat: "camp", lat: 63.9, lon: -19.0 }),
    ]);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].kind === "place" && result.hits[0].row.cat).toBe("spring");
  });
});
