import type { RecordData } from "../types/account";
import type { Profile, RecordState } from "../types/record";
import type { D1Database } from "./d1";
import {
  RevisionConflict,
  emptyRecord,
  type RecordSnapshot,
  type Repository,
} from "./repository";
import { ensureSchema } from "./schema";

interface ProfileRow {
  user_id: string;
  display_name: string;
  email: string;
  units: string;
  created_at: string;
}

interface RecordRow {
  revision: number;
  data: string;
}

function units(value: string): Profile["units"] {
  return value === "metric" ? "metric" : "imperial";
}

function asProfile(row: ProfileRow): Profile {
  return {
    id: row.user_id,
    displayName: row.display_name,
    email: row.email,
    units: units(row.units),
    createdAt: row.created_at,
  };
}

export class D1Repository implements Repository {
  constructor(private readonly db: D1Database) {}

  async getProfile(userId: string): Promise<Profile | null> {
    await ensureSchema(this.db);
    const row = await this.db
      .prepare("SELECT user_id, display_name, email, units, created_at FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<ProfileRow>();
    return row ? asProfile(row) : null;
  }

  async createProfile(profile: Profile): Promise<Profile> {
    await ensureSchema(this.db);
    const now = new Date().toISOString();
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO profiles (user_id, display_name, email, units, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        profile.id,
        profile.displayName,
        profile.email,
        profile.units,
        profile.createdAt,
        now,
      )
      .run();
    const row = await this.db
      .prepare("SELECT user_id, display_name, email, units, created_at FROM profiles WHERE user_id = ?")
      .bind(profile.id)
      .first<ProfileRow>();
    if (!row) throw new Error("Could not create profile.");
    return asProfile(row);
  }

  async getRecord(profile: Profile): Promise<RecordSnapshot> {
    await ensureSchema(this.db);
    const row = await this.db
      .prepare("SELECT revision, data FROM user_records WHERE user_id = ?")
      .bind(profile.id)
      .first<RecordRow>();
    if (!row) {
      return { profile, record: emptyRecord(profile), revision: 0 };
    }
    const parsed = JSON.parse(row.data) as Omit<RecordState, "profile">;
    return {
      profile,
      record: { profile, ...parsed },
      revision: Number(row.revision),
    };
  }

  async saveRecord(
    profile: Profile,
    data: RecordData,
    expectedRevision: number,
  ): Promise<{ revision: number }> {
    await ensureSchema(this.db);
    const existing = await this.db
      .prepare("SELECT revision FROM user_records WHERE user_id = ?")
      .bind(profile.id)
      .first<{ revision: number }>();

    if (!existing) {
      if (expectedRevision !== 0) {
        throw new RevisionConflict(await this.getRecord(profile));
      }
      const inserted = await this.db
        .prepare(
          "INSERT INTO user_records (user_id, revision, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision",
        )
        .bind(profile.id, JSON.stringify(data), new Date().toISOString())
        .first<{ revision: number }>();
      if (inserted) return { revision: Number(inserted.revision) };
      throw new RevisionConflict(await this.getRecord(profile));
    }

    if (Number(existing.revision) !== expectedRevision) {
      throw new RevisionConflict(await this.getRecord(profile));
    }

    const updated = await this.db
      .prepare(
        "UPDATE user_records SET revision = revision + 1, data = ?, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision",
      )
      .bind(JSON.stringify(data), new Date().toISOString(), profile.id, expectedRevision)
      .first<{ revision: number }>();

    if (!updated) throw new RevisionConflict(await this.getRecord(profile));
    return { revision: Number(updated.revision) };
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string; units?: Profile["units"] },
  ): Promise<Profile> {
    await ensureSchema(this.db);
    const row = await this.db
      .prepare("SELECT user_id, display_name, email, units, created_at FROM profiles WHERE user_id = ?")
      .bind(userId)
      .first<ProfileRow>();
    if (!row) throw new Error("Profile not found.");
    const displayName = patch.displayName ?? row.display_name;
    const nextUnits = patch.units ?? units(row.units);
    await this.db
      .prepare("UPDATE profiles SET display_name = ?, units = ?, updated_at = ? WHERE user_id = ?")
      .bind(displayName, nextUnits, new Date().toISOString(), userId)
      .run();
    return asProfile({
      ...row,
      display_name: displayName,
      units: nextUnits,
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    await ensureSchema(this.db);
    await this.db.batch([
      this.db.prepare("DELETE FROM user_records WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId),
    ]);
  }
}
