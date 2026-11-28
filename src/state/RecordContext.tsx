import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildFacts } from "../badges/facts";
import { missingLaunchAwards, sourceTripForBadge } from "../badges/awards";
import { getList, PEAKS } from "../data/lists";
import { NH48_LIST } from "../data/nh48";
import { missingCompletions } from "../lib/completions";
import { listProgress, statsFor, summitSlugs } from "../lib/progress";
import type { Units } from "../lib/format";
import { ApiError, deleteAccount, fetchAccount, saveRecord, signOutNow, updateAccountProfile } from "../lib/api";
import { mergeRecords, recordData } from "../lib/mergeRecords";
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
const UNITS_KEY = "terrane.units.v1";

const EMPTY: RecordState = {
  profile: null,
  startedLists: [],
  listStarts: {},
  badges: [],
  listCompletions: [],
  trips: [],
};

type SyncState = "idle" | "saving" | "saved" | "error";
type Mode = "guest" | "account";

interface RecordContextValue {
  profile: Profile | null;
  units: Units;
  startedLists: string[];
  listStarts: Record<string, ListStart>;
  badges: BadgeAward[];
  listCompletions: ListCompletion[];
  badgeFacts: ReturnType<typeof buildFacts>;
  trips: Trip[];
  hydrated: boolean;
  mode: Mode;
  syncState: SyncState;
  syncError: string;
  localRecord: RecordState | null;
  completedSlugs: Set<string>;
  progress: ReturnType<typeof listProgress>;
  progressFor: (listId: string) => ReturnType<typeof listProgress>;
  stats: ReturnType<typeof statsFor>;
  updateProfile: (displayName: string, units: Units) => Promise<void>;
  setUnits: (units: Units) => Promise<void>;
  signOut: () => void;
  startList: (listId?: string) => void;
  addTrip: (input: NewTripInput) => Trip;
  importTrips: (inputs: NewTripInput[]) => Trip[];
  mergeTripPeaks: (id: string, peaks: TripPeak[]) => void;
  updateTrip: (id: string, input: NewTripInput) => void;
  deleteTrip: (id: string) => void;
  deleteRecord: () => Promise<void>;
  importLocalRecord: () => Promise<void>;
  retrySync: () => void;
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

function hasLocalData(record: RecordState): boolean {
  return record.trips.length > 0 || record.startedLists.length > 0;
}

function readUnitsPreference(): Units {
  if (typeof window === "undefined") return "imperial";
  try {
    const stored = window.localStorage.getItem(UNITS_KEY);
    return stored === "metric" || stored === "imperial" ? stored : "imperial";
  } catch {
    return "imperial";
  }
}

function storeUnitsPreference(units: Units): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNITS_KEY, units);
  } catch {
    // A blocked storage quota should not prevent the current view from changing.
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

function conflictPayload(error: unknown): { revision: number; record: RecordState } | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const payload = error.payload as { revision?: unknown; record?: unknown } | null;
  if (!payload || typeof payload.revision !== "number" || !payload.record) return null;
  return { revision: payload.revision, record: payload.record as RecordState };
}

