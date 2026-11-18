import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/* A site URL is not known until deployment, and a wrong absolute URL in a
   canonical or an og:image is worse than none. `index.html` carries __SITE_URL__
   placeholders; with SITE_URL set they become absolute, without it they stay
   root-relative. */
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");

function seo(): Plugin {
  return {
    name: "terrane-seo",
    transformIndexHtml(html) {
      return html.replaceAll("__SITE_URL__", SITE_URL);
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  server: {
    port: 3000,
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    /* MapLibre is the one large chunk and it is lazy-ish by design; the warning
       is noise at 500 kB when the app is a map. */
    chunkSizeWarningLimit: 1400,
  },
});
