import type { Pick } from "../data/features";
import {
  feetToMetres,
  listsForPlace,
  type SummitList,
  type SummitPeak,
} from "../data/summits";
import { keyForPlace, peakKey, type LogEntry } from "./log";

/** Everything a log entry needs before it has a state or a time. */
export type LogTarget = Omit<LogEntry, "state" | "at">;

export function targetForPeak(
  list: SummitList,
  peak: SummitPeak,
  place?: { lat: number; lon: number } | null,
): LogTarget {
  return {
    key: peakKey(list.id, peak.name),
    kind: "peak",
    cat: "peak",
    name: peak.name,
    elev: feetToMetres(peak.ft),
    where: peak.where ?? list.region,
    slug: peak.place,
    listId: list.id,
    listName: list.name,
    peakName: peak.name,
    ...(place ? { lat: place.lat, lon: place.lon } : {}),
  };
}

export function targetForPlace(input: {
  slug?: string;
  name: string;
  cat: string;
  lat: number;
  lon: number;
  elev?: number;
  where?: string;
  source?: string;
  experience?: boolean;
}): LogTarget {
  return {
    key: keyForPlace({ slug: input.slug, lat: input.lat, lon: input.lon }),
    kind: "place",
    cat: input.experience ? "experience" : input.cat,
    name: input.name,
    lat: input.lat,
    lon: input.lon,
    ...(input.slug ? { slug: input.slug } : {}),
    ...(input.elev ? { elev: input.elev } : {}),
    ...(input.where ? { where: input.where } : {}),
    ...(input.source ? { source: input.source } : {}),
  };
}

/** The target behind any map pick, with list membership when it is known. */
export function targetForPick(pick: Pick): LogTarget {
  if (pick.list && pick.slug) {
    const membership = listsForPlace(pick.slug).find(
      (row) => row.list.id === pick.list?.id,
    );
    if (membership) {
      return targetForPeak(membership.list, membership.peak, {
        lat: pick.lat,
        lon: pick.lon,
      });
    }
  }

  if (pick.slug) {
    const membership = listsForPlace(pick.slug)[0];
    if (membership) {
      return targetForPeak(membership.list, membership.peak, {
        lat: pick.lat,
        lon: pick.lon,
      });
    }
  }

  return targetForPlace({
    slug: pick.slug,
    name: pick.name,
    cat: pick.cat,
    lat: pick.lat,
    lon: pick.lon,
    elev: pick.elev,
    where: pick.region ?? pick.country ?? pick.where,
    source: pick.src,
    experience: pick.cat === "experience",
  });
}
