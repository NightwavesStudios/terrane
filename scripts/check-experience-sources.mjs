#!/usr/bin/env node
/**
 * Verify every distinct source URL carried by a shipped experience place.
 *
 * The experience records are generated from committed data; their Wikipedia
 * links come from the Wikidata detail harvest and until this script runs they are
 * only format-checked. This check follows each link, classifies it as verified,
 * dead or unreachable, and writes a committed artifact
 * (`src/data/experience-sources.json`) that the generator and validator read.
 *
 * The normal build never touches the network: it consumes the artifact. Running
 * this script is the opt-in networked step (`npm run sources:check`).
 *
 * Safe to run offline-incompletely:
 *   - Never overwrites the artifact when nothing could be verified.
 *   - Will not overwrite it when some URLs are unreachable unless
 *     `--allow-unreachable` is passed, so a flaky connection cannot silently
 *     delete places.
 *   - `--strict` exits 1 only when a shipped link is confirmed dead.
 *
 * Usage:
 *   node scripts/check-experience-sources.mjs                 # report only
 *   node scripts/check-experience-sources.mjs --write         # write artifact
 *   node scripts/check-experience-sources.mjs --write --strict
 *   node scripts/check-experience-sources.mjs --write --strict --incremental
 *   node scripts/check-experience-sources.mjs --limit=20      # quick sample
 *
 * `--incremental` keeps already-verified entries and fetches only URLs the
 * committed artifact does not cover. It is how a newly curated Experience is
 * checked without re-fetching every collection source; a full run remains the
 * default and refreshes every entry.
 */
import { readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEAD,
  UNREACHABLE,
  VERIFIED,
  buildArtifact,
  classifyFetchError,
  classifySource,
  exampleRows,
} from "./lib/source-check.mjs";

const root = process.cwd();
const OUT = "src/data/experience-sources.json";
const CATALOG = "src/data/experience-index/catalog.json";
const GUIDE_CATALOG = "src/data/guide-index/catalog.json";

const args = process.argv.slice(2);
const write = args.includes("--write");
const verify = args.includes("--verify");
const strict = args.includes("--strict");
const allowUnreachable = args.includes("--allow-unreachable");
const incremental = args.includes("--incremental");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

/* Wikimedia rate-limits bursts: 20 concurrent requests earned 429s. Requests
   are spaced per host and Retry-After is honoured, so a full pass stays polite
   and still finishes in minutes. */
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;
const PREFIX_BYTES = 40000;
const ATTEMPTS = 5;
const HOST_INTERVAL_MS = 450;
const nextByHost = new Map();

async function reserveHost(url) {
  const host = new URL(url).hostname;
  for (;;) {
    const now = Date.now();
    const next = nextByHost.get(host) ?? 0;
    if (now >= next) {
      nextByHost.set(host, now + HOST_INTERVAL_MS);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, next - now + 10));
  }
}
const UA = "TerraneSourceCheck/1.0 (+https://terrane.app)";

const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
};

function readShardDir(dir) {
  if (!existsSync(join(root, dir))) return {};
  const out = {};
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith(".json") || name === "catalog.json" || name === "meta.json") continue;
    const file = read(`${dir}/${name}`, null);
    if (file?.items) Object.assign(out, file.items);
  }
  return out;
}

/** Every distinct credited URL a shipped page links to. */
function collectUrls(records) {
  const urls = new Map();
  const add = (url, kind) => {
    if (typeof url !== "string" || !/^https:\/\//.test(url)) return;
    const prior = urls.get(url);
    if (prior && prior.kind === "article") return;
    urls.set(url, { kind });
  };
  for (const record of Object.values(records)) {
    for (const stop of record.stops ?? []) {
      add(stop.source?.url, "article");
      add(stop.photo?.page, "file");
    }
    for (const photo of record.photos ?? []) add(photo.page, "file");
  }
  return urls;
}

/** The curated catalogue links each destination to Wikipedia and Commons. */
function collectGuideUrls(records) {
  const urls = new Map();
  const add = (url, kind) => {
    if (typeof url !== "string" || !/^https:\/\//.test(url)) return;
    const prior = urls.get(url);
    if (prior && prior.kind === "article") return;
    urls.set(url, { kind });
  };
  for (const record of Object.values(records)) {
    add(record.source?.url, "article");
    add(record.photo?.page, "file");
    for (const photo of record.photos ?? []) add(photo.page, "file");
  }
  return urls;
}

async function readPrefix(response, limitBytes) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let bytes = 0;
  try {
    while (bytes < limitBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (bytes >= limitBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* The prefix is enough. */
    }
  }
  return out;
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
      },
    });
    const body =
      response.status === 200 ? await readPrefix(response, PREFIX_BYTES) : "";
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    return { status: response.status, finalUrl: response.url, body, retryAfter };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** HTTP status is kept on the entry for diagnosis, not for the verdict. */
async function checkWithStatus(url, kind) {
  let last;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    let response = null;
    let result;
    try {
      await reserveHost(url);
      response = await fetchOnce(url);
      result = classifySource({ kind, requestedUrl: url, ...response });
    } catch (error) {
      result = classifyFetchError(error);
    }
    if (result.status !== UNREACHABLE) {
      return {
        kind,
        status: result.status,
        http: response?.status ?? 0,
        final: response?.finalUrl ?? url,
        ...(result.reason ? { reason: result.reason } : {}),
      };
    }
    last = { result, response };
    if (attempt < ATTEMPTS) {
      const retryAfterMs = (response?.retryAfter ?? 0) * 1000;
      await sleep(Math.max(retryAfterMs, 2500 * attempt));
    }
  }
  return {
    kind,
    status: UNREACHABLE,
    http: last?.response?.status ?? 0,
    final: last?.response?.finalUrl ?? url,
    ...(last?.result?.reason ? { reason: last.result.reason } : {}),
  };
}

