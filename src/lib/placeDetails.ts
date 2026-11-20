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

/**
 * Rewrite a Wikimedia thumbnail URL to a width the file can actually serve.
 *
 * Commons returns a bucketed thumbnail (often 1920px) and the original width in
 * `max`. Asking for a larger width than the original is a 404, so the request is
 * capped; the page then falls back to the ridge art on any image error.
 */
export function thumbAt(url: string, width: number, max?: number): string {
  if (!url.includes("/thumb/")) return url;
  const capped = max && max > 0 ? Math.min(width, max) : width;
  return url.replace(/\/\d+px-/, `/${capped}px-`);
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
