/**
 * The experience generator's pure half.
 *
 * Geographic clustering, category rules and prose composition are separated from
 * the file writes in `scripts/build-experiences.mjs` so they can be reasoned
 * about (and re-run) without touching the committed shards. Everything here is a
 * function of the committed destination, detail and trail-link data: no clock, no
 * network, no randomness, so two runs on the same commit produce the same files.
 */

export const CATEGORY_IDS = ["weekend", "mountain", "hiking", "camping", "park"];

const RAD = Math.PI / 180;

/** Great-circle distance in kilometres. */
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

const BASE_HUE = {
  weekend: 34,
  mountain: 206,
  hiking: 118,
  camping: 26,
  park: 148,
};

/** Stable ridge-art hue for a category, varied a little by slug. */
export function experienceHue(category, slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return (BASE_HUE[category] ?? 206) + (Math.abs(h) % 34) - 17;
}

/** Category of an atlas row, matching the map's type model. */
function catOf(destination) {
  if (destination.cat) return destination.cat;
  if (destination.type === "peak") return "peak";
  if (destination.type === "park") return "park";
  return "landmark";
}

/** Camping evidence already present in the committed records. Bare "camp" is
    left out on purpose: "Camp Peak" is a summit, and a concentration camp is not
    a campsite. */
const CAMP_WORDS = /\b(campground|campsite|campsites|camping|huts?|refuges?|bivouac|shelters?)\b/i;
const WATER_CATS = new Set(["lake", "valley", "waterfall", "spring", "island", "beach"]);
const PEAK_CATS = new Set(["peak", "volcano", "glacier", "range"]);

/**
 * How good a destination is as the seed of a route.
 *
 * Fame leads; a credited photograph, a recorded elevation, a description and
 * named trails are all evidence the page can actually say something. Nothing
 * here invents importance: it orders the same records the rest of the app uses.
 */
export function scoreCandidate(candidate) {
  let score = 0;
  score += { 0: 40, 1: 30, 2: 22, 3: 12, 4: 6 }[candidate.tier] ?? 4;
  if (candidate.elev) score += Math.min(14, candidate.elev / 300);
  if (candidate.photos.length) score += 8;
  if (candidate.desc) score += 4;
  score += Math.min(10, candidate.trailLinks.length * 3);
  return score;
}

/**
 * One candidate per pageable destination, joined with its detail and trail
 * records. Sorted deterministically so the seed pass never depends on file order.
 */
export function buildCandidates(destinations, detailsBySlug, trailsBySlug) {
  return destinations
    .map((destination) => {
      const detail = detailsBySlug[destination.slug] ?? {};
      const photos = Array.isArray(detail.img)
        ? detail.img.filter(
            (photo) => photo && photo.url && photo.credit && photo.licence,
          )
        : [];
      const candidate = {
        slug: destination.slug,
        name: destination.name,
        lat: destination.lat,
        lon: destination.lon,
        cat: catOf(destination),
        tier: destination.tier ?? 3,
        country: destination.country,
        region: destination.region,
        elev: destination.elevation ?? detail.elev ?? null,
        desc: detail.desc ?? "",
        photos,
        trailLinks: trailsBySlug[destination.slug] ?? [],
        range: detail.range ?? null,
        protectedArea: detail.protected ?? null,
      };
      candidate.score = scoreCandidate(candidate);
      return candidate;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.name.localeCompare(b.name) ||
        a.slug.localeCompare(b.slug),
    );
}

/** A simple latitude/longitude bucket index for neighbour queries. */
export function createIndex(candidates, cellDeg = 0.5) {
  const buckets = new Map();
  for (const candidate of candidates) {
    const key = `${Math.floor(candidate.lon / cellDeg)}:${Math.floor(candidate.lat / cellDeg)}`;
    const list = buckets.get(key);
    if (list) list.push(candidate);
    else buckets.set(key, [candidate]);
  }
  return {
    near(lat, lon, radiusKm) {
      /* 0.5° is ~55 km; two buckets either side covers the widest corridor. */
      const reach = Math.max(1, Math.ceil(radiusKm / 50));
      const x = Math.floor(lon / cellDeg);
      const y = Math.floor(lat / cellDeg);
      const out = [];
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (let dy = -reach; dy <= reach; dy += 1) {
          const list = buckets.get(`${x + dx}:${y + dy}`);
          if (list) out.push(...list);
        }
      }
      return out;
    },
  };
}

/** Bounding-box diagonal, the cluster's span in kilometres. */
export function spanKm(members) {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const member of members) {
    minLat = Math.min(minLat, member.lat);
    maxLat = Math.max(maxLat, member.lat);
    minLon = Math.min(minLon, member.lon);
    maxLon = Math.max(maxLon, member.lon);
  }
  return kmBetween(minLat, minLon, maxLat, maxLon);
}

