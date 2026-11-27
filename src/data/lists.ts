/** Curated lists: two canonical challenges and Terrane's own collections. */
export type ListKind = "canonical" | "collection";

export interface AdventureList {
  id: string;
  name: string;
  kind: ListKind;
  scope: string;
  description: string;
  members: string[];
}

export const LISTS: AdventureList[] = [
  {
    id: "seven-summits",
    name: "The Seven Summits",
    kind: "canonical",
    scope: "Seven continents",
    description:
      "The highest summit on each continent. The list most people mean when they say they are collecting summits.",
    members: [
      "everest",
      "aconcagua",
      "denali",
      "kilimanjaro",
      "elbrus",
      "vinson",
      "puncak-jaya",
    ],
  },
  {
    id: "volcanic-seven",
    name: "The Volcanic Seven",
    kind: "canonical",
    scope: "Seven continents",
    description:
      "The highest volcano on each continent — a hotter, stranger version of the same idea.",
    members: [
      "ojos-del-salado",
      "kilimanjaro",
      "elbrus",
      "orizaba",
      "giluwe",
      "sidley",
      "damavand",
    ],
  },
  {
    id: "alps-4000",
    name: "Alps, 4,000 m and up",
    kind: "collection",
    scope: "The Alps",
    description:
      "A short Terrane collection of the range's most legible high summits, one from each of its great massifs.",
    members: [
      "mont-blanc",
      "dufourspitze",
      "matterhorn",
      "gran-paradiso",
      "barre-des-ecrins",
    ],
  },
  {
    id: "great-walks",
    name: "The Great Walks",
    kind: "collection",
    scope: "Worldwide",
    description:
      "Long trails where the walking is the point: high routes, fiords, and one very deep gorge.",
    members: [
      "everest-base-camp",
      "annapurna-base-camp",
      "tour-du-mont-blanc",
      "laugavegur",
      "milford-track",
      "routeburn-track",
      "overland-track",
      "torres-del-paine",
      "tiger-leaping-gorge",
    ],
  },
  {
    id: "desert-light",
    name: "Desert Light",
    kind: "collection",
    scope: "Worldwide",
    description:
      "Dunes, salt and dry stone, chosen for the hour when the ground turns the colour of fire.",
    members: [
      "wadi-rum",
      "sossusvlei",
      "erg-chebbi",
      "death-valley",
      "salar-de-uyuni",
      "valle-de-la-luna",
      "uluru",
    ],
  },
  {
    id: "american-high-points",
    name: "American High Points",
    kind: "collection",
    scope: "United States",
    description:
      "Ten high points from Alaska to Hawaii via the Sierra, the Cascades and the southern Appalachians.",
    members: [
      "denali",
      "rainier",
      "whitney",
      "elbert",
      "grand-teton",
      "longs-peak",
      "hood",
      "shasta",
      "mitchell",
      "mauna-kea",
    ],
  },
  {
    id: "island-high-points",
    name: "Island High Points",
    kind: "collection",
    scope: "Worldwide",
    description:
      "Summits that begin with a boat or a flight: five islands, five different ideas of an edge.",
    members: ["kinabalu", "rinjani", "teide", "hallasan", "aoraki"],
  },
];

export function listById(id: string | undefined): AdventureList | undefined {
  return LISTS.find((list) => list.id === id);
}
