import { beforeAll, describe, expect, it } from "vitest";
import type { RecordData } from "../types/account";
import { createApp } from "./app";
import { MemoryRepository } from "./memory-repository";
import type { Profile } from "../types/record";

const ORIGIN = "https://terrane.test";

const user: Profile = {
  id: "account-user-a",
  displayName: "Avery Stone",
  email: "avery@example.com",
  units: "imperial",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function emptyRecord(): RecordData {
  return {
    startedLists: [],
    listStarts: {},
    badges: [],
    listCompletions: [],
    trips: [],
  };
}

function recordWithTrip(): RecordData {
  return {
    ...emptyRecord(),
    startedLists: ["nh48"],
    listStarts: {
      nh48: {
        version: "2026",
        edition: "2026",
        peakSlugs: ["mount-washington"],
        startedAt: "2024-07-01T10:00:00.000Z",
      },
    },
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

describe("record API", () => {
  let app: ReturnType<typeof createApp>;
  let repo: MemoryRepository;

  beforeAll(() => {
    repo = new MemoryRepository();
    app = createApp({
      repo,
      appOrigin: ORIGIN,
      getUser: async (request) => {
        const id = request.headers.get("x-test-user");
        if (!id) return null;
        return {
          ...user,
          id,
          displayName: id === "account-user-b" ? "Blair" : user.displayName,
          email: id === "account-user-b" ? "blair@example.com" : user.email,
        };
      },
    });
  });

  function call(
    path: string,
    init: RequestInit = {},
    sub: string | null = user.id,
    origin = ORIGIN,
  ) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (sub) headers.set("x-test-user", sub);
    if (init.method && init.method !== "GET") headers.set("Origin", origin);
    return app.request(`${ORIGIN}${path}`, { ...init, headers });
  }

  it("keeps health public and rejects an anonymous record read", async () => {
    const health = await call("/api/health", {}, null);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, storage: "d1" });

    const me = await call("/api/me", {}, null);
    expect(me.status).toBe(401);
    expect(me.headers.get("cache-control")).toContain("no-store");
  });

  it("creates a profile and returns an empty record at revision zero", async () => {
    const response = await call("/api/me");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      profile: { displayName: string; email: string; units: string };
      revision: number;
      record: { trips: unknown[] };
    };
    expect(body.profile.displayName).toBe("Avery Stone");
    expect(body.profile.email).toBe("avery@example.com");
    expect(body.profile.units).toBe("imperial");
    expect(body.revision).toBe(0);
    expect(body.record.trips).toEqual([]);
  });

  it("persists a validated record and advances its revision", async () => {
    const saved = await call("/api/record", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: 0, record: recordWithTrip() }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ revision: 1 });

    const loaded = await call("/api/me");
    const body = (await loaded.json()) as {
      revision: number;
      record: { trips: { title: string }[]; startedLists: string[] };
    };
    expect(body.revision).toBe(1);
    expect(body.record.trips[0].title).toBe("Washington");
    expect(body.record.startedLists).toEqual(["nh48"]);
  });

  it("rejects a stale revision without overwriting the record", async () => {
    const stale = await call("/api/record", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: 0, record: emptyRecord() }),
    });
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as {
      revision: number;
      record: { trips: { title: string }[] };
    };
    expect(body.revision).toBe(1);
    expect(body.record.trips[0].title).toBe("Washington");
  });

  it("rejects a foreign origin and unknown catalogue peaks", async () => {
    const foreign = await call(
      "/api/record",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 1, record: emptyRecord() }),
      },
      user.id,
      "https://not-terrane.example",
    );
    expect(foreign.status).toBe(403);

    const badPeak = recordWithTrip();
    badPeak.trips[0].peaks[0].slug = "invented-summit";
    const invalid = await call("/api/record", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: 1, record: badPeak }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ title: "Invalid record" });
  });

  it("isolates two signed-in accounts", async () => {
    const other = await call("/api/me", {}, "account-user-b");
    const body = (await other.json()) as {
      profile: { displayName: string };
      revision: number;
      record: { trips: unknown[] };
    };
    expect(body.profile.displayName).toBe("Blair");
    expect(body.revision).toBe(0);
    expect(body.record.trips).toEqual([]);
  });

  it("updates the account profile and deletes the account record", async () => {
    const updated = await call("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Avery Updated", units: "metric" }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      profile: { displayName: "Avery Updated", units: "metric" },
    });

    const deleted = await call("/api/me", { method: "DELETE" });
    expect(deleted.status).toBe(204);

    const recreated = await call("/api/me");
    const body = (await recreated.json()) as {
      revision: number;
      profile: { displayName: string };
      record: { trips: unknown[] };
    };
    expect(body.profile.displayName).toBe("Avery Stone");
    expect(body.revision).toBe(0);
    expect(body.record.trips).toEqual([]);
  });
});
