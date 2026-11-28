import { build } from "esbuild";

await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  mainFields: ["browser", "module", "main"],
  conditions: ["worker", "browser", "import"],
  outfile: "dist-worker/index.js",
  sourcemap: false,
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
