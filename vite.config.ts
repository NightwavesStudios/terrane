import { cpSync } from "node:fs";
import { relative } from "node:path";
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
 * `public/poi` and `public/trails` are gitignored harvest outputs used by the dev
 * server and the upload scripts. Vite would otherwise copy them into every build
 * (~300 MB on a machine that has harvested cells), even though production reads
 * the same cells from the bucket.
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

export default defineConfig({
  plugins: [react(), seo(), publicAssets()],
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
