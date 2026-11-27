/**
 * Badge criteria are data, not code branches.
 *
 * The catalog lives in `data/badges.json`. This module owns the fact registry,
 * the criteria grammar and the validation used by the seed and the tests.
 */

export const FACT_TYPES = {
  "ascents.summits": "number",
  "ascents.unique_peaks": "number",
  "ascents.attempts": "number",
  "ascents.gpx_tracks": "number",
  "ascents.winter_summits": "number",
  "ascents.seasons_on_single_peak": "number",
  "ascents.max_ascents_on_single_peak": "number",
  "ascents.countries": "number",
  "ascents.continents": "number",
  "ascents.ranges": "number",
  "ascents.max_peaks_in_trip": "number",
  "ascents.max_elevation_m": "number",
  "ascents.max_prominence_m": "number",
  "ascents.has_pre_account_ascent": "boolean",
  "ascents.has_solstice_summit": "boolean",
  "ascents.has_dawn_start": "boolean",
  "ascents.has_night_summit": "boolean",
  "ascents.has_highpoint": "boolean",
  "ascents.has_continental_highpoint": "boolean",
  "ascents.has_lonely_summit": "boolean",
  "ascents.has_summitted_previous_attempt": "boolean",
  "lists.started": "number",
  "lists.completed": "number",
  "lists.distinct_completed": "number",
  "lists.max_progress_pct": "number",
  "lists.max_completed_rounds": "number",
  "contributions.photos": "number",
  "contributions.reports": "number",
  "contributions.corrections_accepted": "number",
  "time.months_with_summits_in_year": "number",
  "time.current_year_complete": "boolean",
  "profile.has_home_region_and_units": "boolean",
} as const;

export type FactName = keyof typeof FACT_TYPES;
export type FactType = (typeof FACT_TYPES)[FactName];
export type FactValue = number | boolean;
export type Facts = Partial<Record<FactName, FactValue>>;

export interface Comparison {
  fact: string;
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
  eq?: FactValue;
  neq?: FactValue;
}

export type Criteria =
  | { all: Criteria[] }
  | { any: Criteria[] }
  | { not: Criteria }
  | Comparison;

export interface ProgressDefinition {
  fact: string;
  target: number;
  unit: string;
}

export interface Badge {
  id: string;
  name: string;
  family: string;
  description: string;
  criteriaVersion: number;
  progressive: boolean;
  hidden: boolean;
  progress: ProgressDefinition | null;
  criteria: Criteria;
}

export interface BadgeFamily {
  id: string;
  name: string;
  description: string;
}

export interface BadgeCatalog {
  version: number;
  families: BadgeFamily[];
  badges: Badge[];
}

export interface BadgeProgress {
  current: number;
  target: number;
  pct: number;
  unit: string;
}

const NUMERIC_OPERATORS = ["gte", "gt", "lte", "lt"] as const;
const EQUALITY_OPERATORS = ["eq", "neq"] as const;
const ALL_OPERATORS = [...NUMERIC_OPERATORS, ...EQUALITY_OPERATORS] as const;

function isFactName(name: string): name is FactName {
  return Object.prototype.hasOwnProperty.call(FACT_TYPES, name);
}

