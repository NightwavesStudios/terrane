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

/* ── walking model ────────────────────────────────────────────────
   These routes are walked. Naismith's rule is the standard estimate: flat pace
   plus a climb allowance. The distances are still straight lines between stops,
   so the result is a floor for the ground, and every surface states that. */

export const WALK_KMH = 4.5;
export const ASCENT_M_PER_HOUR = 600;
const DAY_HOURS = 6;
const DAY_MAX_KM = 20;
const STOP_PAUSE_HOURS = 0.5;

/** Walking hours for a leg, including its climb. */
export function walkHours(km, ascentM = 0) {
  return km / WALK_KMH + ascentM / ASCENT_M_PER_HOUR;
}

/** Ascent from one stop to the next, where both record an elevation. */
export function ascentBetween(previous, stop) {
  if (!Number.isFinite(previous?.elev) || !Number.isFinite(stop?.elev)) return 0;
  return Math.max(0, stop.elev - previous.elev);
}

/**
 * Split the route into walking days.
 *
 * Stops are not evenly spaced: a leg can be 40 km, which is two days of walking
 * with a night somewhere in between. So days are cut by walking time along the
 * line, splitting a long leg proportionally instead of pretending it is one day.
 * Each day records its start and end names (a stop, or "between A and B"), its
 * km, hours and climb, the stops it reaches, and the last stop reached — the
 * place to look for a bed that night.
 */
export function itineraryFor(stops) {
  const cumulative = [0];
  for (let i = 1; i < stops.length; i += 1) {
    cumulative.push(round(cumulative[i - 1] + stops[i].legKm, 3));
  }
  const totalKm = cumulative[cumulative.length - 1] ?? 0;
  const nameAt = (km) => {
    for (let i = 0; i < stops.length; i += 1) {
      if (Math.abs(cumulative[i] - km) <= 0.3) return stops[i].name;
    }
    if (km <= 0) return stops[0].name;
    if (km >= totalKm) return stops[stops.length - 1].name;
    for (let i = 1; i < stops.length; i += 1) {
      if (km < cumulative[i]) {
        /* A night mid-leg is stated by distance from the last stop, which is
           more useful than "between X and Y" repeated on consecutive days. */
        return `${stops[i - 1].name} +${Math.round(km - cumulative[i - 1])} km`;
      }
    }
    return stops[stops.length - 1].name;
  };

  const stopAt = (km) => {
    let last = 0;
    for (let i = 0; i < stops.length; i += 1) {
      if (cumulative[i] <= km + 0.05) last = i + 1;
    }
    return last;
  };

  const days = [];
  let startKm = 0;
  let km = 0;
  let hours = 0;
  let ascentM = 0;

  const close = (endKm) => {
    const stopFrom = stopAt(startKm);
    const stopTo = Math.max(stopFrom, stopAt(endKm));
    let highPoint;
    for (let i = stopFrom; i <= stopTo && i <= stops.length; i += 1) {
      const elev = stops[i - 1]?.elev;
      if (Number.isFinite(elev)) highPoint = Math.max(highPoint ?? elev, elev);
    }
    days.push({
      day: days.length + 1,
      fromName: nameAt(startKm),
      toName: nameAt(endKm),
      stopFrom,
      stopTo,
      km: round(km, 1),
      hours: round(hours, 1),
      ascentM: Math.round(ascentM),
      ...(highPoint == null ? {} : { highPoint: Math.round(highPoint) }),
    });
    startKm = endKm;
    km = 0;
    hours = 0;
    ascentM = 0;
  };

  for (let i = 1; i < stops.length; i += 1) {
    const legKm = stops[i].legKm;
    const legAscent = ascentBetween(stops[i - 1], stops[i]);
    const legHours = walkHours(legKm, legAscent);
    if (legKm <= 0.01) continue;

    let consumed = 0;
    const hoursPerKm = legHours / legKm;
    while (consumed < legKm - 0.01) {
      const kmRoom = DAY_MAX_KM - km;
      const hourRoom = DAY_HOURS - hours;
      const take = Math.min(
        legKm - consumed,
        kmRoom,
        hoursPerKm > 0 ? hourRoom / hoursPerKm : kmRoom,
      );

      if (take <= 0.05) {
        if (km > 0.05 || hours > 0.05) {
          close(cumulative[i - 1] + consumed);
          continue;
        }
        /* A leg so steep that one hour of climb covers almost no ground: no
           day size can split it, so it is walked as a single day. Without this
           the loop closes empty days forever. */
        const forced = legKm - consumed;
        km += forced;
        hours += forced * hoursPerKm;
        ascentM += (legAscent * forced) / legKm;
        consumed = legKm;
        close(cumulative[i]);
        break;
      }

      km += take;
      hours += take * hoursPerKm;
      ascentM += (legAscent * take) / legKm;
      consumed += take;

      if (
        consumed < legKm - 0.01 &&
        (DAY_MAX_KM - km <= 0.05 || DAY_HOURS - hours <= 0.05)
      ) {
        close(cumulative[i - 1] + consumed);
      }
    }
  }

  close(totalKm);
  return days.length > 0
    ? days
    : [
        {
          day: 1,
          fromName: stops[0]?.name ?? "",
          toName: stops[0]?.name ?? "",
          stopFrom: 1,
          stopTo: 1,
          km: 0,
          hours: 0,
          ascentM: 0,
        },
      ];
}

