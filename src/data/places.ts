import atlasRaw from "./atlas.json";

export type PlaceType = "peak" | "park" | "city" | "landmark" | "gem";

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
  /** Two or three short sentences. Only present on written-up places. */
  body?: string;
  /** 1 = January. Only present on written-up places. */
  bestMonths?: number[];
  /** 1 gentle → 5 severe. Only present on written-up places. */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Drives the gradient art on cards and the place hero. */
  hue: number;
  featured?: boolean;
  /** Hand-written field guide, as opposed to a structured atlas record. */
  curated?: boolean;
  /** Wikidata item, for atlas records. */
  wd?: string;
}

export const TYPE_LABEL: Record<PlaceType, string> = {
  peak: "Peak",
  park: "Park",
  city: "City",
  landmark: "Landmark",
  gem: "Hidden gem",
};

export const TYPE_LABEL_PLURAL: Record<PlaceType, string> = {
  peak: "Peaks",
  park: "Parks",
  city: "Cities",
  landmark: "Landmarks",
  gem: "Hidden gems",
};

export const DIFFICULTY_LABEL = [
  "",
  "Gentle",
  "Easy",
  "Moderate",
  "Hard",
  "Severe",
] as const;

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

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
    body:
      "The towers rise straight out of the Patagonian steppe, and the circuit around them — lakes, glaciers, a pass at 1,200 m — has become the reference point for what a wild landscape can look like. Nothing here is easy: the weather turns four times a day and the wind is a physical presence. That is precisely the appeal.",
    bestMonths: [11, 12, 1, 2, 3],
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
    body:
      "Fitz Roy's granite spires catch sunrise in a way that has ruined other mountains for a lot of people, and the walk in from El Chaltén costs you nothing but time. Stay for the Laguna de los Tres dawn; it is worth the cold.",
    bestMonths: [11, 12, 1, 2, 3],
    difficulty: 4,
    hue: 205,
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
    body:
      "The loop around the Tre Cime is the rare alpine walk that needs no technical skill and still puts you under 500-metre walls. Go early, walk anticlockwise, and stay for the enrosadira — the pink light that gives the Dolomites their name.",
    bestMonths: [6, 7, 8, 9, 10],
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
    body:
      "You do not climb it to see it — the Höhenweg above Zermatt gives you the full pyramid for the price of a cable car and a few hours of walking. The north face turns copper at sunset, and every terrace in town faces it.",
    bestMonths: [7, 8, 9],
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
    body:
      "Chamonix is the most convenient serious mountain town in the world: a train from the valley floor, a cable car to 3,842 m, and glaciers you can walk beside. The Tour du Mont Blanc takes a week and crosses three countries without ever leaving the massif.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "El Capitan and Half Dome are the headline, but the park's real gift is density: waterfalls, granite domes and giant sequoia within a valley you can drive end to end in an hour. Go in May for the melt, and be on the valley floor before seven.",
    bestMonths: [4, 5, 6, 9, 10],
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
    body:
      "General Sherman is the largest living thing on earth by volume, and the walk among the groves is genuinely disorienting — scale stops working. The canyons behind the sequoias are deeper than Yosemite's and almost empty.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "The Narrows is a hike inside a slot canyon with the Virgin River as the trail, and Angels Landing is the most famous knife-edge walk in America. Both are crowded for a reason; both are better at first light.",
    bestMonths: [4, 5, 9, 10],
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
    body:
      "Bryce is not a canyon but a series of frozen erosion fronts, and the hoodoos turn orange to pink as the sun moves. Walk down among them at least once — the Rim Trail alone undersells it.",
    bestMonths: [5, 6, 9, 10],
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
    body:
      "Delicate Arch is on every Utah licence plate for good reason, but the park's quieter windows and fins reward a full day. Summer heat is genuinely dangerous here; April and October are the honest months.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "Depth is the trick: the canyon is a mile down and ten wide, and the scale only resolves when something man-made is in frame. Rim-to-rim is a serious undertaking — down is optional, up is not.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "Half the world's geysers sit in one caldera, and the colours in the hot pools come from heat-loving bacteria rather than minerals. Go for Grand Prismatic at midday and the Lamar Valley at dusk, when the wolves come out.",
    bestMonths: [5, 6, 9, 10],
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
    body:
      "The road over Logan Pass is one of the great drives, cut into a wall with a 900-metre drop on the other side. The park's namesakes are down to a couple of dozen and will be gone within decades — which is its own reason to go now.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "Cadillac Mountain takes the country's first dawn for half the year, and the carriage roads make the park feel designed rather than preserved. October is the correct answer, if you can bear the crowds.",
    bestMonths: [6, 7, 8, 9, 10],
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
    body:
      "Rainier carries more glacial ice than any other peak in the lower 48, and the meadows at Paradise are the best wildflower show in the country in late July. The summit is a real mountaineering objective, not a hike.",
    bestMonths: [7, 8, 9],
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
    body:
      "Denali rises 5,500 metres from its own base — more vertical relief than Everest — and makes its own weather. Most visitors see it from the park road; the mountain is visible roughly one day in three.",
    bestMonths: [6, 7],
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
    body:
      "Nowhere else in the lower 48 packs temperate rainforest, glaciated peaks and a sea stack coast into a single day's drive. The Hoh in the rain is the point, not a disappointment.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "The haze is hydrocarbons released by the forest itself, and it turns every ridge into a set of receding silhouettes. It is the most visited park in America and still has 150 quiet trails if you walk a mile past the trailhead.",
    bestMonths: [4, 5, 6, 9, 10],
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
    body:
      "A hundred miles of the Blue Ridge with the Appalachian Trail running parallel to the road, which means you can walk in and out at will. October is a lottery for colour and worth the traffic.",
    bestMonths: [5, 6, 9, 10],
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
    body:
      "Highway 1 hangs over the Pacific here for one of the best coastal drives on earth, and the redwoods start one ridge inland. Stop at Pfeiffer Beach at low tide and Bixby Bridge before the fog burns off.",
    bestMonths: [4, 5, 9, 10, 11],
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
    body:
      "The canyon is a crack in Navajo sandstone that flash floods widened over millennia into a twisting corridor, and at midday the light comes down in beams. It is on Navajo land, guided only, and worth booking weeks ahead.",
    bestMonths: [3, 4, 5, 9, 10],
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
    body:
      "Kīlauea has been erupting on and off for four decades, and when it does, the glow is visible from the rim without a hike. The park is also a rainforest, which is not what most people picture.",
    bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
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
    body:
      "The only ways in are a boat, a helicopter or eleven miles of the Kalalau Trail, and that inaccessibility is what keeps it wild. The fluted green cliffs drop 1,200 metres straight into the Pacific.",
    bestMonths: [5, 6, 7, 8, 9],
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
    body:
      "Moraine Lake's colour comes from glacial rock flour suspended in the water, and it is as unreal in person as in photographs. The Icefields Parkway north to Jasper is the best mountain road in North America.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "Jasper is a dark-sky preserve the size of a small country, and the Columbia Icefield is the largest south of the Arctic. Fewer people, more elk, and the same mountains.",
    bestMonths: [6, 7, 8, 9],
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
    body:
      "The hills here are yellow, ochre and green because the rock is volcanic and mineral-rich, and a hot river runs through the valley for bathing. It is the start of the Laugavegur, the best multi-day walk in Iceland.",
    bestMonths: [7, 8, 9],
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
    body:
      "Grass-roofed villages sit under cliffs that drop straight into the North Atlantic, and the fog is part of the architecture. The hike to Lake Sørvágsvatn, which appears to float above the sea, is the one to do.",
    bestMonths: [6, 7, 8],
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
    body:
      "The islands look like the Alps dropped into the ocean, with fishing villages at the waterline and cod racks everywhere. In winter the aurora runs over Reine; in summer the sun does not bother setting.",
    bestMonths: [6, 7, 8, 9, 2, 3],
    difficulty: 3,
    hue: 215,
  },
  {
    slug: "tromso",
    name: "Tromsø",
    type: "city",
    region: "Troms",
    country: "Norway",
    lat: 69.65,
    lon: 18.96,
    tagline: "A city inside the aurora oval.",
    body:
      "Tromsø is the largest town above the Arctic Circle and the most reliable base for northern lights in Europe. The cable car up Storsteinen gives you the whole geometry in ten minutes.",
    bestMonths: [9, 10, 11, 1, 2, 3],
    difficulty: 1,
    hue: 220,
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
    body:
      "Rainfall here is measured in metres, which is why the cliffs are hung with temporary waterfalls that appear and vanish within the hour. Go when it rains — the fiord is at its best in bad weather.",
    bestMonths: [10, 11, 12, 1, 2, 3],
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
    body:
      "From Kala Patthar at 5,545 m you get the summit above you and the Khumbu Icefall below, which is the view most people mean when they say they have seen Everest. The walk in takes twelve days and is the real achievement.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "Thousands of quartz-sandstone columns rise out of the mist, some over 200 metres tall, and the cable car drops you among them. Go early or in rain; the clouds are what make it.",
    bestMonths: [4, 5, 9, 10],
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
    body:
      "The karsts are the remains of a seabed pushed up and eaten away by rain, and kayaking between them is the only way to feel the scale. Sleep on the water at least one night.",
    bestMonths: [10, 11, 3, 4],
    difficulty: 1,
    hue: 165,
  },
  {
    slug: "petra",
    name: "Petra",
    type: "landmark",
    region: "Ma'an",
    country: "Jordan",
    lat: 30.328,
    lon: 35.442,
    tagline: "A city cut into a canyon wall, reached through a crack.",
    body:
      "You enter through the Siq, a slot barely three metres wide in places, and the Treasury appears without warning. Two days minimum — the monastery and the high places are half-empty compared to the first view.",
    bestMonths: [3, 4, 5, 10, 11],
    difficulty: 3,
    hue: 25,
  },
  {
    slug: "machu-picchu",
    name: "Machu Picchu",
    type: "landmark",
    region: "Cusco",
    country: "Peru",
    lat: -13.163,
    lon: -72.545,
    tagline: "The citadel the clouds kept hidden.",
    body:
      "The Inca site sits in a saddle between two peaks at 2,430 m, and Huayna Picchu behind it is the photograph everyone is trying to take. Arrive at opening; by ten it is a queue.",
    bestMonths: [5, 6, 7, 8, 9],
    difficulty: 3,
    hue: 155,
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
    body:
      "The Devil's Throat is a horseshoe of water 80 metres high that you reach by catwalk, and the noise arrives before the spray does. The Argentine side has the walks; the Brazilian side has the panorama.",
    bestMonths: [3, 4, 5, 8, 9, 10, 11],
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
    body:
      "The Zambezi drops 108 metres into a basalt gorge along a single fault line, throwing spray 400 metres up — the locals call it the smoke that thunders. Go in April or May when the flow is at its peak.",
    bestMonths: [4, 5, 6, 7, 8],
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
    body:
      "Uluru is 348 metres of arkose sandstone and the surrounding desert is flat for 500 kilometres in every direction, which is why it dominates. The base walk takes three hours and shows waterholes and rock art most visitors never see.",
    bestMonths: [5, 6, 7, 8, 9],
    difficulty: 2,
    hue: 15,
  },
  {
    slug: "santorini",
    name: "Santorini",
    type: "city",
    region: "Cyclades",
    country: "Greece",
    lat: 36.393,
    lon: 25.461,
    tagline: "A caldera rim of white villages over deep blue.",
    body:
      "The island is the remains of a volcanic eruption that ended the Minoan world, and the villages cling to the inside of the crater. Oia at sunset is a scrum; walk an hour north instead and have the same view.",
    bestMonths: [5, 6, 9, 10],
    difficulty: 1,
    hue: 220,
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    type: "city",
    region: "Kansai",
    country: "Japan",
    lat: 35.011,
    lon: 135.768,
    tagline: "Sixteen hundred temples and one very good hour before dawn.",
    body:
      "Fushimi Inari's tunnels of vermilion gates are open all night, which is the trick — go at 5am and have them alone. The city rewards walking north along the Kamo river more than any itinerary.",
    bestMonths: [3, 4, 10, 11],
    difficulty: 1,
    hue: 340,
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
    body:
      "The Tallulah River cuts a two-mile canyon 300 metres deep, and the rim trails give you five overlooks and the suspension bridge over the floor. Permits for the gorge floor are limited and worth the trouble — the sliding rock and Bridal Veil are down there.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "Georgia's tallest waterfall falls in a single cascade you can walk beside on a stairway, which is why it is everyone's first hike. The visitor centre here is the southern approach to the AT — Springer Mountain is 8.5 miles up the trail.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "The summit is a short paved climb from the parking area, with a tower that on a clear day shows Atlanta's skyline, the Smokies and both Carolinas. Come in late October for the colour; come at dawn to have the ridge to yourself.",
    bestMonths: [5, 6, 9, 10],
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
    body:
      "The climb from Neels Gap is 2.2 miles of switchbacks to the state's highest point on the Appalachian Trail, ending on open rock with a stone shelter from the 1930s. It is the most satisfying short summit in the state.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "The 2.2-mile climb ends on a bare granite face with 800 feet of air below and the whole Sautee valley in front of you. It is a short hike that photographs like a big one.",
    bestMonths: [3, 4, 5, 9, 10, 11, 12],
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
    body:
      "A 1.5-mile climb from Beegum Gap puts you on a stone observation deck above the trees, looking straight into the Blue Ridge. It is the best sunset summit in the northeast corner of the state.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "The summit is an open meadow at 4,430 feet with a view south over the Chattahoochee forest and north into the Nantahala. It is on the AT, which means through-hikers but almost nobody else.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "A bronze plaque on a rock marks the southern terminus of the 2,190-mile trail, and in March you will meet people starting the whole thing. The 8.5-mile approach from Amicalola is the ceremonial first day.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "The canyon sits on Lookout Mountain where Sitton Gulch Creek cuts through sandstone, and the descent to Cherokee Falls is 600 metal steps. The west rim trail at sunset is the quiet alternative.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "The gullies are up to 150 feet deep and were carved in under two centuries by runoff from cleared farmland, which makes it a canyon with a start date. The colours come from iron and manganese in the soil — pink, ochre, white.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "The water is tea-dark from tannins and the prairies open into skies full of herons, ibis and alligators that have no interest in you. Paddle the canal at dawn; the swamp is loud and entirely alive.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "Reachable only by ferry, Cumberland is Georgia's largest barrier island and mostly wilderness, with feral horses on the beach and maritime forest behind it. Day visitors see a fraction; camp at Stafford and walk north.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "The north end is a boneyard of bleached oak skeletons on sand, which is why every photographer in the state has been here at sunrise. The rest of the island is a 1920s millionaires' club, preserved and bikeable.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "Sapelo is reached by a state ferry and has no bridge, no hotels and one of the last Gullah-Geechee communities in the country at Hog Hammock. The beach on the south end is 165 acres of untouched dunes.",
    bestMonths: [4, 5, 9, 10],
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
    body:
      "It is a 825-foot monadnock you can walk up in half an hour, with Atlanta on the horizon and a Confederate carving on the north face that the state is still arguing about. The walk-up trail is the honest way to see it.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "The battlefield park preserves miles of trenches from the 1864 Atlanta campaign, and the summit trail gives you the best skyline view in metro Atlanta. It is the city's best argument for owning hiking boots.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "The solution pits on the rock hold diamorpha, a red succulent that turns the surface crimson in spring and exists almost only here. Walk the boardwalk at sunrise and it looks like another planet.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "The New Manchester mill burned in 1864 and its five-storey brick skeleton still stands at the creek, which is why the park feels like a set. The white trail follows the water to the shoals and takes about two hours.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 2,
    hue: 126,
  },
  {
    slug: "etowah-mounds",
    name: "Etowah Mounds",
    type: "landmark",
    region: "Bartow County, Georgia",
    country: "United States",
    lat: 34.12,
    lon: -84.72,
    tagline: "Six flat-topped mounds from a city that predates Columbus.",
    body:
      "This was a Mississippian town of several thousand people between 1000 and 1550 CE, with a plaza, a defensive ditch and a chief's mound 63 feet high. The museum's copper and marble regalia came out of the ground here.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 1,
    hue: 30,
  },
  {
    slug: "ocmulgee-mounds",
    name: "Ocmulgee Mounds",
    type: "landmark",
    region: "Bibb County, Georgia",
    country: "United States",
    lat: 32.84,
    lon: -83.6,
    tagline: "Seventeen thousand years of people, in one river bend.",
    body:
      "The park holds mounds, an Earth Lodge floor last used around 1100 CE, and traces of continuous habitation going back to the ice age. It is on the shortlist to become Georgia's first national park.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 1,
    hue: 34,
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
    body:
      "The wall zigzags along the crest and has been attributed to everything from Woodland-era defence to Welsh explorers, with no consensus. The overlook behind it drops into the Cohutta Wilderness.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "Thirty-seven thousand acres of steep ridges and trout streams with no roads, shared with Tennessee and crossed by the Jacks River. It is the closest thing the Southeast has to real backcountry.",
    bestMonths: [4, 5, 6, 9, 10],
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
    body:
      "The falls are 25 feet high and 80 wide, and the classic route to them involves fording the Jacks River more than forty times. Wear shoes you trust and go in low water.",
    bestMonths: [5, 6, 7, 8, 9],
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
    body:
      "Dodd Creek shears through a notch in the cliff and falls in a fine spray, and the rock around it is green with moss year-round. The 5-mile round trip is one of the best in the state.",
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
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
    body:
      "Dukes Creek drops 150 feet in two stages into a shaded gorge below the Richard Russell Scenic Highway. The viewing deck is a short walk, which makes it the easiest big waterfall in the mountains.",
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
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
    body:
      "A lower and an upper fall sit a few hundred yards apart on Helton Creek, and the walk in is flat enough for anyone. It is the waterfall to take someone who does not hike.",
    bestMonths: [4, 5, 6, 7, 9, 10],
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
    body:
      "York and Curtis creeks drop 150 and 50 feet side by side off Tray Mountain, and the paved path from the visitor centre takes ten minutes. The trout stream below is stocked and beautiful.",
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
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
    body:
      "The trail follows Panther Creek for five miles through hemlock and rhododendron to a broad falls you can swim under. It is a long, flat walk in and a long, flat walk out — bring more water than you think.",
    bestMonths: [4, 5, 6, 7, 9, 10],
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
    body:
      "The park sits at 3,640 feet and the Tennessee Rock trail crosses the divide, so rain falling on one side reaches the Atlantic and the other the Gulf. Sunset from the overlook goes all the way to the Blue Ridge.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "The park was built by the Civilian Conservation Corps and the stone cabins and lake are still the originals, which gives it a period feel. The Bear Hair Gap trail climbs to a view back over the valley.",
    bestMonths: [4, 5, 6, 9, 10, 11],
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
    body:
      "Burton is a TVA-style reservoir built in 1919 and still ringed by national forest on two sides, with water clear enough to see bottom in places. Rent a boat and go north to the narrows.",
    bestMonths: [5, 6, 7, 8, 9],
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
    body:
      "Roosevelt came here for the warm springs and stayed for the ridge, and the state park now holds his house and the best sunset overlook in west Georgia. Walk the Dowdell's Knob trail to the spot where he took his meals.",
    bestMonths: [3, 4, 5, 10, 11],
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
    body:
      "One of Georgia's seven natural wonders, the spring pumps 70,000 gallons a minute at a constant 68°F and fills a pool of unreal blue. The casino that stood here is gone; the water is not.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "The park is built around a mill pond full of tupelo and bald cypress, with a boardwalk that puts you at water level. It is one of the quietest places in the state and nobody seems to know.",
    bestMonths: [3, 4, 5, 9, 10, 11],
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
    body:
      "An hour east of the city, with a swimming lake, a golf course and fourteen miles of trail through oak and hickory. It is not wilderness, but it is the easiest dose of woods available on a Tuesday.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 1,
    hue: 122,
  },
  {
    slug: "savannah",
    name: "Savannah",
    type: "city",
    region: "Chatham County, Georgia",
    country: "United States",
    lat: 32.08,
    lon: -81.09,
    tagline: "Twenty-two squares of live oak and Spanish moss.",
    body:
      "The historic district is a 1733 grid with a square every few blocks, which is why it is the most walkable city in the South. Go in March for the azaleas, and walk the river at night.",
    bestMonths: [3, 4, 5, 10, 11],
    difficulty: 1,
    hue: 100,
  },
  {
    slug: "atlanta",
    name: "Atlanta",
    type: "city",
    region: "Fulton County, Georgia",
    country: "United States",
    lat: 33.749,
    lon: -84.388,
    tagline: "A city built inside a forest, with the BeltLine running through it.",
    body:
      "The tree canopy is the densest of any major American city, and the BeltLine has turned old rail corridors into a 22-mile loop of trail and art. Start at Piedmont Park and walk south.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 1,
    hue: 110,
  },
  {
    slug: "athens",
    name: "Athens",
    type: "city",
    region: "Clarke County, Georgia",
    country: "United States",
    lat: 33.96,
    lon: -83.38,
    tagline: "A college town that accidentally invented a genre of rock.",
    body:
      "R.E.M., the B-52s and Neutral Milk Hotel all came out of a few blocks downtown, and the Georgia Theatre still books the kind of bill that shouldn't play a town this size. Eat at Weaver D's.",
    bestMonths: [3, 4, 5, 9, 10, 11],
    difficulty: 1,
    hue: 320,
  },
];