/** Evaluate one criteria tree against a facts snapshot. Missing facts are false. */
export function evaluateCriteria(criteria: Criteria, facts: Facts): boolean {
  if ("all" in criteria) {
    return criteria.all.every((child) => evaluateCriteria(child, facts));
  }
  if ("any" in criteria) {
    return criteria.any.some((child) => evaluateCriteria(child, facts));
  }
  if ("not" in criteria) {
    return !evaluateCriteria(criteria.not, facts);
  }
  if (!isFactName(criteria.fact)) return false;

  const value = facts[criteria.fact];
  if (value === undefined) return false;

  for (const operator of NUMERIC_OPERATORS) {
    const threshold = criteria[operator];
    if (threshold === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    switch (operator) {
      case "gte":
        if (!(value >= threshold)) return false;
        break;
      case "gt":
        if (!(value > threshold)) return false;
        break;
      case "lte":
        if (!(value <= threshold)) return false;
        break;
      case "lt":
        if (!(value < threshold)) return false;
        break;
    }
  }

  for (const operator of EQUALITY_OPERATORS) {
    const expected = criteria[operator];
    if (expected === undefined) continue;
    if (operator === "eq" && value !== expected) return false;
    if (operator === "neq" && value === expected) return false;
  }

  return true;
}

export function evaluateBadge(badge: Badge, facts: Facts): boolean {
  return evaluateCriteria(badge.criteria, facts);
}

/** A progress bar value for a progressive badge; null for one-shot marks. */
export function getBadgeProgress(badge: Badge, facts: Facts): BadgeProgress | null {
  if (!badge.progressive || !badge.progress) return null;
  const raw = facts[badge.progress.fact as FactName];
  const current = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  const pct = Math.min(100, Math.round((current / badge.progress.target) * 100));
  return {
    current: Math.min(current, badge.progress.target),
    target: badge.progress.target,
    pct,
    unit: badge.progress.unit,
  };
}

/** Every fact at zero/false. Used by the evaluator tests and the initial seed. */
export function emptyFacts(): Facts {
  const facts: Facts = {};
  for (const [name, type] of Object.entries(FACT_TYPES) as [FactName, FactType][]) {
    facts[name] = type === "number" ? 0 : false;
  }
  return facts;
}

function validateCriteria(criteria: Criteria, path: string, errors: string[]): void {
  if ("all" in criteria || "any" in criteria) {
    const children = "all" in criteria ? criteria.all : criteria.any;
    if (!Array.isArray(children) || children.length === 0) {
      errors.push(`${path}: "${"all" in criteria ? "all" : "any"}" needs at least one child`);
      return;
    }
    children.forEach((child, index) => validateCriteria(child, `${path}.${index}`, errors));
    return;
  }

  if ("not" in criteria) {
    validateCriteria(criteria.not, `${path}.not`, errors);
    return;
  }

  if (!isFactName(criteria.fact)) {
    errors.push(`${path}: unknown fact "${criteria.fact}"`);
    return;
  }

  const type = FACT_TYPES[criteria.fact];
  const operators = ALL_OPERATORS.filter((operator) => criteria[operator] !== undefined);
  if (operators.length !== 1) {
    errors.push(`${path}: exactly one operator required, found ${operators.length}`);
    return;
  }

  const operator = operators[0];
  if (operator === "gte" || operator === "gt" || operator === "lte" || operator === "lt") {
    const value = criteria[operator];
    if (type !== "number") {
      errors.push(`${path}: "${operator}" needs a number fact, "${criteria.fact}" is ${type}`);
    } else if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${path}: "${operator}" needs a finite number`);
    }
    return;
  }

  const expected = criteria[operator];
  if (type === "number" && typeof expected !== "number") {
    errors.push(`${path}: "${operator}" needs a number for "${criteria.fact}"`);
  }
  if (type === "boolean" && typeof expected !== "boolean") {
    errors.push(`${path}: "${operator}" needs a boolean for "${criteria.fact}"`);
  }
}

/**
 * Validate the whole catalog. Returns a list of human-readable errors; the
 * seed and the test both refuse to proceed when it is non-empty.
 */
export function validateCatalog(catalog: BadgeCatalog): string[] {
  const errors: string[] = [];

  if (catalog.version !== 1) {
    errors.push(`catalog: expected version 1, found ${catalog.version}`);
  }

  if (!Array.isArray(catalog.families) || catalog.families.length !== 9) {
    errors.push(`catalog: expected 9 families, found ${catalog.families?.length ?? 0}`);
  }

  const familyIds = new Set<string>();
  for (const family of catalog.families) {
    if (!family.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family.id)) {
      errors.push(`family "${family.id}": invalid id`);
    }
    if (familyIds.has(family.id)) errors.push(`family "${family.id}": duplicate id`);
    familyIds.add(family.id);
    if (!family.name.trim()) errors.push(`family "${family.id}": empty name`);
    if (!family.description.trim()) errors.push(`family "${family.id}": empty description`);
  }

  if (!Array.isArray(catalog.badges) || catalog.badges.length === 0) {
    errors.push("catalog: no badges");
    return errors;
  }

  const badgeIds = new Set<string>();
  for (const badge of catalog.badges) {
    const path = `badge "${badge.id || "(missing id)"}"`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(badge.id)) errors.push(`${path}: invalid id`);
    if (badgeIds.has(badge.id)) errors.push(`${path}: duplicate id`);
    badgeIds.add(badge.id);
    if (!badge.name.trim()) errors.push(`${path}: empty name`);
    if (!badge.description.trim()) errors.push(`${path}: empty description`);
    if (!familyIds.has(badge.family)) errors.push(`${path}: unknown family "${badge.family}"`);
    if (!Number.isInteger(badge.criteriaVersion) || badge.criteriaVersion < 1) {
      errors.push(`${path}: criteriaVersion must be a positive integer`);
    }
    if (typeof badge.progressive !== "boolean") errors.push(`${path}: progressive must be boolean`);
    if (typeof badge.hidden !== "boolean") errors.push(`${path}: hidden must be boolean`);

    if (badge.progressive) {
      if (!badge.progress) {
        errors.push(`${path}: progressive badges need a progress definition`);
      } else {
        if (!isFactName(badge.progress.fact)) {
          errors.push(`${path}: unknown progress fact "${badge.progress.fact}"`);
        } else if (FACT_TYPES[badge.progress.fact] !== "number") {
          errors.push(`${path}: progress fact "${badge.progress.fact}" must be numeric`);
        }
        if (!Number.isInteger(badge.progress.target) || badge.progress.target <= 0) {
          errors.push(`${path}: progress target must be a positive integer`);
        }
        if (!badge.progress.unit.trim()) errors.push(`${path}: progress unit is empty`);
      }
    } else if (badge.progress) {
      errors.push(`${path}: one-shot badges cannot have progress`);
    }

    validateCriteria(badge.criteria, `${path}.criteria`, errors);
  }

  return errors;
}
