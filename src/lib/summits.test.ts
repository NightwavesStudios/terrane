import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

const storage = new MemoryStorage();
const windowEvents = new EventTarget();
vi.stubGlobal("window", windowEvents);
vi.stubGlobal("localStorage", storage);

async function fresh() {
  vi.resetModules();
  return await import("./summits");
}

describe("summit ledger", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("logs and unlogs a summit", async () => {
    const { toggleClimbed, climbedAt, climbedLog } = await fresh();
    expect(climbedAt("georgia-4000/brasstown-bald")).toBeNull();
    expect(toggleClimbed("georgia-4000/brasstown-bald", 10)).toBe(true);
    expect(climbedAt("georgia-4000/brasstown-bald")).toBe(10);
    expect(climbedLog()).toHaveLength(1);
    expect(toggleClimbed("georgia-4000/brasstown-bald")).toBe(false);
    expect(climbedAt("georgia-4000/brasstown-bald")).toBeNull();
  });

  it("reads the log back after a reload", async () => {
    const first = await fresh();
    first.toggleClimbed("adirondack-46/mount-marcy", 42);
    const second = await fresh();
    expect(second.climbedAt("adirondack-46/mount-marcy")).toBe(42);
  });

  it("ignores a corrupt stored value", async () => {
    storage.setItem("terrane.summits.v1", "{not json");
    const mod = await fresh();
    expect(mod.climbedLog()).toEqual([]);
  });

  it("drops rows that are not climbs", async () => {
    storage.setItem(
      "terrane.summits.v1",
      JSON.stringify([
        { id: "no-list", at: 1 },
        { id: "list/peak", at: "yesterday" },
        null,
        { id: "colorado-14ers/mount-elbert", at: 2 },
      ]),
    );
    const mod = await fresh();
    expect(mod.climbedLog().map((climb) => climb.id)).toEqual([
      "colorado-14ers/mount-elbert",
    ]);
  });

  it("picks up a change written by another tab", async () => {
    const mod = await fresh();
    storage.setItem(
      "terrane.summits.v1",
      JSON.stringify([{ id: "colorado-14ers/longs-peak", at: 7 }]),
    );
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: "terrane.summits.v1" });
    windowEvents.dispatchEvent(event);
    expect(mod.climbedAt("colorado-14ers/longs-peak")).toBe(7);
  });
});
