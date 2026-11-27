import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildFacts } from "../badges/facts";
import { missingLaunchAwards, sourceTripForBadge } from "../badges/awards";
import { getList, PEAKS } from "../data/lists";
import { NH48_LIST } from "../data/nh48";
import { missingCompletions } from "../lib/completions";
import { listProgress, statsFor, summitSlugs } from "../lib/progress";
import type {
  BadgeAward,
  ListCompletion,
  ListStart,
  NewTripInput,
  Profile,
  RecordState,
  Trip,
  TripPeak,
} from "../types/record";

const STORAGE_KEY = "terrane.record.v1";

const EMPTY: RecordState = {
  profile: null,
  startedLists: [],
  listStarts: {},
  badges: [],
  listCompletions: [],
  trips: [],
};

interface RecordContextValue {
  profile: Profile | null;
  startedLists: string[];
  listStarts: Record<string, ListStart>;
  badges: BadgeAward[];
  listCompletions: ListCompletion[];
  badgeFacts: ReturnType<typeof buildFacts>;
  trips: Trip[];
  hydrated: boolean;
  completedSlugs: Set<string>;
  progress: ReturnType<typeof listProgress>;
  progressFor: (listId: string) => ReturnType<typeof listProgress>;
  stats: ReturnType<typeof statsFor>;
  signIn: (displayName: string, email: string) => void;
  updateProfile: (displayName: string, email: string, units?: Profile["units"]) => void;
  setUnits: (units: Profile["units"]) => void;
  signOut: () => void;
  startList: (listId?: string) => void;
  addTrip: (input: NewTripInput) => Trip;
  importTrips: (inputs: NewTripInput[]) => Trip[];
  mergeTripPeaks: (id: string, peaks: TripPeak[]) => void;
  updateTrip: (id: string, input: NewTripInput) => void;
  deleteTrip: (id: string) => void;
  deleteRecord: () => void;
}