export function RecordProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordState>(EMPTY);
  const [localUnits, setLocalUnits] = useState<Units>(readUnitsPreference);
  const [mode, setMode] = useState<Mode>("guest");
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState("");
  const [localRecord, setLocalRecord] = useState<RecordState | null>(null);
  const [saveTick, setSaveTick] = useState(0);

  const stateRef = useRef(state);
  const modeRef = useRef(mode);
  const hydratedRef = useRef(hydrated);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    hydratedRef.current = hydrated;
  }, [hydrated]);

  useEffect(() => {
    const stored = readStored();
    setLocalRecord(hasLocalData(stored) ? stored : null);

    let cancelled = false;
    async function boot() {
      try {
        const account = await fetchAccount();
        if (cancelled) return;
        revisionRef.current = account.revision;
        stateRef.current = account.record;
        setState(account.record);
        if (account.record.profile) {
          setLocalUnits(account.record.profile.units);
          storeUnitsPreference(account.record.profile.units);
        }
        setMode("account");
        setSyncState("saved");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          setMode("guest");
          setState(EMPTY);
        } else {
          setMode("guest");
          setState(EMPTY);
          setSyncState("error");
          setSyncError(
            error instanceof Error
              ? error.message
              : "The account service could not be reached.",
          );
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveTick((value) => value + 1);
  }, []);

  flushRef.current = async () => {
    if (
      !hydratedRef.current ||
      modeRef.current !== "account" ||
      !dirtyRef.current ||
      inFlightRef.current
    ) {
      return;
    }

    const snapshot = stateRef.current;
    dirtyRef.current = false;
    inFlightRef.current = true;
    setSyncState("saving");

    try {
      const result = await saveRecord(recordData(snapshot), revisionRef.current);
      revisionRef.current = result.revision;
      setSyncState("saved");
      setSyncError("");
    } catch (error) {
      const conflict = conflictPayload(error);
      if (conflict) {
        const merged = mergeRecords(conflict.record, snapshot);
        revisionRef.current = conflict.revision;
        stateRef.current = merged;
        setState(merged);
        dirtyRef.current = true;
        setSyncError("This record changed in another session. Both copies were merged.");
        setSyncState("saving");
      } else if (error instanceof ApiError && error.status === 401) {
        modeRef.current = "guest";
        setMode("guest");
        setState(EMPTY);
        setSyncState("idle");
        setSyncError("Your session expired. Sign in again to keep syncing.");
      } else {
        dirtyRef.current = true;
        setSyncState("error");
        setSyncError(
          error instanceof Error ? error.message : "The record could not be saved.",
        );
      }
    } finally {
      inFlightRef.current = false;
      if (dirtyRef.current && modeRef.current === "account") {
        window.setTimeout(() => void flushRef.current(), 600);
      }
    }
  };

  useEffect(() => {
    if (!hydrated || mode !== "account" || !dirtyRef.current) return;
    const timer = window.setTimeout(() => void flushRef.current(), 350);
    return () => window.clearTimeout(timer);
  }, [state, mode, hydrated, saveTick]);

  const retrySync = useCallback(() => {
    setSyncError("");
    setSyncState("saving");
    markDirty();
  }, [markDirty]);

  const updateProfile = useCallback(
    async (displayName: string, units: Units) => {
      if (!stateRef.current.profile) throw new Error("Sign in to edit the profile.");
      const result = await updateAccountProfile({ displayName, units });
      setState((current) => ({ ...current, profile: result.profile }));
      setLocalUnits(result.profile.units);
      storeUnitsPreference(result.profile.units);
    },
    [],
  );

  const setUnits = useCallback(async (units: Units) => {
    setLocalUnits(units);
    storeUnitsPreference(units);

    const current = stateRef.current.profile;
    if (!current || current.units === units) return;

    const previous = current.units;
    setState((value) =>
      value.profile ? { ...value, profile: { ...value.profile, units } } : value,
    );
    try {
      const result = await updateAccountProfile({ units });
      setState((value) =>
        value.profile ? { ...value, profile: result.profile } : value,
      );
    } catch (error) {
      setState((value) =>
        value.profile
          ? { ...value, profile: { ...value.profile, units: previous } }
          : value,
      );
      throw error;
    }
  }, []);

  const signOut = useCallback(() => {
    void signOutNow()
      .catch(() => undefined)
      .finally(() => window.location.assign("/"));
  }, []);

  const startList = useCallback(
    (listId: string = NH48_LIST.id) => {
      if (!stateRef.current.profile) return;
      const list = getList(listId);
      if (!list) return;
      setState((current) => {
        if (current.startedLists.includes(listId)) return current;
        return {
          ...current,
          startedLists: [...current.startedLists, listId],
          listStarts: {
            ...current.listStarts,
            [listId]: {
              version: list.version,
              edition: list.edition,
              peakSlugs: list.peaks.map((peak) => peak.slug),
              startedAt: new Date().toISOString(),
            },
          },
        };
      });
      markDirty();
    },
    [markDirty],
  );

  const addTrip = useCallback(
    (input: NewTripInput) => {
      const trip = tripFrom(input);
      setState((current) => ({ ...current, trips: [trip, ...current.trips] }));
      markDirty();
      return trip;
    },
    [markDirty],
  );

  const importTrips = useCallback(
    (inputs: NewTripInput[]) => {
      const created = inputs.map((input) => tripFrom(input));
      if (created.length) {
        setState((current) => ({ ...current, trips: [...created, ...current.trips] }));
        markDirty();
      }
      return created;
    },
    [markDirty],
  );

  const mergeTripPeaks = useCallback(
    (id: string, peaks: TripPeak[]) => {
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
      markDirty();
    },
    [markDirty],
  );

  const updateTrip = useCallback(
    (id: string, input: NewTripInput) => {
      setState((current) => ({
        ...current,
        trips: current.trips.map((trip) =>
          trip.id === id ? tripFrom(input, trip) : trip,
        ),
      }));
      markDirty();
    },
    [markDirty],
  );

  const deleteTrip = useCallback(
    (id: string) => {
      setState((current) => ({
        ...current,
        trips: current.trips.filter((trip) => trip.id !== id),
      }));
      markDirty();
    },
    [markDirty],
  );

  const deleteRecord = useCallback(async () => {
    if (modeRef.current === "account") {
      await deleteAccount();
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.assign("/");
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setLocalRecord(null);
    setState(EMPTY);
  }, []);

  const importLocalRecord = useCallback(async () => {
    const local = localRecord;
    const current = stateRef.current;
    if (!local || !current.profile) return;

    let merged = mergeRecords(current, local);
    setSyncState("saving");
    try {
      let result;
      try {
        result = await saveRecord(recordData(merged), revisionRef.current);
      } catch (error) {
        const conflict = conflictPayload(error);
        if (!conflict) throw error;
        merged = mergeRecords(conflict.record, merged);
        revisionRef.current = conflict.revision;
        result = await saveRecord(recordData(merged), conflict.revision);
      }
      revisionRef.current = result.revision;
      stateRef.current = merged;
      setState(merged);
      setLocalRecord(null);
      window.localStorage.removeItem(STORAGE_KEY);
      setSyncState("saved");
      setSyncError("");
    } catch (error) {
      setSyncState("error");
      setSyncError(error instanceof Error ? error.message : "The local record could not be imported.");
      throw error;
    }
  }, [localRecord]);

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
    if (!hydrated || !state.profile) return;
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
      markDirty();
    }
  }, [hydrated, state.trips, state.startedLists, state.listStarts, listCompletions, state.profile, markDirty]);

  useEffect(() => {
    if (!hydrated || !state.profile) return;
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
      markDirty();
    }
  }, [hydrated, badgeFacts, badges, state.trips, state.profile, state.startedLists, state.listStarts, listCompletions, markDirty]);

  const units = state.profile?.units ?? localUnits;
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
      units,
      startedLists: state.startedLists,
      listStarts: state.listStarts,
      badges,
      listCompletions,
      badgeFacts,
      trips: state.trips,
      hydrated,
      mode,
      syncState,
      syncError,
      localRecord,
      completedSlugs,
      progress,
      progressFor,
      stats,
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
      importLocalRecord,
      retrySync,
    }),
    [
      state.profile,
      units,
      state.startedLists,
      state.listStarts,
      badges,
      listCompletions,
      badgeFacts,
      state.trips,
      hydrated,
      mode,
      syncState,
      syncError,
      localRecord,
      completedSlugs,
      progress,
      progressFor,
      stats,
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
      importLocalRecord,
      retrySync,
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
