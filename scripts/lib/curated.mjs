/**
 * The hand-written destinations, read out of `src/data/places.ts`.
 *
 * The 68 entries are the only destination records that are not JSON: they carry
 * prose-ish extras (tagline, difficulty, hue) and a page, so they live in the app's
 * typed source. The manifest, the validator and the audit need their count and
 * categories; rather than keep a second copy in sync, they read the object literal
 * and fail loudly if it stops parsing.
 *
 * The parse is deliberately strict about shape: one `  {` per entry, four-space
 * keys, and every row must yield a slug, name, category, latitude and longitude.
 */
import { readFileSync } from "node:fs";

const PLACE_CAT = { peak: "peak", park: "park", landmark: "landmark", gem: "landmark" };

export function readCurated(path = "src/data/places.ts") {
  const src = readFileSync(path, "utf8");
  const start = src.indexOf("const CURATED");
  const end = src.indexOf("const ATLAS");
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`${path}: could not find the CURATED block`);
  }

  const rows = src
    .slice(start, end)
    .split(/\n  \{\n/)
    .slice(1)
    .map((chunk) => {
      const slug = chunk.match(/slug:\s*"([a-z0-9-]+)"/)?.[1];
      const name = chunk.match(/\n    name:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
      const type = chunk.match(/\n    type:\s*"(peak|park|landmark|gem)"/)?.[1];
      const lat = Number(chunk.match(/\n    lat:\s*(-?[\d.]+)/)?.[1]);
      const lon = Number(chunk.match(/\n    lon:\s*(-?[\d.]+)/)?.[1]);
      const country = chunk.match(/\n    country:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? null;
      const elevation = Number(chunk.match(/\n    elevation:\s*(\d+)/)?.[1]);
      return {
        slug,
        name,
        type,
        cat: PLACE_CAT[type],
        lat,
        lon,
        country,
        elevation: Number.isFinite(elevation) ? elevation : null,
        // Provenance is derived, never typed twice. The 68 are frozen; a generated
        // record can replace one later, but a new hand-written row cannot appear
        // without the validator noticing.
        src: "editorial",
        srcId: slug,
      };
    });

  for (const row of rows) {
    if (
      !row.slug ||
      !row.name ||
      !row.cat ||
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lon)
    ) {
      throw new Error(`${path}: unreadable curated entry ${JSON.stringify(row.slug ?? row)}`);
    }
  }
  return rows;
}
