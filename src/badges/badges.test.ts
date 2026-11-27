import { describe, expect, it } from "vitest";
import catalogJson from "../../data/badges.json";
import {
  FACT_TYPES,
  emptyFacts,
  evaluateBadge,
  evaluateCriteria,
  getBadgeProgress,
  validateCatalog,
  type Badge,
  type BadgeCatalog,
  type Criteria,
  type Facts,
  type FactName,
} from "./evaluate";

const catalog = catalogJson as unknown as BadgeCatalog;

const LAUNCH_IDS = [
  "first-light",
  "paper-trail",
  "ten-up",
  "halfway",
  "finisher",
  "grand-traverse",
  "winter-round",
  "highpoint",
  "home-mountain",
  "comeback",
];

const RICH_FACTS: Facts = {
  "ascents.summits": 1200,
  "ascents.unique_peaks": 1200,
  "ascents.attempts": 3,
  "ascents.gpx_tracks": 10,
  "ascents.winter_summits": 10,
  "ascents.seasons_on_single_peak": 4,
  "ascents.max_ascents_on_single_peak": 5,
  "ascents.countries": 7,
  "ascents.continents": 7,
  "ascents.ranges": 10,
  "ascents.max_peaks_in_trip": 3,
  "ascents.max_elevation_m": 9000,
  "ascents.max_prominence_m": 2000,
  "ascents.has_pre_account_ascent": true,
  "ascents.has_solstice_summit": true,
  "ascents.has_dawn_start": true,
  "ascents.has_night_summit": true,
  "ascents.has_highpoint": true,
  "ascents.has_continental_highpoint": true,
  "ascents.has_lonely_summit": true,
  "ascents.has_summitted_previous_attempt": true,
  "lists.started": 3,
  "lists.completed": 3,
  "lists.distinct_completed": 3,
  "lists.max_progress_pct": 100,
  "lists.max_completed_rounds": 3,
  "contributions.photos": 50,
  "contributions.reports": 5,
  "contributions.corrections_accepted": 1,
  "time.months_with_summits_in_year": 12,
  "time.current_year_complete": true,
  "profile.has_home_region_and_units": true,
};

/** Build the smallest facts snapshot that satisfies a criteria tree. */
function satisfyingFacts(criteria: Criteria, facts: Facts = emptyFacts()): Facts {
  if ("all" in criteria) {
    criteria.all.forEach((child) => satisfyingFacts(child, facts));
    return facts;
  }
  if ("any" in criteria) {
    satisfyingFacts(criteria.any[0], facts);
    return facts;
  }
  if ("not" in criteria) {
    // No one-shot badge uses `not`; satisfy the inner tree so the negation is
    // still exercised by the evaluator test below.
    satisfyingFacts(criteria.not, facts);
    return facts;
  }

  const name = criteria.fact as FactName;
  if (!(name in FACT_TYPES)) return facts;
  const type = FACT_TYPES[name];

  if (criteria.gte !== undefined) facts[name] = criteria.gte;
  else if (criteria.gt !== undefined) facts[name] = criteria.gt + 1;
  else if (criteria.lte !== undefined) facts[name] = criteria.lte;
  else if (criteria.lt !== undefined) facts[name] = criteria.lt - 1;
  else if (criteria.eq !== undefined) facts[name] = criteria.eq;
  else if (criteria.neq !== undefined) {
    facts[name] = type === "number" ? Number(criteria.neq) + 1 : !criteria.neq;
  }
  return facts;
}

function progressFactOf(badge: Badge): FactName | null {
  return badge.progress ? (badge.progress.fact as FactName) : null;
}

