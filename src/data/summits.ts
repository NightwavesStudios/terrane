/**
 * Summit challenge lists.
 *
 * These are the lists people actually complete, not every peak the map knows:
 * the Georgia Appalachian Trail Club's 4,000-foot challenge, the AMC New
 * Hampshire 48, the Adirondack 46ers and the 58 named Colorado fourteeners.
 * Names and elevations follow the publishing club's own list. Elevations vary by
 * a few feet between surveys, which is why each list carries its source and a
 * note rather than pretending one number is the summit.
 *
 * Membership is committed editorial data, not derived from the atlas. A list
 * that says 32 peaks has 32 rows even when only a handful of those summits are
 * also charted as destination pages; `place` is set only where the summit has a
 * real page in the destination index, so the page can link to the globe without
 * inventing a slug.
 */

export type SummitPeak = {
  /** The name the publishing club uses. */
  name: string;
  /** Elevation in feet, as published by the list's source. */
  ft: number;
  /** County or area, where the source records one. */
  where?: string;
  /** Destination slug when this summit also has a Terrane page. */
  place?: string;
};

export type SummitList = {
  id: string;
  /** Full name of the challenge. */
  name: string;
  /** One or two words for a card badge. */
  badge: string;
  /** Where every summit in the list is. */
  region: string;
  country: string;
  /** Where "show this list on the globe" lands. Editorial, not a peak point. */
  center: { lat: number; lon: number };
  /** A frame that holds the list's country or range, not one summit. */
  zoom: number;
  /** One sentence for the card and the page head. */
  blurb: string;
  /** What the list is and how membership was decided. */
  note: string;
  /** The club or publisher whose list this is. */
  source: { label: string; url: string };
  peaks: SummitPeak[];
};

