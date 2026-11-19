import atlasRaw from "./atlas.json";
import { kmBetween } from "../lib/geo";

/** Every place is somewhere you go outside. No cities, no built monuments. */
export type PlaceType = "peak" | "park" | "landmark" | "gem";

export interface Place {
  slug: string;
  name: string;
  type: PlaceType;
  /** State, province or range — the line under the name. */
  region?: string;
  country: string;
  lat: number;
  lon: number;
  /** Metres. Present for anything with a summit or a known high point. */
  elevation?: number;
  /** One line, written to be read on a marker card. Max ~70 chars. */
  tagline: string;
  /** 1 gentle → 5 severe. Only present on written-up places. */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Drives the gradient art on cards and the place hero. */
  hue: number;
  featured?: boolean;
  /** Hand-written field guide, as opposed to a structured atlas record. */
  curated?: boolean;
  /** True for the hand-written field guides, so provenance survives ranking. */
  editorial?: boolean;
  /** Reveal band (0 world … 5 tail), assigned by `rankPlaces`. */
  band?: number;
  /** Wikidata item, for atlas records. */
  wd?: string;
  /** Every other row that described this same place, so a merge keeps its sources. */
  also?: { src?: "atlas" | "editorial" | "wikidata"; id?: string; name?: string }[];
}

export const TYPE_LABEL: Record<PlaceType, string> = {
  peak: "Peak",
  park: "Park",
  landmark: "Landmark",
  gem: "Hidden gem",
};

export const TYPE_LABEL_PLURAL: Record<PlaceType, string> = {
  peak: "Peaks",
  park: "Parks",
  landmark: "Landmarks",
  gem: "Hidden gems",
};

