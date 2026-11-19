/**
 * The Terrane data store.
 *
 * Points (poi/), trail routes (trails/), the live manifest and the coverage report
 * live in one R2 bucket behind this Worker. Reads are public and CORS-open; writes
 * are the one upload path, gated by the UPLOAD_TOKEN site secret.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, x-upload-token",
  "access-control-max-age": "86400",
};

const LIVE = new Set(["manifest.json", "coverage.json", "sources.json"]);
const STATE = "upload-manifest.json";
const allowed = (key) =>
  key.startsWith("poi/") ||
  key.startsWith("trails/") ||
  key.startsWith("sources/") ||
  LIVE.has(key) ||
  key === STATE ||
  key === "stats.json";

function headersFor(key) {
  return {
    ...CORS,
    "content-type": "application/json; charset=utf-8",
    // Cells change weekly, metadata changes with every harvest. A day of cache on
    // a cell hid a whole update; an hour is the compromise, and the client appends
    // a version query when it needs a fresh copy.
    "cache-control": LIVE.has(key) ? "public, max-age=300" : "public, max-age=3600",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...headersFor("") },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "PUT") {
      const token = request.headers.get("x-upload-token") ?? "";
      if (!env.UPLOAD_TOKEN || token !== env.UPLOAD_TOKEN) {
        return json({ error: "forbidden" }, 403);
      }
      const key = decodeURIComponent(url.pathname.replace(/^\/upload\//, ""));
      if (!allowed(key)) return json({ error: "bad key" }, 400);
      const body = await request.arrayBuffer();
      if (!body.byteLength) return json({ error: "empty body" }, 400);
      await env.FILES.put(key, body, {
        httpMetadata: { contentType: "application/json" },
      });
      return json({ ok: true, key, bytes: body.byteLength });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method" }, 405);
    }

    const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!key) {
      return json({
        store: "terrane data",
        keys: ["poi/6/{x}/{y}.json", "trails/6/{x}/{y}.json", "manifest.json", "coverage.json"],
      });
    }
    if (!allowed(key)) return json({ error: "not found" }, 404);

    const object = await env.FILES.get(key);
    if (!object) return json({ error: "not found" }, 404);

    const headers = { ...headersFor(key), etag: object.httpEtag };
    if (request.method === "HEAD") return new Response(null, { headers });
    return new Response(object.body, { headers });
  },
};
