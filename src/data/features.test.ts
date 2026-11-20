import { describe, expect, it } from "vitest";
import { destinationCategory, pickOf, pickOfPlace } from "./features";
import type { Place } from "./places";

function place(over: Partial<Place> & Pick<Place, "name" | "type">): Place {
  return {
    slug: over.name.toLowerCase().replace(/\s+/g, "-"),
    country: "Iceland",
    lat: 64.1,
    lon: -21.9,
    tagline: "",
    hue: 200,
    ...over,
  };
}

describe("destinationCategory", () => {
  it("keeps the explicit peak and park types", () => {
    expect(destinationCategory(place({ name: "Matterhorn", type: "peak" }))).toBe("peak");
    expect(destinationCategory(place({ name: "Vatnajökull", type: "park" }))).toBe("park");
  });

  it("gives an atlas landmark the category its name ends in", () => {
    expect(destinationCategory(place({ name: "Gullfoss Falls", type: "landmark" }))).toBe(
      "waterfall",
    );
    expect(destinationCategory(place({ name: "Vatnajökull Glacier", type: "landmark" }))).toBe(
      "glacier",
    );
    expect(destinationCategory(place({ name: "Grjótagjá Cave", type: "landmark" }))).toBe("cave");
    expect(destinationCategory(place({ name: "Hekla Volcano", type: "landmark" }))).toBe(
      "volcano",
    );
    expect(destinationCategory(place({ name: "Surtsey Island", type: "landmark" }))).toBe(
      "island",
    );
    expect(destinationCategory(place({ name: "Fjaðrárgljúfur Canyon", type: "landmark" }))).toBe(
      "canyon",
    );
    expect(destinationCategory(place({ name: "Snaefellsnes Desert", type: "landmark" }))).toBe(
      "desert",
    );
    expect(destinationCategory(place({ name: "Reynisfjara Beach", type: "landmark" }))).toBe(
      "beach",
    );
    expect(destinationCategory(place({ name: "Thingvellir Valley", type: "landmark" }))).toBe(
      "valley",
    );
    expect(destinationCategory(place({ name: "Kerlingarfjöll Range", type: "landmark" }))).toBe(
      "range",
    );
  });

  it("recognises the feature words the atlas carries in other languages", () => {
    expect(destinationCategory(place({ name: "Aldeyjarfoss", type: "landmark" }))).toBe(
      "waterfall",
    );
    expect(destinationCategory(place({ name: "Grande Cascade", type: "landmark" }))).toBe(
      "waterfall",
    );
    expect(destinationCategory(place({ name: "Vatnajökull", type: "landmark" }))).toBe(
      "glacier",
    );
  });

  it("does not turn a name that merely contains a word into that category", () => {
    expect(destinationCategory(place({ name: "Falls Creek", type: "landmark" }))).toBe(
      "landmark",
    );
    expect(destinationCategory(place({ name: "Mount Shasta", type: "landmark" }))).toBe(
      "landmark",
    );
  });

  it("leaves a hand-written gem alone", () => {
    expect(destinationCategory(place({ name: "The Wave", type: "gem" }))).toBe("landmark");
  });
});

describe("pick shape", () => {
  it("carries specific category, region and country from a place", () => {
    const pick = pickOfPlace(
      place({
        name: "Gullfoss Falls",
        type: "landmark",
        region: "Suðurland",
        country: "Iceland",
        elevation: 60,
      }),
    );
    expect(pick.cat).toBe("waterfall");
    expect(pick.region).toBe("Suðurland");
    expect(pick.country).toBe("Iceland");
    expect(pick.where).toBe("Suðurland");
    expect(pick.slug).toBe("gullfoss-falls");
  });

  it("reads structured location from map properties", () => {
    const pick = pickOf(
      { cat: "lake", n: "Lake X", region: "Valais", country: "Switzerland" },
      8,
      46,
    );
    expect(pick.region).toBe("Valais");
    expect(pick.country).toBe("Switzerland");
    expect(pick.name).toBe("Lake X");
  });
});
