import MANIFEST from "../data/manifest.json";

/**
 * Per-route head tags.
 *
 * The app is a single document, so every route shares `index.html`'s title,
 * description, canonical and social tags until one of these runs. Crawlers that
 * execute JavaScript pick up the change; the ones that do not still get the
 * generic site-level tags from the static head, which is the correct fallback.
 */
const SITE = "Terrane";

function upsert(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector);
  if (!el) {
    const tag = selector.startsWith("link") ? "link" : "meta";
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

export type Meta = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  /** Absolute URL or a root-relative fallback such as `/og.jpg`. */
  image?: string;
  /** Structured data for this route; cleared when a route does not set one. */
  jsonLd?: Record<string, unknown> | null;
};

const JSONLD_ID = "terrane-route-jsonld";

function setJsonLd(value: Record<string, unknown> | null) {
  let el = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = JSONLD_ID;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(value);
}

export function setMeta({
  title,
  description,
  path,
  type = "website",
  image = "/og.jpg",
  jsonLd = null,
}: Meta) {
  const url = `${location.origin}${path}`;
  document.title = title;

  upsert('meta[name="description"]', { name: "description", content: description });
  upsert('link[rel="canonical"]', { rel: "canonical", href: url });
  upsert('meta[property="og:title"]', { property: "og:title", content: title });
  upsert('meta[property="og:description"]', {
    property: "og:description",
    content: description,
  });
  upsert('meta[property="og:url"]', { property: "og:url", content: url });
  upsert('meta[property="og:type"]', { property: "og:type", content: type });
  upsert('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsert('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });

  const imageUrl = image.startsWith("http") ? image : `${location.origin}${image}`;
  upsert('meta[property="og:image"]', { property: "og:image", content: imageUrl });
  upsert('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
  setJsonLd(jsonLd);
}

export const HOME_META: Meta = {
  title: SITE,
  description: `Spin a globe of ${MANIFEST.totals.all.toLocaleString("en-US")} places in ${MANIFEST.categories} categories: peaks, parks, landmarks, campsites, water and parking. Real coordinates, shaded terrain and hiking trails.`,
  path: "/",
};
