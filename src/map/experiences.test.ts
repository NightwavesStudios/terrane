import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { GuideCatalogRow, GuideExperience } from "../data/guide";
import { GUIDE_KINDS, guideKind } from "../data/guide";
import {
  addExperiences,
  experienceFeatures,
  experienceLayerSpecs,
  experienceWhere,
  placeFeatures,
  setExperienceLayers,
  showExperience,
} from "./experiences";
import { createStyle } from "./style";
import { loadGuideCatalog } from "../lib/guide";
import { DEFAULT_LAYERS } from "../components/LayerControl";

function fakeMap() {
  const sources = new Map<
    string,
    { data: GeoJSON.FeatureCollection; setData: (next: GeoJSON.FeatureCollection) => void }
  >();
  const layers = new Map<string, { id: string }>();
  const filters = new Map<string, unknown>();
  const layout = new Map<string, unknown>();
  let fitted: { bounds: unknown; options: unknown } | null = null;
  return {
    sources,
    layers,
    filters,
    layout,
    get fitted() {
      return fitted;
    },
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: { data: GeoJSON.FeatureCollection }) => {
      sources.set(id, {
        ...spec,
        setData(next: GeoJSON.FeatureCollection) {
          this.data = next;
        },
      });
    },
    addLayer: (spec: { id: string }) => layers.set(spec.id, spec),
    getLayer: (id: string) => layers.get(id),
    setFilter: (id: string, filter: unknown) => filters.set(id, filter),
    setLayoutProperty: (id: string, key: string, value: unknown) =>
      layout.set(`${id}:${key}`, value),
    fitBounds: (bounds: unknown, options: unknown) => {
      fitted = { bounds, options };
    },
  };
}

const row = (
  overrides: Partial<GuideCatalogRow> & { slug: string; name: string },
): GuideCatalogRow => ({
  kind: "peak",
  lat: 45.8,
  lon: 6.9,
  hue: 208,
  summary: "A recorded summit.",
  placeCount: 5,
  trailCount: 2,
  associatedNames: [],
  ...overrides,
});

describe("experienceWhere", () => {
  it("does not repeat a region that is the country", () => {
    expect(experienceWhere({ region: "Switzerland", country: "Switzerland" })).toBe(
      "Switzerland",
    );
  });

  it("joins region and country, and tolerates either alone", () => {
    expect(experienceWhere({ region: "Valais", country: "Switzerland" })).toBe(
      "Valais, Switzerland",
    );
    expect(experienceWhere({ country: "Norway" })).toBe("Norway");
    expect(experienceWhere({})).toBe("");
  });
});

describe("experienceFeatures", () => {
  it("makes one point per curated destination with its kind colour", () => {
    const rows = [
      row({ slug: "mont-blanc", name: "Mont Blanc", country: "France" }),
      row({
        slug: "lake-bled",
        name: "Lake Bled",
        kind: "lake",
        country: "Slovenia",
        lat: 46.36,
        lon: 14.09,
        placeCount: 4,
        trailCount: 1,
      }),
    ];
    const collection = experienceFeatures(rows);
    expect(collection.features).toHaveLength(2);

    expect(collection.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [6.9, 45.8],
    });
    expect(collection.features[0].properties).toMatchObject({
      cat: "experience",
      n: "Mont Blanc",
      slug: "mont-blanc",
      kind: "peak",
      colour: guideKind("peak").colour,
      places: 5,
      trails: 2,
    });
    expect(collection.features[1].properties?.colour).toBe(guideKind("lake").colour);
  });

  it("keeps an empty catalogue empty rather than inventing a row", () => {
    expect(experienceFeatures([]).features).toHaveLength(0);
  });
});

