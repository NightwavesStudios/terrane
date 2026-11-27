import { defineConfig } from "vitest/config";

/* Pure modules are unit-tested; the globe needs a WebGL context and the live
   basemap, so those are covered by `npm run build` and by looking at the page,
   not here. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
