import { describe, expect, it } from "vitest";
import { createStyle } from "./style";

function peakLabelField(units: "metric" | "imperial"): string {
  const style = createStyle({ units });
  const layer = style.layers.find((candidate) => candidate.id === "label-peak");
  if (!layer || layer.type !== "symbol") throw new Error("Peak label layer is missing.");
  return JSON.stringify(layer.layout?.["text-field"]);
}

describe("createStyle", () => {
  it("writes basemap summit labels in feet or metres", () => {
    expect(peakLabelField("imperial")).toContain('" ft"');
    expect(peakLabelField("metric")).toContain('" m"');
  });

  it("keeps the globe projection optional for flat maps", () => {
    expect(createStyle({ globe: true }).projection).toEqual({ type: "globe" });
    expect(createStyle().projection).toBeUndefined();
  });
});
