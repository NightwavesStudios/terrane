import type { RecordData } from "../types/account";
import type { Profile, RecordState } from "../types/record";

export interface RecordSnapshot {
  profile: Profile;
  record: RecordState;
  revision: number;
}

export class RevisionConflict extends Error {
  readonly current: RecordSnapshot;

  constructor(current: RecordSnapshot) {
    super("The record changed in another session.");
    this.name = "RevisionConflict";
    this.current = current;
  }
}

export interface Repository {
  getProfile(userId: string): Promise<Profile | null>;
  createProfile(profile: Profile): Promise<Profile>;
  getRecord(profile: Profile): Promise<RecordSnapshot>;
  saveRecord(
    profile: Profile,
    data: RecordData,
    expectedRevision: number,
  ): Promise<{ revision: number }>;
  updateProfile(
    userId: string,
    patch: { displayName?: string; units?: Profile["units"] },
  ): Promise<Profile>;
  deleteAccount(userId: string): Promise<void>;
}

export function emptyRecord(profile: Profile): RecordState {
  return {
    profile,
    startedLists: [],
    listStarts: {},
    badges: [],
    listCompletions: [],
    trips: [],
  };
}
