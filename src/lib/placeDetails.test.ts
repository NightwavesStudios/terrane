import { describe, expect, it } from "vitest";
import {
  difficultyLabel,
  landscapeRows,
  sentence,
  thumbAt,
  type PlaceDetail,
} from "./placeDetails";

describe("thumbAt", () => {
  const url =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/File.jpg/1920px-File.jpg";

  it("resolves the file through Special:FilePath", () => {
    expect(thumbAt(url, 640)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/File.jpg?width=640",
    );
    expect(thumbAt(url, 960)).toContain("width=960");
  });

  it("uses the file name from a bucketed portrait thumb", () => {
    const portrait =
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Portrait.jpg/1920px-Portrait.jpg?utm_source=x";
    expect(thumbAt(portrait, 960)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Portrait.jpg?width=960",
    );
  });

  it("caps at the original width", () => {
    expect(thumbAt(url, 1440, 800)).toContain("width=800");
  });

  it("leaves a non-thumbnail URL alone", () => {
    expect(thumbAt("https://example.com/a.jpg", 640)).toBe("https://example.com/a.jpg");
  });
});

describe("difficultyLabel", () => {
  it("humanises OSM values", () => {
    expect(difficultyLabel("demanding_mountain_hiking")).toBe("Demanding mountain hiking");
    expect(difficultyLabel("hiking")).toBe("Hiking");
  });

  it("drops an unknown difficulty", () => {
    expect(difficultyLabel("")).toBe("");
    expect(difficultyLabel("Unknown")).toBe("");
  });
});

describe("sentence", () => {
  it("capitalises and punctuates a Wikidata description", () => {
    expect(sentence("mountain in Alaska")).toBe("Mountain in Alaska.");
    expect(sentence("A lake in Italy.")).toBe("A lake in Italy.");
    expect(sentence("")).toBe("");
  });
});

describe("landscapeRows", () => {
  const claimed: PlaceDetail = {
    range: { name: "Alaska Range" },
    protected: { name: "Denali National Park" },
    nearestRange: { name: "Nearest", km: 4 },
    nearestPark: { name: "Nearest park", km: 6 },
  };

  it("labels recorded associations and ignores nearest duplicates", () => {
    expect(landscapeRows(claimed).map((row) => row.label)).toEqual([
      "Mountain range",
      "Protected area",
    ]);
  });

  it("falls back to the nearest rows with their own labels", () => {
    expect(
      landscapeRows({
        nearestRange: { name: "R", km: 2 },
        nearestPark: { name: "P", km: 3 },
      }).map((row) => row.label),
    ).toEqual(["Nearest range", "Nearest park"]);
  });

  it("returns nothing without a detail record", () => {
    expect(landscapeRows(null)).toEqual([]);
  });
});
