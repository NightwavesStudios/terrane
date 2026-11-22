import { useSyncExternalStore } from "react";
import BUNDLED from "../data/manifest.json";
import { cellUrl } from "./cells";

/**
 * The data behind the map moves independently of the app build.
 *
 * The manifest and coverage are fetched from the cell store at runtime, so a weekly
 * harvest changes the date and the counts on screen without a new Vite build. The
 * bundled manifest stays the first paint and the offline fallback.
 */
export type Manifest = typeof BUNDLED & {
  generatedAt?: string;
  sources?: { id: string; name: string; records: number; updated?: string }[];
};

export type Coverage = {
  generatedAt: string;
  totals: { sources: number; ok: number; attention: number; points: number; trails: number };
  gaps?: { stale?: string[]; missing?: string[]; attention?: string[]; unknown?: string[] };
  trails?: {
    segments: number;
    cells: number;
    bytes: number | null;
    maxCellBytes: number | null;
    bySource?: Record<string, number> | null;
    byCountry?: Record<string, number> | null;
    quality?: {
      segments: number;
      outOfTile: number;
      chords: number;
      duplicateCopies: number;
      distanceMismatch: number;
    } | null;
  };
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
    licenceUrl?: string | null;
    attribution?: string | null;
    terms?: string | null;
    coverage: string;
    cadence: string;
  }[];
};

export type CoverageStatus = "loading" | "ready" | "error";

let manifest: Manifest = BUNDLED as Manifest;
let coverage: Coverage | null = null;
let coverageStatus: CoverageStatus = "loading";
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

async function liveJson(key: string): Promise<unknown> {
  try {
    // `ts` busts the store's five-minute live-object cache after a harvest.
    const res = await fetch(`${cellUrl(key)}?ts=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {
    // The bundled manifest is the fallback; the coverage page shows an error.
  }
  return null;
}

function isManifest(value: unknown): value is Manifest {
  const data = value as Manifest | null;
  return Boolean(
    data &&
      data.totals &&
      Number.isFinite(data.totals.all) &&
      Array.isArray(data.sources),
  );
}

type Dated = { days?: Record<string, string>; generatedAt?: string };

/** The newest harvest day in a manifest, as a UTC timestamp; 0 when absent. */
export function manifestDay(manifest: Dated): number {
  let newest = 0;
  for (const value of Object.values(manifest.days ?? {})) {
    const at = Date.parse(`${value}T00:00:00Z`);
    if (Number.isFinite(at) && at > newest) newest = at;
  }
  if (!newest && manifest.generatedAt) {
    const at = Date.parse(manifest.generatedAt);
    if (Number.isFinite(at)) newest = at;
  }
  return newest;
}

/**
 * A live manifest may replace the bundled one only when it is not older.
 *
 * The cell store can lag a code deploy (or a data job can fail after the site
 * ships), and blindly accepting its JSON rolls the visible counts back to an
 * older harvest. The bundled manifest is the newer one in that case.
 */
export function newerManifest<T extends Dated>(live: T, bundled: T): T {
  const liveDay = manifestDay(live);
  const bundledDay = manifestDay(bundled);
  return liveDay > 0 && bundledDay > 0 && liveDay < bundledDay ? bundled : live;
}

function isCoverage(value: unknown): value is Coverage {
  const data = value as Coverage | null;
  return Boolean(data && data.totals && Array.isArray(data.sources));
}

function start() {
  if (started) return;
  started = true;
  /* The bundled manifest is already on screen, so the live one is a correction,
     not the first paint. Fetched eagerly it put a `no-store` request in front of
     the map's own tiles on a phone — the same reason coverage waits. */
  const loadManifest = () => {
    void liveJson("manifest.json").then((data) => {
      if (isManifest(data)) {
        manifest = newerManifest(data, BUNDLED as Manifest);
        emit();
      }
    });
  };
  const idleManifest = window.requestIdleCallback?.(loadManifest, { timeout: 2500 });
  if (!idleManifest) window.setTimeout(loadManifest, 900);
  /* The coverage report is a page-sized document and the globe needs one badge
     from it. It waits for the first idle frame instead of competing with the
     map's tiles, fonts and DEM for the first seconds of a phone load. */
  const loadCoverage = () => {
    void liveJson("coverage.json").then((data) => {
      if (isCoverage(data)) {
        coverage = data;
        coverageStatus = "ready";
      } else {
        coverageStatus = "error";
      }
      emit();
    });
  };
  const idle = window.requestIdleCallback?.(loadCoverage, { timeout: 3500 });
  if (!idle) window.setTimeout(loadCoverage, 1500);
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

export function useCoverageStatus(): CoverageStatus {
  return useSyncExternalStore(subscribe, () => coverageStatus, () => coverageStatus);
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
