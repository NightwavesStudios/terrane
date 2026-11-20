import { useSyncExternalStore } from "react";
import { PLACES, type Place } from "../data/places";
import {
  destinationCategory,
  getMappedRows,
  pickOfRow,
  type FeatureRow,
  type Pick,
} from "../data/features";
import { ensureDestinationRows } from "../map/destinations";
import { kmBetween } from "./geo";
import { normalize } from "./text";

/**
 * One lazy index of everything Discover can show.
 *
 * The atlas is bundled, the 23,261-row reach tail is two chunks, and the named
 * OpenStreetMap pins arrive with the map's cells. Discover and search read a
 * single flat list built from all three, so a row does not change shape — or
 * disappear from search — depending on which loader happened to run first.
 *
 * The build is deliberately boring: dedupe, attach the nearest named
 * destination as context, and aggregate countries and regions into areas.
 * It runs once on the first open (the atlas-only index is ready immediately)
 * and again only when a map cell adds named pins.
 */

export interface CatalogRow {
  /** Stable within one build; used as the list key. */
  key: string;
  pick: Pick;
  name: string;
  norm: string;
  cat: string;
  lat: number;
  lon: number;
  region?: string;
  country?: string;
  /** 0 atlas, 1–4 reach fame cohort, 5 practical pin. */
  tier: number;
  hasPage: boolean;
  /** Nearest named destination, for context and "near X" prose. */
  near?: { name: string; km: number; slug?: string };
  source: "atlas" | "reach" | "poi";
}

export interface AreaRow {
  kind: "country" | "region";
  name: string;
  label: string;
  norm: string;
  count: number;
  lat: number;
  lon: number;
  zoom: number;
}

export interface CatalogData {
  rows: CatalogRow[];
  areas: AreaRow[];
  countries: number;
}

export type CatalogStatus = "idle" | "loading" | "ready" | "error";

export interface CatalogSnapshot extends CatalogData {
  status: CatalogStatus;
  /** "atlas" until the tail and named pins are in, then "full". */
  coverage: "atlas" | "full";
  /** Every place row in the snapshot, atlas and tail together. */
  total: number;
}

const NEAR_KM = 100;
const DEDUPE_KM = 10;
const REGION_MIN = 3;

/* ── geometry helpers ───────────────────────────────────────────────────── */

function gridKey(lat: number, lon: number, scale: number): string {
  return `${Math.floor(lon * scale)}:${Math.floor(lat * scale)}`;
}

function placeGrid(places: Place[]): Map<string, Place[]> {
  const grid = new Map<string, Place[]>();
  for (const place of places) {
    const key = gridKey(place.lat, place.lon, 1);
    const bucket = grid.get(key);
    if (bucket) bucket.push(place);
    else grid.set(key, [place]);
  }
  return grid;
}

function nearestPlace(
  grid: Map<string, Place[]>,
  lat: number,
  lon: number,
  maxKm: number,
): { place: Place; km: number } | null {
  const x = Math.floor(lon);
  const y = Math.floor(lat);
  let best: { place: Place; km: number } | null = null;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bucket = grid.get(`${x + dx}:${y + dy}`);
      if (!bucket) continue;
      for (const place of bucket) {
        const km = kmBetween(lat, lon, place.lat, place.lon);
        if (km <= maxKm && (!best || km < best.km)) best = { place, km };
      }
    }
  }
  return best;
}

function pushBucket(buckets: Map<string, CatalogRow[]>, row: CatalogRow): void {
  const key = gridKey(row.lat, row.lon, 10);
  const bucket = buckets.get(key);
  if (bucket) bucket.push(row);
  else buckets.set(key, [row]);
}

/** A same-name row within `km`: one place described by two harvests. */
function duplicateNear(
  buckets: Map<string, CatalogRow[]>,
  norm: string,
  lat: number,
  lon: number,
): boolean {
  const x = Math.floor(lon * 10);
  const y = Math.floor(lat * 10);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const bucket = buckets.get(`${x + dx}:${y + dy}`);
      if (!bucket) continue;
      for (const row of bucket) {
        if (row.norm === norm && kmBetween(lat, lon, row.lat, row.lon) <= DEDUPE_KM) {
          return true;
        }
      }
    }
  }
  return false;
}

