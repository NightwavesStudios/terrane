/**
 * The public origin of the site, with no trailing slash.
 *
 * `SITE_URL` wins when set. On Vercel the production hostname is available at
 * build time but the scheme is not, so the scheme is supplied here — the same
 * fallback `vite.config.ts` uses for canonical and og:url tags.
 */
export function siteUrl() {
  const raw =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  return raw.replace(/\/+$/, "");
}
