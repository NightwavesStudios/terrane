/**
 * Goal vocabulary.
 *
 * A goal is an intention measured only by what has been logged — there are no
 * forecasts, no scheduled outings and no live tracking anywhere in the model.
 */
export type GoalMetric =
  | "summits"
  | "places"
  | "elevation"
  | "continents"
  | "volcanoes"
  | "regions"
  | "list";

export interface GoalMetricMeta {
  label: string;
  unit: string;
  hint: string;
  step: number;
  min: number;
}

export const GOAL_METRICS: Record<Exclude<GoalMetric, "list">, GoalMetricMeta> = {
  summits: {
    label: "Summits",
    unit: "summits",
    hint: "Every outing marked as a summit, this season.",
    step: 1,
    min: 1,
  },
  places: {
    label: "New places",
    unit: "places",
    hint: "Distinct places visited or climbed, this season.",
    step: 1,
    min: 1,
  },
  elevation: {
    label: "Summit elevation",
    unit: "m",
    hint: "The combined height of every distinct summit in the season.",
    step: 500,
    min: 100,
  },
  continents: {
    label: "Continents",
    unit: "continents",
    hint: "Different continents with at least one outing, this season.",
    step: 1,
    min: 1,
  },
  volcanoes: {
    label: "Volcanoes",
    unit: "volcano summits",
    hint: "Summits on places classed as volcanoes, this season.",
    step: 1,
    min: 1,
  },
  regions: {
    label: "Ranges & regions",
    unit: "regions",
    hint: "Different ranges, massifs or wild regions, this season.",
    step: 1,
    min: 1,
  },
};

export const CUSTOM_METRICS = Object.keys(GOAL_METRICS) as Exclude<GoalMetric, "list">[];

export interface GoalPreset {
  id: string;
  title: string;
  note: string;
  metric: GoalMetric;
  target: number;
  scope: "season" | "all";
  listId?: string;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "preset-ten-summits",
    title: "Ten summits",
    note: "A steady season rather than a single push.",
    metric: "summits",
    target: 10,
    scope: "season",
  },
  {
    id: "preset-six-places",
    title: "Six new places",
    note: "Somewhere you have never stood before, six times over.",
    metric: "places",
    target: 6,
    scope: "season",
  },
  {
    id: "preset-three-continents",
    title: "Three continents",
    note: "Make the season a wider map.",
    metric: "continents",
    target: 3,
    scope: "season",
  },
  {
    id: "preset-four-volcanoes",
    title: "Four volcanoes",
    note: "For the summer the ground is the destination.",
    metric: "volcanoes",
    target: 4,
    scope: "season",
  },
  {
    id: "preset-ten-thousand",
    title: "10,000 m of summits",
    note: "Add up the summits; the number is only a way of looking.",
    metric: "elevation",
    target: 10000,
    scope: "season",
  },
  {
    id: "preset-seven-summits",
    title: "The Seven Summits",
    note: "The long list. It may take a lifetime, which is the point.",
    metric: "list",
    target: 7,
    scope: "all",
    listId: "seven-summits",
  },
  {
    id: "preset-volcanic-seven",
    title: "The Volcanic Seven",
    note: "The same seven continents, on hotter ground.",
    metric: "list",
    target: 7,
    scope: "all",
    listId: "volcanic-seven",
  },
];