/* ── Atlas ──────────────────────────────────────────────────
   ​1,060 national parks, peaks and World Heritage sites pulled from Wikidata
   (CC0) by scripts/build-atlas.py. These are structured records: real
   coordinates and facts, no invented prose. */

interface AtlasRow {
  wd: string;
  slug: string;
  name: string;
  type: "peak" | "park" | "landmark";
  country: string;
  lat: number;
  lon: number;
  elevation: number | null;
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
  city: 282,
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
  return `World Heritage Site in ${country}`;
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
  };
});

export const PLACES: Place[] = [
  ...CURATED.map((p) => ({ ...p, curated: true })),
  ...ATLAS,
];

export const CURATED_COUNT = CURATED.length;
export const CURATED_PLACES = PLACES.filter((p) => p.curated);

export const bySlug = new Map(PLACES.map((p) => [p.slug, p]));

export const FEATURED = PLACES.filter((p) => p.featured);

export const GEORGIA = PLACES.filter((p) => p.region?.includes("Georgia"));

export function nearbyFor(place: Place, count = 3): Place[] {
  return PLACES.filter((p) => p.slug !== place.slug)
    .map((p) => ({
      p,
      d:
        Math.hypot(p.lat - place.lat, p.lon - place.lon) +
        (p.type === place.type ? 0 : 6),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.p);
}

export const COUNTRY_COUNT = new Set(PLACES.map((p) => p.country)).size;
