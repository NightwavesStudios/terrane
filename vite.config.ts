import { cpSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { siteUrl } from "./scripts/lib/site-url.mjs";

/* A site URL is not known until deployment, and a wrong absolute URL in a
   canonical or an og:image is worse than none. `index.html` carries __SITE_URL__
   placeholders; with SITE_URL set they become absolute, without it they stay
   root-relative. */
const SITE_URL = siteUrl();

function seo(): Plugin {
  return {
    name: "terrane-seo",
    transformIndexHtml(html) {
      return html.replaceAll("__SITE_URL__", SITE_URL);
    },
  };
}

/**
 * Copy `public/` into `dist/`, except the local cell mirrors.
 *
 * `public/poi` is a gitignored harvest output and `public/trails` is committed
 * verification data; both are used by the dev server and the upload scripts.
 * Vite would otherwise copy them into every build (~300 MB), even though
 * production reads the same cells from the bucket.
 */
function publicAssets(): Plugin {
  return {
    name: "terrane-public-assets",
    apply: "build",
    closeBundle() {
      cpSync("public", "dist", {
        recursive: true,
        filter: (src) => !["poi", "trails"].includes(relative("public", src)),
      });
    },
  };
}

/**
 * Start the map chunk downloading as soon as the document is parsed.
 *
 * The map is a lazy chunk, so the browser only discovers MapLibre after the
 * entry has executed and called `import("./map/Globe")`. That is one full
 * round trip plus a megabyte of waiting behind the entry. A modulepreload at
 * the end of the body asks for it while the entry is still arriving, without
 * putting it in front of first paint the way a head preload did: the entry and
 * the stylesheet are still requested first, so the shell paints, and the map’s
 * megabyte is already in flight by the time React asks for it.
 *
 * The file name is hashed, so this reads the written build and finds the chunk
 * that carries MapLibre rather than guessing at a name.
 */
function mapPreload(): Plugin {
  return {
    name: "terrane-map-preload",
    apply: "build",
    closeBundle() {
      const dir = join("dist", "assets");
      const candidates = readdirSync(dir)
        .filter((file) => file.endsWith(".js"))
        .map((file) => join(dir, file))
        .filter((path) => readFileSync(path, "utf8").includes("maplibregl"))
        .sort((a, b) => statSync(b).size - statSync(a).size);
      const mapChunk = candidates[0];
      if (!mapChunk) return;
      const htmlPath = join("dist", "index.html");
      const html = readFileSync(htmlPath, "utf8");
      const file = mapChunk.split(/[\\/]/).pop()!;
      if (html.includes(`assets/${file}`)) return;
      const tag = `    <link rel="modulepreload" crossorigin href="/assets/${file}" />\n`;
      writeFileSync(htmlPath, html.replace("  </body>", tag + "  </body>"));
    },
  };
}

export default defineConfig({
  plugins: [react(), seo(), publicAssets(), mapPreload()],
  server: {
    port: 3000,
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    copyPublicDir: false,
    /* MapLibre is the one large chunk and it is lazy-ish by design; the warning
       is noise at 500 kB when the app is a map. */
    chunkSizeWarningLimit: 1400,
  },
});
