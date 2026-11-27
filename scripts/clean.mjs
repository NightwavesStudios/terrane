#!/usr/bin/env node
/** Remove regenerable build output. */
import { rmSync } from "node:fs";

for (const path of ["dist", "tsconfig.tsbuildinfo"]) {
  rmSync(path, { recursive: true, force: true });
}
console.log("clean: removed dist, tsconfig.tsbuildinfo");
