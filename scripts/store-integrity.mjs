#!/usr/bin/env node
/**
 * Store integrity: every key the uploader says it wrote is readable, and its byte
 * count matches what the uploader recorded.
 *
 * This is deliberately read-only. Run it after a publish, or before promoting an
 * environment:
 *
 *   POI_BUCKET=https://... npm run store:check
 *   npm run store:check -- --local
 *
 * `--local` compares the local mirrors' object counts with the store instead of
 * checking every object; the full check reads each manifest key's headers. The
 * Worker's HEAD response carries no Content-Length (Cloudflare drops it from a
 * null body), so the check uses GET and cancels the body after the headers.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const bucket = (process.env.POI_BUCKET ?? "").replace(/\/+$/, "");
const localOnly = process.argv.includes("--local");
const read = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

const localState = read(join(root, "data", "upload-manifest.json"), null);
const state = localState ?? (bucket ? await (await fetch(`${bucket}/upload-manifest.json`)).json() : null);
if (!state?.files) {
  console.error("store: no upload manifest locally and no readable POI_BUCKET");
  process.exit(2);
}
const entries = Object.entries(state.files);
const files = entries.map(([key, value]) => ({
  key,
  bytes: typeof value === "string" ? null : (value?.bytes ?? null),
}));

const groups = {};
for (const { key } of files) {
  const prefix = key.includes("/") ? key.slice(0, key.indexOf("/")) : "root";
  groups[prefix] = (groups[prefix] ?? 0) + 1;
}

let missing = 0;
let mismatched = 0;
let checked = 0;
let bytes = 0;
let errors = 0;

if (localOnly) {
  for (const [dir, prefix] of [
    ["public/poi", "poi"],
    ["public/trails", "trails"],
  ]) {
    let count = 0;
    const rootDir = join(root, dir);
    if (existsSync(rootDir)) {
      const walk = (path) => {
        for (const name of readdirSync(path)) {
          const child = join(path, name);
          if (statSync(child).isDirectory()) walk(child);
          else if (name.endsWith(".json")) count += 1;
        }
      };
      walk(rootDir);
    }
    const stored = groups[prefix] ?? 0;
    console.log(`${prefix}: ${stored.toLocaleString()} in store · ${count.toLocaleString()} local`);
    if (stored !== count) mismatched += 1;
  }
} else {
  if (!bucket) {
    console.error("store: set POI_BUCKET or pass --local");
    process.exit(2);
  }
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      checked += 1;
      try {
        const res = await fetch(`${bucket}/${file.key}`, {
          method: "GET",
          headers: { range: "bytes=0-0" },
        });
        if (!res.ok) {
          missing += 1;
          console.error(`MISSING ${file.key}: ${res.status}`);
          continue;
        }
        const range = res.headers.get("content-range");
        const length = range
          ? Number(range.split("/").at(-1))
          : Number(res.headers.get("content-length") ?? 0);
        await res.body?.cancel();
        bytes += length;
        if (file.bytes != null && length !== file.bytes) {
          mismatched += 1;
          console.error(`SIZE ${file.key}: store ${length} · manifest ${file.bytes}`);
        }
      } catch (err) {
        errors += 1;
        console.error(`ERROR ${file.key}: ${String(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

const report = {
  checkedAt: new Date().toISOString(),
  bucket: bucket || "local",
  mode: localOnly ? "local-count" : "head",
  objects: files.length,
  checked,
  bytes,
  missing,
  mismatched,
  errors,
  groups,
};
mkdirSync(join(root, "reports"), { recursive: true });
writeFileSync(join(root, "reports/store-integrity.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `store: ${files.length.toLocaleString()} objects · ${(bytes / 1e6).toFixed(1)} MB checked · ${missing} missing · ${mismatched} mismatched · ${errors} errors`,
);
if (missing || mismatched || errors) process.exit(1);
