#!/usr/bin/env node
/**
 * Build the generated half of every destination page.
 *
 * This is an occasional harvest, not a build step: the sharded output is
 * committed, so a checkout builds offline and two builds of the same commit are
 * identical. Run it after `npm run atlas` or `harvest-reach.py` when the
 * destination set changes:
 *
 *     npm run details
 *
 * Only facts a source actually records are written. There is no generated prose:
 * the description is Wikidata's own one-line `schema:description` (CC0), and an
 * image is only included with the credit and licence Commons reports for it.
 * Images are referenced by their thumbnail URL; nothing is copied into the
 * repository or the cell store.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  destinationMeta,
  readDestinations,
  readJson,
  shardOf,
} from "./lib/destinations.mjs";

const OUT_DIR = "src/data/place-details";
const SUMMARY = "src/data/place-details-summary.json";
const OLD = "src/data/place-details.json";
const DESTINATIONS = readDestinations();
const ATLAS = readJson("src/data/atlas.json", []);

const UA = "Terrane/0.1 (place details harvest; https://terrane.app)";
const BATCH = 50;
const MAX_IMAGES = 3;
const SLEEP_MS = 180;
const NEAREST_KM = 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chunks(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

async function api(endpoint, params, attempt = 1) {
  const url = `${endpoint}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(600 * attempt);
    return api(endpoint, params, attempt + 1);
  }
}

function entityList(data) {
  const raw = data?.entities;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : Object.values(raw);
}

function pageList(data) {
  const raw = data?.query?.pages;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : Object.values(raw);
}

function claims(entity, property) {
  return (entity?.claims?.[property] ?? []).filter((c) => c.rank !== "deprecated");
}

function firstSnak(entity, property) {
  return claims(entity, property)[0]?.mainsnak;
}

function stringValue(snak) {
  const value = snak?.datavalue?.value;
  return typeof value === "string" ? value.trim() : null;
}

function entityId(snak) {
  const value = snak?.datavalue?.value;
  return value && typeof value === "object" ? value.id ?? null : null;
}

function quantityMetres(snak) {
  const value = snak?.datavalue?.value;
  if (!value || typeof value !== "object") return null;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) return null;
  const unit = String(value.unit ?? "");
  /* Wikidata stores a quantity's unit as an entity URL. Metres (Q11573) and feet
     (Q3710) are the two the elevation properties actually use. */
  if (unit.endsWith("Q3710")) return Math.round(amount * 0.3048);
  return Math.round(amount);
}

function httpsOnly(value) {
  if (!value) return null;
  const url = value.trim();
  return url.startsWith("https://") ? url : null;
}

/* Commons often reports a licence deed as http://. The deed is the same page
   over https, and the page must not emit a mixed-content link. */
