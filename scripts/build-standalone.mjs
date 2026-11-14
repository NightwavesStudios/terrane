#!/usr/bin/env node
/**
 * Turns the Vite build into one self-contained HTML file: CSS, JS and the
 * four font families (as base64 woff2) are inlined, so the file has no sibling
 * dependencies at all.
 *
 *   npm run build && npm run single     →  terrane.html
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const OUT = "terrane.html";

const html = readFileSync(join(DIST, "index.html"), "utf8");
const assets = readdirSync(join(DIST, "assets"));

const jsName = assets.find((f) => f.endsWith(".js"));
const cssName = assets.find((f) => f.endsWith(".css"));
if (!jsName || !cssName) throw new Error("Run `npm run build` first.");

const js = readFileSync(join(DIST, "assets", jsName), "utf8");
const css = readFileSync(join(DIST, "assets", cssName), "utf8");

/* Fonts: public/fonts.css references 15 woff2 subsets. Inline each as a data URI
   so the file renders with the real typefaces with no network at all. */
let fontCss = readFileSync("public/fonts.css", "utf8");
fontCss = fontCss.replace(/url\(fonts\/([^)]+)\)/g, (_, file) => {
  const b64 = readFileSync(join("public/fonts", file)).toString("base64");
  return `url(data:font/woff2;base64,${b64})`;
});

/* The <script> must be inline: a file:// page cannot fetch an external module,
   but an inline module is fine. `</script>` inside the bundle would end the tag
   early, so escape any occurrence. */
const safeJs = js.replace(/<\/script>/gi, "<\\/script>");

const out = html
  .replace(/<link rel="stylesheet" href="\/fonts\.css" \/>/, "")
  .replace(
    /<script type="module" crossorigin src="\/assets\/[^"]+"><\/script>/,
    () => `<script type="module">\n${safeJs}\n</script>`,
  )
  .replace(
    /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+">/,
    () => `<style>\n${fontCss}\n${css}\n</style>`,
  );

if (/src="\/assets|href="\/assets|href="\/fonts\.css"/.test(out)) {
  throw new Error("An external asset reference survived inlining.");
}

writeFileSync(OUT, out);
const kb = (n) => `${Math.round(n / 1024).toLocaleString()} KB`;
console.log(
  `wrote ${OUT} — ${kb(Buffer.byteLength(out))} (js ${kb(js.length)}, css ${kb(
    css.length,
  )}, fonts ${kb(fontCss.length)})`,
);
