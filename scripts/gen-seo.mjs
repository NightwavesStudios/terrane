/**
 * Writes `public/sitemap.xml` and `public/robots.txt` from the atlas.
 *
 * Run before every build (`npm run build` does). `SITE_URL` is optional: with it
 * set the sitemap carries absolute URLs and robots points at it, without it the
 * paths are root-relative — valid sitemap XML, just not submittable to a search
 * console until the domain exists.
 */
import { readFile, writeFile } from "node:fs/promises";

const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const atlas = JSON.parse(await readFile("src/data/atlas.json", "utf8"));
const curated = (await readFile("src/data/places.ts", "utf8")).match(
  /slug:\s*"([a-z0-9-]+)"/g,
);

const slugs = new Set();
for (const row of atlas) {
  if (row.slug) slugs.add(row.slug);
}
for (const m of curated ?? []) {
  const slug = m.match(/"([a-z0-9-]+)"/);
  if (slug) slugs.add(slug[1]);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  ...[...slugs]
    .sort()
    .map((slug) => ({ path: `/place/${slug}`, priority: "0.6", changefreq: "monthly" })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

await writeFile("public/sitemap.xml", xml);

await writeFile(
  "public/robots.txt",
  `User-agent: *
Allow: /
${SITE ? `\nSitemap: ${SITE}/sitemap.xml\n` : ""}`,
);

console.log(`seo: ${urls.length} urls${SITE ? ` for ${SITE}` : " (relative paths)"}`);