function secureUrl(value) {
  if (!value) return null;
  const url = String(value).trim();
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return null;
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const wikiUrl = (title) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
const commonsCategoryUrl = (category) =>
  `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(
    category.replace(/ /g, "_"),
  )}`;
const normalizeTitle = (title) => String(title ?? "").replace(/_/g, " ").toLowerCase();
/* P18 stores a bare filename; the Commons API wants the File: namespace. */
const fileTitle = (file) => (/^File:/i.test(file) ? file : `File:${file}`);

async function getEntities(ids) {
  const out = new Map();
  for (const batch of chunks([...new Set(ids)].filter(Boolean), BATCH)) {
    try {
      const data = await api("https://www.wikidata.org/w/api.php", {
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "claims|descriptions|sitelinks",
        languages: "en",
        sitefilter: "enwiki",
        format: "json",
        formatversion: "2",
      });
      for (const entity of entityList(data)) out.set(entity.id, entity);
    } catch (err) {
      console.warn(`  entities ${batch[0]}… failed: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }
  return out;
}

async function getLabels(ids) {
  const out = new Map();
  for (const batch of chunks([...new Set(ids)].filter(Boolean), BATCH)) {
    try {
      const data = await api("https://www.wikidata.org/w/api.php", {
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "labels|sitelinks",
        languages: "en",
        sitefilter: "enwiki",
        format: "json",
        formatversion: "2",
      });
      for (const entity of entityList(data)) {
        const name = entity.labels?.en?.value;
        const title = entity.sitelinks?.enwiki?.title;
        if (name) out.set(entity.id, { name, wiki: title ? wikiUrl(title) : undefined });
      }
    } catch (err) {
      console.warn(`  labels ${batch[0]}… failed: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }
  return out;
}

async function getImages(titles) {
  const out = new Map();
  for (const batch of chunks([...new Set(titles)].filter(Boolean).map(fileTitle), BATCH)) {
    try {
      const data = await api("https://commons.wikimedia.org/w/api.php", {
        action: "query",
        titles: batch.join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiurlwidth: String(1440),
        format: "json",
        formatversion: "2",
      });
      for (const page of pageList(data)) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        const meta = info.extmetadata ?? {};
        const url = info.thumburl || info.url;
        if (!url) continue;
        out.set(normalizeTitle(page.title), {
          url,
          w: Number(info.width) || 0,
          h: Number(info.height) || 0,
          /* The widest thumbnail the file can actually serve; the page caps its
             srcset at this so a small original is never upscaled. */
          max: Number(info.width) || 0,
          credit: stripHtml(meta.Artist?.value || meta.Credit?.value || "") || "Wikimedia Commons",
          licence: stripHtml(meta.LicenseShortName?.value || "") || "See file page",
          licenceUrl: secureUrl(meta.LicenseUrl?.value) || info.descriptionurl,
          page: info.descriptionurl,
        });
      }
    } catch (err) {
      console.warn(`  images ${batch[0]}… failed: ${err.message}`);
    }
    await sleep(SLEEP_MS);
  }
  return out;
}

const rad = (value) => (value * Math.PI) / 180;
function kmBetween(aLat, aLon, bLat, bLon) {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function nearest(rows, base) {
  let best = null;
  for (const row of rows) {
    if (row.slug === base.slug) continue;
    const km = kmBetween(base.lat, base.lon, row.lat, row.lon);
    if (km > NEAREST_KM) continue;
    if (!best || km < best.km) best = { name: row.name, slug: row.slug, km };
  }
  return best ? { ...best, km: Math.round(best.km * 10) / 10 } : null;
}

function priorRecords() {
  const byWd = new Map();
  const add = (items) => {
    for (const item of Object.values(items ?? {})) {
      if (item?.wd) byWd.set(item.wd, item);
    }
  };
  if (existsSync(OLD)) add(readJson(OLD, { items: {} }).items);
  if (existsSync(OUT_DIR)) {
    for (const name of readdirSync(OUT_DIR)) {
      if (name.endsWith(".json")) add(readJson(join(OUT_DIR, name), { items: {} }).items);
    }
  }
  return byWd;
}

function writeShards(items) {
  const generated = destinationMeta();
  const shards = new Map();
  for (const [slug, item] of Object.entries(items)) {
    const key = shardOf(slug);
    const shard = shards.get(key) ?? {};
    shard[slug] = item;
    shards.set(key, shard);
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [key, shard] of [...shards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    writeFileSync(
      join(OUT_DIR, `${key}.json`),
      `${JSON.stringify({ generated, source: "wikidata", items: shard })}\n`,
    );
  }

  const rows = Object.values(items);
  const summary = {
    generated,
    source: "wikidata",
    pages: rows.length,
    described: rows.filter((item) => item.desc).length,
    photographed: rows.filter((item) => item.img?.length).length,
    official: rows.filter((item) => item.site).length,
    ranges: rows.filter((item) => item.range).length,
    protected: rows.filter((item) => item.protected).length,
    shards: shards.size,
  };
  writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`);
  if (existsSync(OLD)) rmSync(OLD, { force: true });
  return summary;
}

async function main() {
  console.log(`→ details: ${DESTINATIONS.length} destinations`);

  const priorByWd = priorRecords();
  const missing = DESTINATIONS.filter((row) => !priorByWd.has(row.wd)).map((row) => row.wd);
  const entities = await getEntities(missing);
  console.log(
    `  ${entities.size} new Wikidata entities (${DESTINATIONS.length - missing.length} reused by Q id)`,
  );

  const records = new Map();
  const fileTitles = new Set();
  const assocIds = new Set();
  const byQid = new Map(DESTINATIONS.map((row) => [row.wd, row]));

  for (const row of DESTINATIONS) {
    const prior = priorByWd.get(row.wd);
    if (prior) {
      records.set(row.slug, { ...prior, wd: row.wd });
      continue;
    }
    const entity = entities.get(row.wd);
    if (!entity) {
      records.set(row.slug, { wd: row.wd });
      continue;
    }
    const description = entity.descriptions?.en?.value?.trim() || null;
    const site = httpsOnly(stringValue(firstSnak(entity, "P856")));
    const wikiTitle = entity.sitelinks?.enwiki?.title;
    const commonsCategory = stringValue(firstSnak(entity, "P373"));
    const elev = quantityMetres(firstSnak(entity, "P2044"));
    const prom = quantityMetres(firstSnak(entity, "P2660"));
    const files = claims(entity, "P18")
      .map((claim) => stringValue(claim.mainsnak))
      .filter(Boolean)
      .slice(0, MAX_IMAGES);
    for (const file of files) fileTitles.add(file);

    const rangeId = entityId(firstSnak(entity, "P4552"));
    const protectedId = entityId(firstSnak(entity, "P814"));
    if (rangeId) assocIds.add(rangeId);
    if (protectedId) assocIds.add(protectedId);

    records.set(row.slug, {
      wd: row.wd,
      desc: description,
      elev,
      prom,
      site,
      wiki: wikiTitle ? wikiUrl(wikiTitle) : null,
      commons: commonsCategory ? commonsCategoryUrl(commonsCategory) : null,
      files,
      rangeId,
      protectedId,
    });
  }

  const images = await getImages([...fileTitles]);
  console.log(`  ${images.size} Commons images`);

  const assoc = await getLabels([...assocIds]);
  console.log(`  ${assoc.size} range/protected labels`);

  const ranges = ATLAS.filter((row) => /(?:^|\s)(?:range|ranges|mountains)$/i.test(row.name.trim()));
  const parks = ATLAS.filter((row) => row.type === "park");
  const allSlugs = new Set(DESTINATIONS.map((row) => row.slug));

  function repairAssoc(association) {
    if (!association) return null;
    if (!association.slug || allSlugs.has(association.slug)) return association;
    const { slug: _stale, ...rest } = association;
    return rest;
  }

  function association(id) {
    if (!id) return null;
    const local = byQid.get(id);
    const label = assoc.get(id);
    if (!local && !label) return null;
    return {
      name: local?.name ?? label?.name,
      slug: local?.slug,
      wiki: label?.wiki,
    };
  }

  const items = {};
  let withDesc = 0;
  let withImage = 0;
  let withSite = 0;
  let withRange = 0;
  let withProtected = 0;

  for (const row of DESTINATIONS) {
    const record = records.get(row.slug) ?? { wd: row.wd };
    const item = { wd: row.wd };

    if (record.desc) {
      item.desc = record.desc;
      withDesc += 1;
    }
    if (record.elev != null) item.elev = record.elev;
    if (record.prom != null) item.prom = record.prom;

    if (Array.isArray(record.img)) {
      item.img = record.img.map((img) => ({
        ...img,
        credit: String(img?.credit ?? "").trim() || "Wikimedia Commons",
        licence: String(img?.licence ?? "").trim() || "See file page",
      }));
    }
    const rowImages = (record.files ?? [])
      .map((file) => images.get(normalizeTitle(fileTitle(file))))
      .filter(Boolean);
    if (rowImages.length) {
      item.img = rowImages;
    }
    if (item.img) withImage += 1;
    if (record.site) {
      item.site = record.site;
      withSite += 1;
    }
    if (record.wiki) item.wiki = record.wiki;
    if (record.commons) item.commons = record.commons;

    if (record.range) item.range = repairAssoc(record.range);
    if (record.protected) item.protected = repairAssoc(record.protected);
    const range = association(record.rangeId);
    if (range) item.range = range;
    if (item.range) withRange += 1;
    const protectedArea = association(record.protectedId);
    if (protectedArea) item.protected = protectedArea;
    if (item.protected) withProtected += 1;

    /* A recorded parent range or protected area is a claim about the place. A
       nearest neighbour is not, so it is stored under its own key and the page
       labels it "Nearest". */
    if (!item.range) {
      const nearRange = nearest(ranges, row);
      if (nearRange) item.nearestRange = nearRange;
      else delete item.nearestRange;
    }
    if (!item.protected) {
      const nearPark = nearest(parks, row);
      if (nearPark) item.nearestPark = nearPark;
      else delete item.nearestPark;
    }

    items[row.slug] = item;
  }

  if (missing.length && entities.size === 0) {
    throw new Error("no Wikidata entities were fetched for the new pages");
  }

  const summary = writeShards(items);
  const total = DESTINATIONS.length;
  const pct = (n) => `${Math.round((n / total) * 100)}%`;
  console.log(
    `details: ${total} pages · ${withDesc} descriptions (${pct(withDesc)}) · ` +
      `${withImage} with a photo (${pct(withImage)}) · ${withSite} official sites (${pct(withSite)}) · ` +
      `${withRange} ranges · ${withProtected} protected areas`,
  );
  console.log(`wrote ${OUT_DIR} (${summary.shards} shards) and ${SUMMARY}`);
}

main().catch((err) => {
  console.error(`details: ${err.message}`);
  process.exit(1);
});
