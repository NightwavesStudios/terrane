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
  return await import("./saved");
}

describe("saved places", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("adds and removes a place", async () => {
    const { toggleSaved, isSaved, savedPlaces } = await fresh();
    expect(isSaved("a")).toBe(false);
    expect(toggleSaved({ slug: "a", name: "A", cat: "peak", lat: 1, lon: 2 })).toBe(true);
    expect(isSaved("a")).toBe(true);
    expect(savedPlaces()).toHaveLength(1);
    expect(toggleSaved({ slug: "a", name: "A", cat: "peak", lat: 1, lon: 2 })).toBe(false);
    expect(isSaved("a")).toBe(false);
  });

  it("reads the list back after a reload", async () => {
    const first = await fresh();
    first.toggleSaved({ slug: "b", name: "B", cat: "park", lat: 3, lon: 4, at: 10 });
    const second = await fresh();
    expect(second.isSaved("b")).toBe(true);
    expect(second.savedPlaces()[0].at).toBe(10);
  });

  it("ignores a corrupt stored value", async () => {
    storage.setItem("terrane.saved.v1", "{not json");
    const mod = await fresh();
    expect(mod.savedPlaces()).toEqual([]);
  });

  it("drops rows that are not places", async () => {
    storage.setItem(
      "terrane.saved.v1",
      JSON.stringify([
        { slug: "x" },
        null,
        { slug: "ok", name: "Ok", cat: "peak", lat: 0, lon: 0, at: 1 },
      ]),
    );
    const mod = await fresh();
    expect(mod.savedPlaces().map((place) => place.slug)).toEqual(["ok"]);
  });

  it("caps the list at 500, newest first", async () => {
    const mod = await fresh();
    for (let i = 0; i < 505; i += 1) {
      mod.toggleSaved({ slug: `p${i}`, name: `P${i}`, cat: "peak", lat: 0, lon: 0 });
    }
    const list = mod.savedPlaces();
    expect(list).toHaveLength(500);
    expect(list[0].slug).toBe("p504");
    expect(list.some((place) => place.slug === "p0")).toBe(false);
  });

  it("picks up a change written by another tab", async () => {
    const mod = await fresh();
    storage.setItem(
      "terrane.saved.v1",
      JSON.stringify([{ slug: "tab", name: "Tab", cat: "peak", lat: 0, lon: 0, at: 1 }]),
    );
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: "terrane.saved.v1" });
    windowEvents.dispatchEvent(event);
    expect(mod.isSaved("tab")).toBe(true);
  });
});
