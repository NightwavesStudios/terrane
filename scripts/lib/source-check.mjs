/**
 * Classification for source-link verification.
 *
 * Pure so the rules can be unit-tested without the network. The rule that
 * matters: a link is verified only when following it lands on a real article (or
 * a real Commons file page). A 404/410, a redirect to search or the main page, a
 * page that says the article does not exist, or an off-site redirect is dead.
 * Rate limits, 5xx, timeouts and network failures are unreachable — not proof
 * that the link is dead, and not proof that it is live.
 */

export const VERIFIED = "verified";
export const DEAD = "dead";
export const UNREACHABLE = "unreachable";

const MISSING_ARTICLE = [
  "wikipedia does not have an article with this exact name",
  "this page does not exist",
  "there is currently no text in this page",
  "the page you are looking for does not exist",
];

const MISSING_FILE = [
  "this page does not exist",
  "no file by this name exists",
  "the file you are looking for does not exist",
];

function hasAny(body, phrases) {
  const text = String(body ?? "").toLowerCase();
  return phrases.some((phrase) => text.includes(phrase));
}

function dead(reason) {
  return { status: DEAD, reason };
}

function unreachable(reason) {
  return { status: UNREACHABLE, reason };
}

/**
 * Classify one fetched response.
 *
 * `kind` is `article` for a place's Wikipedia source, `file` for a Wikimedia
 * Commons file page. `finalUrl` is the URL after redirects.
 */
export function classifySource({ kind, requestedUrl, status, finalUrl, body }) {
  if (status === 404 || status === 410) return dead(`http-${status}`);
  if (status === 403 || status === 429 || status >= 500) {
    return unreachable(`http-${status}`);
  }
  if (!Number.isFinite(status) || status === 0) return unreachable("no-response");
  if (status < 200 || status >= 300) return dead(`http-${status}`);

  let final;
  let requested;
  try {
    final = new URL(finalUrl || requestedUrl);
    requested = new URL(requestedUrl);
  } catch {
    return dead("invalid-url");
  }

  if (kind === "file") {
    if (final.hostname !== "commons.wikimedia.org") return dead("left-commons");
    if (!final.pathname.startsWith("/wiki/File:")) return dead("not-a-file-page");
    if (hasAny(body, MISSING_FILE)) return dead("file-does-not-exist");
    return { status: VERIFIED };
  }

  if (!/(^|\.)wikipedia\.org$/.test(final.hostname)) {
    return dead("left-wikipedia");
  }
  if (final.pathname.startsWith("/wiki/Special:")) {
    return dead("redirected-to-special");
  }
  if (
    final.searchParams.has("search") ||
    /[?&]search=/i.test(final.search) ||
    /Special:Search/i.test(final.pathname)
  ) {
    return dead("redirected-to-search");
  }
  if (!final.pathname.startsWith("/wiki/")) return dead("not-an-article");
  if (final.pathname === "/wiki/" || final.pathname === "/wiki/Main_Page") {
    return dead("redirected-to-main-page");
  }
  if (hasAny(body, MISSING_ARTICLE)) return dead("article-does-not-exist");
  /* A redirect from one article to a different one is still a working link:
     Wikipedia moved the page and the reader lands on it. */
  return { status: VERIFIED };
}

/** Network error classification, kept separate from HTTP status handling. */
export function classifyFetchError(error) {
  const message = String(error?.message ?? error ?? "");
  if (/redirect count exceeded|redirect/i.test(message)) {
    return dead("redirect-loop");
  }
  if (/abort|timeout|timed out/i.test(message)) {
    return unreachable("timeout");
  }
  return unreachable("network");
}

/**
 * Deterministic summary: the same entries always produce the same object, with
 * URLs sorted and counts stacked in a fixed order.
 */
export function summarize(entries) {
  const urls = [...entries.keys()].sort((a, b) => a.localeCompare(b));
  const counts = {
    urls: urls.length,
    articles: 0,
    filePages: 0,
    verified: 0,
    dead: 0,
    unreachable: 0,
  };
  const sorted = {};
  for (const url of urls) {
    const entry = entries.get(url);
    sorted[url] = entry;
    if (entry.kind === "article") counts.articles += 1;
    else counts.filePages += 1;
    counts[entry.status] += 1;
  }
  return { counts, urls: sorted };
}

/**
 * The committed artifact the generator and validator read. No clock, no run id:
 * `generated` is the input data date, and the URL map is sorted.
 */
export function buildArtifact(entries, generated) {
  const summary = summarize(entries);
  return {
    version: 1,
    generated,
    counts: summary.counts,
    urls: summary.urls,
  };
}

export function exampleRows(entries, status, limit = 5) {
  return [...entries.entries()]
    .filter(([, entry]) => entry.status === status)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([url, entry]) => `${url} — ${entry.reason ?? entry.status}`);
}