async function main() {
  const catalog = read(CATALOG, { generated: "unknown" });
  const guideCatalog = read(GUIDE_CATALOG, { generated: "unknown" });
  const records = readShardDir("src/data/experience-index");
  const guides = readShardDir("src/data/guide-index");
  if (!Object.keys(records).length && !Object.keys(guides).length) {
    throw new Error("no experience or guide records found; run the builders first");
  }

  const collected = new Map([...collectUrls(records), ...collectGuideUrls(guides)]);
  const previous = incremental ? read(OUT, null) : null;
  const targets = [...collected.entries()]
    .filter(([url]) => !incremental || !previous?.urls?.[url])
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  /* Offline mode: assert the committed artifact already proves every link the
     current shards ship. This is what a build or a review can run without
     touching the network. */
  if (verify) {
    const artifact = read(OUT, null);
    if (!artifact?.urls) {
      console.error(`missing ${OUT}; run \`npm run sources:check\` first`);
      process.exitCode = 1;
      return;
    }
    const unverified = targets.filter(
      ([url]) => artifact.urls[url]?.status !== VERIFIED,
    );
    const counts = artifact.counts ?? {};
    console.log(
      `artifact covers ${targets.length - unverified.length}/${targets.length} shipped URLs · ` +
        `verified ${counts.verified} · dead ${counts.dead} · unreachable ${counts.unreachable}`,
    );
    for (const [url] of unverified.slice(0, 10)) {
      console.error(`  not verified: ${url} (${artifact.urls[url]?.status ?? "absent"})`);
    }
    if (unverified.length > 0) {
      console.error(
        `${unverified.length} shipped source URLs are not in the verified artifact`,
      );
      process.exitCode = 1;
    }
    return;
  }

  console.log(
    `checking ${targets.length.toLocaleString()} distinct source URLs ` +
      `(${collected.size.toLocaleString()} collected${incremental ? `, ${(collected.size - targets.length).toLocaleString()} already verified` : ""}${Number.isFinite(limit) ? `, limited to ${limit}` : ""})`,
  );

  const entries = new Map();
  if (incremental) {
    for (const [url, info] of collected) {
      const prior = previous?.urls?.[url];
      if (prior) entries.set(url, { ...prior, kind: info.kind });
    }
  }
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      const [url, info] = targets[index];
      entries.set(url, await checkWithStatus(url, info.kind));
      done += 1;
      if (done % 100 === 0 || done === targets.length) {
        console.log(`  ${done}/${targets.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  const artifact = buildArtifact(
    entries,
    [catalog.generated, guideCatalog.generated, previous?.generated]
      .filter((date) => date && date !== "unknown")
      .sort()
      .at(-1) ?? "unknown",
  );
  const { counts } = artifact;

  console.log(
    `urls ${counts.urls} = verified ${counts.verified} + dead ${counts.dead} + ` +
      `unreachable ${counts.unreachable} · articles ${counts.articles} · file pages ${counts.filePages}`,
  );

  if (counts.dead > 0) {
    console.log("dead examples:");
    for (const row of exampleRows(entries, DEAD, 10)) console.log(`  ${row}`);
  }
  if (counts.unreachable > 0) {
    console.log("unreachable examples:");
    for (const row of exampleRows(entries, UNREACHABLE, 10)) console.log(`  ${row}`);
  }

  if (write) {
    if (counts.verified === 0) {
      console.error("refusing to write: nothing was verified (offline or blocked)");
      process.exitCode = 2;
    } else if (counts.unreachable > 0 && !allowUnreachable) {
      console.error(
        `refusing to write: ${counts.unreachable} URLs were unreachable; ` +
          `rerun when reachable, or pass --allow-unreachable to drop them deliberately`,
      );
      process.exitCode = 2;
    } else {
      const text = `${JSON.stringify(artifact, null, 2)}\n`;
      const target = join(root, OUT);
      const temp = `${target}.tmp`;
      writeFileSync(temp, text);
      renameSync(temp, target);
      console.log(
        `wrote ${OUT} · ${counts.verified} verified · ${counts.dead} dead · ${counts.unreachable} unreachable` +
          `${existsSync(target) ? "" : " (missing)"}`,
      );
    }
  }

  if (strict && counts.dead > 0) {
    console.error(`strict: ${counts.dead} shipped source URLs are dead`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
