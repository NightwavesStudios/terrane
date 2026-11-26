import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LOG_KEY = "terrane.log.v2";
const OLD_SUMMITS = "terrane.summits.v1";
const OLD_SAVED = "terrane.saved.v1";
const OLD_GUIDES = "terrane.saved.guide.v1";

const storage = new Map<string, string>();
const localStorageMock = {
  getItem(key: string) {
    return storage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    storage.set(key, value);
  },
  removeItem(key: string) {
    storage.delete(key);
  },
};

async function loadLog() {
  vi.resetModules();
  return import("./log");
}

function savedRow(slug: string, name: string, at: number) {
  return {
    slug,
    name,
    cat: "peak",
    lat: 46.8523,
    lon: -121.7603,
    at,
  };
}

describe("legacy log migration", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", { addEventListener: vi.fn() });
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("migrates old saved and guide rows, then removes every legacy key", async () => {
    storage.set(OLD_SUMMITS, "not a ledger");
    storage.set(
      OLD_SAVED,
      JSON.stringify([savedRow("mount-rainier", "Mount Rainier", 1_700_000_000_000)]),
    );
    storage.set(
      OLD_GUIDES,
      JSON.stringify([{ slug: "mount-rainier", name: "Mount Rainier", kind: "peak", at: 1 }]),
    );

    await loadLog();
    const rows = JSON.parse(storage.get(LOG_KEY) ?? "[]") as { key: string }[];

    expect(rows.map((row) => row.key)).toEqual(["place:mount-rainier"]);
    expect(storage.has(OLD_SUMMITS)).toBe(false);
    expect(storage.has(OLD_SAVED)).toBe(false);
    expect(storage.has(OLD_GUIDES)).toBe(false);
  });

  it("does not run again after the current log is emptied", async () => {
    storage.set(
      OLD_SAVED,
      JSON.stringify([savedRow("mount-rainier", "Mount Rainier", 1)]),
    );

    await loadLog();
    storage.delete(LOG_KEY);

    await loadLog();
    expect(storage.has(LOG_KEY)).toBe(false);
    expect(storage.has(OLD_SAVED)).toBe(false);
  });

  it("keeps a current log and discards old rows instead of merging them", async () => {
    const current = [
      {
        key: "custom:already-here",
        kind: "custom",
        cat: "peak",
        name: "Already here",
        state: "done",
        at: 2,
        date: 2,
      },
    ];
    storage.set(LOG_KEY, JSON.stringify(current));
    storage.set(
      OLD_SAVED,
      JSON.stringify([savedRow("mount-rainier", "Mount Rainier", 1)]),
    );

    await loadLog();

    expect(JSON.parse(storage.get(LOG_KEY) ?? "[]")).toEqual(current);
    expect(storage.has(OLD_SAVED)).toBe(false);
  });
});