function fitZoom(minLat: number, maxLat: number, minLon: number, maxLon: number): number {
  const mid = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const latSpan = Math.max(0.05, maxLat - minLat);
  const lonSpan = Math.max(0.05, (maxLon - minLon) * Math.cos(mid));
  const span = Math.max(latSpan, lonSpan);
  return Math.max(1.8, Math.min(8.2, Math.log2(360 / span) - 0.3));
}

/* ── the pure build ─────────────────────────────────────────────────────── */

type AreaAcc = {
  count: number;
  latSum: number;
  lonSum: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

function accArea(
  map: Map<string, AreaAcc & { name: string; country?: string }>,
  key: string,
  name: string,
  point: { lat: number; lon: number },
  country?: string,
): void {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    existing.latSum += point.lat;
    existing.lonSum += point.lon;
    existing.minLat = Math.min(existing.minLat, point.lat);
    existing.maxLat = Math.max(existing.maxLat, point.lat);
    existing.minLon = Math.min(existing.minLon, point.lon);
    existing.maxLon = Math.max(existing.maxLon, point.lon);
    return;
  }
  map.set(key, {
    name,
    country,
    count: 1,
    latSum: point.lat,
    lonSum: point.lon,
    minLat: point.lat,
    maxLat: point.lat,
    minLon: point.lon,
    maxLon: point.lon,
  });
}

function toAreas(
  map: Map<string, AreaAcc & { name: string; country?: string }>,
  kind: "country" | "region",
): AreaRow[] {
  const out: AreaRow[] = [];
  for (const area of map.values()) {
    if (kind === "region" && area.count < REGION_MIN) continue;
    const label = kind === "region" ? `${area.name}, ${area.country}` : area.name;
    out.push({
      kind,
      name: area.name,
      label,
      norm: normalize(label),
      /* Bounds, centroid and count come from every catalog row that names this
         area, not just the handful of atlas points. Otherwise Iceland's country
         hit framed four peaks at z7.3 instead of the whole island. */
      count: area.count,
      lat: (area.minLat + area.maxLat) / 2,
      lon: (area.minLon + area.maxLon) / 2,
      zoom: fitZoom(area.minLat, area.maxLat, area.minLon, area.maxLon),
    });
  }
  return out;
}