describe("experience layers", () => {
  it("are valid MapLibre layers on top of the app's own style", () => {
    const base = createStyle();
    const empty = { type: "FeatureCollection", features: [] };
    const style = {
      ...base,
      sources: {
        ...base.sources,
        experiences: { type: "geojson", data: empty },
        "experience-places": { type: "geojson", data: empty },
      },
      layers: [...(base.layers ?? []), ...experienceLayerSpecs()],
    };
    const errors = validateStyleMin(style as never).map(
      (error) => `${error.message} (${error.identifier ?? ""})`,
    );
    expect(errors).toEqual([]);
  });

  it("draws beacons and neighbours with no connecting line or numbering", () => {
    const specs = experienceLayerSpecs();
    expect(specs.map((layer) => layer.id)).toEqual([
      "experiences-halo",
      "experiences-ring",
      "experiences-dot",
      "experiences-label",
      "experience-places",
      "experience-places-label",
    ]);
    expect(specs.some((layer) => layer.type === "line")).toBe(false);
    const hidden = specs
      .filter((layer) => layer.id.startsWith("experience-places"))
      .map((layer) => (layer as { layout?: { visibility?: string } }).layout?.visibility);
    expect(hidden).toEqual(["none", "none"]);
  });
});

describe("experience map wiring", () => {
  it("installs two sources, six layers and the curated catalogue", async () => {
    const map = fakeMap();
    addExperiences(map as never, DEFAULT_LAYERS);
    const rows = await loadGuideCatalog();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect([...map.sources.keys()]).toEqual(["experiences", "experience-places"]);
    expect(rows.length).toBeGreaterThan(100);
    const data = map.sources.get("experiences")?.data;
    expect(data?.features).toHaveLength(rows.length);
    expect(new Set(data?.features.map((f) => f.properties?.kind))).toEqual(
      new Set(GUIDE_KINDS.map((kind) => kind.id)),
    );
    expect(map.layers.size).toBe(6);
    expect(map.filters.get("experiences-dot")).toEqual([
      "in",
      ["get", "kind"],
      ["literal", GUIDE_KINDS.map((kind) => kind.id)],
    ]);
  });

  it("narrows the beacons to the kinds that are switched on", () => {
    const map = fakeMap();
    addExperiences(map as never, DEFAULT_LAYERS);
    setExperienceLayers(map as never, {
      ...DEFAULT_LAYERS,
      expCats: { ...DEFAULT_LAYERS.expCats, peak: false, park: false },
    });
    expect(map.filters.get("experiences-dot")).toEqual([
      "in",
      ["get", "kind"],
      ["literal", ["waterfall", "lake", "coast", "landmark"]],
    ]);

    setExperienceLayers(map as never, { ...DEFAULT_LAYERS, experience: false });
    expect(map.filters.get("experiences-dot")).toEqual([
      "==",
      ["get", "kind"],
      "__none__",
    ]);
  });

  it("shows and frames the selected destination's neighbours", async () => {
    const map = fakeMap();
    addExperiences(map as never, DEFAULT_LAYERS);
    await loadGuideCatalog();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const slug = map.sources.get("experiences")?.data.features[0].properties?.slug as string;

    showExperience(map as never, slug);
    for (let i = 0; i < 40 && !map.fitted; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const places = map.sources.get("experience-places")?.data.features ?? [];
    expect(places.length).toBeGreaterThan(1);
    expect(map.layout.get("experience-places:visibility")).toBe("visible");
    expect(map.fitted).not.toBeNull();
  });
});

describe("placeFeatures", () => {
  const guide = {
    slug: "yosemite-national-park",
    name: "Yosemite National Park",
    kind: "park",
    hue: 148,
    center: { lat: 37.83, lon: -119.5 },
    bounds: [-119.9, 37.5, -119.1, 38.2],
    associated: [
      { slug: "a", name: "A", cat: "peak", lat: 37.7, lon: -119.4, km: 12 },
      { slug: "b", name: "B", cat: "waterfall", lat: 37.8, lon: -119.6, km: 8 },
    ],
  } as unknown as GuideExperience;

  it("marks the destination and its neighbours without an order", () => {
    const places = placeFeatures(guide);
    expect(places.features).toHaveLength(3);
    expect(places.features.map((feature) => feature.properties?.name)).toEqual([
      "Yosemite National Park",
      "A",
      "B",
    ]);
    for (const feature of places.features) {
      expect(feature.properties?.colour).toBe(guideKind("park").colour);
    }
  });
});
