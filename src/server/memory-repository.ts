import type { RecordData } from "../types/account";
import type { Profile, RecordState } from "../types/record";
import {
  RevisionConflict,
  emptyRecord,
  type RecordSnapshot,
  type Repository,
} from "./repository";

interface Stored {
  profile: Profile;
  record: RecordState;
  revision: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryRepository implements Repository {
  private readonly users = new Map<string, Stored>();

  async getProfile(userId: string): Promise<Profile | null> {
    const stored = this.users.get(userId);
    return stored ? clone(stored.profile) : null;
  }

  async createProfile(profile: Profile): Promise<Profile> {
    const existing = this.users.get(profile.id);
    if (existing) return clone(existing.profile);
    this.users.set(profile.id, {
      profile: clone(profile),
      record: emptyRecord(profile),
      revision: 0,
    });
    return clone(profile);
  }

  async getRecord(profile: Profile): Promise<RecordSnapshot> {
    const stored = this.users.get(profile.id);
    if (!stored) throw new Error("Profile not found.");
    stored.record.profile = profile;
    return {
      profile: clone(profile),
      record: clone(stored.record),
      revision: stored.revision,
    };
  }

  async saveRecord(
    profile: Profile,
    data: RecordData,
    expectedRevision: number,
  ): Promise<{ revision: number }> {
    const stored = this.users.get(profile.id);
    if (!stored) throw new Error("Profile not found.");
    if (stored.revision !== expectedRevision) {
      throw new RevisionConflict(await this.getRecord(profile));
    }
    stored.revision += 1;
    stored.record = { profile, ...clone(data) };
    return { revision: stored.revision };
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string; units?: Profile["units"] },
  ): Promise<Profile> {
    const stored = this.users.get(userId);
    if (!stored) throw new Error("Profile not found.");
    if (patch.displayName) stored.profile.displayName = patch.displayName;
    if (patch.units) stored.profile.units = patch.units;
    stored.record.profile = stored.profile;
    return clone(stored.profile);
  }

  async deleteAccount(userId: string): Promise<void> {
    this.users.delete(userId);
  }
}
