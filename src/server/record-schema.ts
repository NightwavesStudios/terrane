import { z } from "zod";
import { LISTS, PEAKS } from "../data/lists";
import type { RecordData } from "../types/account";

const LIST_IDS = new Set(LISTS.map((list) => list.id));
const PEAK_SLUGS = new Set(PEAKS.map((peak) => peak.slug));
const OUTCOMES = new Set(["summit", "attempt", "traverse"]);
const PRECISIONS = new Set(["day", "month", "year"]);
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const peakSchema = z.object({
  slug: z.string().min(1).max(160),
  outcome: z.enum(["summit", "attempt", "traverse"]),
});

const tripSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().max(200),
  date: z.string().regex(DATE_SHAPE),
  precision: z.enum(["day", "month", "year"]),
  source: z.enum(["manual", "backfill"]),
  notes: z.string().max(20_000),
  peaks: z.array(peakSchema).min(1).max(25),
  createdAt: z.string().regex(ISO),
  updatedAt: z.string().regex(ISO),
});

const listStartSchema = z.object({
  version: z.string().min(1).max(80),
  edition: z.string().min(1).max(120),
  peakSlugs: z.array(z.string().min(1).max(160)).max(500),
  startedAt: z.string().regex(ISO),
});

const badgeSchema = z.object({
  badgeId: z.string().min(1).max(80),
  criteriaVersion: z.number().int().min(1).max(100),
  earnedAt: z.string().regex(ISO),
  sourceTripId: z.string().min(1).max(120).optional(),
});

const completionSchema = z.object({
  id: z.string().min(1).max(120),
  listId: z.string().min(1).max(80),
  listVersion: z.string().min(1).max(80),
  edition: z.string().min(1).max(120),
  completedAt: z.string().regex(ISO),
  peakSlugs: z.array(z.string().min(1).max(160)).max(500),
  evidenceTripId: z.string().min(1).max(120).optional(),
});

export const recordDataSchema = z
  .object({
    startedLists: z.array(z.string().min(1).max(80)).max(20),
    listStarts: z.record(z.string(), listStartSchema),
    badges: z.array(badgeSchema).max(40),
    listCompletions: z.array(completionSchema).max(20),
    trips: z.array(tripSchema).max(500),
  })
  .superRefine((record, ctx) => {
    const seenTrips = new Set<string>();
    for (const [index, trip] of record.trips.entries()) {
      if (seenTrips.has(trip.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["trips", index, "id"],
          message: "Trip ids must be unique.",
        });
      }
      seenTrips.add(trip.id);

      if (trip.precision === "month" && !trip.date.endsWith("-01")) {
        ctx.addIssue({
          code: "custom",
          path: ["trips", index, "date"],
          message: "Month-precision dates must be stored on the first of the month.",
        });
      }
      if (trip.precision === "year" && !trip.date.endsWith("-01-01")) {
        ctx.addIssue({
          code: "custom",
          path: ["trips", index, "date"],
          message: "Year-precision dates must be stored on 1 January.",
        });
      }

      const seenPeaks = new Set<string>();
      for (const [peakIndex, peak] of trip.peaks.entries()) {
        if (!PEAK_SLUGS.has(peak.slug)) {
          ctx.addIssue({
            code: "custom",
            path: ["trips", index, "peaks", peakIndex, "slug"],
            message: `Unknown peak: ${peak.slug}`,
          });
        }
        if (seenPeaks.has(peak.slug)) {
          ctx.addIssue({
            code: "custom",
            path: ["trips", index, "peaks", peakIndex, "slug"],
            message: "A peak can appear only once in a trip.",
          });
        }
        seenPeaks.add(peak.slug);
      }
    }

    for (const listId of record.startedLists) {
      if (!LIST_IDS.has(listId)) {
        ctx.addIssue({
          code: "custom",
          path: ["startedLists"],
          message: `Unknown list: ${listId}`,
        });
      }
    }

    for (const [listId, start] of Object.entries(record.listStarts)) {
      if (!LIST_IDS.has(listId)) {
        ctx.addIssue({
          code: "custom",
          path: ["listStarts", listId],
          message: `Unknown list: ${listId}`,
        });
      }
      for (const slug of start.peakSlugs) {
        if (!PEAK_SLUGS.has(slug)) {
          ctx.addIssue({
            code: "custom",
            path: ["listStarts", listId, "peakSlugs"],
            message: `Unknown peak: ${slug}`,
          });
        }
      }
    }

    for (const completion of record.listCompletions) {
      if (!LIST_IDS.has(completion.listId)) {
        ctx.addIssue({
          code: "custom",
          path: ["listCompletions", completion.listId],
          message: `Unknown list: ${completion.listId}`,
        });
      }
    }

    if (JSON.stringify(record).length > 900_000) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "Record is too large.",
      });
    }
  });

export function parseRecordData(input: unknown): RecordData {
  return recordDataSchema.parse(input) as RecordData;
}

export function isKnownOutcome(value: string): boolean {
  return OUTCOMES.has(value);
}

export function isKnownPrecision(value: string): boolean {
  return PRECISIONS.has(value);
}