/**
 * Grow a cluster outward from one seed.
 *
 * A candidate joins when it is within the corridor of a stop already in the
 * group, the group still fits its span, and no category has more than three
 * stops. The best next stop balances fame against distance and rewards a new
 * category, so a route is a mix of things rather than four summits in a row.
 */
export function expandCluster(seed, index, used, options = {}) {
  const {
    maxStops = 8,
    corridorKm = 40,
    maxSpanKm = 120,
    perCategory = 3,
    initial,
  } = options;
  const members = Array.isArray(initial) && initial.length ? [...initial] : [seed];
  const inCluster = new Set(members.map((member) => member.slug));
  const counts = new Map();
  for (const member of members) {
    counts.set(member.cat, (counts.get(member.cat) ?? 0) + 1);
  }

  while (members.length < maxStops) {
    let best = null;
    for (const member of members) {
      for (const candidate of index.near(member.lat, member.lon, corridorKm)) {
        if (used.has(candidate.slug) || inCluster.has(candidate.slug)) continue;
        if ((counts.get(candidate.cat) ?? 0) >= perCategory) continue;
        const km = kmBetween(member.lat, member.lon, candidate.lat, candidate.lon);
        if (km > corridorKm) continue;
        if (spanKm([...members, candidate]) > maxSpanKm) continue;
        const freshCategory = counts.has(candidate.cat) ? 0 : 6;
        const score = candidate.score * 0.45 - km * 0.55 + freshCategory;
        if (
          !best ||
          score > best.score ||
          (score === best.score && candidate.slug < best.candidate.slug)
        ) {
          best = { candidate, score, km };
        }
      }
    }
    if (!best) break;
    members.push(best.candidate);
    inCluster.add(best.candidate.slug);
    counts.set(best.candidate.cat, (counts.get(best.candidate.cat) ?? 0) + 1);
  }
  return members;
}

/**
 * The category a finished cluster earns.
 *
 * Rules read recorded facts only: destination categories, elevations, named
 * trails nearby, recorded protected areas, and the name/description words that
 * tell us a camp or hut is one of the stops. Order matters — camping needs
 * evidence and water or park context, parks claim majority park groups, and a
 * compact mixed group is a weekend.
 */
export function classifyCluster(members) {
  const n = members.length;
  const parks = members.filter(
    (member) => member.cat === "park" || member.cat === "reserve",
  ).length;
  const peaks = members.filter((member) => PEAK_CATS.has(member.cat)).length;
  const high = members.filter((member) => (member.elev ?? 0) >= 2000).length;
  const water = members.some((member) => WATER_CATS.has(member.cat));
  const camp = members.some(
    (member) =>
      CAMP_WORDS.test(member.name) || CAMP_WORDS.test(member.desc ?? ""),
  );
  const trailCount = members.reduce(
    (sum, member) => sum + member.trailLinks.length,
    0,
  );
  const trailStops = members.filter((member) => member.trailLinks.length > 0).length;

    const protectedCounts = new Map();
  for (const member of members) {
    const name = specificAreaName(member.protectedArea);
    if (name) protectedCounts.set(name, (protectedCounts.get(name) ?? 0) + 1);
  }
  const sharedProtected = [...protectedCounts.values()].some((count) => count >= 2);

  if (camp && (parks > 0 || water)) return "camping";
  if (parks / n >= 0.5 || sharedProtected) return "park";
  if (peaks / n >= 0.35 || high >= 2) return "mountain";
  /* Water country with named trails, without a park or peak majority: the
     practical shape of a camping route even where the destination set records
     no campsite. Campsites themselves are listed from the POI cells on the
     page, never asserted here. */
  if (water && trailStops >= 2 && spanKm(members) <= 80) return "camping";
  if (trailCount >= 3 && trailStops >= 2) return "hiking";
  if (spanKm(members) <= 80) return "weekend";
  return null;
}

/**
 * Walk the cluster from its most notable stop, always taking the nearest stop
 * that has not been visited. The order is what makes the map's line readable and
 * the leg distances comparable.
 */
export function orderStops(members) {
  const anchor = [...members].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  )[0];
  const rest = members.filter((member) => member.slug !== anchor.slug);
  const ordered = [anchor];

  while (rest.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestKm = Infinity;
    for (let i = 0; i < rest.length; i += 1) {
      const km = kmBetween(last.lat, last.lon, rest[i].lat, rest[i].lon);
      if (
        km < bestKm - 1e-9 ||
        (Math.abs(km - bestKm) < 1e-9 && rest[i].name < rest[bestIndex].name)
      ) {
        bestKm = km;
        bestIndex = i;
      }
    }
    ordered.push(rest.splice(bestIndex, 1)[0]);
  }

  let previous = null;
  return ordered.map((member, index) => {
    const legKm =
      previous === null
        ? 0
        : round(kmBetween(previous.lat, previous.lon, member.lat, member.lon), 1);
    previous = member;
    return { ...member, index: index + 1, legKm };
  });
}