const RecordContext = createContext<RecordContextValue | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `trip_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readStored(): RecordState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<RecordState>;
    return {
      profile: parsed.profile ?? null,
      startedLists: Array.isArray(parsed.startedLists) ? parsed.startedLists : [],
      listStarts:
        parsed.listStarts && typeof parsed.listStarts === "object" ? parsed.listStarts : {},
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
      listCompletions: Array.isArray(parsed.listCompletions) ? parsed.listCompletions : [],
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
    };
  } catch {
    return EMPTY;
  }
}

function tripFrom(input: NewTripInput, existing?: Trip): Trip {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? newId(),
    title: input.title?.trim() || "Climbing day",
    date: input.date,
    precision: input.precision,
    source: input.source,
    notes: input.notes?.trim() ?? "",
    peaks: input.peaks?.length
      ? input.peaks
      : input.peakSlugs.map((slug) => ({ slug, outcome: input.outcome })),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function RecordProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const signIn = useCallback((displayName: string, email: string) => {
    setState((current) => ({
      ...current,
      profile: {
        id: current.profile?.id ?? newId(),
        displayName: displayName.trim() || "Climber",
        email: email.trim(),
        units: current.profile?.units ?? "imperial",
        createdAt: current.profile?.createdAt ?? new Date().toISOString(),
      },
    }));
  }, []);

  const updateProfile = useCallback(
    (displayName: string, email: string, units?: Profile["units"]) => {
      setState((current) => ({
        ...current,
        profile: current.profile
          ? {
              ...current.profile,
              displayName: displayName.trim() || current.profile.displayName,
              email: email.trim(),
              units: units ?? current.profile.units,
            }
          : current.profile,
      }));
    },
    [],
  );

  const setUnits = useCallback((units: Profile["units"]) => {
    setState((current) => ({
      ...current,
      profile: current.profile ? { ...current.profile, units } : current.profile,
    }));
  }, []);

  const signOut = useCallback(() => {
    setState(EMPTY);
  }, []);

  const startList = useCallback((listId: string = NH48_LIST.id) => {
    setState((current) => {
      if (current.startedLists.includes(listId)) return current;
      const list = getList(listId);
      return {
        ...current,
        startedLists: [...current.startedLists, listId],
        listStarts: list
          ? {
              ...current.listStarts,
              [listId]: {
                version: list.version,
                edition: list.edition,
                peakSlugs: list.peaks.map((peak) => peak.slug),
                startedAt: new Date().toISOString(),
              },
            }
          : current.listStarts,
      };
    });
  }, []);

  const addTrip = useCallback((input: NewTripInput) => {
    const trip = tripFrom(input);
    setState((current) => ({ ...current, trips: [trip, ...current.trips] }));
    return trip;
  }, []);

  const importTrips = useCallback((inputs: NewTripInput[]) => {
    const created = inputs.map((input) => tripFrom(input));
    if (created.length) {
      setState((current) => ({ ...current, trips: [...created, ...current.trips] }));
    }
    return created;
  }, []);

  const mergeTripPeaks = useCallback((id: string, peaks: TripPeak[]) => {
    setState((current) => ({
      ...current,
      trips: current.trips.map((trip) => {
        if (trip.id !== id) return trip;
        const missing = peaks.filter(
          (peak) => !trip.peaks.some((existing) => existing.slug === peak.slug),
        );
        return missing.length
          ? { ...trip, peaks: [...trip.peaks, ...missing], updatedAt: new Date().toISOString() }
          : trip;
      }),
    }));
  }, []);

  const updateTrip = useCallback((id: string, input: NewTripInput) => {
    setState((current) => ({
      ...current,
      trips: current.trips.map((trip) =>
        trip.id === id ? tripFrom(input, trip) : trip,
      ),
    }));
  }, []);

  const deleteTrip = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      trips: current.trips.filter((trip) => trip.id !== id),
    }));
  }, []);

  const deleteRecord = useCallback(() => {
    setState(EMPTY);
  }, []);

  const badges = state.badges ?? [];
  const listCompletions = state.listCompletions ?? [];
  const badgeFacts = useMemo(
    () =>
      buildFacts({
        trips: state.trips,
        profile: state.profile,
        startedLists: state.startedLists,
        listStarts: state.listStarts,
        completions: listCompletions,
      }),
    [state.trips, state.profile, state.startedLists, state.listStarts, listCompletions],
  );

  useEffect(() => {
    if (!hydrated) return;
    const missing = missingCompletions(
      state.trips,
      state.startedLists,
      state.listStarts,
      listCompletions,
    );
    if (missing.length) {
      setState((current) => ({
        ...current,
        listCompletions: [...(current.listCompletions ?? []), ...missing],
      }));
    }
  }, [hydrated, state.trips, state.startedLists, state.listStarts, listCompletions]);

  useEffect(() => {
    if (!hydrated) return;
    const missing = missingLaunchAwards(badgeFacts, badges).map((award) => ({
      ...award,
      sourceTripId: sourceTripForBadge(award.badgeId, {
        trips: state.trips,
        profile: state.profile,
        startedLists: state.startedLists,
        listStarts: state.listStarts,
        completions: listCompletions,
      }),
    }));
    if (missing.length) {
      setState((current) => ({
        ...current,
        badges: [...(current.badges ?? []), ...missing],
      }));
    }
  }, [hydrated, badgeFacts, badges, state.trips]);

  const completedSlugs = useMemo(() => summitSlugs(state.trips), [state.trips]);
  const progress = useMemo(
    () => listProgress(state.trips, state.startedLists),
    [state.trips, state.startedLists],
  );
  const progressFor = useCallback(
    (listId: string) => listProgress(state.trips, state.startedLists, listId),
    [state.trips, state.startedLists],
  );
  const stats = useMemo(() => statsFor(state.trips), [state.trips]);

  const value = useMemo<RecordContextValue>(
    () => ({
      profile: state.profile,
      startedLists: state.startedLists,
      listStarts: state.listStarts,
      badges,
      listCompletions,
      badgeFacts,
      trips: state.trips,
      hydrated,
      completedSlugs,
      progress,
      progressFor,
      stats,
      signIn,
      updateProfile,
      setUnits,
      signOut,
      startList,
      addTrip,
      importTrips,
      mergeTripPeaks,
      updateTrip,
      deleteTrip,
      deleteRecord,
    }),
    [
      state.profile,
      state.startedLists,
      state.listStarts,
      badges,
      listCompletions,
      badgeFacts,
      state.trips,
      hydrated,
      completedSlugs,
      progress,
      progressFor,
      stats,
      signIn,
      updateProfile,
      setUnits,
      signOut,
      startList,
      addTrip,
      importTrips,
      mergeTripPeaks,
      updateTrip,
      deleteTrip,
      deleteRecord,
    ],
  );

  return <RecordContext.Provider value={value}>{children}</RecordContext.Provider>;
}

export function useRecord(): RecordContextValue {
  const value = useContext(RecordContext);
  if (!value) throw new Error("useRecord must be used inside RecordProvider");
  return value;
}

export const PEAK_NAMES = new Map(PEAKS.map((peak) => [peak.slug, peak.name]));
