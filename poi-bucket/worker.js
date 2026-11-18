/**
 * The POI cell store.
 *
 * The harvested cells are 370 MB across 1,869 files, which is more than a static
 * build wants to carry and more than a git push wants to move, so they live here:
 * an R2 bucket behind this Worker, served over HTTPS with a long cache and an open
 * CORS header, and read by the map as `{base}/poi/6/{x}/{y}.json`.
 *
 * Uploads are the one write path. `PUT /upload/poi/6/33/22.json` with the
 * `x-upload-token` header writes the object; without the token (a site secret, set
 * only on the deployment) every write is refused, so the bucket cannot be poisoned
 * from outside.
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=86400",
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, x-upload-token",
  "access-control-max-age": "86400",
};

const allowed = (key) => key.startsWith("poi/") || key === "stats.json";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...JSON_HEADERS },
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
    if (!key) return json({ store: "terrane poi cells", keys: "poi/6/{x}/{y}.json" });
    if (!allowed(key)) return json({ error: "not found" }, 404);

    const object = await env.FILES.get(key);
    if (!object) return json({ error: "not found" }, 404);

    const headers = {
      ...CORS,
      ...JSON_HEADERS,
      etag: object.httpEtag,
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    return new Response(object.body, { headers });
  },
};
