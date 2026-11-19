#!/usr/bin/env node
/**
 * Regenerate `src/data/curated-index.json` from `src/data/places.ts`.
 *
 * The two Python harvesters need the hand-written slugs and names, and
 * `build-atlas.py` uses them to avoid naming the same place twice. That index used
 * to be edited by hand next to the entries themselves, which is one place to forget.
 * It is derived now; the entries stay the only source.
 */
import { writeFileSync } from "node:fs";
import { readCurated } from "./lib/curated.mjs";

const rows = readCurated().map(({ slug, name, country, type, lat, lon }) => ({
  slug,
  name,
  country,
  type,
  lat,
  lon,
}));
writeFileSync("src/data/curated-index.json", `${JSON.stringify(rows)}\n`);
console.log(`curated-index: ${rows.length} rows`);
