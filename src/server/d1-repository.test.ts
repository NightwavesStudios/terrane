import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RecordData } from "../types/account";
import type { Profile } from "../types/record";
import { D1Repository } from "./d1-repository";
import type { D1Database } from "./d1";
import { RevisionConflict } from "./repository";

const profile: Profile = {
  id: "d1-user-a",
  displayName: "Avery Stone",
  email: "avery@example.com",
  units: "imperial",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function record(): RecordData {
  return {
    startedLists: ["nh48"],
    listStarts: {
      nh48: {
        version: "2026",
        edition: "2026",
        peakSlugs: ["mount-washington"],
        startedAt: "2024-07-01T10:00:00.000Z",
      },
    },
    badges: [],
    listCompletions: [],
    trips: [
      {
        id: "trip-1",
        title: "Washington",
        date: "2024-07-01",
        precision: "day",
        source: "manual",
        notes: "",
        peaks: [{ slug: "mount-washington", outcome: "summit" }],
        createdAt: "2024-07-01T10:00:00.000Z",
        updatedAt: "2024-07-01T10:00:00.000Z",
      },
    ],
  };
}

describe("D1Repository", () => {
  let mf: Miniflare;
  let repo: D1Repository;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: ["DB"],
      compatibilityDate: "2026-11-27",
    });
    const db = (await mf.getD1Database("DB")) as unknown as D1Database;
    repo = new D1Repository(db);
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it("creates a profile and persists a revisioned record in D1", async () => {
    expect(await repo.getProfile(profile.id)).toBeNull();
    const created = await repo.createProfile(profile);
    expect(created.displayName).toBe("Avery Stone");

    const empty = await repo.getRecord(created);
    expect(empty.profile.displayName).toBe("Avery Stone");
    expect(empty.revision).toBe(0);

    const saved = await repo.saveRecord(created, record(), 0);
    expect(saved.revision).toBe(1);

    const loaded = await repo.getRecord(created);
    expect(loaded.revision).toBe(1);
    expect(loaded.record.trips[0].title).toBe("Washington");
    expect(loaded.record.startedLists).toEqual(["nh48"]);
  });

  it("refuses a stale write and keeps the stored copy", async () => {
    const created = (await repo.getProfile(profile.id))!;
    await expect(
      repo.saveRecord(created, { ...record(), trips: [] }, 0),
    ).rejects.toBeInstanceOf(RevisionConflict);

    const loaded = await repo.getRecord(created);
    expect(loaded.record.trips).toHaveLength(1);
  });

  it("updates the profile and deletes both tables for the account", async () => {
    const updated = await repo.updateProfile(profile.id, {
      displayName: "Avery Updated",
      units: "metric",
    });
    expect(updated).toMatchObject({ displayName: "Avery Updated", units: "metric" });

    await repo.deleteAccount(profile.id);
    expect(await repo.getProfile(profile.id)).toBeNull();
  });
});
