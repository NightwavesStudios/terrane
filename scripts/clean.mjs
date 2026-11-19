#!/usr/bin/env node
/**
 * Remove regenerable build output.
 *
 * Deliberately does not touch `.cache`, `data/sources/*.ndjson`, `public/poi`,
 * `public/trails` or `shots`: those are expensive harvest results, not build
 * artifacts. Rebuild them with the data pipeline when needed.
 */
import { rmSync } from "node:fs";

for (const path of ["dist", "tsconfig.tsbuildinfo", "terrane.html"]) {
  rmSync(path, { recursive: true, force: true });
}
console.log("clean: removed dist, tsconfig.tsbuildinfo, terrane.html");