export const SUMMIT_LISTS: SummitList[] = [
  {
    id: "georgia-4000",
    name: "Georgia 4,000",
    badge: "Georgia",
    region: "North Georgia",
    country: "United States",
    center: { lat: 34.85, lon: -83.85 },
    zoom: 8.6,
    blurb:
      "All 32 Georgia summits over 4,000 feet, from Brasstown Bald to the viewless knobs of the southern Nantahala.",
    note: "The Georgia Appalachian Trail Club's official 32-peak challenge. Elevations and counties follow the club's 2017 list; several summits require a bushwhack and some lie on private land.",
    source: {
      label: "Georgia Appalachian Trail Club",
      url: "https://georgia-atclub.org/for-hikers/georgia-4000",
    },
    peaks: [
      { name: "Brasstown Bald", ft: 4784, where: "Towns / Union", place: "brasstown-bald" },
      { name: "Rabun Bald", ft: 4696, where: "Rabun" },
      { name: "Dicks Knob", ft: 4643, where: "Rabun" },
      { name: "Hightower Bald", ft: 4588, where: "Towns" },
      { name: "Wolfpen Ridge", ft: 4561, where: "Towns / Union" },
      { name: "Blood Mountain", ft: 4458, where: "Union", place: "blood-mountain" },
      { name: "Tray Mountain", ft: 4430, where: "Towns" },
      { name: "Grassy Ridge", ft: 4406, where: "Rabun" },
      { name: "Slaughter Mountain", ft: 4338, where: "Union" },
      { name: "Chimneytop Mountain", ft: 4303, where: "Union" },
      { name: "Double Spring Knob", ft: 4276, where: "Towns" },
      { name: "Coosa Bald", ft: 4271, where: "Union" },
      { name: "Eagle Mountain", ft: 4259, where: "Towns" },
      { name: "Flint Knob", ft: 4240, where: "Rabun" },
      { name: "Brier Creek Bald", ft: 4163, where: "Towns" },
      { name: "Rich Knob", ft: 4152, where: "Towns" },
      { name: "Cowpen Mountain", ft: 4151, where: "Fannin" },
      { name: "Sassafras Knob", ft: 4121, where: "Towns" },
      { name: "Flat Top", ft: 4114, where: "Rabun" },
      { name: "Locust Log Ridge", ft: 4108, where: "Union" },
      { name: "Alex Mountain", ft: 4080, where: "Rabun" },
      { name: "Big Bald Mountain", ft: 4076, where: "Gilmer", place: "big-bald-mountain" },
      { name: "Mayapple Knob", ft: 4054, where: "Towns" },
      { name: "Double Knob (South Peak)", ft: 4040, where: "Towns" },
      { name: "Horsetrough Mountain", ft: 4040, where: "Union" },
      { name: "Rich Mountain", ft: 4040, where: "Gilmer" },
      { name: "Rocky Mountain", ft: 4017, where: "Towns" },
      { name: "Bald Mountain", ft: 4005, where: "Murray" },
      { name: "Blue Mountain", ft: 4000, where: "Towns" },
      { name: "Rattlesnake Knob", ft: 4000, where: "Towns" },
      { name: "Spaniards Knob", ft: 4000, where: "Union" },
      { name: "Tickanetley Bald", ft: 4000, where: "Gilmer" },
    ],
  },
  {
    id: "new-hampshire-48",
    name: "New Hampshire 48",
    badge: "NH 48",
    region: "White Mountains",
    country: "United States",
    center: { lat: 44.15, lon: -71.55 },
    zoom: 8,
    blurb:
      "The AMC's classic 48: every White Mountain summit on the traditional 4,000-footer list, from Mount Washington down to Mount Tecumseh.",
    note: "The AMC 4,000-footer list. The club keeps the original 48 even where modern surveys put a summit just under 4,000 feet or just short of the old prominence rule; those quirks are part of the list, not errors in it.",
    source: {
      label: "Appalachian Mountain Club",
      url: "https://www.amc4000footer.org/",
    },
    peaks: [
      { name: "Mount Washington", ft: 6288, place: "mount-washington" },
      { name: "Mount Adams", ft: 5774, place: "mount-adams-q1840432" },
      { name: "Mount Jefferson", ft: 5712 },
      { name: "Mount Monroe", ft: 5384 },
      { name: "Mount Madison", ft: 5367 },
      { name: "Mount Lafayette", ft: 5260, place: "mount-lafayette" },
      { name: "Mount Lincoln", ft: 5089 },
      { name: "South Twin Mountain", ft: 4902 },
      { name: "Carter Dome", ft: 4832 },
      { name: "Mount Moosilauke", ft: 4802 },
      { name: "Mount Eisenhower", ft: 4780 },
      { name: "North Twin Mountain", ft: 4761 },
      { name: "Mount Carrigain", ft: 4700 },
      { name: "Mount Bond", ft: 4698 },
      { name: "Middle Carter Mountain", ft: 4610 },
      { name: "West Bond", ft: 4540 },
      { name: "Mount Garfield", ft: 4500 },
      { name: "Mount Liberty", ft: 4459 },
      { name: "South Carter Mountain", ft: 4430 },
      { name: "Wildcat Mountain (A Peak)", ft: 4422 },
      { name: "Mount Hancock", ft: 4420 },
      { name: "South Kinsman Mountain", ft: 4358 },
      { name: "Mount Field", ft: 4340 },
      { name: "Mount Osceola", ft: 4340 },
      { name: "Mount Flume", ft: 4328 },
      { name: "South Hancock", ft: 4319 },
      { name: "Mount Pierce", ft: 4310 },
      { name: "North Kinsman Mountain", ft: 4293 },
      { name: "Mount Willey", ft: 4285 },
      { name: "Bondcliff", ft: 4265 },
      { name: "Zealand Mountain", ft: 4260 },
      { name: "North Tripyramid", ft: 4180 },
      { name: "Mount Cabot", ft: 4170 },
      { name: "East Osceola", ft: 4156 },
      { name: "Middle Tripyramid", ft: 4140 },
      { name: "Cannon Mountain", ft: 4100, place: "cannon-mountain" },
      { name: "Mount Hale", ft: 4054 },
      { name: "Mount Jackson", ft: 4052 },
      { name: "Mount Tom", ft: 4051 },
      { name: "Wildcat Mountain (D Peak)", ft: 4050 },
      { name: "Mount Moriah", ft: 4049 },
      { name: "Mount Passaconaway", ft: 4043 },
      { name: "Owl's Head", ft: 4025 },
      { name: "Galehead Mountain", ft: 4024 },
      { name: "Mount Whiteface", ft: 4020 },
      { name: "Mount Waumbek", ft: 4006 },
      { name: "Mount Isolation", ft: 4004 },
      { name: "Mount Tecumseh", ft: 4003 },
    ],
  },
  {
    id: "adirondack-46",
    name: "Adirondack 46ers",
    badge: "46ers",
    region: "Adirondack High Peaks",
    country: "United States",
    center: { lat: 44.15, lon: -73.95 },
    zoom: 8.4,
    blurb:
      "The 46 High Peaks of the Adirondacks, from Mount Marcy to Couchsachraga — including the four summits below 4,000 feet that stayed on the list.",
    note: "The Adirondack 46ers' official list. Blake Peak, Cliff Mountain, Nye Mountain and Couchsachraga Peak are below 4,000 feet but remain on the 46; MacNaughton is over 4,000 feet but is not required.",
    source: {
      label: "Adirondack 46ers",
      url: "https://adk46er.org/peaks",
    },
    peaks: [
      { name: "Mount Marcy", ft: 5344 },
      { name: "Algonquin Peak", ft: 5114, place: "algonquin-peak" },
      { name: "Mount Haystack", ft: 4960 },
      { name: "Mount Skylight", ft: 4926 },
      { name: "Whiteface Mountain", ft: 4867, place: "whiteface-mountain" },
      { name: "Dix Mountain", ft: 4857 },
      { name: "Gray Peak", ft: 4840 },
      { name: "Iroquois Peak", ft: 4840 },
      { name: "Basin Mountain", ft: 4827 },
      { name: "Gothics", ft: 4736 },
      { name: "Mount Colden", ft: 4714 },
      { name: "Giant Mountain", ft: 4627 },
      { name: "Nippletop", ft: 4620 },
      { name: "Santanoni Peak", ft: 4607 },
      { name: "Mount Redfield", ft: 4606 },
      { name: "Wright Peak", ft: 4580 },
      { name: "Saddleback Mountain", ft: 4515 },
      { name: "Panther Peak", ft: 4442 },
      { name: "Table Top Mountain", ft: 4427 },
      { name: "Rocky Peak Ridge", ft: 4420 },
      { name: "Macomb Mountain", ft: 4405 },
      { name: "Armstrong Mountain", ft: 4400 },
      { name: "Hough Peak", ft: 4400 },
      { name: "Seward Mountain", ft: 4361 },
      { name: "Mount Marshall", ft: 4360 },
      { name: "Allen Mountain", ft: 4340 },
      { name: "Big Slide Mountain", ft: 4240 },
      { name: "Esther Mountain", ft: 4240 },
      { name: "Upper Wolfjaw Mountain", ft: 4185 },
      { name: "Lower Wolfjaw Mountain", ft: 4175 },
      { name: "Street Mountain", ft: 4166 },
      { name: "Phelps Mountain", ft: 4161 },
      { name: "Mount Donaldson", ft: 4140 },
      { name: "Seymour Mountain", ft: 4120 },
      { name: "Sawteeth", ft: 4100 },
      { name: "Cascade Mountain", ft: 4098 },
      { name: "South Dix", ft: 4060 },
      { name: "Porter Mountain", ft: 4059 },
      { name: "Mount Colvin", ft: 4057 },
      { name: "Mount Emmons", ft: 4040 },
      { name: "Dial Mountain", ft: 4020 },
      { name: "Grace Peak", ft: 4012 },
      { name: "Blake Peak", ft: 3960 },
      { name: "Cliff Mountain", ft: 3960 },
      { name: "Nye Mountain", ft: 3895 },
      { name: "Couchsachraga Peak", ft: 3820 },
    ],
  },
  {
    id: "colorado-14ers",
    name: "Colorado 14ers",
    badge: "14ers",
    region: "Colorado",
    country: "United States",
    center: { lat: 39, lon: -106 },
    zoom: 6.4,
    blurb:
      "The 58 named Colorado summits above 14,000 feet, from Mount Elbert in the Sawatch to the Grenadiers of the San Juan.",
    note: "The 58 named peaks over 14,000 feet in the Colorado Department of Natural Resources list. Several are unofficial sub-summits and some fourteeners are on private land; route access is not implied by this list.",
    source: {
      label: "Colorado DNR · 14ers.com",
      url: "https://data.colorado.gov/Environment/Colorado-s-Named-Peaks-greater-than-14-000-feet-ab/9333-96ac",
    },
    peaks: [
      { name: "Mount Elbert", ft: 14440, place: "mount-elbert" },
      { name: "Mount Massive", ft: 14421, place: "mount-massive" },
      { name: "Mount Harvard", ft: 14421, place: "mount-harvard" },
      { name: "Blanca Peak", ft: 14345, place: "blanca-peak" },
      { name: "La Plata Peak", ft: 14336, place: "la-plata-peak" },
      { name: "Uncompahgre Peak", ft: 14321, place: "uncompahgre-peak" },
      { name: "Crestone Peak", ft: 14294, place: "crestone-peak" },
      { name: "Mount Lincoln", ft: 14293, place: "mount-lincoln" },
      { name: "Castle Peak", ft: 14279, place: "castle-peak" },
      { name: "Grays Peak", ft: 14278, place: "grays-peak" },
      { name: "Mount Antero", ft: 14276, place: "mount-antero" },
      { name: "Torreys Peak", ft: 14275, place: "torreys-peak" },
      { name: "Quandary Peak", ft: 14271, place: "quandary-peak" },
      { name: "Mount Blue Sky", ft: 14265, place: "mount-blue-sky" },
      { name: "Longs Peak", ft: 14259, place: "longs-peak" },
      { name: "Mount Wilson", ft: 14246 },
      { name: "Mount Cameron", ft: 14238 },
      { name: "Mount Shavano", ft: 14231, place: "mount-shavano" },
      { name: "Mount Princeton", ft: 14204, place: "mount-princeton" },
      { name: "Mount Belford", ft: 14203, place: "mount-belford" },
      { name: "Mount Yale", ft: 14200 },
      { name: "Crestone Needle", ft: 14197, place: "crestone-needle" },
      { name: "Mount Bross", ft: 14172, place: "mount-bross" },
      { name: "Kit Carson Peak", ft: 14165, place: "kit-carson-peak" },
      { name: "Maroon Peak", ft: 14163 },
      { name: "Tabeguache Peak", ft: 14162 },
      { name: "Mount Oxford", ft: 14160, place: "mount-oxford" },
      { name: "El Diente Peak", ft: 14159 },
      { name: "Mount Democrat", ft: 14155, place: "mount-democrat" },
      { name: "Mount Sneffels", ft: 14150, place: "mount-sneffels" },
      { name: "Capitol Peak", ft: 14130, place: "capitol-peak" },
      { name: "Pikes Peak", ft: 14115, place: "pikes-peak" },
      { name: "Snowmass Mountain", ft: 14099, place: "snowmass-mountain" },
      { name: "Mount Eolus", ft: 14083, place: "mount-eolus" },
      { name: "Windom Peak", ft: 14082 },
      { name: "Challenger Point", ft: 14081, place: "challenger-point" },
      { name: "Mount Columbia", ft: 14077, place: "mount-columbia-q6920212" },
      { name: "Missouri Mountain", ft: 14074 },
      { name: "Humboldt Peak", ft: 14064, place: "humboldt-peak-q8521770" },
      { name: "Mount Bierstadt", ft: 14060, place: "mount-bierstadt" },
      { name: "Conundrum Peak", ft: 14060 },
      { name: "Sunlight Peak", ft: 14059 },
      { name: "Handies Peak", ft: 14058, place: "handies-peak" },
      { name: "Culebra Peak", ft: 14047, place: "culebra-peak" },
      { name: "Ellingwood Point", ft: 14042 },
      { name: "Mount Lindsey", ft: 14042 },
      { name: "North Eolus", ft: 14039 },
      { name: "Little Bear Peak", ft: 14037 },
      { name: "Mount Sherman", ft: 14036, place: "mount-sherman" },
      { name: "Redcloud Peak", ft: 14034 },
      { name: "Pyramid Peak", ft: 14025 },
      { name: "North Maroon Peak", ft: 14019 },
      { name: "Wilson Peak", ft: 14017 },
      { name: "Wetterhorn Peak", ft: 14015, place: "wetterhorn-peak" },
      { name: "San Luis Peak", ft: 14014 },
      { name: "Huron Peak", ft: 14010, place: "huron-peak" },
      { name: "Mount of the Holy Cross", ft: 14009, place: "mount-of-the-holy-cross" },
      { name: "Sunshine Peak", ft: 14001 },
    ],
  },
];

