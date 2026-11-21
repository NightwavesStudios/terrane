/**
 * The Collection generator's pure half.
 *
 * Collections are wide groups of curated Experiences. This module only composes
 * facts the Experience records already hold: kinds, coordinates, nearby place
 * and trail counts, credited photographs and the committed group definition.
 * There is no route, day plan, distance-between-stops claim or invented trail.
 */

export const SCOPE_IDS = ["country", "range", "area", "trail"];

const BASE_HUE = { country: 206, range: 148, area: 34, trail: 26 };

/** Stable ridge-art hue for a scope and slug. */
export function collectionHue(scope, slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  const base = BASE_HUE[scope] ?? 206;
  return (base + (Math.abs(hash) % 34) - 17 + 360) % 360;
}

const RAD = Math.PI / 180;

export function kmBetween(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * RAD;
  const dLon = (bLon - aLon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function spanKm(experiences) {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const experience of experiences) {
    minLat = Math.min(minLat, experience.lat);
    maxLat = Math.max(maxLat, experience.lat);
    minLon = Math.min(minLon, experience.lon);
    maxLon = Math.max(maxLon, experience.lon);
  }
  return kmBetween(minLat, minLon, maxLat, maxLon);
}

export function boundsOf(experiences) {
  const lats = experiences.map((experience) => experience.lat);
  const lons = experiences.map((experience) => experience.lon);
  const pad = 0.02;
  return [
    round(Math.min(...lons) - pad, 3),
    round(Math.min(...lats) - pad, 3),
    round(Math.max(...lons) + pad, 3),
    round(Math.max(...lats) + pad, 3),
  ];
}

export function centerOf(experiences) {
  const bounds = boundsOf(experiences);
  return {
    lat: round((bounds[1] + bounds[3]) / 2, 4),
    lon: round((bounds[0] + bounds[2]) / 2, 4),
  };
}

const KIND_NAMES = {
  park: ["park", "parks"],
  peak: ["peak", "peaks"],
  waterfall: ["waterfall", "waterfalls"],
  lake: ["lake", "lakes"],
  coast: ["coastal place", "coastal places"],
  landmark: ["landmark", "landmarks"],
};

export function formatList(values) {
  const list = values.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function kindCounts(experiences) {
  const counts = {};
  for (const experience of experiences) {
    counts[experience.kind] = (counts[experience.kind] ?? 0) + 1;
  }
  return counts;
}

/** "8 peaks, 3 parks and 2 lakes" — counted from the member Experiences. */
export function kindPhrase(experiences) {
  const counts = kindCounts(experiences);
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([kind, count]) => {
      const [one, many] = KIND_NAMES[kind] ?? KIND_NAMES.landmark;
      if (count === 1) return kind === "park" ? "a national park" : `a ${one}`;
      return `${count} ${many}`;
    });
  return formatList(parts);
}

/**
 * Summary and evidence paragraphs. The first says what is grouped and where;
 * the second says how the group is verified and what it refuses to claim.
 */
export function describeCollection({
  experiences,
  where,
  scope,
  basisTrails = [],
}) {
  const count = experiences.length;
  const summary =
    `A collection of ${count} curated Experience${count === 1 ? "" : "s"} across ${where}: ` +
    `${kindPhrase(experiences)}.`;

  const trailLine = basisTrails.length
    ? ` The recorded trail thread is ${formatList(basisTrails.slice(0, 5))}.`
    : "";
  const first =
    `${summary} Every member is one destination with its own page, its own ` +
    `recorded geography and a Wikipedia source.${trailLine}`;

  const second =
    scope === "trail"
      ? `The trail names come from the committed trail links around these ` +
        `Experiences; their condition, access and seasonal status are not ` +
        `verified here. Collections gather Experiences, not walking days, and ` +
        `nothing on this page claims a way between them.`
      : `Collections group Experiences by country, mountain range, area or a ` +
        `recorded long-distance trail; they are not itineraries. The distance ` +
        `shown is the extent of the group, not a route, and no walking day or ` +
        `travel time is inferred.`;

  return { summary, description: [first, second] };
}

/** Keep the editorial order from the committed Experience selection. */
export function orderExperiences(experiences, selectionOrder) {
  return [...experiences].sort(
    (a, b) =>
      (selectionOrder.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
        (selectionOrder.get(b.slug) ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Reject a grouping that would lose, duplicate or invent an Experience. The
 * source file is hand-maintained, so this is the guard that keeps it total.
 */
export function validateGroups(groups, guideSlugs) {
  const errors = [];
  const known = new Set(guideSlugs);
  const seenSlugs = new Set();
  const seenExperiences = new Map();
  const seenScopes = new Set(SCOPE_IDS);

  for (const group of groups) {
    if (!group || typeof group !== "object") {
      errors.push("group is not an object");
      continue;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.slug ?? "")) {
      errors.push(`bad group slug: ${group.slug}`);
    }
    if (seenSlugs.has(group.slug)) errors.push(`duplicate group slug: ${group.slug}`);
    seenSlugs.add(group.slug);
    if (!seenScopes.has(group.scope)) {
      errors.push(`${group.slug}: unknown scope ${group.scope}`);
    }
    if (typeof group.title !== "string" || !group.title.trim()) {
      errors.push(`${group.slug}: missing title`);
    }
    if (typeof group.where !== "string" || !group.where.trim()) {
      errors.push(`${group.slug}: missing where`);
    }
    if (!Array.isArray(group.countries) || group.countries.length === 0) {
      errors.push(`${group.slug}: no countries`);
    }
    if (!Array.isArray(group.slugs) || group.slugs.length < 2) {
      errors.push(`${group.slug}: needs at least two Experiences`);
    }
    for (const experienceSlug of group.slugs ?? []) {
      if (!known.has(experienceSlug)) {
        errors.push(`${group.slug}: unknown Experience ${experienceSlug}`);
      }
      if (seenExperiences.has(experienceSlug)) {
        errors.push(
          `${group.slug}: ${experienceSlug} already belongs to ${seenExperiences.get(experienceSlug)}`,
        );
      }
      seenExperiences.set(experienceSlug, group.slug);
    }
    if (group.scope === "trail" && (!Array.isArray(group.basisTrails) || group.basisTrails.length === 0)) {
      errors.push(`${group.slug}: trail collection has no basisTrails`);
    }
  }

  for (const slug of guideSlugs) {
    if (!seenExperiences.has(slug)) errors.push(`unassigned Experience: ${slug}`);
  }
  return errors;
}