const CURATED: Place[] = [
  /* ── The greats ─────────────────────────────────────────── */
  {
    slug: "torres-del-paine",
    name: "Torres del Paine",
    type: "park",
    region: "Magallanes",
    country: "Chile",
    lat: -51.0,
    lon: -73.0,
    elevation: 2884,
    tagline: "Three granite towers, one long walk, and the wind to match.",
    difficulty: 4,
    hue: 200,
    featured: true,
  },
  {
    slug: "fitz-roy",
    name: "Monte Fitz Roy",
    type: "peak",
    region: "Santa Cruz",
    country: "Argentina",
    lat: -49.271,
    lon: -73.043,
    elevation: 3405,
    tagline: "The most photographed rock face in South America.",
    difficulty: 4,
    hue: 205,
    wd: "Q215138",
    also: [{ src: "atlas", id: "Q215138", name: "Mount Fitz Roy" }],
  },
  {
    slug: "tre-cime",
    name: "Tre Cime di Lavaredo",
    type: "peak",
    region: "Dolomites",
    country: "Italy",
    lat: 46.618,
    lon: 12.303,
    elevation: 2999,
    tagline: "Three limestone towers you can circle in an afternoon.",
    difficulty: 2,
    hue: 195,
    featured: true,
  },
  {
    slug: "matterhorn",
    name: "Matterhorn",
    type: "peak",
    region: "Valais",
    country: "Switzerland",
    lat: 45.976,
    lon: 7.658,
    elevation: 4478,
    tagline: "The mountain that taught everyone what a mountain should look like.",
    difficulty: 3,
    hue: 210,
  },
  {
    slug: "mont-blanc",
    name: "Mont Blanc",
    type: "peak",
    region: "Haute-Savoie",
    country: "France",
    lat: 45.833,
    lon: 6.865,
    elevation: 4808,
    tagline: "Western Europe's roof, and the valley that lives off it.",
    difficulty: 4,
    hue: 215,
  },
  {
    slug: "yosemite",
    name: "Yosemite",
    type: "park",
    region: "California",
    country: "United States",
    lat: 37.745,
    lon: -119.533,
    tagline: "A valley built at a scale that makes people go quiet.",
    difficulty: 2,
    hue: 150,
    featured: true,
  },
  {
    slug: "sequoia",
    name: "Sequoia & Kings Canyon",
    type: "park",
    region: "California",
    country: "United States",
    lat: 36.486,
    lon: -118.566,
    tagline: "Trees that make the rest of the forest look like undergrowth.",
    difficulty: 2,
    hue: 145,
  },
  {
    slug: "zion",
    name: "Zion",
    type: "park",
    region: "Utah",
    country: "United States",
    lat: 37.298,
    lon: -113.026,
    tagline: "Red walls, a cold river, and one very exposed ridge.",
    difficulty: 4,
    hue: 20,
  },
  {
    slug: "bryce-canyon",
    name: "Bryce Canyon",
    type: "park",
    region: "Utah",
    country: "United States",
    lat: 37.593,
    lon: -112.187,
    tagline: "An amphitheatre of hoodoos that looks made up.",
    difficulty: 2,
    hue: 16,
  },
  {
    slug: "arches",
    name: "Arches",
    type: "park",
    region: "Utah",
    country: "United States",
    lat: 38.733,
    lon: -109.59,
    tagline: "Two thousand stone spans, and one you have seen a thousand times.",
    difficulty: 2,
    hue: 24,
  },
  {
    slug: "grand-canyon",
    name: "Grand Canyon",
    type: "park",
    region: "Arizona",
    country: "United States",
    lat: 36.107,
    lon: -112.112,
    tagline: "The one place that is bigger than its photographs.",
    difficulty: 3,
    hue: 18,
  },
  {
    slug: "yellowstone",
    name: "Yellowstone",
    type: "park",
    region: "Wyoming",
    country: "United States",
    lat: 44.428,
    lon: -110.588,
    tagline: "A volcano with a boardwalk over the top of it.",
    difficulty: 1,
    hue: 140,
  },
  {
    slug: "glacier",
    name: "Glacier",
    type: "park",
    region: "Montana",
    country: "United States",
    lat: 48.76,
    lon: -113.787,
    tagline: "Going-to-the-Sun Road, and the last of the real glaciers.",
    difficulty: 3,
    hue: 200,
  },
  {
    slug: "acadia",
    name: "Acadia",
    type: "park",
    region: "Maine",
    country: "United States",
    lat: 44.35,
    lon: -68.21,
    tagline: "The first sunlight in the United States, on granite and spruce.",
    difficulty: 2,
    hue: 190,
  },
  {
    slug: "rainier",
    name: "Mount Rainier",
    type: "peak",
    region: "Washington",
    country: "United States",
    lat: 46.852,
    lon: -121.76,
    elevation: 4392,
    tagline: "A glacier-covered volcano you can see from Seattle.",
    difficulty: 4,
    hue: 205,
  },
  {
    slug: "denali",
    name: "Denali",
    type: "peak",
    region: "Alaska",
    country: "United States",
    lat: 63.069,
    lon: -151.007,
    elevation: 6190,
    tagline: "The biggest mountain in North America, by a wide margin.",
    difficulty: 5,
    hue: 210,
  },
  {
    slug: "olympic",
    name: "Olympic",
    type: "park",
    region: "Washington",
    country: "United States",
    lat: 47.802,
    lon: -123.604,
    tagline: "Rainforest, alpine and wild coast in one park.",
    difficulty: 2,
    hue: 165,
  },
  {
    slug: "great-smoky",
    name: "Great Smoky Mountains",
    type: "park",
    region: "Tennessee",
    country: "United States",
    lat: 35.611,
    lon: -83.489,
    tagline: "The blue ridgeline that gave the Appalachians their name.",
    difficulty: 2,
    hue: 135,
  },
  {
    slug: "shenandoah",
    name: "Shenandoah",
    type: "park",
    region: "Virginia",
    country: "United States",
    lat: 38.53,
    lon: -78.35,
    tagline: "Skyline Drive, and a ridge that runs the whole length of it.",
    difficulty: 2,
    hue: 120,
  },
  {
    slug: "big-sur",
    name: "Big Sur",
    type: "gem",
    region: "California",
    country: "United States",
    lat: 36.27,
    lon: -121.81,
    tagline: "Ninety miles of cliff, fog and one very good road.",
    difficulty: 1,
    hue: 195,
  },
  {
    slug: "antelope-canyon",
    name: "Antelope Canyon",
    type: "landmark",
    region: "Arizona",
    country: "United States",
    lat: 36.861,
    lon: -111.374,
    tagline: "Sandstone carved into a slot of moving light.",
    difficulty: 1,
    hue: 28,
  },
  {
    slug: "hawaii-volcanoes",
    name: "Hawaiʻi Volcanoes",
    type: "park",
    region: "Hawaiʻi",
    country: "United States",
    lat: 19.42,
    lon: -155.29,
    tagline: "An active volcano you can walk up to.",
    difficulty: 1,
    hue: 12,
  },
  {
    slug: "na-pali",
    name: "Nā Pali Coast",
    type: "gem",
    region: "Kauaʻi",
    country: "United States",
    lat: 22.18,
    lon: -159.65,
    tagline: "Fluted sea cliffs with no road to them at all.",
    difficulty: 5,
    hue: 175,
  },
  {
    slug: "banff",
    name: "Banff",
    type: "park",
    region: "Alberta",
    country: "Canada",
    lat: 51.496,
    lon: -115.928,
    tagline: "Turquoise lakes under a wall of peaks.",
    difficulty: 2,
    hue: 200,
  },
  {
    slug: "jasper",
    name: "Jasper",
    type: "park",
    region: "Alberta",
    country: "Canada",
    lat: 52.873,
    lon: -117.954,
    tagline: "Banff's quieter, darker neighbour.",
    difficulty: 2,
    hue: 205,
  },
  {
    slug: "landmannalaugar",
    name: "Landmannalaugar",
    type: "gem",
    region: "Highlands",
    country: "Iceland",
    lat: 63.99,
    lon: -19.06,
    tagline: "Rhyolite mountains in colours that should not occur.",
    difficulty: 3,
    hue: 30,
  },
  {
    slug: "faroe-islands",
    name: "Faroe Islands",
    type: "gem",
    region: "Faroe Islands",
    country: "Denmark",
    lat: 62.0,
    lon: -6.8,
    tagline: "Eighteen islands, more sheep than people, and permanent weather.",
    difficulty: 3,
    hue: 185,
  },
  {
    slug: "lofoten",
    name: "Lofoten",
    type: "gem",
    region: "Nordland",
    country: "Norway",
    lat: 68.15,
    lon: 13.6,
    tagline: "Arctic peaks rising straight out of a turquoise sea.",
    difficulty: 3,
    hue: 215,
  },
  {
    slug: "milford-sound",
    name: "Milford Sound",
    type: "landmark",
    region: "Fiordland",
    country: "New Zealand",
    lat: -44.64,
    lon: 167.9,
    tagline: "Mitre Peak, 1,700 metres, straight up from the water.",
    difficulty: 2,
    hue: 190,
  },
  {
    slug: "everest",
    name: "Everest",
    type: "peak",
    region: "Khumbu",
    country: "Nepal",
    lat: 27.99,
    lon: 86.93,
    elevation: 8849,
    tagline: "The high point of the planet, seen properly from Kala Patthar.",
    difficulty: 5,
    hue: 210,
  },
  {
    slug: "zhangjiajie",
    name: "Zhangjiajie",
    type: "landmark",
    region: "Hunan",
    country: "China",
    lat: 29.32,
    lon: 110.43,
    tagline: "Sandstone pillars that inspired a floating-mountain film.",
    difficulty: 2,
    hue: 130,
  },
  {
    slug: "halong-bay",
    name: "Hạ Long Bay",
    type: "landmark",
    region: "Quảng Ninh",
    country: "Vietnam",
    lat: 20.91,
    lon: 107.18,
    tagline: "Two thousand limestone islands in a sheltered sea.",
    difficulty: 1,
    hue: 165,
  },
  {
    slug: "iguazu-falls",
    name: "Iguazú Falls",
    type: "park",
    region: "Misiones",
    country: "Argentina",
    lat: -25.695,
    lon: -54.437,
    tagline: "275 falls on one basalt ledge, with a walkway over the throat.",
    difficulty: 1,
    hue: 170,
  },
  {
    slug: "victoria-falls",
    name: "Victoria Falls",
    type: "landmark",
    region: "Matabeleland North",
    country: "Zimbabwe",
    lat: -17.924,
    lon: 25.857,
    tagline: "A mile-wide curtain of water, heard before it is seen.",
    difficulty: 1,
    hue: 160,
  },
  {
    slug: "uluru",
    name: "Uluru",
    type: "landmark",
    region: "Northern Territory",
    country: "Australia",
    lat: -25.345,
    lon: 131.036,
    tagline: "A single red monolith on an empty plain.",
    difficulty: 2,
    hue: 15,
  },

  /* ── Georgia ────────────────────────────────────────────── */
  {
    slug: "tallulah-gorge",
    name: "Tallulah Gorge",
    type: "gem",
    region: "Rabun County, Georgia",
    country: "United States",
    lat: 34.74,
    lon: -83.39,
    elevation: 305,
    tagline: "A thousand-foot gorge an hour and a half from Atlanta.",
    difficulty: 3,
    hue: 140,
    featured: true,
  },
  {
    slug: "amicalola-falls",
    name: "Amicalola Falls",
    type: "park",
    region: "Dawson County, Georgia",
    country: "United States",
    lat: 34.566,
    lon: -84.247,
    elevation: 222,
    tagline: "729 feet in one drop, and the approach to the Appalachian Trail.",
    difficulty: 3,
    hue: 148,
  },
  {
    slug: "brasstown-bald",
    name: "Brasstown Bald",
    type: "peak",
    region: "Towns County, Georgia",
    country: "United States",
    lat: 34.874,
    lon: -83.811,
    elevation: 1458,
    tagline: "The highest point in Georgia, and you can see four states.",
    difficulty: 1,
    hue: 132,
    featured: true,
  },
  {
    slug: "blood-mountain",
    name: "Blood Mountain",
    type: "peak",
    region: "Union County, Georgia",
    country: "United States",
    lat: 34.736,
    lon: -83.937,
    elevation: 1358,
    tagline: "The AT's high point in Georgia, over bare granite.",
    difficulty: 3,
    hue: 136,
  },
  {
    slug: "yonah-mountain",
    name: "Yonah Mountain",
    type: "peak",
    region: "White County, Georgia",
    country: "United States",
    lat: 34.63,
    lon: -83.72,
    elevation: 963,
    tagline: "A granite dome that looks like it belongs in Yosemite.",
    difficulty: 3,
    hue: 142,
  },
  {
    slug: "rabun-bald",
    name: "Rabun Bald",
    type: "peak",
    region: "Rabun County, Georgia",
    country: "United States",
    lat: 34.99,
    lon: -83.3,
    elevation: 1424,
    tagline: "Georgia's second-highest summit, with a fire tower on top.",
    difficulty: 2,
    hue: 138,
  },
  {
    slug: "tray-mountain",
    name: "Tray Mountain",
    type: "peak",
    region: "Towns County, Georgia",
    country: "United States",
    lat: 34.8,
    lon: -83.68,
    elevation: 1310,
    tagline: "A grassy bald on the Appalachian Trail with no crowds.",
    difficulty: 2,
    hue: 134,
  },
  {
    slug: "springer-mountain",
    name: "Springer Mountain",
    type: "peak",
    region: "Gilmer County, Georgia",
    country: "United States",
    lat: 34.63,
    lon: -84.19,
    elevation: 1152,
    tagline: "Where the Appalachian Trail begins — or ends.",
    difficulty: 3,
    hue: 130,
  },
  {
    slug: "cloudland-canyon",
    name: "Cloudland Canyon",
    type: "park",
    region: "Walker County, Georgia",
    country: "United States",
    lat: 34.81,
    lon: -85.39,
    tagline: "Two waterfalls at the bottom of a very steep staircase.",
    difficulty: 4,
    hue: 146,
    featured: true,
  },
  {
    slug: "providence-canyon",
    name: "Providence Canyon",
    type: "gem",
    region: "Stewart County, Georgia",
    country: "United States",
    lat: 32.06,
    lon: -84.92,
    tagline: "Georgia's little Grand Canyon, and it is entirely our fault.",
    difficulty: 2,
    hue: 22,
  },
  {
    slug: "okefenokee",
    name: "Okefenokee Swamp",
    type: "park",
    region: "Charlton County, Georgia",
    country: "United States",
    lat: 30.74,
    lon: -82.13,
    tagline: "A blackwater swamp the size of a small state.",
    difficulty: 2,
    hue: 158,
    featured: true,
  },
  {
    slug: "cumberland-island",
    name: "Cumberland Island",
    type: "park",
    region: "Camden County, Georgia",
    country: "United States",
    lat: 30.85,
    lon: -81.45,
    tagline: "Wild horses, live oaks and seventeen miles of empty beach.",
    difficulty: 3,
    hue: 172,
  },
  {
    slug: "jekyll-island",
    name: "Jekyll Island",
    type: "gem",
    region: "Glynn County, Georgia",
    country: "United States",
    lat: 31.06,
    lon: -81.42,
    tagline: "Driftwood beach and a gilded-age club in the pines.",
    difficulty: 1,
    hue: 178,
  },
  {
    slug: "sapelo-island",
    name: "Sapelo Island",
    type: "gem",
    region: "McIntosh County, Georgia",
    country: "United States",
    lat: 31.47,
    lon: -81.25,
    tagline: "A barrier island with a Gullah community still on it.",
    difficulty: 2,
    hue: 168,
  },
  {
    slug: "stone-mountain",
    name: "Stone Mountain",
    type: "landmark",
    region: "DeKalb County, Georgia",
    country: "United States",
    lat: 33.806,
    lon: -84.145,
    tagline: "The largest exposed granite dome in North America.",
    difficulty: 2,
    hue: 40,
  },
  {
    slug: "kennesaw-mountain",
    name: "Kennesaw Mountain",
    type: "park",
    region: "Cobb County, Georgia",
    country: "United States",
    lat: 33.98,
    lon: -84.6,
    tagline: "Civil War earthworks and a skyline view, 20 minutes from town.",
    difficulty: 2,
    hue: 118,
  },
  {
    slug: "arabia-mountain",
    name: "Arabia Mountain",
    type: "gem",
    region: "DeKalb County, Georgia",
    country: "United States",
    lat: 33.66,
    lon: -84.12,
    tagline: "A granite outcrop with plants that grow nowhere else.",
    difficulty: 1,
    hue: 12,
  },
  {
    slug: "sweetwater-creek",
    name: "Sweetwater Creek",
    type: "park",
    region: "Douglas County, Georgia",
    country: "United States",
    lat: 33.75,
    lon: -84.63,
    tagline: "A ruined mill in a hemlock gorge.",
    difficulty: 2,
    hue: 126,
  },
  {
    slug: "fort-mountain",
    name: "Fort Mountain",
    type: "gem",
    region: "Murray County, Georgia",
    country: "United States",
    lat: 34.6,
    lon: -84.55,
    tagline: "A 855-foot stone wall nobody can explain.",
    difficulty: 2,
    hue: 128,
  },
  {
    slug: "cohutta-wilderness",
    name: "Cohutta Wilderness",
    type: "gem",
    region: "Union County, Georgia",
    country: "United States",
    lat: 34.85,
    lon: -84.63,
    tagline: "The largest wilderness east of the Mississippi.",
    difficulty: 4,
    hue: 124,
  },
  {
    slug: "jacks-river-falls",
    name: "Jacks River Falls",
    type: "gem",
    region: "Fannin County, Georgia",
    country: "United States",
    lat: 34.98,
    lon: -84.62,
    tagline: "A wide curtain of water at the end of 42 river crossings.",
    difficulty: 5,
    hue: 152,
  },
  {
    slug: "raven-cliff-falls",
    name: "Raven Cliff Falls",
    type: "gem",
    region: "White County, Georgia",
    country: "United States",
    lat: 34.71,
    lon: -83.79,
    tagline: "A 400-foot waterfall inside a wall of moss.",
    difficulty: 2,
    hue: 150,
  },
  {
    slug: "dukes-creek-falls",
    name: "Dukes Creek Falls",
    type: "gem",
    region: "White County, Georgia",
    country: "United States",
    lat: 34.7,
    lon: -83.79,
    tagline: "A double waterfall reached by a switchback boardwalk.",
    difficulty: 1,
    hue: 154,
  },
  {
    slug: "helton-creek-falls",
    name: "Helton Creek Falls",
    type: "gem",
    region: "Union County, Georgia",
    country: "United States",
    lat: 34.86,
    lon: -83.72,
    tagline: "Two falls, one short path, almost no one there.",
    difficulty: 1,
    hue: 156,
  },
  {
    slug: "anna-ruby-falls",
    name: "Anna Ruby Falls",
    type: "gem",
    region: "White County, Georgia",
    country: "United States",
    lat: 34.76,
    lon: -83.71,
    tagline: "Twin falls where two creeks meet above the trees.",
    difficulty: 1,
    hue: 158,
  },
  {
    slug: "panther-creek-falls",
    name: "Panther Creek Falls",
    type: "gem",
    region: "Habersham County, Georgia",
    country: "United States",
    lat: 34.66,
    lon: -83.43,
    tagline: "A 60-foot fan of water at the end of a creek walk.",
    difficulty: 3,
    hue: 160,
  },
  {
    slug: "black-rock-mountain",
    name: "Black Rock Mountain",
    type: "park",
    region: "Rabun County, Georgia",
    country: "United States",
    lat: 34.91,
    lon: -83.42,
    elevation: 1110,
    tagline: "Georgia's highest state park, on the Eastern Continental Divide.",
    difficulty: 2,
    hue: 144,
  },
  {
    slug: "vogel-state-park",
    name: "Vogel State Park",
    type: "park",
    region: "Union County, Georgia",
    country: "United States",
    lat: 34.77,
    lon: -83.92,
    tagline: "A 1930s CCC lake under Blood Mountain.",
    difficulty: 2,
    hue: 134,
  },
  {
    slug: "lake-burton",
    name: "Lake Burton",
    type: "gem",
    region: "Rabun County, Georgia",
    country: "United States",
    lat: 34.75,
    lon: -83.55,
    tagline: "Deep green water in a folded mountain valley.",
    difficulty: 1,
    hue: 170,
  },
  {
    slug: "pine-mountain",
    name: "Pine Mountain",
    type: "park",
    region: "Harris County, Georgia",
    country: "United States",
    lat: 32.84,
    lon: -84.69,
    tagline: "FDR's little White House and a 500-mile view.",
    difficulty: 2,
    hue: 120,
  },
  {
    slug: "radium-springs",
    name: "Radium Springs",
    type: "gem",
    region: "Dougherty County, Georgia",
    country: "United States",
    lat: 31.57,
    lon: -84.16,
    tagline: "A million gallons a day of clear blue water.",
    difficulty: 1,
    hue: 184,
  },
  {
    slug: "george-l-smith",
    name: "George L. Smith",
    type: "gem",
    region: "Emanuel County, Georgia",
    country: "United States",
    lat: 32.55,
    lon: -82.08,
    tagline: "Cypress trees and blackwater, sixty miles from nowhere.",
    difficulty: 1,
    hue: 166,
  },
  {
    slug: "hard-labor-creek",
    name: "Hard Labor Creek",
    type: "park",
    region: "Morgan County, Georgia",
    country: "United States",
    lat: 33.65,
    lon: -83.63,
    tagline: "The closest real forest to Atlanta, and a good lake.",
    difficulty: 1,
    hue: 122,
  },
];

