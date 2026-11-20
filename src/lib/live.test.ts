import { describe, expect, it } from "vitest";
import { manifestDay, newerManifest } from "./live";

type M = { days: Record<string, string>; generatedAt?: string };

const m = (days: Record<string, string>, generatedAt?: string): M => ({
  days,
  generatedAt,
});

describe("live manifest freshness", () => {
  it("uses the newest harvest day", () => {
    expect(manifestDay(m({ osm: "2026-11-18", wikidata: "2026-11-20" }))).toBe(
      Date.parse("2026-11-20T00:00:00Z"),
    );
  });

  it("keeps the bundled manifest when the live one is older", () => {
    const bundled = m({ osm: "2026-11-18", wikidata: "2026-11-20" });
    const live = m({ osm: "2026-11-18", wikidata: "2026-11-18" });
    expect(newerManifest(live, bundled)).toBe(bundled);
  });

  it("accepts a live manifest that is newer or equal", () => {
    const bundled = m({ osm: "2026-11-18" });
    const live = m({ osm: "2026-11-20" });
    expect(newerManifest(live, bundled)).toBe(live);
    expect(newerManifest(bundled, bundled)).toBe(bundled);
  });

  it("falls back to generatedAt when no days are recorded", () => {
    expect(
      manifestDay({ days: {}, generatedAt: "2026-11-20T12:00:00Z" }),
    ).toBe(Date.parse("2026-11-20T12:00:00Z"));
  });

  it("accepts a manifest with no date rather than blocking it", () => {
    const bundled = m({ osm: "2026-11-20" });
    const live = m({});
    expect(newerManifest(live, bundled)).toBe(live);
  });
});
