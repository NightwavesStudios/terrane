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
  trips: Trip[];
}

export interface NewTripInput {
  title?: string;
  date: string;
  precision: DatePrecision;
  source: TripSource;
  notes?: string;
  peakSlugs: string[];
  outcome: PeakOutcome;
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