/* ── Atlas ──────────────────────────────────────────────────
   1,218 national parks, peaks and natural landmarks pulled from Wikidata (CC0)
   by scripts/build-atlas.py. Structured records only: real coordinates and
   facts, no invented prose. Peaks are ranked by topographic prominence, so the
   set is major summits rather than every high shoulder on the map. */

interface AtlasRow {
  wd: string;
  slug: string;
  name: string;
  type: "peak" | "park" | "landmark";
  country: string;
  lat: number;
  lon: number;
  elevation: number | null;
  also?: { src?: "atlas" | "editorial" | "wikidata"; id?: string; name?: string }[];
}

const COUNTRY_FIX: Record<string, string> = {
  "United States of America": "United States",
  "Russian Federation": "Russia",
  "People's Republic of China": "China",
  "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
  "Czech Republic": "Czechia",
  "Republic of Ireland": "Ireland",
  "Kingdom of the Netherlands": "Netherlands",
  "Republic of South Africa": "South Africa",
  "Türkiye": "Turkey",
};

const HUE_BY_TYPE: Record<PlaceType, number> = {
  peak: 206,
  park: 143,
  landmark: 34,
  gem: 168,
};

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function atlasTagline(row: AtlasRow, country: string) {
  if (row.type === "peak" && row.elevation) {
    return `${row.elevation.toLocaleString()} m peak in ${country}`;
  }
  if (row.type === "peak") return `Peak in ${country}`;
  if (row.type === "park") return `National park in ${country}`;
  // Landmarks are natural features only — waterfall, canyon, volcano, glacier,
  // cave or desert — never a UNESCO cultural site.
  return `Natural landmark in ${country}`;
}

