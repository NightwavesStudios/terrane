/**
 * The canonical URL set for `dist/sitemap.xml`.
 *
 * Pure and shared: `gen-seo.mjs` writes the file from it and
 * `validate-data.mjs` asserts the surviving routes are in it, so the sitemap
 * cannot drift from the page index or the curated experience catalogue.
 *
 * The route set is the globe, the sourced lists, the local log, coverage, the
 * curated experience detail pages and the place pages.
 */

/**
 * Origin used when the build has no public origin configured.
 *
 * A sitemap needs absolute `<loc>` values, but a local `npm run build` still has
 * to produce one: skipping the write left `dist/` with no sitemap at all, which
 * looks the same as a sitemap that lost every route. Vercel supplies
 * `VERCEL_PROJECT_PRODUCTION_URL` and CI supplies `SITE_URL`, so a deploy always
 * gets the real origin; this only keeps local and unconfigured builds complete.
 */
export const PLACEHOLDER_SITE_URL = "https://terrane.app";

/**
 * @param {{ slugs?: string[], experiences?: { slug: string }[] }} [input]
 * @returns {{ path: string, priority: string, changefreq: "weekly" | "monthly" }[]}
 */
export function sitemapPaths({ slugs = [], experiences = [] } = {}) {
  return [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/lists", priority: "0.9", changefreq: "weekly" },
    { path: "/log", priority: "0.6", changefreq: "weekly" },
    { path: "/coverage", priority: "0.4", changefreq: "weekly" },
    ...experiences.map((row) => ({
      path: `/experiences/${row.slug}`,
      priority: "0.8",
      changefreq: "monthly",
    })),
    ...slugs.map((slug) => ({
      path: `/place/${slug}`,
      priority: "0.6",
      changefreq: "monthly",
    })),
  ];
}
