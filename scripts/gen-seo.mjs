/**
 * Writes `dist/sitemap.xml` and `dist/robots.txt` from the generated page index.
 *
 * This runs after `vite build` because it writes into the build output, not into
 * `public/`: generated files must not be committed or copied by Vite. A sitemap
 * needs absolute `<loc>` values, so it is only written when the public origin is
 * known (`SITE_URL`, or Vercel's production hostname).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { siteUrl } from "./lib/site-url.mjs";

const SITE = siteUrl();
if (!SITE) {
  console.log("seo: no SITE_URL or VERCEL_PROJECT_PRODUCTION_URL — sitemap skipped");
  process.exit(0);
}

const pageIndex = JSON.parse(await readFile("src/data/place-index/slugs.json", "utf8"));
const manifest = JSON.parse(await readFile("src/data/manifest.json", "utf8"));
const slugs = Array.isArray(pageIndex.slugs) ? pageIndex.slugs : [];

/* Experiences are generated pages too, so the sitemap must include their list
   and every route. A missing catalog is an empty list, not a failed build: the
   page still works and `validate` is the gate that catches a broken generator. */
let experiences = [];
try {
  const file = JSON.parse(
    await readFile("src/data/experience-index/catalog.json", "utf8"),
  );
  experiences = Array.isArray(file.items) ? file.items : [];
} catch {
  experiences = [];
}

const lastmod = manifest.days?.osm ?? manifest.days?.wikidata ?? "";
const urls = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/experiences", priority: "0.8", changefreq: "weekly" },
  { path: "/coverage", priority: "0.4", changefreq: "weekly" },
  ...experiences.map((row) => ({
    path: `/experiences/${row.slug}`,
    priority: "0.7",
    changefreq: "monthly",
  })),
  ...slugs
    .map((slug) => ({ path: `/place/${slug}`, priority: "0.6", changefreq: "monthly" })),
];

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

console.log(`seo: ${urls.length} urls for ${SITE}`);