/** Stable id for one peak in one list; the climb log stores these. */
export function summitSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function peakId(listId: string, peakName: string): string {
  return `${listId}/${summitSlug(peakName)}`;
}

export function summitList(id: string): SummitList | undefined {
  return SUMMIT_LISTS.find((list) => list.id === id);
}

export function feetToMetres(ft: number): number {
  return Math.round(ft * 0.3048);
}

export const SUMMIT_PEAK_COUNT = SUMMIT_LISTS.reduce(
  (sum, list) => sum + list.peaks.length,
  0,
);

/** A peak as it belongs to one sourced list. */
export type ListMembership = { list: SummitList; peak: SummitPeak };

/**
 * The mapped members of the lists, by place slug.
 *
 * A list peak has a globe point only when it also has a real place page; this
 * lookup never invents a coordinate for the other peaks.
 */
export const LISTED_BY_PLACE = new Map<string, ListMembership[]>();
for (const list of SUMMIT_LISTS) {
  for (const peak of list.peaks) {
    if (!peak.place) continue;
    const rows = LISTED_BY_PLACE.get(peak.place) ?? [];
    rows.push({ list, peak });
    LISTED_BY_PLACE.set(peak.place, rows);
  }
}

export function listsForPlace(slug?: string): ListMembership[] {
  return slug ? LISTED_BY_PLACE.get(slug) ?? [] : [];
}
