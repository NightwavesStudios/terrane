import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { NH48_LIST, NH48_PEAKS } from "../data/nh48";
import { listProgress, statsFor, summitSlugs } from "../lib/progress";
import type {
  NewTripInput,
  Profile,
  RecordState,
  Trip,
} from "../types/record";

const STORAGE_KEY = "terrane.record.v1";

const EMPTY: RecordState = {
  profile: null,
  startedLists: [],
  trips: [],
};

interface RecordContextValue {
  profile: Profile | null;
  startedLists: string[];
  trips: Trip[];
  hydrated: boolean;
  completedSlugs: Set<string>;
  progress: ReturnType<typeof listProgress>;
  stats: ReturnType<typeof statsFor>;
  signIn: (displayName: string, email: string) => void;
  updateProfile: (displayName: string, email: string, units?: Profile["units"]) => void;
  setUnits: (units: Profile["units"]) => void;
  signOut: () => void;
  startList: (listId?: string) => void;
  addTrip: (input: NewTripInput) => Trip;
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
    peaks: input.peakSlugs.map((slug) => ({ slug, outcome: input.outcome })),
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
    setState((current) => ({
      ...current,
      startedLists: current.startedLists.includes(listId)
        ? current.startedLists
        : [...current.startedLists, listId],
    }));
  }, []);

  const addTrip = useCallback((input: NewTripInput) => {
    const trip = tripFrom(input);
    setState((current) => ({ ...current, trips: [trip, ...current.trips] }));
    return trip;
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

  const completedSlugs = useMemo(() => summitSlugs(state.trips), [state.trips]);
  const progress = useMemo(
    () => listProgress(state.trips, state.startedLists),
    [state.trips, state.startedLists],
  );
  const stats = useMemo(() => statsFor(state.trips), [state.trips]);

  const value = useMemo<RecordContextValue>(
    () => ({
      profile: state.profile,
      startedLists: state.startedLists,
      trips: state.trips,
      hydrated,
      completedSlugs,
      progress,
      stats,
      signIn,
      updateProfile,
      setUnits,
      signOut,
      startList,
      addTrip,
      updateTrip,
      deleteTrip,
      deleteRecord,
    }),
    [
      state.profile,
      state.startedLists,
      state.trips,
      hydrated,
      completedSlugs,
      progress,
      stats,
      signIn,
      updateProfile,
      setUnits,
      signOut,
      startList,
      addTrip,
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

export const PEAK_NAMES = new Map(NH48_PEAKS.map((peak) => [peak.slug, peak.name]));
