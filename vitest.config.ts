import { defineConfig } from "vitest/config";

/* Only the pure modules are unit-tested: routing, cell maths and ranking. The
   globe needs a WebGL context and the map style needs the network, so those are
   covered by `npm run build` and by looking at the page, not here. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
