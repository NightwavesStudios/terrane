import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import type { FeatureRow } from "../data/features";
import type { Place } from "../data/places";

function place(over: Partial<Place> & Pick<Place, "slug" | "name" | "type">): Place {
  return {
    country: "Switzerland",
    region: "Valais",
    lat: 45.976,
    lon: 7.658,
    hue: 200,
    ...over,
  };
}

function tail(over: Partial<FeatureRow> & Pick<FeatureRow, "name" | "cat" | "lat" | "lon">): FeatureRow {
  return { tier: 3, src: "wikidata", ...over };
}

describe("buildCatalog", () => {
  const matterhorn = place({ slug: "matterhorn", name: "Matterhorn", type: "peak", elevation: 4478 });

  it("keeps one row for a place described by the atlas and the tail", () => {
    const data = buildCatalog(
      [matterhorn],
      [tail({ name: "Matterhorn", cat: "peak", lat: 45.977, lon: 7.659 })],
      [],
    );
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].source).toBe("atlas");
  });

  it("keeps two places with the same name when they are far apart", () => {
    const data = buildCatalog(
      [matterhorn],
      [tail({ name: "Matterhorn", cat: "peak", lat: 60, lon: 8 })],
      [],
    );
    expect(data.rows).toHaveLength(2);
  });

  it("attaches the nearest named destination as context", () => {
    const data = buildCatalog(
      [matterhorn],
      [tail({ name: "Riffelhorn", cat: "peak", lat: 45.99, lon: 7.67 })],
      [],
    );
    const row = data.rows.find((item) => item.name === "Riffelhorn");
    expect(row?.near?.name).toBe("Matterhorn");
    expect(row?.near?.km).toBeLessThan(5);
    expect(row?.country).toBe("Switzerland");
    expect(row?.region).toBe("Valais");
  });

  it("uses the baked neighbour even when a broader search would find another", () => {
    const data = buildCatalog(
      [matterhorn],
      [
        tail({
          name: "Somewhere",
          cat: "lake",
          lat: 46.3,
          lon: 7.9,
          near: "matterhorn",
        }),
      ],
      [],
    );
    const row = data.rows.find((item) => item.name === "Somewhere");
    expect(row?.near?.slug).toBe("matterhorn");
    expect(row?.near?.km).toBeGreaterThan(20);
  });

  it("ignores a baked neighbour farther than 100 km", () => {
    const far = place({ slug: "far", name: "Far", type: "peak", lat: 60, lon: 8 });
    const data = buildCatalog(
      [far],
      [
        tail({
          name: "Somewhere",
          cat: "lake",
          lat: 46,
          lon: 8,
          near: "far",
        }),
      ],
      [],
    );
    const row = data.rows.find((item) => item.name === "Somewhere");
    expect(row?.near).toBeUndefined();
    expect(row?.country).toBeUndefined();
  });

  it("appends named practical pins with their own tier and location", () => {
    const data = buildCatalog(
      [matterhorn],
      [],
      [
        {
          cat: "camp",
          name: "Camping Zermatt",
          lat: 46.02,
          lon: 7.75,
          region: "Valais",
          country: "Switzerland",
          src: "osm",
        },
      ],
    );
    const poi = data.rows.find((item) => item.name === "Camping Zermatt");
    expect(poi?.tier).toBe(5);
    expect(poi?.source).toBe("poi");
    expect(poi?.country).toBe("Switzerland");
  });

  it("drops a named pin that repeats an indexed row within 10 km", () => {
    const data = buildCatalog(
      [matterhorn],
      [],
      [{ cat: "peak", name: "Matterhorn", lat: 45.977, lon: 7.659, src: "osm" }],
    );
    expect(data.rows.filter((item) => item.name === "Matterhorn")).toHaveLength(1);
    expect(data.rows[0].source).toBe("atlas");
  });

  it("dedupes named pins against each other", () => {
    const data = buildCatalog(
      [],
      [],
      [
        { cat: "camp", name: "Camp", lat: 46, lon: 7, src: "osm" },
        { cat: "camp", name: "Camp", lat: 46.01, lon: 7.01, src: "osm" },
      ],
    );
    expect(data.rows).toHaveLength(1);
  });

  it("groups countries and regions into areas with a fit", () => {
    const data = buildCatalog(
      [
        matterhorn,
        place({ slug: "weisshorn", name: "Weisshorn", type: "peak", lat: 46.1, lon: 7.7 }),
        place({ slug: "dents-blanches", name: "Dents Blanches", type: "peak", lat: 46.15, lon: 6.9 }),
        place({ slug: "lake", name: "Lake", type: "landmark", region: "Bern", lat: 46.5, lon: 7.9 }),
      ],
      [tail({ name: "Tail Lake", cat: "lake", lat: 46.02, lon: 7.66 })],
      [],
    );
    const switzerland = data.areas.find((item) => item.kind === "country");
    expect(switzerland?.count).toBe(5);
    const valais = data.areas.find((item) => item.kind === "region" && item.name === "Valais");
    expect(valais?.count).toBe(4);
    expect(valais?.label).toBe("Valais, Switzerland");
    expect(valais?.zoom).toBeGreaterThanOrEqual(1.8);
    expect(valais?.zoom).toBeLessThanOrEqual(8.2);
    expect(data.countries).toBe(1);
  });
});
