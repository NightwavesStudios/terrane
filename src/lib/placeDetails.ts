import { useEffect, useState } from "react";

/**
 * The generated half of a destination page.
 *
 * The atlas is bundled and paints immediately; this file arrives as one lazy
 * chunk only on `/place/:slug`. Everything here is optional: a page with no
 * detail record still renders from the atlas, and a failed chunk leaves it
 * exactly as it was.
 */

export type PlaceImage = {
  url: string;
  w: number;
  h: number;
  /** Widest thumbnail the original file can serve. */
  max?: number;
  credit: string;
  licence: string;
  licenceUrl: string;
  page: string;
};

export type PlaceAssociation = {
  name: string;
  slug?: string;
  wiki?: string;
  km?: number;
};

export type PlaceDetail = {
  wd?: string;
  /** Wikidata's one-line `schema:description` (CC0). */
  desc?: string;
  elev?: number;
  prom?: number;
  img?: PlaceImage[];
  site?: string;
  wiki?: string;
  commons?: string;
  /** Recorded parent range (P4552). */
  range?: PlaceAssociation;
  /** Recorded protected area (P814). */
  protected?: PlaceAssociation;
  /** Nearest range page, only when no parent range is recorded. */
  nearestRange?: PlaceAssociation;
  /** Nearest park page, only when no protected area is recorded. */
  nearestPark?: PlaceAssociation;
};

type DetailsFile = {
  generated: string;
  source: string;
  items: Record<string, PlaceDetail>;
};

let filePromise: Promise<DetailsFile | null> | null = null;

export function loadPlaceDetails(): Promise<DetailsFile | null> {
  filePromise ??= import("../data/place-details.json")
    .then((mod) => mod.default as unknown as DetailsFile)
    .catch(() => null);
  return filePromise;
}

export function usePlaceDetail(slug: string): PlaceDetail | null {
  const [detail, setDetail] = useState<PlaceDetail | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    void loadPlaceDetails().then((file) => {
      if (alive) setDetail(file?.items[slug] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  return detail;
}

/** The encoded file name inside a Wikimedia thumb or original URL. */
function wikimediaFile(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)wikimedia\.org$/.test(parsed.hostname)) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const thumb = parts.indexOf("thumb");
    if (thumb >= 0 && parts.length >= thumb + 4) return parts[thumb + 3];
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Wikimedia file to a thumbnail at the requested display width.
 *
 * Commons' direct thumb URLs are bucketed: a 1440-wide request for a portrait
 * file is served as 1920px, and asking for an unbucketed width is a 400. The
 * `Special:FilePath` endpoint maps any width to a valid bucket and redirects to
 * the canonical image host. `max` is the original width, so a small file is
 * never upscaled.
 */
export function thumbAt(url: string, width: number, max?: number): string {
  const file = wikimediaFile(url);
  if (!file) return url;
  const capped = Math.max(
    1,
    Math.round(max && max > 0 ? Math.min(width, max) : width),
  );
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=${capped}`;
}

/** OSM trail difficulty values as a reader reads them. */
export function difficultyLabel(value?: string): string {
  const raw = (value ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown") return "";
  return raw.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

/** A Wikidata description is lowercase and unpunctuated; make it a sentence. */
export function sentence(value?: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const capitalized = raw.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase());
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

export type LandscapeRow = { assoc: PlaceAssociation; label: string };

/**
 * The landscape section: a recorded parent range or protected area is a claim
 * about the place; a nearest neighbour is not, and keeps its own label.
 */
export function landscapeRows(detail: PlaceDetail | null): LandscapeRow[] {
  if (!detail) return [];
  const rows: LandscapeRow[] = [];
  if (detail.range) rows.push({ assoc: detail.range, label: "Mountain range" });
  if (detail.protected) rows.push({ assoc: detail.protected, label: "Protected area" });
  if (!detail.range && detail.nearestRange) {
    rows.push({ assoc: detail.nearestRange, label: "Nearest range" });
  }
  if (!detail.protected && detail.nearestPark) {
    rows.push({ assoc: detail.nearestPark, label: "Nearest park" });
  }
  return rows;
}
