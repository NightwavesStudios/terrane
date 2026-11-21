import { useEffect, useState } from "react";
import { cellUrl } from "./cells";
import { cellMayExist } from "./cellIndex";
import { kmBetween } from "./geo";

/**
 * Nearby practical places for one experience, from the cell store.
 *
 * The generated experience knows destinations, not facilities. Campsites, huts,
 * viewpoints, trailheads and passes live in the z6 POI cells the map already
 * reads; this fetches only the cells covering an experience's bounds, decodes the
 * same compact wire format (`[lat, lon, kindIndex, name, src]`), and keeps the
 * named rows of the categories that make a route practical.
 *
 * It runs after the page has painted. A failed fetch leaves the section empty and
 * the generated route intact; the page says the coverage is OpenStreetMap's, not
 * a promise that every campsite exists.
 */

/** Row order in a cell, matching `src/map/mapped.ts`'s wire format. */
const CELL_KINDS = [
  "camp",
  "hut",
  "shelter",
  "water",
  "parking",
  "view",
  "picnic",
  "pass",
  "caravan",
  "toilets",
  "shower",
  "info",
  "trailhead",
] as const;

const KEEP = new Set(["camp", "hut", "shelter", "view", "trailhead", "pass"]);
const PRIORITY: Record<string, number> = {
  camp: 0,
  hut: 1,
  trailhead: 2,
  view: 3,
  pass: 4,
  shelter: 5,
};

const CELL_ZOOM = 6;
const CELL_COUNT = 2 ** CELL_ZOOM;
const MAX_CELLS = 6;
const MAX_POIS = 18;

export type ExperiencePoi = {
  cat: string;
  name: string;
  lat: number;
  lon: number;
  km: number;
};

type Cell = {
  kinds?: string[];
  items?: [number, number, number, string, string][];
};

const cellCache = new Map<string, Promise<ExperiencePoi[]>>();

function tileX(lon: number): number {
  return Math.floor(((lon + 180) / 360) * CELL_COUNT);
}

function tileY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * CELL_COUNT,
  );
}

function cellsFor(bounds: [number, number, number, number]): string[] {
  const [west, south, east, north] = bounds;
  const x0 = Math.max(0, Math.min(CELL_COUNT - 1, tileX(west)));
  const x1 = Math.max(0, Math.min(CELL_COUNT - 1, tileX(east)));
  const y0 = Math.max(0, Math.min(CELL_COUNT - 1, tileY(north)));
  const y1 = Math.max(0, Math.min(CELL_COUNT - 1, tileY(south)));
  const paths: string[] = [];
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
      paths.push(`poi/${CELL_ZOOM}/${x}/${y}.json`);
    }
  }
  return paths.slice(0, MAX_CELLS);
}

async function loadCell(path: string): Promise<ExperiencePoi[]> {
  let pending = cellCache.get(path);
  if (!pending) {
    pending = (async () => {
      if (!(await cellMayExist(path))) return [];
      try {
        const res = await fetch(cellUrl(path));
        if (!res.ok) return [];
        const cell = (await res.json()) as Cell;
        if (!Array.isArray(cell.items)) return [];
        const kinds = cell.kinds?.length ? cell.kinds : CELL_KINDS;
        return cell.items
          .filter((row) => Array.isArray(row) && typeof row[3] === "string" && row[3])
          .map((row) => ({
            cat: kinds[row[2]] ?? "camp",
            name: row[3],
            lat: row[0],
            lon: row[1],
            km: 0,
          }))
          .filter((row) => KEEP.has(row.cat));
      } catch {
        return [];
      }
    })();
    cellCache.set(path, pending);
  }
  return pending;
}

export function useExperiencePois(
  bounds: [number, number, number, number] | null | undefined,
): { pois: ExperiencePoi[]; status: "idle" | "loading" | "ready" | "error" } {
  const key = bounds ? bounds.join(",") : "";
  const [state, setState] = useState<{
    pois: ExperiencePoi[];
    status: "idle" | "loading" | "ready" | "error";
  }>({ pois: [], status: bounds ? "loading" : "idle" });

  useEffect(() => {
    if (!bounds) return;
    let alive = true;
    setState((current) => ({ ...current, status: "loading" }));

    const [west, south, east, north] = bounds;
    const center = { lat: (south + north) / 2, lon: (west + east) / 2 };
    const radius = Math.max(8, Math.min(60, kmBetween(south, west, north, east) / 2 + 2));
    const paths = cellsFor(bounds);

    void Promise.all(paths.map((path) => loadCell(path)))
      .then((cells) => {
        if (!alive) return;
        const seen = new Set<string>();
        const rows: ExperiencePoi[] = [];
        for (const cell of cells) {
          for (const row of cell) {
            const km = kmBetween(center.lat, center.lon, row.lat, row.lon);
            if (km > radius) continue;
            const dedupe = `${row.cat}:${row.name}:${row.lat.toFixed(3)}:${row.lon.toFixed(3)}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);
            rows.push({ ...row, km });
          }
        }
        rows.sort(
          (a, b) =>
            (PRIORITY[a.cat] ?? 9) - (PRIORITY[b.cat] ?? 9) ||
            a.km - b.km ||
            a.name.localeCompare(b.name),
        );
        setState({
          pois: rows.slice(0, MAX_POIS),
          status: paths.length === 0 ? "error" : "ready",
        });
      })
      .catch(() => {
        if (alive) setState({ pois: [], status: "error" });
      });

    return () => {
      alive = false;
    };
    // `key` is the bounds' stable identity; the array itself is recreated per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
