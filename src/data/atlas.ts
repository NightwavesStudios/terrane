/**
 * Terrane's discovery atlas.
 *
 * A curated set of outdoor places worth crossing the world for — peaks first,
 * then the volcanoes, treks, canyons, deserts, lakes, ice and coast around them.
 * Coordinates are approximate centres for discovery on the globe, not survey
 * points; this product deliberately carries no routes, approach beta, conditions
 * or navigation data.
 */
import type { IconName } from "../components/Icon";

export type AdventureKind =
  | "peak"
  | "volcano"
  | "trek"
  | "canyon"
  | "desert"
  | "lake"
  | "glacier"
  | "coast"
  | "island";

export type Continent =
  | "Africa"
  | "Antarctica"
  | "Asia"
  | "Europe"
  | "North America"
  | "Oceania"
  | "South America";

export type Approach = "walk" | "hike" | "alpine" | "expedition" | "sight";

export interface Adventure {
  id: string;
  name: string;
  kind: AdventureKind;
  continent: Continent;
  country: string;
  region: string;
  lat: number;
  lon: number;
  elevationM?: number;
  prominenceM?: number;
  approach: Approach;
  note: string;
}

export interface KindMeta {
  label: string;
  singular: string;
  color: string;
  icon: IconName;
  blurb: string;
}

export const KIND_META: Record<AdventureKind, KindMeta> = {
  peak: {
    label: "Peaks",
    singular: "Peak",
    color: "#7ce0c0",
    icon: "peak",
    blurb: "Summits, high points and the bones of a range.",
  },
  volcano: {
    label: "Volcanoes",
    singular: "Volcano",
    color: "#e09062",
    icon: "volcano",
    blurb: "Ground that built itself, and is still building.",
  },
  trek: {
    label: "Treks",
    singular: "Trek",
    color: "#d8c58a",
    icon: "trek",
    blurb: "Multi-day walks between one world and another.",
  },
  canyon: {
    label: "Canyons",
    singular: "Canyon",
    color: "#c98d6a",
    icon: "canyon",
    blurb: "Country cut open, layer by layer.",
  },
  desert: {
    label: "Deserts",
    singular: "Desert",
    color: "#d9b171",
    icon: "desert",
    blurb: "Dry ground, low light, long horizons.",
  },
  lake: {
    label: "Lakes",
    singular: "Lake",
    color: "#6fc7dd",
    icon: "lake",
    blurb: "Still water under very big country.",
  },
  glacier: {
    label: "Ice",
    singular: "Glacier",
    color: "#cfe9f5",
    icon: "glacier",
    blurb: "Rivers that move too slowly to watch.",
  },
  coast: {
    label: "Coasts",
    singular: "Coast",
    color: "#8fd3c4",
    icon: "coast",
    blurb: "Where the land gives up, dramatically.",
  },
  island: {
    label: "Islands",
    singular: "Island",
    color: "#b7d38c",
    icon: "island",
    blurb: "Small ground, entirely surrounded.",
  },
};

export const KINDS = Object.keys(KIND_META) as AdventureKind[];

export const CONTINENTS: Continent[] = [
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
];

export const APPROACH_META: Record<Approach, { label: string; note: string }> = {
  walk: { label: "Walk-in", note: "An easy approach; the place does the work." },
  hike: { label: "Day hike", note: "A long walk, usually from a road end." },
  alpine: { label: "Alpine", note: "Snow, rock or glacier travel with real exposure." },
  expedition: { label: "Expedition", note: "Days to weeks, self-supported or guided." },
  sight: { label: "Viewpoint", note: "Seen from the rim, the shore or the road." },
};

