import { useSyncExternalStore } from "react";
import BUNDLED from "../data/manifest.json";

/**
 * The data behind the map moves independently of the app build.
 *
 * The manifest and coverage are fetched from the cell store at runtime, so a weekly
 * harvest changes the date and the counts on screen without a new Vite build. The
 * bundled manifest stays the first paint and the offline fallback.
 */
const BASE = (
  (import.meta.env.VITE_POI_BASE as string | undefined) ??
  "https://terrane-poi-cells-mqa53q-preview.freebuff.site"
).replace(/\/+$/, "");

export type Manifest = typeof BUNDLED & {
  sources?: { id: string; name: string; records: number; updated?: string }[];
};

export type Coverage = {
  generatedAt: string;
  totals: { sources: number; ok: number; attention: number; points: number; trails: number };
  gaps?: { stale?: string[]; missing?: string[]; attention?: string[]; unknown?: string[] };
  sources: {
    id: string;
    name: string;
    status: string;
    fetched: number;
    placed: number;
    ageDays: number | null;
    stale: boolean;
    problems: string[];
    licence: string;
    coverage: string;
    cadence: string;
  }[];
};

let manifest: Manifest = BUNDLED as Manifest;
let coverage: Coverage | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

async function liveJson(key: string): Promise<unknown> {
  for (const url of [`${BASE}/${key}?ts=${Date.now()}`, `/${key}?ts=${Date.now()}`]) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // Try the copy the build ships with before giving up.
    }
  }
  return null;
}

function start() {
  if (started) return;
  started = true;
  void liveJson("manifest.json").then((data) => {
    if (data && (data as Manifest).totals && Array.isArray((data as Manifest).sources)) {
      manifest = data as Manifest;
      emit();
    }
  });
  void liveJson("coverage.json").then((data) => {
    if (data && (data as Coverage).totals && Array.isArray((data as Coverage).sources)) {
      coverage = data as Coverage;
      emit();
    }
  });
}

function subscribe(fn: () => void) {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useManifest(): Manifest {
  return useSyncExternalStore(subscribe, () => manifest, () => manifest);
}

export function useCoverage(): Coverage | null {
  return useSyncExternalStore(subscribe, () => coverage, () => coverage);
}

export function dataDate(m: Manifest): string {
  const raw = m.days?.osm ?? m.sources?.find((s) => s.id === "osm")?.updated ?? "";
  if (!raw) return "";
  return new Date(`${raw}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fetchCoverage(): Promise<Coverage | null> {
  start();
  return liveJson("coverage.json").then((data) =>
    data && (data as Coverage).totals ? (data as Coverage) : null,
  );
}