describe("badge catalog", () => {
  it("has 43 unique badges across all nine families", () => {
    expect(catalog.badges).toHaveLength(43);
    expect(new Set(catalog.badges.map((badge) => badge.id)).size).toBe(43);
    expect(catalog.families).toHaveLength(9);
    expect(new Set(catalog.families.map((family) => family.id)).size).toBe(9);

    const familyIds = new Set(catalog.families.map((family) => family.id));
    for (const badge of catalog.badges) {
      expect(familyIds.has(badge.family)).toBe(true);
    }
  });

  it("has no validation errors and references only real facts", () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("marks exactly the ten launch badges and keeps them visible", () => {
    const launch = catalog.badges.filter((badge) => badge.launch);
    expect(launch.map((badge) => badge.id).sort()).toEqual([...LAUNCH_IDS].sort());
    expect(launch).toHaveLength(10);
    expect(catalog.badges.filter((badge) => !badge.launch)).toHaveLength(33);
    for (const badge of launch) expect(badge.hidden).toBe(false);
  });

  it("contains 28 progressive and 15 one-shot marks", () => {
    expect(catalog.badges.filter((badge) => badge.progressive)).toHaveLength(28);
    expect(catalog.badges.filter((badge) => !badge.progressive)).toHaveLength(15);
    for (const badge of catalog.badges) {
      expect(Boolean(badge.progress)).toBe(badge.progressive);
    }
  });

  it("awards nothing on an empty history", () => {
    const facts = emptyFacts();
    for (const badge of catalog.badges) {
      expect(evaluateBadge(badge, facts), `${badge.id} should not fire on empty facts`).toBe(false);
    }
  });

  it("awards every badge on a history that satisfies all of them", () => {
    for (const badge of catalog.badges) {
      expect(evaluateBadge(badge, RICH_FACTS), `${badge.id} should fire on rich facts`).toBe(true);
    }
  });

  it("evaluates every badge against sample ascent and list facts", () => {
    for (const badge of catalog.badges) {
      const facts = satisfyingFacts(badge.criteria);
      expect(evaluateBadge(badge, facts), `${badge.id} should fire on its own fixture`).toBe(true);
    }
  });

  it("does not fire a progressive badge one step below its threshold", () => {
    for (const badge of catalog.badges) {
      if (!badge.progressive) continue;
      const fact = progressFactOf(badge);
      expect(fact, `${badge.id} has no progress fact`).not.toBeNull();
      const facts = satisfyingFacts(badge.criteria);
      facts[fact!] = badge.progress!.target - 1;
      expect(evaluateBadge(badge, facts), `${badge.id} should not fire below target`).toBe(false);
    }
  });

  it("exposes progress for progressive badges and null for one-shot marks", () => {
    for (const badge of catalog.badges) {
      const progress = getBadgeProgress(badge, RICH_FACTS);
      if (badge.progressive) {
        expect(progress).not.toBeNull();
        expect(progress!.pct).toBe(100);
        expect(progress!.current).toBe(badge.progress!.target);
      } else {
        expect(progress).toBeNull();
      }
    }
  });
});

describe("criteria grammar", () => {
  it("supports all, any, not and every comparison", () => {
    const facts: Facts = {
      "ascents.unique_peaks": 10,
      "ascents.summits": 12,
      "profile.has_home_region_and_units": true,
    };

    expect(evaluateCriteria({ all: [{ fact: "ascents.unique_peaks", gte: 10 }] }, facts)).toBe(true);
    expect(evaluateCriteria({ any: [{ fact: "ascents.unique_peaks", gte: 99 }, { fact: "ascents.summits", gte: 12 }] }, facts)).toBe(true);
    expect(evaluateCriteria({ not: { fact: "profile.has_home_region_and_units", eq: false } }, facts)).toBe(true);
    expect(evaluateCriteria({ fact: "ascents.unique_peaks", gt: 9 }, facts)).toBe(true);
    expect(evaluateCriteria({ fact: "ascents.unique_peaks", lte: 10 }, facts)).toBe(true);
    expect(evaluateCriteria({ fact: "ascents.unique_peaks", lt: 11 }, facts)).toBe(true);
    expect(evaluateCriteria({ fact: "profile.has_home_region_and_units", eq: true }, facts)).toBe(true);
    expect(evaluateCriteria({ fact: "profile.has_home_region_and_units", neq: false }, facts)).toBe(true);
  });

  it("treats missing facts as false", () => {
    expect(evaluateCriteria({ fact: "ascents.unique_peaks", gte: 1 }, {})).toBe(false);
  });

  it("rejects unknown facts and malformed criteria", () => {
    const errors = validateCatalog({
      ...catalog,
      badges: [
        {
          ...catalog.badges[0],
          id: "broken",
          criteria: { fact: "ascents.not_a_fact", gte: 1 },
          progress: null,
          progressive: false,
        },
      ],
    });
    expect(errors.some((error) => error.includes("unknown fact"))).toBe(true);
  });
});