const ATLAS: Place[] = (atlasRaw as AtlasRow[]).map((row) => {
  const country = COUNTRY_FIX[row.country] ?? row.country;
  return {
    slug: row.slug,
    name: row.name,
    type: row.type,
    country,
    lat: row.lat,
    lon: row.lon,
    elevation: row.elevation ?? undefined,
    tagline: atlasTagline(row, country),
    hue: (HUE_BY_TYPE[row.type] + (hash(row.slug) % 34) - 17 + 360) % 360,
    curated: false,
    wd: row.wd,
    also: row.also,
  };
});

export const PLACES: Place[] = [
  ...CURATED.map((p) => ({ ...p, curated: true, editorial: true })),
  ...ATLAS,
];

export const bySlug = new Map(PLACES.map((p) => [p.slug, p]));


/** How far it is to each activity, in plain words. */
const ACTIVITY: Record<PlaceType, string> = {
  peak: "Hiking · scrambling",
  park: "Walking · wildlife",
  landmark: "Sightseeing",
  gem: "Detours",
};

export type Around = {
  radiusKm: number;
  /** Nearest atlas entries, closest first. */
  nearest: { place: Place; km: number }[];
  /** Counts per activity, largest first, empty types dropped. */
  activities: { type: PlaceType; label: string; count: number }[];
};

/**
 * What is around a place, computed from the atlas rather than from a trail or POI
 * dataset: one pass over the destination rows, keep what falls inside the radius, group
 * by the activity its type implies, and take the closest few for the list.
 *
 * Deliberately a proxy. There is no route database behind this, so the honest
 * thing to show is "what kinds of place are near, and how near" — not invented
 * trail names or a difficulty for a walk nobody has surveyed here.
 */
export function aroundPlace(place: Place, radiusKm = 30): Around {
  const inside: { place: Place; km: number }[] = [];
  for (const other of PLACES) {
    if (other.slug === place.slug) continue;
    const km = kmBetween(place.lat, place.lon, other.lat, other.lon);
    if (km <= radiusKm) inside.push({ place: other, km });
  }
  inside.sort((a, b) => a.km - b.km);

  const counts = new Map<PlaceType, number>();
  for (const { place: p } of inside) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  const activities = [...counts.entries()]
    .map(([type, count]) => ({ type, label: ACTIVITY[type], count }))
    .sort((a, b) => b.count - a.count);

  return { radiusKm, nearest: inside.slice(0, 6), activities };
}