export function buildCatalog(
  places: Place[],
  tail: FeatureRow[],
  pois: FeatureRow[],
): CatalogData {
  const grid = placeGrid(places);
  const bySlug = new Map(places.map((place) => [place.slug, place]));
  const rows: CatalogRow[] = [];
  const buckets = new Map<string, CatalogRow[]>();
  const countries = new Map<string, AreaAcc & { name: string; country?: string }>();
  const regions = new Map<string, AreaAcc & { name: string; country?: string }>();

  for (const place of places) {
    const pick = pickOfRow({
      cat: destinationCategory(place),
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      slug: place.slug,
      elev: place.elevation,
      hue: place.hue,
      where: place.region ?? place.country,
      region: place.region,
      country: place.country,
      src: "atlas",
      srcId: place.wd ?? place.slug,
    });
    const row: CatalogRow = {
      key: `a${rows.length}`,
      pick,
      name: place.name,
      norm: normalize(place.name),
      cat: pick.cat,
      lat: place.lat,
      lon: place.lon,
      region: place.region,
      country: place.country,
      tier: 0,
      hasPage: true,
      source: "atlas",
    };
    rows.push(row);
    pushBucket(buckets, row);
  }

  for (const feature of tail) {
    if (!feature.name || feature.slug) continue;
    const norm = normalize(feature.name);
    if (!norm) continue;
    if (duplicateNear(buckets, norm, feature.lat, feature.lon)) continue;

    const baked = feature.near ? bySlug.get(feature.near) : undefined;
    const bakedKm = baked
      ? kmBetween(feature.lat, feature.lon, baked.lat, baked.lon)
      : Infinity;
    /* A baked neighbour is only context when it is actually near. The harvest
       records one for every row, but a stale or cross-border link should not
       claim "near X" from a hundred kilometres away. */
    const close =
      baked && bakedKm <= NEAR_KM
        ? { place: baked, km: bakedKm }
        : nearestPlace(grid, feature.lat, feature.lon, NEAR_KM);

    const row: CatalogRow = {
      key: `r${rows.length}`,
      pick: pickOfRow({
        ...feature,
        tier: feature.tier ?? 3,
        region: close?.place.region,
        country: close?.place.country,
      }),
      name: feature.name,
      norm,
      cat: feature.cat,
      lat: feature.lat,
      lon: feature.lon,
      /* The nearest named destination is context, not a country claim: search
         may use it, but the prose says "near X", never "in X". */
      region: close?.place.region,
      country: close?.place.country,
      tier: feature.tier ?? 3,
      hasPage: false,
      near: close ? { name: close.place.name, km: close.km, slug: close.place.slug } : undefined,
      source: "reach",
    };
    rows.push(row);
    pushBucket(buckets, row);
  }

  for (const feature of pois) {
    if (!feature.name) continue;
    const norm = normalize(feature.name);
    if (!norm) continue;
    /* A named pin can repeat an atlas or tail row: the cell harvest and the
       destination harvest overlap. Prefer the row already indexed, which is
       the one with a page when there is one. */
    if (duplicateNear(buckets, norm, feature.lat, feature.lon)) continue;
    const row: CatalogRow = {
      key: `p${rows.length}`,
      pick: pickOfRow(feature),
      name: feature.name,
      norm,
      cat: feature.cat,
      lat: feature.lat,
      lon: feature.lon,
      region: feature.region,
      country: feature.country,
      tier: 5,
      hasPage: Boolean(feature.slug),
      source: "poi",
    };
    rows.push(row);
    pushBucket(buckets, row);
  }

  /* Areas are made from the finished catalog: atlas rows use their recorded
     country/region, tail rows use the nearest named destination's. That makes
     the count, centroid and fit describe the same set of places. */
  for (const row of rows) {
    if (!row.country) continue;
    accArea(countries, row.country, row.country, row);
    if (row.region) {
      accArea(
        regions,
        `${row.country}::${row.region}`,
        row.region,
        row,
        row.country,
      );
    }
  }

  const areas = [
    ...toAreas(countries, "country"),
    ...toAreas(regions, "region"),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || b.count - a.count);

  return { rows, areas, countries: countries.size };
}

/* ── the lazy store ─────────────────────────────────────────────────────── */

const ATLAS_ONLY = buildCatalog(PLACES, [], []);

/** The bundled atlas index, available before the tail is fetched. */
export const ATLAS_CATALOG_ROWS: CatalogRow[] = ATLAS_ONLY.rows;

let snapshot: CatalogSnapshot = {
  ...ATLAS_ONLY,
  status: "idle",
  coverage: "atlas",
  total: ATLAS_ONLY.rows.length,
};
let started = false;
let loading = false;
let poiCount = 0;
let tailCache: FeatureRow[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function rebuild(tail: FeatureRow[], pois: FeatureRow[], status: CatalogStatus): void {
  const data = buildCatalog(PLACES, tail, pois);
  const full = data.rows.length > PLACES.length;
  tailCache = tail;
  poiCount = pois.length;
  snapshot = {
    ...data,
    status: full ? status : "error",
    coverage: full ? "full" : "atlas",
    total: data.rows.length,
  };
  emit();
}

/**
 * Load the tail once. Called the first time Discover opens; never on page load,
 * so a visit that only spins the globe does not pay for the index.
 */
export function startCatalog(): void {
  if (started || loading) return;
  started = true;
  loading = true;
  snapshot = { ...snapshot, status: "loading" };
  emit();
  void ensureDestinationRows()
    .then((tail) => rebuild(tail, getMappedRows(), "ready"))
    .catch(() => rebuild([], getMappedRows(), "error"))
    .finally(() => {
      loading = false;
    });
}

/**
 * Named pins arrive with map cells after the index is built. Rebuilding is only
 * worth it when their count changed, and only while Discover is open.
 */
export function syncCatalog(): void {
  if (snapshot.coverage !== "full") return;
  const pois = getMappedRows();
  if (pois.length === poiCount) return;
  rebuild(tailCache, pois, "ready");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CatalogSnapshot {
  return snapshot;
}

export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** For tests and for a caller that only needs the current rows. */
export function catalogRows(): CatalogRow[] {
  return snapshot.rows;
}

export function catalogAreas(): AreaRow[] {
  return snapshot.areas;
}
