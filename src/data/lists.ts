import type { Peak } from "../types/geography";
import { CO14ERS_LIST, CO14ERS_PEAKS } from "./co14ers";
import { MUNROS_LIST, MUNROS_PEAKS } from "./munros";
import { NH48_LIST, NH48_PEAKS } from "./nh48";

export interface MountainList {
  id: string;
  slug: string;
  title: string;
  publisher: string;
  publisherUrl: string;
  edition: string;
  version: string;
  sourceUrl: string;
  elevationSourceUrl?: string;
  license?: string;
  description: string;
  rules: string;
  peaks: Peak[];
}

export const LISTS: MountainList[] = [
  {
    ...NH48_LIST,
    peaks: NH48_PEAKS,
    elevationSourceUrl: NH48_LIST.sourceUrl,
  },
  {
    ...CO14ERS_LIST,
    peaks: CO14ERS_PEAKS,
  },
  {
    ...MUNROS_LIST,
    peaks: MUNROS_PEAKS,
    license: "DoBIH data CC BY 4.0",
  },
];

export const PEAKS: Peak[] = LISTS.flatMap((list) => list.peaks);

export const PEAKS_BY_SLUG = new Map(PEAKS.map((peak) => [peak.slug, peak]));
export const LIST_BY_ID = new Map(LISTS.map((list) => [list.id, list]));
export const LIST_BY_SLUG = new Map(LISTS.map((list) => [list.slug, list]));

export function getPeak(slug: string): Peak | undefined {
  return PEAKS_BY_SLUG.get(slug);
}

export function getList(slug: string): MountainList | undefined {
  return LIST_BY_SLUG.get(slug) ?? LIST_BY_ID.get(slug);
}

export function getListForPeak(peak: Peak): MountainList[] {
  return (peak.listIds ?? [])
    .map((id) => LIST_BY_ID.get(id))
    .filter((list): list is MountainList => Boolean(list));
}

export function listShortName(list: MountainList): string {
  return list.id === "nh48"
    ? "NH 48"
    : list.id === "co14ers"
      ? "CO 14ers"
      : list.id === "munros"
        ? "Munros"
        : list.title;
}

export function peakListLabel(peak: Peak): string {
  return getListForPeak(peak).map((list) => listShortName(list)).join(" · ");
}
