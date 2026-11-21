/**
 * The experience generator's pure half.
 *
 * An experience is a collection of remarkable places in one region, not an
 * itinerary. These helpers group destinations that belong together on the
 * ground, classify the group from recorded facts, and compose prose that says
 * what the collection contains. They deliberately contain no walking model, no
 * day planning and no distance-between-stops claim: the data can support "these
 * places are here, and each has a source", not "walk this way".
 *
 * Everything is a function of the committed destination, detail and trail-link
 * data: no clock, no network, no randomness, so two runs on the same commit
 * produce the same files.
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

/** A verified place: its Terrane page, its position and the Wikipedia article
    the detail harvest recorded. No source, no stop. */
export function isVerifiedCandidate(candidate) {
  return (
    typeof candidate.wiki === "string" &&
    /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/\S+$/i.test(candidate.wiki) &&
    Number.isFinite(candidate.lat) &&
    Number.isFinite(candidate.lon)
  );
}

/**
 * How good a destination is as the anchor of a collection.
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
  if (candidate.wiki) score += 10;
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
        tier: destination.tier ?? 4,
        country: destination.country,
        region: destination.region,
        elev: destination.elevation ?? detail.elev ?? null,
        desc: detail.desc ?? "",
        wiki: typeof detail.wiki === "string" ? detail.wiki : null,
        commons: typeof detail.commons === "string" ? detail.commons : null,
        wd: typeof detail.wd === "string" ? detail.wd : null,
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
 * Grow a collection outward from one seed.
 *
 * A candidate joins when it is within the corridor of a place already in the
 * group, the group still fits its span, and no category has more than three
 * places. The best next place balances fame against distance and rewards a new
 * category, so a collection is a mix of things rather than four summits in a row.
 */
export function expandCluster(seed, index, used, options = {}) {
  const {
    maxStops = 8,
    corridorKm = 40,
    maxSpanKm = 120,
    perCategory = 3,
    country = null,
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
        /* A collection is labelled with one country, so it must not borrow a
           neighbour's summit to fill a row. Border ranges become one
           collection on each side, which is what the records actually say. */
        if (country && candidate.country !== country) continue;
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
 * The category a finished collection earns.
 *
 * Rules read recorded facts only: destination categories, elevations, named
 * trails nearby, recorded protected areas, and the name/description words that
 * tell us a camp or hut is one of the places. Order matters — camping needs
 * evidence and water or park context, parks claim majority park groups, and a
 * compact mixed group is a short escape.
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
     practical shape of a camping collection even where the destination set
     records no campsite. Campsites themselves are listed from the POI cells on
     the page, never asserted here. */
  if (water && trailStops >= 2 && spanKm(members) <= 80) return "camping";
  if (trailCount >= 3 && trailStops >= 2) return "hiking";
  if (spanKm(members) <= 80) return "weekend";
  return null;
}

/** Places ordered by evidence, not by travel: the most notable first. */
export function collectionOrder(members) {
  return [...members].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
}

/**
 * The protected-area name, when it is a name rather than a classification.
 * Wikidata's P814 is often the generic `IUCN category II: National Park`, which
 * says nothing about where the collection is and must never become a title.
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

/** Readable names for the recorded categories, singular and plural. */
const KIND_NAMES = {
  peak: ["peak", "peaks"],
  volcano: ["volcano", "volcanoes"],
  glacier: ["glacier", "glaciers"],
  range: ["range", "ranges"],
  park: ["park", "parks"],
  reserve: ["reserve", "reserves"],
  lake: ["lake", "lakes"],
  waterfall: ["waterfall", "waterfalls"],
  valley: ["valley", "valleys"],
  island: ["island", "islands"],
  beach: ["beach", "beaches"],
  cave: ["cave", "caves"],
  spring: ["spring", "springs"],
  river: ["river", "rivers"],
  landmark: ["landmark", "landmarks"],
};

/** The atlas category is coarse (a glacier is a `landmark`); the recorded name
    and Wikidata description are specific, so they decide the readable kind. */
function kindOf(member) {
  const text = `${member.name} ${member.desc ?? ""}`.toLowerCase();
  const hints = [
    ["glacier", "glacier"],
    ["waterfall", "waterfall"],
    ["cave", "cave"],
    ["valley", "valley"],
    ["nature reserve", "reserve"],
    ["national park", "park"],
    ["lake", "lake"],
    ["island", "island"],
    ["beach", "beach"],
    ["spring", "spring"],
    ["range", "range"],
    ["volcano", "volcano"],
    ["mountain", "peak"],
  ];
  for (const [word, cat] of hints) {
    if (text.includes(word)) return cat;
  }
  return member.cat;
}

/** "3 peaks, 2 glaciers and a national park" — counted, not characterised. */
export function kindPhrase(members) {
  const counts = new Map();
  for (const member of members) {
    const cat = kindOf(member);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([cat, count]) => {
      const [one, many] = KIND_NAMES[cat] ?? KIND_NAMES.landmark;
      if (count === 1) return cat === "park" ? "a national park" : `a ${one}`;
      return `${count} ${many}`;
    });
  return formatList(parts);
}

/**
 * Title, summary and evidence paragraph for one collection.
 *
 * The summary says what is in the collection and where it is. The second
 * paragraph says how it is verified. Neither says how to travel between the
 * places, because the committed data does not record a route.
 */
export function describeCollection({
  members,
  label,
  country,
  span,
  trailCount,
  photoCount,
}) {
  const photos =
    Number.isFinite(photoCount)
      ? photoCount
      : members.filter((member) => member.photos.length > 0).length;
  const where = country && country !== label ? `${label}, ${country}` : label;
  const summary =
    `A collection of ${members.length} remarkable places across ${where}: ` +
    `${kindPhrase(members)}, within ${Math.round(span)} km of each other.`;

  const evidence =
    `Every place links to its Terrane page and to a Wikipedia article` +
    `${photos ? `; ${photos} of ${members.length} have a credited Wikimedia Commons photograph` : ""}` +
    `${
      trailCount
        ? `; ${trailCount} named trail${trailCount === 1 ? " is" : "s are"} recorded within 10 km of the places`
        : ""
    }. Campsites, huts and trailheads are listed from OpenStreetMap cells when the ` +
    `page loads, never inferred here.`;

  return { summary, description: [summary, evidence] };
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