export const ADVENTURES: Adventure[] = [
  /* ── Asia ─────────────────────────────────────────────────────────── */
  {
    id: "everest", name: "Everest", kind: "peak", continent: "Asia",
    country: "Nepal / China", region: "Khumbu Himal",
    lat: 27.9881, lon: 86.925, elevationM: 8849, prominenceM: 8849,
    approach: "expedition",
    note: "The roof of the world, and the measure every other summit is held against.",
  },
  {
    id: "k2", name: "K2", kind: "peak", continent: "Asia",
    country: "Pakistan / China", region: "Karakoram",
    lat: 35.8825, lon: 76.5133, elevationM: 8611, prominenceM: 4020,
    approach: "expedition",
    note: "The mountain climbers call the savage one: steep, remote and rarely kind.",
  },
  {
    id: "kangchenjunga", name: "Kangchenjunga", kind: "peak", continent: "Asia",
    country: "Nepal / India", region: "Eastern Himalaya",
    lat: 27.7025, lon: 88.1475, elevationM: 8586, prominenceM: 3922,
    approach: "expedition",
    note: "Five summits on one massif, held sacred by the people below it.",
  },
  {
    id: "nanga-parbat", name: "Nanga Parbat", kind: "peak", continent: "Asia",
    country: "Pakistan", region: "Western Himalaya",
    lat: 35.2375, lon: 74.5892, elevationM: 8126, prominenceM: 4608,
    approach: "expedition",
    note: "A single vast face above the Indus, isolated from every other 8,000er.",
  },
  {
    id: "annapurna-i", name: "Annapurna I", kind: "peak", continent: "Asia",
    country: "Nepal", region: "Annapurna Himal",
    lat: 28.5961, lon: 83.8203, elevationM: 8091, prominenceM: 2984,
    approach: "expedition",
    note: "The first 8,000 m summit ever climbed, and still one of the least forgiving.",
  },
  {
    id: "damavand", name: "Damavand", kind: "volcano", continent: "Asia",
    country: "Iran", region: "Alborz",
    lat: 35.955, lon: 52.11, elevationM: 5610, prominenceM: 4667,
    approach: "hike",
    note: "A snow-capped stratovolcano above the Caspian plain, the highest ground in Iran.",
  },
  {
    id: "fuji", name: "Fuji", kind: "volcano", continent: "Asia",
    country: "Japan", region: "Honshu",
    lat: 35.3606, lon: 138.7274, elevationM: 3776, prominenceM: 3776,
    approach: "hike",
    note: "A near-perfect cone that has been a destination, not just a mountain, for centuries.",
  },
  {
    id: "hallasan", name: "Hallasan", kind: "volcano", continent: "Asia",
    country: "South Korea", region: "Jeju Island",
    lat: 33.3617, lon: 126.5292, elevationM: 1947, prominenceM: 1947,
    approach: "hike",
    note: "Jeju's shield volcano, rising straight out of the sea to the south.",
  },
  {
    id: "kinabalu", name: "Kinabalu", kind: "peak", continent: "Asia",
    country: "Malaysia", region: "Borneo",
    lat: 6.0759, lon: 116.5583, elevationM: 4095, prominenceM: 4095,
    approach: "alpine",
    note: "Granite spires above Bornean cloud forest, the island's highest ground.",
  },
  {
    id: "rinjani", name: "Rinjani", kind: "volcano", continent: "Asia",
    country: "Indonesia", region: "Lombok",
    lat: -8.4139, lon: 116.4578, elevationM: 3726, prominenceM: 3726,
    approach: "expedition",
    note: "A crater lake inside a volcano inside an island — a whole day of walking in one view.",
  },
  {
    id: "bromo", name: "Bromo", kind: "volcano", continent: "Asia",
    country: "Indonesia", region: "Java",
    lat: -7.9425, lon: 112.953, elevationM: 2329,
    approach: "walk",
    note: "A smoking cone in a sand sea, best met before the sun clears the rim.",
  },
  {
    id: "everest-base-camp", name: "Everest Base Camp", kind: "trek", continent: "Asia",
    country: "Nepal", region: "Khumbu",
    lat: 28.0026, lon: 86.8528, elevationM: 5644,
    approach: "expedition",
    note: "The Khumbu's long walk to the foot of the highest mountain, with Kala Patthar as its high point.",
  },
  {
    id: "annapurna-base-camp", name: "Annapurna Base Camp", kind: "trek", continent: "Asia",
    country: "Nepal", region: "Annapurna Himal",
    lat: 28.53, lon: 83.86, elevationM: 4130,
    approach: "expedition",
    note: "A sanctuary of rock and ice reached through rhododendron forest and Gurung villages.",
  },
  {
    id: "tiger-leaping-gorge", name: "Tiger Leaping Gorge", kind: "trek", continent: "Asia",
    country: "China", region: "Yunnan",
    lat: 27.2, lon: 100.1, elevationM: 2670,
    approach: "hike",
    note: "The Jinsha River cutting between two 5,000 m walls — one of the deepest gorges on earth.",
  },
  {
    id: "wadi-rum", name: "Wadi Rum", kind: "desert", continent: "Asia",
    country: "Jordan", region: "Arabian Desert",
    lat: 29.5765, lon: 35.4207, elevationM: 1754,
    approach: "sight",
    note: "Sand valleys between sandstone towers, with the high point at Jabal Umm ad Dami.",
  },
  {
    id: "zhangjiajie", name: "Zhangjiajie", kind: "canyon", continent: "Asia",
    country: "China", region: "Hunan",
    lat: 29.3159, lon: 110.4344, elevationM: 1262,
    approach: "sight",
    note: "Thousands of quartz-sandstone pillars standing in mist, a landscape that reads as impossible.",
  },

  /* ── Europe ───────────────────────────────────────────────────────── */
  {
    id: "elbrus", name: "Elbrus", kind: "volcano", continent: "Europe",
    country: "Russia", region: "Caucasus",
    lat: 43.355, lon: 42.4392, elevationM: 5642, prominenceM: 4741,
    approach: "alpine",
    note: "A twin summit on a glaciated volcano: the highest ground in Europe.",
  },
  {
    id: "mont-blanc", name: "Mont Blanc", kind: "peak", continent: "Europe",
    country: "France / Italy", region: "Mont Blanc massif",
    lat: 45.8326, lon: 6.8652, elevationM: 4808, prominenceM: 4695,
    approach: "alpine",
    note: "The Alps' high point and the birthplace of alpinism.",
  },
  {
    id: "dufourspitze", name: "Dufourspitze", kind: "peak", continent: "Europe",
    country: "Switzerland", region: "Pennine Alps",
    lat: 45.9369, lon: 7.8664, elevationM: 4634, prominenceM: 2165,
    approach: "alpine",
    note: "The highest summit in Switzerland, on the Monte Rosa massif.",
  },
  {
    id: "matterhorn", name: "Matterhorn", kind: "peak", continent: "Europe",
    country: "Switzerland / Italy", region: "Pennine Alps",
    lat: 45.9763, lon: 7.6586, elevationM: 4478, prominenceM: 1042,
    approach: "alpine",
    note: "The horn that decided how the world would picture a mountain.",
  },
  {
    id: "gran-paradiso", name: "Gran Paradiso", kind: "peak", continent: "Europe",
    country: "Italy", region: "Graian Alps",
    lat: 45.5175, lon: 7.2672, elevationM: 4061, prominenceM: 1879,
    approach: "alpine",
    note: "Italy's own 4,000 m summit, inside its first national park.",
  },
  {
    id: "barre-des-ecrins", name: "Barre des Écrins", kind: "peak", continent: "Europe",
    country: "France", region: "Dauphiné Alps",
    lat: 44.9225, lon: 6.3583, elevationM: 4102,
    approach: "alpine",
    note: "The southern Alps' highest summit, a white wall above the Romanche valley.",
  },
  {
    id: "ben-nevis", name: "Ben Nevis", kind: "peak", continent: "Europe",
    country: "Scotland", region: "Grampian Mountains",
    lat: 56.7969, lon: -5.0036, elevationM: 1345, prominenceM: 1345,
    approach: "hike",
    note: "Britain's highest ground and its weather: a summit that is often in cloud.",
  },
  {
    id: "snowdon", name: "Yr Wyddfa / Snowdon", kind: "peak", continent: "Europe",
    country: "Wales", region: "Eryri",
    lat: 53.0685, lon: -4.0763, elevationM: 1085, prominenceM: 1038,
    approach: "hike",
    note: "Wales' highest summit, ringed by ridges that make every approach different.",
  },
  {
    id: "scafell-pike", name: "Scafell Pike", kind: "peak", continent: "Europe",
    country: "England", region: "Lake District",
    lat: 54.4543, lon: -3.2116, elevationM: 978, prominenceM: 912,
    approach: "hike",
    note: "England's highest ground: a boulder field above Wastwater.",
  },
  {
    id: "zugspitze", name: "Zugspitze", kind: "peak", continent: "Europe",
    country: "Germany / Austria", region: "Wetterstein",
    lat: 47.4211, lon: 10.9853, elevationM: 2962, prominenceM: 1746,
    approach: "alpine",
    note: "Germany's highest summit, looking straight down the Alps.",
  },
  {
    id: "grossglockner", name: "Großglockner", kind: "peak", continent: "Europe",
    country: "Austria", region: "High Tauern",
    lat: 47.0744, lon: 12.6939, elevationM: 3798, prominenceM: 2428,
    approach: "alpine",
    note: "Austria's highest mountain, a pyramid of ice and dark rock.",
  },
  {
    id: "galdhopiggen", name: "Galdhøpiggen", kind: "peak", continent: "Europe",
    country: "Norway", region: "Jotunheimen",
    lat: 61.6364, lon: 8.3125, elevationM: 2469, prominenceM: 2372,
    approach: "hike",
    note: "Northern Europe's highest summit, on a glacier at the head of a long valley.",
  },
  {
    id: "hvannadalshnukur", name: "Hvannadalshnúkur", kind: "peak", continent: "Europe",
    country: "Iceland", region: "Vatnajökull",
    lat: 64.0147, lon: -16.6744, elevationM: 2110, prominenceM: 2110,
    approach: "alpine",
    note: "Iceland's high point, on the rim of the island's great ice cap.",
  },
  {
    id: "etna", name: "Etna", kind: "volcano", continent: "Europe",
    country: "Italy", region: "Sicily",
    lat: 37.751, lon: 14.9934, elevationM: 3357, prominenceM: 3357,
    approach: "hike",
    note: "Europe's most active volcano, rebuilding its own summit every few years.",
  },
  {
    id: "teide", name: "Teide", kind: "volcano", continent: "Europe",
    country: "Spain", region: "Tenerife",
    lat: 28.2724, lon: -16.6425, elevationM: 3715, prominenceM: 3715,
    approach: "hike",
    note: "A volcano above the clouds and the highest ground in Spain.",
  },
  {
    id: "preikestolen", name: "Preikestolen", kind: "coast", continent: "Europe",
    country: "Norway", region: "Lysefjord",
    lat: 58.9864, lon: 6.1904, elevationM: 604,
    approach: "hike",
    note: "A flat rock shelf 600 m above Lysefjord, found by a short climb and a long look down.",
  },
  {
    id: "trolltunga", name: "Trolltunga", kind: "coast", continent: "Europe",
    country: "Norway", region: "Hardangerfjord",
    lat: 60.1242, lon: 6.74, elevationM: 1100,
    approach: "hike",
    note: "A tongue of rock over a glacial lake, at the end of a long day's walk.",
  },
  {
    id: "lofoten", name: "Lofoten", kind: "island", continent: "Europe",
    country: "Norway", region: "Lofoten archipelago",
    lat: 67.93, lon: 13.09, elevationM: 448,
    approach: "hike",
    note: "Granite peaks rising straight from the Norwegian Sea; Reinebringen is the classic view.",
  },
  {
    id: "laugavegur", name: "Laugavegur", kind: "trek", continent: "Europe",
    country: "Iceland", region: "Highlands",
    lat: 63.99, lon: -19.06, elevationM: 1100,
    approach: "expedition",
    note: "Coloured rhyolite, black sand and hot springs between Landmannalaugar and Þórsmörk.",
  },
  {
    id: "tour-du-mont-blanc", name: "Tour du Mont Blanc", kind: "trek", continent: "Europe",
    country: "France / Italy / Switzerland", region: "Mont Blanc massif",
    lat: 45.9, lon: 6.9, elevationM: 2665,
    approach: "expedition",
    note: "The eleven-day circuit of the massif, crossing three countries and a dozen passes.",
  },

  /* ── North America ────────────────────────────────────────────────── */
  {
    id: "denali", name: "Denali", kind: "peak", continent: "North America",
    country: "United States", region: "Alaska Range",
    lat: 63.0692, lon: -151.007, elevationM: 6190, prominenceM: 6144,
    approach: "expedition",
    note: "The highest ground in North America, rising 5,500 m out of the Alaskan plain.",
  },
  {
    id: "rainier", name: "Rainier", kind: "volcano", continent: "North America",
    country: "United States", region: "Cascades",
    lat: 46.8523, lon: -121.7603, elevationM: 4392, prominenceM: 4023,
    approach: "expedition",
    note: "A glaciated volcano visible from Seattle, with more ice than any peak in the lower 48.",
  },
  {
    id: "whitney", name: "Whitney", kind: "peak", continent: "North America",
    country: "United States", region: "Sierra Nevada",
    lat: 36.5785, lon: -118.2923, elevationM: 4421, prominenceM: 3071,
    approach: "hike",
    note: "The highest ground in the contiguous United States, a long walk from Whitney Portal.",
  },
  {
    id: "elbert", name: "Elbert", kind: "peak", continent: "North America",
    country: "United States", region: "Sawatch Range",
    lat: 39.1178, lon: -106.4454, elevationM: 4401, prominenceM: 2772,
    approach: "hike",
    note: "Colorado's highest summit: a broad, grassy mountain above Leadville.",
  },
  {
    id: "grand-teton", name: "Grand Teton", kind: "peak", continent: "North America",
    country: "United States", region: "Teton Range",
    lat: 43.7412, lon: -110.8024, elevationM: 4199, prominenceM: 1995,
    approach: "alpine",
    note: "The sharpest skyline in the Rockies, above a string of glacier lakes.",
  },
  {
    id: "longs-peak", name: "Longs Peak", kind: "peak", continent: "North America",
    country: "United States", region: "Front Range",
    lat: 40.2549, lon: -105.616, elevationM: 4346, prominenceM: 896,
    approach: "alpine",
    note: "The Front Range's high point, a wall of rock above the Colorado plains.",
  },
  {
    id: "hood", name: "Hood", kind: "volcano", continent: "North America",
    country: "United States", region: "Cascades",
    lat: 45.3736, lon: -121.6959, elevationM: 3429, prominenceM: 2349,
    approach: "alpine",
    note: "Oregon's signature cone, climbed on snow and rime most of the year.",
  },
  {
    id: "shasta", name: "Shasta", kind: "volcano", continent: "North America",
    country: "United States", region: "Cascades",
    lat: 41.4092, lon: -122.1944, elevationM: 4322, prominenceM: 2977,
    approach: "alpine",
    note: "A solitary volcano at the head of California's Central Valley.",
  },
  {
    id: "mitchell", name: "Mitchell", kind: "peak", continent: "North America",
    country: "United States", region: "Blue Ridge",
    lat: 35.7649, lon: -82.2651, elevationM: 2037, prominenceM: 1856,
    approach: "hike",
    note: "The highest ground east of the Mississippi, in the southern Appalachians.",
  },
  {
    id: "mauna-kea", name: "Mauna Kea", kind: "volcano", continent: "North America",
    country: "United States", region: "Hawaii",
    lat: 19.8207, lon: -155.4681, elevationM: 4207, prominenceM: 4207,
    approach: "walk",
    note: "Measured from its seafloor base, the tallest mountain on earth.",
  },
  {
    id: "orizaba", name: "Pico de Orizaba", kind: "volcano", continent: "North America",
    country: "Mexico", region: "Trans-Mexican Volcanic Belt",
    lat: 19.0305, lon: -97.2687, elevationM: 5636, prominenceM: 4922,
    approach: "alpine",
    note: "Mexico's highest summit and the third-highest volcano in the world.",
  },
  {
    id: "grand-canyon", name: "Grand Canyon", kind: "canyon", continent: "North America",
    country: "United States", region: "Arizona",
    lat: 36.1069, lon: -112.1129, elevationM: 2438,
    approach: "sight",
    note: "A mile of layered time cut by the Colorado River, with the North Rim as its high ground.",
  },
  {
    id: "half-dome", name: "Half Dome", kind: "peak", continent: "North America",
    country: "United States", region: "Sierra Nevada",
    lat: 37.7459, lon: -119.5332, elevationM: 2694, prominenceM: 415,
    approach: "hike",
    note: "Yosemite's granite half-moon, reached by cables up the final slab.",
  },
  {
    id: "death-valley", name: "Death Valley", kind: "desert", continent: "North America",
    country: "United States", region: "California / Nevada",
    lat: 36.2295, lon: -116.7675, elevationM: 3368,
    approach: "sight",
    note: "The hottest, driest place in North America — Badwater Basin to Telescope Peak in one valley.",
  },
  {
    id: "banff-lake-louise", name: "Lake Louise", kind: "lake", continent: "North America",
    country: "Canada", region: "Banff",
    lat: 51.4254, lon: -116.1773, elevationM: 1750,
    approach: "walk",
    note: "Turquoise meltwater under the Victoria Glacier, the Bow Valley's front door.",
  },
  {
    id: "moraine-lake", name: "Moraine Lake", kind: "lake", continent: "North America",
    country: "Canada", region: "Banff",
    lat: 51.3217, lon: -116.186, elevationM: 1884,
    approach: "hike",
    note: "A glacial lake in the Valley of the Ten Peaks, blue in a way photographs understate.",
  },
  {
    id: "athabasca-glacier", name: "Athabasca Glacier", kind: "glacier", continent: "North America",
    country: "Canada", region: "Columbia Icefield",
    lat: 52.2086, lon: -117.234, elevationM: 2000,
    approach: "sight",
    note: "A tongue of the Columbia Icefield, one of the most accessible glacier views in the Rockies.",
  },

  /* ── South America ────────────────────────────────────────────────── */
  {
    id: "aconcagua", name: "Aconcagua", kind: "peak", continent: "South America",
    country: "Argentina", region: "Andes",
    lat: -32.6532, lon: -70.0109, elevationM: 6961, prominenceM: 6961,
    approach: "expedition",
    note: "The highest summit outside Asia, a long scree walk above the Chilean border.",
  },
  {
    id: "ojos-del-salado", name: "Ojos del Salado", kind: "volcano", continent: "South America",
    country: "Chile / Argentina", region: "Puna de Atacama",
    lat: -27.1094, lon: -68.5417, elevationM: 6893, prominenceM: 3688,
    approach: "expedition",
    note: "The world's highest volcano, in the thin, dry air of the Atacama.",
  },
  {
    id: "chimborazo", name: "Chimborazo", kind: "volcano", continent: "South America",
    country: "Ecuador", region: "Andes",
    lat: -1.4692, lon: -78.817, elevationM: 6263, prominenceM: 4123,
    approach: "expedition",
    note: "Ecuador's high point and, measured from the earth's centre, the farthest summit from it.",
  },
  {
    id: "cotopaxi", name: "Cotopaxi", kind: "volcano", continent: "South America",
    country: "Ecuador", region: "Andes",
    lat: -0.6807, lon: -78.4369, elevationM: 5897, prominenceM: 2404,
    approach: "expedition",
    note: "A near-perfect glaciated cone on the Avenue of the Volcanoes.",
  },
  {
    id: "huascaran", name: "Huascarán", kind: "peak", continent: "South America",
    country: "Peru", region: "Cordillera Blanca",
    lat: -9.1214, lon: -77.6047, elevationM: 6768, prominenceM: 2776,
    approach: "expedition",
    note: "Peru's highest summit, the crown of the Cordillera Blanca.",
  },
  {
    id: "fitz-roy", name: "Fitz Roy", kind: "peak", continent: "South America",
    country: "Chile / Argentina", region: "Patagonian Andes",
    lat: -49.2717, lon: -73.0433, elevationM: 3405, prominenceM: 1951,
    approach: "alpine",
    note: "A granite needle above the Patagonian ice field, and its own weather system.",
  },
  {
    id: "torres-del-paine", name: "Torres del Paine", kind: "trek", continent: "South America",
    country: "Chile", region: "Patagonia",
    lat: -50.9423, lon: -73.4068, elevationM: 2884,
    approach: "expedition",
    note: "The 'W' and the full circuit below the Paine massif's granite towers.",
  },
  {
    id: "perito-moreno", name: "Perito Moreno", kind: "glacier", continent: "South America",
    country: "Argentina", region: "Patagonian Ice Field",
    lat: -50.4967, lon: -73.1375, elevationM: 200,
    approach: "sight",
    note: "A glacier that still advances, calving into Lago Argentino in front of you.",
  },
  {
    id: "salar-de-uyuni", name: "Salar de Uyuni", kind: "desert", continent: "South America",
    country: "Bolivia", region: "Altiplano",
    lat: -20.1338, lon: -67.4891, elevationM: 3656,
    approach: "sight",
    note: "The world's largest salt flat: a horizon that disappears in the wet season.",
  },
  {
    id: "valle-de-la-luna", name: "Valle de la Luna", kind: "desert", continent: "South America",
    country: "Chile", region: "Atacama",
    lat: -22.925, lon: -68.2833, elevationM: 2550,
    approach: "sight",
    note: "Salt ridges and dry dunes in the Atacama, at their best in low evening light.",
  },

  /* ── Africa ───────────────────────────────────────────────────────── */
  {
    id: "kilimanjaro", name: "Kilimanjaro", kind: "volcano", continent: "Africa",
    country: "Tanzania", region: "East African Rift",
    lat: -3.0674, lon: 37.3556, elevationM: 5895, prominenceM: 5885,
    approach: "expedition",
    note: "A free-standing volcano you can walk to the top of, through five climate zones.",
  },
  {
    id: "mount-kenya", name: "Mount Kenya", kind: "volcano", continent: "Africa",
    country: "Kenya", region: "East African Rift",
    lat: -0.1521, lon: 37.3084, elevationM: 5199, prominenceM: 3825,
    approach: "expedition",
    note: "A glaciated volcanic massif on the equator, with Batian at its top.",
  },
  {
    id: "rwenzori", name: "Rwenzori", kind: "peak", continent: "Africa",
    country: "Uganda / DR Congo", region: "Ruwenzori Range",
    lat: 0.3867, lon: 29.8719, elevationM: 5109,
    approach: "expedition",
    note: "The Mountains of the Moon: equatorial glaciers above forest and bog.",
  },
  {
    id: "table-mountain", name: "Table Mountain", kind: "peak", continent: "Africa",
    country: "South Africa", region: "Cape Fold",
    lat: -33.9628, lon: 18.4098, elevationM: 1085, prominenceM: 1055,
    approach: "hike",
    note: "A flat-topped wall above Cape Town, with the whole peninsula in view.",
  },
  {
    id: "toubkal", name: "Toubkal", kind: "peak", continent: "Africa",
    country: "Morocco", region: "High Atlas",
    lat: 31.0617, lon: -7.9155, elevationM: 4167, prominenceM: 3755,
    approach: "hike",
    note: "North Africa's highest summit, two days from Marrakech.",
  },
  {
    id: "ras-dashen", name: "Ras Dashen", kind: "peak", continent: "Africa",
    country: "Ethiopia", region: "Simien Mountains",
    lat: 13.2378, lon: 38.3728, elevationM: 4550, prominenceM: 3997,
    approach: "hike",
    note: "Ethiopia's high point, on an escarpment above the Simien plateau.",
  },
  {
    id: "mount-cameroon", name: "Mount Cameroon", kind: "volcano", continent: "Africa",
    country: "Cameroon", region: "Cameroon Volcanic Line",
    lat: 4.2167, lon: 9.1725, elevationM: 4040,
    approach: "expedition",
    note: "An active volcano rising straight from the Gulf of Guinea coast.",
  },
  {
    id: "sossusvlei", name: "Sossusvlei", kind: "desert", continent: "Africa",
    country: "Namibia", region: "Namib",
    lat: -24.7333, lon: 15.2833, elevationM: 550,
    approach: "sight",
    note: "Red dunes over a white clay pan — the Namib at its most graphic.",
  },
  {
    id: "erg-chebbi", name: "Erg Chebbi", kind: "desert", continent: "Africa",
    country: "Morocco", region: "Sahara",
    lat: 31.15, lon: -3.9667, elevationM: 730,
    approach: "sight",
    note: "A sea of orange dunes at the edge of the Sahara, walked at dawn.",
  },

  /* ── Oceania ──────────────────────────────────────────────────────── */
  {
    id: "puncak-jaya", name: "Puncak Jaya", kind: "peak", continent: "Oceania",
    country: "Indonesia", region: "Sudirman Range",
    lat: -4.0784, lon: 137.1583, elevationM: 4884, prominenceM: 4884,
    approach: "expedition",
    note: "The highest summit in Oceania and the hardest of the Seven Summits to reach.",
  },
  {
    id: "giluwe", name: "Mount Giluwe", kind: "volcano", continent: "Oceania",
    country: "Papua New Guinea", region: "Southern Highlands",
    lat: -6.0422, lon: 143.8844, elevationM: 4368,
    approach: "expedition",
    note: "The highest volcano in Oceania: an old shield volcano under alpine grassland.",
  },
  {
    id: "aoraki", name: "Aoraki / Mount Cook", kind: "peak", continent: "Oceania",
    country: "New Zealand", region: "Southern Alps",
    lat: -43.595, lon: 170.1418, elevationM: 3724, prominenceM: 3724,
    approach: "expedition",
    note: "New Zealand's highest summit, in a range of ice and greywacke.",
  },
  {
    id: "taranaki", name: "Taranaki", kind: "volcano", continent: "Oceania",
    country: "New Zealand", region: "North Island",
    lat: -39.2967, lon: 174.0639, elevationM: 2518, prominenceM: 2308,
    approach: "alpine",
    note: "A solitary cone in a green plain, climbed on rime and scree.",
  },
  {
    id: "milford-track", name: "Milford Track", kind: "trek", continent: "Oceania",
    country: "New Zealand", region: "Fiordland",
    lat: -44.65, lon: 167.92, elevationM: 1073,
    approach: "expedition",
    note: "Four days of rainforest, a saddle at Mackinnon Pass and a fiord at the end.",
  },
  {
    id: "routeburn-track", name: "Routeburn Track", kind: "trek", continent: "Oceania",
    country: "New Zealand", region: "Fiordland / Mount Aspiring",
    lat: -44.73, lon: 168.3, elevationM: 1255,
    approach: "expedition",
    note: "A three-day crossing of the Harris Saddle between two national parks.",
  },
  {
    id: "overland-track", name: "Overland Track", kind: "trek", continent: "Oceania",
    country: "Australia", region: "Tasmania",
    lat: -41.68, lon: 145.95, elevationM: 1617,
    approach: "expedition",
    note: "Tasmania's long walk under Cradle Mountain, through rainforest and button grass.",
  },
  {
    id: "uluru", name: "Uluru", kind: "desert", continent: "Oceania",
    country: "Australia", region: "Northern Territory",
    lat: -25.3444, lon: 131.0369, elevationM: 863,
    approach: "sight",
    note: "A single sandstone monolith rising 348 m from the central Australian plain.",
  },

  /* ── Antarctica ───────────────────────────────────────────────────── */
  {
    id: "vinson", name: "Vinson", kind: "peak", continent: "Antarctica",
    country: "Antarctica", region: "Ellsworth Mountains",
    lat: -78.5254, lon: -85.6171, elevationM: 4892, prominenceM: 4892,
    approach: "expedition",
    note: "The seventh summit and the coldest, most remote high point of them all.",
  },
  {
    id: "sidley", name: "Mount Sidley", kind: "volcano", continent: "Antarctica",
    country: "Antarctica", region: "Executive Committee Range",
    lat: -77.0667, lon: -126.1, elevationM: 4285,
    approach: "expedition",
    note: "Antarctica's highest volcano, a vast caldera buried in the ice sheet.",
  },
  {
    id: "erebus", name: "Mount Erebus", kind: "volcano", continent: "Antarctica",
    country: "Antarctica", region: "Ross Island",
    lat: -77.53, lon: 167.17, elevationM: 3794, prominenceM: 3794,
    approach: "expedition",
    note: "The southernmost active volcano, with a lava lake that never freezes.",
  },
  {
    id: "paradise-harbour", name: "Paradise Harbour", kind: "coast", continent: "Antarctica",
    country: "Antarctica", region: "Graham Land",
    lat: -64.9, lon: -62.87,
    approach: "sight",
    note: "Ice cliffs, bergs and still water on the Antarctic Peninsula.",
  },
];

