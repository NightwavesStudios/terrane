#!/usr/bin/env node
/**
 * Upload only what changed.
 *
 * The bucket holds 382 MB of OSM cells plus the merged agency rows and trail
 * cells. Re-uploading everything on every weekly run is wasteful and makes a
 * partial upload hard to spot, so each file is hashed and compared with
 * `data/upload-manifest.json`.
 *
 *   POI_BUCKET=https://... POI_UPLOAD_TOKEN=... npm run data:upload
 *   npm run data:upload -- --dry-run
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const dry = process.argv.includes("--dry-run");
const cellsOnly = process.argv.includes("--cells-only");
const bucket = (process.env.POI_BUCKET ?? "").replace(/\/+$/, "");
const token = process.env.POI_UPLOAD_TOKEN ?? "";
const statePath = join(root, "data", "upload-manifest.json");

let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { files: {} };

// CI checks out a fresh tree. Without the last run's hashes every upload would
// rewrite the whole bucket, so the state lives next to the cells it describes.
if (!existsSync(statePath) && bucket) {
  try {
    const res = await fetch(`${bucket}/upload-manifest.json`);
    if (res.ok) state = await res.json();
  } catch {
    // A missing state is a full upload, not a failed run.
  }
}
const files = [];

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else if (name.endsWith(".json")) files.push(path);
  }
}

walk(join(root, "public", "poi"));
walk(join(root, "public", "trails"));

if (!cellsOnly) {
  for (const [path, key] of [
    ["src/data/manifest.json", "manifest.json"],
    ["public/coverage.json", "coverage.json"],
    ["src/data/sources.json", "sources.json"],
  ]) {
    if (existsSync(join(root, path))) files.push(join(root, path));
  }
  const registry = JSON.parse(readFileSync(join(root, "src/data/sources.json"), "utf8"));
  for (const source of registry.sources ?? []) {
    if (source.id === "osm") continue;
    const path = join(root, "data/sources", `${source.id}.json`);
    if (existsSync(path)) files.push(path);
  }
}

const keyFor = (path) => {
  const rel = relative(join(root, "public"), path);
  if (rel.startsWith("..")) {
    if (path.endsWith("manifest.json")) return "manifest.json";
    if (path.endsWith("coverage.json")) return "coverage.json";
    if (path.endsWith("src/data/sources.json")) return "sources.json";
    if (path.includes(`${join("data", "sources")}`)) return `sources/${path.split(/[\\/]/).at(-1)}`;
  }
  return rel;
};

const changed = [];
for (const path of files) {
  const body = readFileSync(path);
  const hash = createHash("sha256").update(body).digest("hex");
  const key = keyFor(path);
  if (state.files[key] === hash) continue;
  changed.push({ path, key, hash, body });
}

console.log(
  `${files.length.toLocaleString()} files · ${changed.length.toLocaleString()} changed · ${dry ? "dry run" : bucket || "no bucket"}`,
);

if (dry) {
  for (const file of changed.slice(0, 12)) console.log(`  ${file.key}`);
  process.exit(0);
}

if (!bucket || !token) {
  console.error("POI_BUCKET and POI_UPLOAD_TOKEN are required (or use --dry-run)");
  process.exit(2);
}

let next = 0;
let failed = 0;
async function worker() {
  while (next < changed.length) {
    const file = changed[next++];
    const res = await fetch(`${bucket}/upload/${file.key}`, {
      method: "PUT",
      headers: { "x-upload-token": token, "content-type": "application/json" },
      body: file.body,
    }).catch((err) => ({ ok: false, status: 0, statusText: String(err) }));
    if (res.ok) {
      state.files[file.key] = file.hash;
    } else {
      failed += 1;
      console.error(`FAILED ${file.key}: ${res.status} ${res.statusText}`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

state.generatedAt = new Date().toISOString();
const stateBody = Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
writeFileSync(statePath, stateBody);
const stateRes = await fetch(`${bucket}/upload/upload-manifest.json`, {
  method: "PUT",
  headers: { "x-upload-token": token, "content-type": "application/json" },
  body: stateBody,
}).catch(() => null);
if (!stateRes?.ok) console.error(`FAILED upload-manifest.json: ${stateRes?.status ?? "network"}`);
console.log(`uploaded ${changed.length - failed}, failed ${failed}`);
if (failed) process.exit(1);
