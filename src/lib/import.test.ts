import { describe, expect, it } from "vitest";
import { IMPORT_TEMPLATE, parseCsvRows, parseImportCsv } from "./import";
import type { Trip } from "../types/record";

const existing: Trip = {
  id: "existing-1",
  title: "Presidential winter",
  date: "2024-01-15",
  precision: "day",
  source: "backfill",
  notes: "",
  peaks: [{ slug: "mount-washington", outcome: "summit" }],
  createdAt: "2024-01-16T00:00:00.000Z",
  updatedAt: "2024-01-16T00:00:00.000Z",
};

describe("CSV import", () => {
  it("parses quoted commas, doubled quotes and embedded newlines", () => {
    const rows = parseCsvRows(
      'date,peak_slug,notes\n2024-01-01,mount-washington,"Cold, clear ""and"" windy"\n',
    );
    expect(rows).toEqual([
      ["date", "peak_slug", "notes"],
      ["2024-01-01", "mount-washington", 'Cold, clear "and" windy'],
    ]);

    const wrapped = parseCsvRows('a,b\n"line one\nline two",c\n');
    expect(wrapped[1][0]).toBe("line one\nline two");
  });

  it("turns the documented template into two trips with three peaks", () => {
    const preview = parseImportCsv(IMPORT_TEMPLATE);
    expect(preview.errors).toEqual([]);
    expect(preview.rowCount).toBe(3);
    expect(preview.validRows).toBe(3);
    expect(preview.groups).toHaveLength(2);
    expect(preview.groups[0].peaks.map((peak) => peak.slug)).toEqual([
      "mount-washington",
      "mount-monroe",
    ]);
    expect(preview.groups[1].peaks[0].slug).toBe("mount-elbert");
    expect(preview.groups[1].precision).toBe("month");
  });

  it("matches by name and preserves per-peak outcomes", () => {
    const preview = parseImportCsv(
      `date,peak_name,precision,outcome,title
2023,Mount Washington,year,attempt,Old attempt
2023,Mount Washington,year,summit,Old summit`,
    );
    expect(preview.errors).toEqual([]);
    expect(preview.groups).toHaveLength(2);
    expect(preview.groups[0].peaks[0].outcome).toBe("attempt");
    expect(preview.groups[1].peaks[0].outcome).toBe("summit");
  });

  it("reports every unmatched or malformed row instead of silently dropping it", () => {
    const preview = parseImportCsv(
      `date,peak_slug
2024-02-30,mount-washington
2024-01-01,not-a-peak
not-a-date,mount-washington
2024-01-01,mount-washington`,
    );
    expect(preview.groups).toHaveLength(1);
    expect(preview.validRows).toBe(1);
    expect(preview.errors).toHaveLength(3);
    expect(preview.errors.map((error) => error.rowNumber)).toEqual([2, 3, 4]);
  });

  it("detects an existing peak on the same date and names the duplicate", () => {
    const preview = parseImportCsv(
      `trip_id,date,peak_slug,outcome,title
winter,2024-01-15,mount-washington,summit,Presidential winter
winter,2024-01-15,mount-monroe,summit,Presidential winter`,
      [existing],
    );
    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].duplicateTripId).toBe(existing.id);
    expect(preview.groups[0].duplicatePeaks).toEqual(["mount-washington"]);
    expect(preview.groups[0].peaks).toHaveLength(2);
  });

  it("rejects a duplicate peak within one trip but keeps the first row", () => {
    const preview = parseImportCsv(
      `trip_id,date,peak_slug
same,2024-01-15,mount-washington
same,2024-01-15,mount-washington`,
    );
    expect(preview.validRows).toBe(1);
    expect(preview.groups[0].peaks).toHaveLength(1);
    expect(preview.errors[0].message).toContain("appears twice");
  });

  it("fails clearly when the header is incomplete", () => {
    expect(parseImportCsv("date,notes\n2024-01-01,hello").errors[0].message).toContain("peak column");
    expect(parseImportCsv("").errors[0].message).toContain("empty");
  });
});