const BY_ID = new Map(ADVENTURES.map((adventure) => [adventure.id, adventure]));

export function adventureById(id: string | undefined): Adventure | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function isAdventureId(id: string | undefined): id is string {
  return Boolean(id && BY_ID.has(id));
}

export function searchAdventures(
  term: string,
  options: { kind?: AdventureKind | "all"; continent?: Continent | "all" } = {},
): Adventure[] {
  const query = term.trim().toLowerCase();
  const { kind = "all", continent = "all" } = options;
  return ADVENTURES.filter((adventure) => {
    if (kind !== "all" && adventure.kind !== kind) return false;
    if (continent !== "all" && adventure.continent !== continent) return false;
    if (!query) return true;
    const haystack = [
      adventure.name,
      adventure.country,
      adventure.region,
      adventure.continent,
      KIND_META[adventure.kind].label,
      KIND_META[adventure.kind].singular,
      adventure.note,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function kindCounts(): Record<AdventureKind | "all", number> {
  const counts = { all: ADVENTURES.length } as Record<AdventureKind | "all", number>;
  for (const kind of KINDS) {
    counts[kind] = ADVENTURES.filter((adventure) => adventure.kind === kind).length;
  }
  return counts;
}

export function distanceKm(a: Adventure, b: Adventure): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearbyAdventures(adventure: Adventure, limit = 4): Adventure[] {
  return ADVENTURES.filter((candidate) => candidate.id !== adventure.id)
    .map((candidate) => ({ candidate, distance: distanceKm(adventure, candidate) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** The elevation label that fits the kind of place. */
export function elevationLabel(kind: AdventureKind): string {
  switch (kind) {
    case "peak":
    case "volcano":
      return "Summit";
    case "trek":
      return "High point";
    case "canyon":
      return "Rim";
    case "desert":
      return "High point";
    case "lake":
      return "Lake surface";
    case "glacier":
      return "Ice surface";
    case "coast":
      return "Elevation";
    case "island":
      return "High point";
  }
}
