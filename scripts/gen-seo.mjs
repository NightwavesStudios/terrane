/**
 * Writes `dist/sitemap.xml` and `dist/robots.txt` from the generated page index
 * and the generated experience catalog.
 *
 * This runs after `vite build` because it writes into the build output, not into
 * `public/`: generated files must not be committed or copied by Vite. It always
 * writes, using `SITE_URL` (or Vercel's production hostname) when known and the
 * documented placeholder origin otherwise — a build that silently skipped the
 * file left no way to tell a missing sitemap from an empty one.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { siteUrl } from "./lib/site-url.mjs";
import { PLACEHOLDER_SITE_URL, sitemapPaths } from "./lib/sitemap.mjs";

const configured = siteUrl();
const SITE = configured || PLACEHOLDER_SITE_URL;

const pageIndex = JSON.parse(await readFile("src/data/place-index/slugs.json", "utf8"));
const manifest = JSON.parse(await readFile("src/data/manifest.json", "utf8"));
const slugs = Array.isArray(pageIndex.slugs) ? pageIndex.slugs : [];

/* Experiences are generated pages too, so the sitemap must include their list
   and every route. An empty catalog means the generator has not run: fail here
   rather than publishing a sitemap without the section. */
const catalog = JSON.parse(
  await readFile("src/data/experience-index/catalog.json", "utf8"),
);
const experiences = Array.isArray(catalog.items) ? catalog.items : [];
if (experiences.length === 0) {
  throw new Error(
    "seo: the experience catalog is empty — run `npm run experiences` before `npm run seo`",
  );
}

const lastmod = manifest.days?.osm ?? manifest.days?.wikidata ?? "";
const urls = sitemapPaths({ slugs, experiences });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.path}</loc>${
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
    }
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

await mkdir("dist", { recursive: true });
await writeFile("dist/sitemap.xml", xml);
await writeFile(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

const note = configured ? SITE : `${SITE} (placeholder origin; set SITE_URL)`;
console.log(
  `seo: ${urls.length} urls for ${note} · ${experiences.length} experiences, ${slugs.length} places`,
);
