export type DatePrecision = "day" | "month" | "year";
export type TripSource = "manual" | "backfill";
export type PeakOutcome = "summit" | "attempt" | "traverse";

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  units: "metric" | "imperial";
  createdAt: string;
}

export interface TripPeak {
  slug: string;
  outcome: PeakOutcome;
}

export interface Trip {
  id: string;
  title: string;
  date: string;
  precision: DatePrecision;
  source: TripSource;
  notes: string;
  peaks: TripPeak[];
  createdAt: string;
  updatedAt: string;
}

export interface RecordState {
  profile: Profile | null;
  startedLists: string[];
  /** Edition and membership captured when a list was started. */
  listStarts: Record<string, ListStart>;
  trips: Trip[];
}

export interface ListStart {
  version: string;
  edition: string;
  peakSlugs: string[];
  startedAt: string;
}

export interface NewTripInput {
  title?: string;
  date: string;
  precision: DatePrecision;
  source: TripSource;
  notes?: string;
  peakSlugs: string[];
  outcome: PeakOutcome;
  /** Per-peak outcomes for imports and multi-outcome trips. */
  peaks?: TripPeak[];
}

export interface ListProgress {
  listId: string;
  total: number;
  completed: number;
  remaining: number;
  percent: number;
  completedSlugs: Set<string>;
  started: boolean;
}