export function distanceOf(stops) {
  return round(
    stops.reduce((sum, stop) => sum + stop.legKm, 0),
    1,
  );
}

const DWELL_HOURS = {
  weekend: 1.5,
  mountain: 2,
  hiking: 2.5,
  camping: 1.5,
  park: 2,
};

/** A stated model, not a claim: road speed for straight-line legs plus dwell. */
export function durationFor(category, distanceKm, stopCount) {
  const dwell = DWELL_HOURS[category] ?? 2;
  const hours = distanceKm / 45 + stopCount * dwell;
  return {
    hours: round(Math.round(hours * 2) / 2, 1),
    days: Math.max(1, Math.min(6, Math.ceil(hours / 8))),
  };
}

export function durationBasis(category) {
  const dwell = DWELL_HOURS[category] ?? 2;
  return `Travel at 45 km/h along straight-line stop distances, plus ${dwell} h at each stop.`;
}

/**
 * The protected-area name, when it is a name rather than a classification.
 * Wikidata's P814 is often the generic `IUCN category II: National Park`, which
 * says nothing about where the route is and must never become a title.
 */
export function specificAreaName(assoc) {
  const raw = assoc?.name?.trim();
  if (!raw || /^IUCN\b/i.test(raw)) return null;
  return raw;
}

/** The most specific recorded geography, never a nearest-neighbour guess. */
export function labelFor(anchor) {
  return (
    specificAreaName(anchor.protectedArea) ||
    anchor.range?.name ||
    anchor.region ||
    anchor.country ||
    anchor.name
  );
}

export function formatList(values) {
  const list = values.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function titleFor(category, members, anchor) {
  const label = labelFor(anchor);
  const peaks = members.filter((member) => PEAK_CATS.has(member.cat)).length;
  if (category === "mountain") {
    return peaks >= 2 ? `Peaks of ${label}` : `Mountain country around ${anchor.name}`;
  }
  if (category === "hiking") return `Hiking ${label}`;
  if (category === "camping") return `Camping around ${label}`;
  if (category === "park") return `Exploring ${label}`;
  return `A weekend in ${label}`;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Two factual paragraphs: what the route links, and the numbers behind it.
 * No adjectives the data cannot support.
 */
export function describeExperience({
  category,
  members,
  stops,
  distanceKm,
  duration,
  label,
}) {
  const names = members.map((member) => member.name);
  const n = members.length;
  const intro =
    category === "weekend"
      ? `A weekend around ${label}, linking ${n} destinations: ${formatList(names)}.`
      : `${
          duration.days === 1 ? "A day" : `A ${duration.days}-day`
        } ${CATEGORY_NOUN[category] ?? "route"} through ${label}, linking ${n} destinations: ${formatList(names)}.`;

  const parts = [];
  const elevations = members
    .filter((member) => Number.isFinite(member.elev) && member.elev > 0)
    .sort((a, b) => a.elev - b.elev);
  if (elevations.length >= 2) {
    const low = elevations[0];
    const high = elevations[elevations.length - 1];
    parts.push(
      `Elevation runs from ${Math.round(low.elev).toLocaleString("en-US")} m at ${low.name} to ${Math.round(high.elev).toLocaleString("en-US")} m at ${high.name}.`,
    );
  } else if (elevations.length === 1) {
    parts.push(
      `${elevations[0].name} is recorded at ${Math.round(elevations[0].elev).toLocaleString("en-US")} m.`,
    );
  }

  const trailCount = members.reduce(
    (sum, member) => sum + member.trailLinks.length,
    0,
  );
  const trailStops = members.filter((member) => member.trailLinks.length > 0).length;
  if (trailStops > 0) {
    parts.push(
      `Named trails lie within 10 km of ${trailStops} of the ${n} stops${trailCount > 0 ? ` (${trailCount} in total)` : ""}.`,
    );
  }

  const protectedNames = new Map();
  for (const member of members) {
    const name = specificAreaName(member.protectedArea);
    if (name) protectedNames.set(name, (protectedNames.get(name) ?? 0) + 1);
  }
  const shared = [...protectedNames.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .find(([, count]) => count >= 2);
  if (shared) {
    parts.push(`${shared[1]} stops are recorded inside ${shared[0]}.`);
  }

  const longest = stops
    .slice(1)
    .sort((a, b) => b.legKm - a.legKm || a.index - b.index)[0];
  parts.push(
    `The stops are ${distanceKm} km apart in a straight line${
      longest ? `, with the longest leg ${longest.legKm} km` : ""
    }.`,
  );

  if (category === "camping") {
    parts.push(
      "Mapped campsites and huts around these stops are listed from OpenStreetMap cells on this page.",
    );
  }

  return { summary: intro, description: [intro, parts.join(" ")] };
}

const CATEGORY_NOUN = {
  mountain: "mountain route",
  hiking: "hiking route",
  camping: "camping route",
  park: "park route",
  weekend: "weekend",
};