/** Total walking time, the per-day plan and the ascent the route accumulates. */
export function walkingModel(stops) {
  const itinerary = itineraryFor(stops);
  const walking = itinerary.reduce((sum, day) => sum + day.hours, 0);
  const ascentM = itinerary.reduce((sum, day) => sum + day.ascentM, 0);
  const hours = round(
    Math.round((walking + stops.length * STOP_PAUSE_HOURS) * 2) / 2,
    1,
  );
  return { itinerary, hours, days: itinerary.length, ascentM };
}

/**
 * Difficulty from the daily shape, not from the category.
 *
 * The thresholds are stated on the page so the grade is auditable: a route is
 * only "hard" because a recorded day is long, climbs a lot, or reaches high
 * ground. Straight-line distance understates the ground, so the grade is a
 * floor in the same way the estimate is.
 */
export function difficultyFor(itinerary, stops) {
  const maxDayKm = Math.max(...itinerary.map((day) => day.km), 0);
  const maxDayAscent = Math.max(...itinerary.map((day) => day.ascentM), 0);
  const elevations = stops
    .map((stop) => stop.elev)
    .filter((value) => Number.isFinite(value) && value > 0);
  const highPoint = elevations.length ? Math.max(...elevations) : 0;

  let level = "moderate";
  if (maxDayKm <= 14 && maxDayAscent <= 300 && highPoint <= 1500) level = "easy";
  if (maxDayKm > 22 || maxDayAscent > 800 || highPoint > 3000) level = "hard";

  return {
    level,
    maxDayKm: round(maxDayKm, 1),
    maxDayAscent,
    highPoint: highPoint > 0 ? highPoint : null,
  };
}

export function difficultyBasis(level) {
  return (
    {
      easy: "Easy: days of up to 14 km and 300 m of ascent, staying below 1,500 m.",
      moderate:
        "Moderate: days of up to 22 km and 800 m of ascent, staying below 3,000 m.",
      hard: "Hard: more than 22 km or 800 m of ascent in a day, or ground above 3,000 m.",
    }[level] ?? ""
  );
}

export function walkingBasis() {
  return `On foot: Naismith's rule at ${WALK_KMH} km/h plus 1 h per ${ASCENT_M_PER_HOUR} m of ascent, on straight-line stop distances, plus ${STOP_PAUSE_HOURS * 60} min at each stop.`;
}

/** The closest recorded trail at each of a day's stops, deduplicated by name. */
export function trailsForDay(day, stops) {
  const out = [];
  const seen = new Set();
  const first = Math.max(1, day.stopFrom);
  const last = Math.min(stops.length, Math.max(day.stopTo, first));
  for (let index = first; index <= last; index += 1) {
    const stop = stops[index - 1];
    const nearest = [...(stop.trails ?? stop.trailLinks ?? [])]
      .filter((trail) => trail?.name)
      .sort(
        (a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name),
      )[0];
    if (!nearest) continue;
    const key = nearest.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: nearest.name,
      km: nearest.km,
      stop: index,
      ...(nearest.difficulty ? { difficulty: nearest.difficulty } : {}),
    });
  }
  return out.slice(0, 3);
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

/**
 * A route is named after the ground it crosses, not after the category.
 *
 * The category already has a badge, a filter and a sentence; prefixing every
 * title with "Camping around" or "A weekend in" made 599 routes read like one
 * template. The most specific recorded name — protected area, then range, then
 * the anchor destination — is the title, and the caller disambiguates duplicates
 * with the region or country.
 */
export function titleFor(category, members, anchor) {
  return (
    specificAreaName(anchor.protectedArea) ||
    anchor.range?.name ||
    anchor.name
  );
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
  difficulty,
  itinerary,
  label,
}) {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const dayText = duration.days === 1 ? "One day" : `${duration.days} days`;
  const summary = `${dayText} on foot across ${label}, from ${first.name} to ${last.name}: ${stops.length} stops, ${distanceKm} km apart in a straight line.`;

  const parts = [];

  /* The trails, by name, at the stop they are nearest. This is the most concrete
     thing the committed data can say about which path to take. */
  const trailLines = [];
  for (const stop of stops) {
    const nearest = [...(stop.trails ?? stop.trailLinks ?? [])]
      .filter((trail) => trail?.name)
      .sort(
        (a, b) => (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name),
      )[0];
    if (nearest) {
      trailLines.push(`${nearest.name} (${nearest.km} km from ${stop.name})`);
    }
  }
  if (trailLines.length > 0) {
    parts.push(
      `Recorded trails nearest the stops: ${formatList(trailLines.slice(0, 4))}${
        trailLines.length > 4 ? `, and ${trailLines.length - 4} more` : ""
      }.`,
    );
  } else {
    parts.push("No named trail is recorded within 10 km of these stops.");
  }
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

  const longest = [...itinerary].sort(
    (a, b) => b.km - a.km || a.day - b.day,
  )[0];
  const climb = [...itinerary].sort(
    (a, b) => b.ascentM - a.ascentM || a.day - b.day,
  )[0];
  parts.push(
    `${difficultyBasis(difficulty.level)}${
      longest ? ` The longest day is ${longest.km} km` : ""
    }${climb && climb.ascentM > 0 ? `, with up to ${climb.ascentM} m of ascent` : ""}.`,
  );
  parts.push(
    `Distances are straight lines between stops, not trail distance; ${distanceKm} km in total.`,
  );

  if (category === "camping") {
    parts.push(
      "Campsites and huts near each stop come from OpenStreetMap cells and are listed on this page.",
    );
  }

  return { summary, description: [summary, parts.join(" ")] };
}
