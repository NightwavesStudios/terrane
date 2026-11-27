#!/usr/bin/env node
/**
 * Data validation, run before every build.
 *
 * The map is only as good as the files behind it, and a dataset that silently
 * loses a category looks exactly like a category nobody recorded. These checks turn
 * that into a build failure instead of a blank layer.
 *
 * The duplicate check uses a ~55 m grid hash, not O(n²): 24,000 destinations is
 * 300 million pairs otherwise.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readDestinations } from "./lib/destinations.mjs";
import { sitemapPaths } from "./lib/sitemap.mjs";

const root = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const readShards = (dir) => {
  const items = {};
  if (!existsSync(join(root, dir))) return items;
  for (const name of readdirSync(join(root, dir))) {
    if (!name.endsWith(".json")) continue;
    Object.assign(items, read(join(dir, name)).items ?? {});
  }
  return items;
};

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

const categoriesFile = read("src/data/categories.json");
const categories = categoriesFile.categories;
const ids = new Set(categories.map((c) => c.id));
const families = new Set(categoriesFile.families.map((f) => f.id));
const atlas = read("src/data/atlas.json");
const reach = read("src/data/reach.json");
const reachMore = read("src/data/reach-more.json");
const manifest = read("src/data/manifest.json");
const merges = read("src/data/atlas-merges.json");
const detailSummary = read("src/data/place-details-summary.json", {});
const detailItems = readShards("src/data/place-details");
const pageMeta = read("src/data/place-index/meta.json", { pages: 0 });
const pageSlugFile = read("src/data/place-index/slugs.json", { slugs: [] });
const pageSlugs = new Set(pageSlugFile.slugs ?? []);
const destinationList = readDestinations();
const destinationCount = destinationList.length;
const destinationBySlug = new Map(destinationList.map((row) => [row.slug, row]));

const coordOk = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

/* ── categories ── */
check("category ids are unique", ids.size === categories.length, `${ids.size}/${categories.length}`);
check(
  "every category has a known family",
  categories.every((c) => families.has(c.family)),
  categories.filter((c) => !families.has(c.family)).map((c) => c.id).join(",") || "ok",
);
check(
  "destination categories carry a colour",
  categories.filter((c) => c.family === "destination").every((c) => /^#[0-9a-f]{6}$/i.test(c.colour)),
  "ok",
);

/* ── atlas ── */
check("atlas is a non-empty array", Array.isArray(atlas) && atlas.length > 0, `${atlas.length}`);
check(
  "atlas rows have the required fields",
  atlas.every(
    (r) =>
      typeof r.slug === "string" &&
      typeof r.name === "string" &&
      typeof r.country === "string" &&
      r.country.length > 0 &&
      ids.has(r.type) &&
      coordOk(r.lat, r.lon),
  ),
  "slug, name, country, known type, coordinates",
);
check("atlas slugs are unique", new Set(atlas.map((r) => r.slug)).size === atlas.length, `${atlas.length}`);

/* ── reach ── */
for (const [label, file] of [
  ["reach", reach],
  ["reach-more", reachMore],
]) {
  const itemsOk = file.items.every(
    (r) =>
      Array.isArray(r) &&
      r.length === 8 &&
      Number.isInteger(r[2]) &&
      r[2] >= 0 &&
      r[2] < file.kinds.length &&
      Number.isInteger(r[3]) &&
      r[3] >= 1 &&
      r[3] <= 4 &&
      typeof r[4] === "string" &&
      r[4].length > 0 &&
      (r[5] === null ||
        (Number.isInteger(r[5]) && r[5] >= 0 && r[5] < (file.near?.length ?? 0))) &&
      typeof r[6] === "string" &&
      /^Q\d+$/.test(r[6]) &&
      typeof r[7] === "string" &&
      r[7].length > 0 &&
      coordOk(r[0], r[1]),
  );
  check(`${label} rows are valid`, itemsOk, `${file.items.length} rows`);
  check(
    `${label} kinds are categories`,
    file.kinds.every((k) => ids.has(k)),
    file.kinds.filter((k) => !ids.has(k)).join(",") || "ok",
  );
  const tiers = new Set(file.items.map((r) => r[3]));
  const expected = label === "reach" ? [1, 2] : [3, 4];
  check(
    `${label} carries only its own tiers`,
    expected.every((t) => tiers.has(t)) && [...tiers].every((t) => expected.includes(t)),
    [...tiers].join(","),
  );
}

const destinationSlugs = [
  ...atlas.map((row) => row.slug),
  ...reach.items.map((row) => row[7]),
  ...reachMore.items.map((row) => row[7]),
];
check(
  "destination slugs are unique",
  new Set(destinationSlugs).size === destinationSlugs.length,
  `${destinationSlugs.length} rows`,
);
check(
  "page index covers every destination",
  pageMeta.pages === destinationCount && pageSlugs.size === destinationCount,
  `${pageSlugs.size}/${destinationCount}`,
);
check(
  "page index slugs match destinations",
  destinationList.every((row) => pageSlugs.has(row.slug)) &&
    [...pageSlugs].every((slug) => destinationBySlug.has(slug)),
  `${pageSlugs.size} pages`,
);

/* ── presence: a category with nothing behind it is a broken layer ── */
const records = {};
for (const r of atlas) records[r.type] = (records[r.type] || 0) + 1;
for (const r of reach.items) records[reach.kinds[r[2]]] = (records[reach.kinds[r[2]]] || 0) + 1;
for (const r of reachMore.items)
  records[reachMore.kinds[r[2]]] = (records[reachMore.kinds[r[2]]] || 0) + 1;
const empty = categories.filter((c) => !records[c.id]);
check("every category has records", empty.length === 0, empty.map((c) => c.id).join(",") || "all present");

/* ── duplicates across the destination sources, ~55 m ── */
const scale = 111_320 / 55;
const seen = new Set();
let dupes = 0;
for (const r of [
  ...atlas.map((x) => [x.type, x.lat, x.lon]),
  ...reach.items.map((x) => [reach.kinds[x[2]], x[0], x[1]]),
  ...reachMore.items.map((x) => [reachMore.kinds[x[2]], x[0], x[1]]),
]) {
  const key = `${r[0]}|${Math.round(r[1] * scale)}|${Math.round(r[2] * scale)}`;
  if (seen.has(key)) dupes += 1;
  else seen.add(key);
}
const dupeRate = dupes / Math.max(1, destinationCount);
check("cross-source duplicate rate under 1%", dupeRate < 0.01, `${dupes} pairs`);

/* ── hard rule: one place, one row ──
   The 55 m rate above tolerates a small number of collisions; this one does not.
   Every destination pair closer than 50 m in the same category must be a documented
   merge, or the build stops. */
const haversine = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const labelled = [
  ...atlas.map((x) => [x.type, x.lat, x.lon, x.slug]),
  ...reach.items.map((x) => [reach.kinds[x[2]], x[0], x[1], x[4]]),
  ...reachMore.items.map((x) => [reachMore.kinds[x[2]], x[0], x[1], x[4]]),
];
const CELL_DEG = 0.0005; // ~55 m of latitude; longitude is wider away from the equator
const grid = new Map();
const tooClose = [];
for (const row of labelled) {
  const gy = Math.floor(row[1] / CELL_DEG);
  const gx = Math.floor(row[2] / CELL_DEG);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (const other of grid.get(`${gy + dy}/${gx + dx}`) ?? []) {
        if (other[0] !== row[0]) continue;
        if (haversine(other[1], other[2], row[1], row[2]) < 50) {
          tooClose.push(`${other[3]} / ${row[3]}`);
        }
      }
    }
  }
  const key = `${gy}/${gx}`;
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(row);
}
check(
  "no two destination rows within 50 m",
  tooClose.length === 0,
  tooClose.slice(0, 4).join(" · ") || "0 pairs",
);

/* ── the merge decisions are in the data, not just in a commit message ── */
const atlasWd = new Set(atlas.map((r) => r.wd));

const mergesApplied = merges.every(
  (m) =>
    atlasWd.has(m.keep) &&
    m.drop.every((d) => !atlasWd.has(d)) &&
    m.drop.every((d) => {
      const row = atlas.find((r) => r.wd === m.keep);
      return !row || (row.also ?? []).some((a) => a.id === d);
    }),
);
check("documented merges are applied", mergesApplied, `${merges.length} merges`);

/* ── manifest matches the files ── */
const destinations = destinationCount;
check("manifest totals match", manifest.totals.all === destinations, `${manifest.totals.all}`);
check(
  "manifest destination count matches",
  manifest.totals.destinations === destinations,
  `${destinations}`,
);
check("manifest categories match", manifest.categories === categories.length, `${manifest.categories}`);

/* ── generated place details ──
   The detail build is the only source of photos, descriptions and official
   links. A page without a record, a broken image or an uncredited file is a
   build failure, not a silent blank section. */
const detailKeys = Object.keys(detailItems);
check(
  "every destination page has a detail record",
  detailKeys.length === pageSlugs.size && detailKeys.every((slug) => pageSlugs.has(slug)),
  `${detailKeys.length}/${pageSlugs.size}`,
);

const imageHosts = new Set([
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "commons.wikimedia.org",
]);
const httpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const hostOf = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};
const detailOk = detailKeys.every((slug) => {
  const row = destinationBySlug.get(slug);
  const item = detailItems[slug];
  if (!row || !item || item.wd !== row.wd) return false;
  if (item.desc != null && (typeof item.desc !== "string" || item.desc.length > 320)) {
    return false;
  }
  if (item.elev != null && !Number.isFinite(item.elev)) return false;
  if (item.prom != null && !Number.isFinite(item.prom)) return false;
  if (item.site != null && !httpsUrl(item.site)) return false;
  if (
    item.wiki != null &&
    (!httpsUrl(item.wiki) || hostOf(item.wiki) !== "en.wikipedia.org")
  ) {
    return false;
  }
  if (
    item.commons != null &&
    (!httpsUrl(item.commons) || hostOf(item.commons) !== "commons.wikimedia.org")
  ) {
    return false;
  }
  if (item.img != null) {
    if (!Array.isArray(item.img) || item.img.length > 3) return false;
    const imagesOk = item.img.every(
      (img) =>
        httpsUrl(img.url) &&
        imageHosts.has(hostOf(img.url)) &&
        typeof img.credit === "string" &&
        img.credit.length > 0 &&
        typeof img.licence === "string" &&
        img.licence.length > 0 &&
        httpsUrl(img.licenceUrl) &&
        httpsUrl(img.page) &&
        hostOf(img.page) === "commons.wikimedia.org",
    );
    if (!imagesOk) return false;
  }
  for (const key of ["range", "protected", "nearestRange", "nearestPark"]) {
    const assoc = item[key];
    if (!assoc) continue;
    if (typeof assoc.name !== "string" || assoc.name.length === 0) return false;
    if (assoc.slug != null && !pageSlugs.has(assoc.slug)) return false;
    if (
      assoc.wiki != null &&
      (!httpsUrl(assoc.wiki) || hostOf(assoc.wiki) !== "en.wikipedia.org")
    ) {
      return false;
    }
    if (assoc.km != null && !Number.isFinite(assoc.km)) return false;
  }
  return true;
});
check("place details are well formed", detailOk, `${detailKeys.length} records`);

const detailCounts = {
  pages: pageSlugs.size,
  described: detailKeys.filter((slug) => detailItems[slug].desc).length,
  photographed: detailKeys.filter((slug) => detailItems[slug].img?.length).length,
  official: detailKeys.filter((slug) => detailItems[slug].site).length,
  ranges: detailKeys.filter((slug) => detailItems[slug].range).length,
  protected: detailKeys.filter((slug) => detailItems[slug].protected).length,
};
const manifestDetails = manifest.details ?? {};
check(
  "manifest detail counts match",
  Object.entries(detailCounts).every(([key, value]) => manifestDetails[key] === value),
  JSON.stringify(detailCounts),
);
check(
  "detail summary matches records",
  detailSummary.pages === pageSlugs.size &&
    detailSummary.described === detailCounts.described &&
    detailSummary.photographed === detailCounts.photographed &&
    detailSummary.official === detailCounts.official &&
    detailSummary.ranges === detailCounts.ranges &&
    detailSummary.protected === detailCounts.protected,
  JSON.stringify(detailSummary),
);

/* The networked link check writes this artifact; the build and validator only
   read it, so a normal build never depends on the network. */
const sourceArtifact = read("src/data/experience-sources.json", {
  counts: {},
  urls: {},
});
const sourceVerified = (url) => sourceArtifact.urls?.[url]?.status === "verified";

/* ── curated Experiences ──
   A separate domain with its own committed selection, catalogue and shards.
   Membership is editorial: only the slugs in `guide-selection.json` may become
   Experiences, and every selected slug must have a built record. */
const GUIDE_KINDS = ["park", "peak", "waterfall", "lake", "coast", "landmark"];
const guideSelection = read("src/data/guide-selection.json", { slugs: [] });
const guideMeta = read("src/data/guide-index/meta.json", { total: 0, kinds: {} });
const guideCatalog = read("src/data/guide-index/catalog.json", { items: [] });
const guideFiles = existsSync(join(root, "src/data/guide-index"))
  ? readdirSync(join(root, "src/data/guide-index")).filter(
      (name) => name.endsWith(".json") && name !== "catalog.json" && name !== "meta.json",
    )
  : [];
const guideItems = {};
for (const name of guideFiles) {
  Object.assign(guideItems, read(join("src/data/guide-index", name)).items ?? {});
}
const guideRows = Object.values(guideItems);
const guideSlugs = Object.keys(guideItems);
const guideCatalogSlugs = new Set((guideCatalog.items ?? []).map((row) => row.slug));

check(
  "the curated Experience selection is a deliberate list",
  Array.isArray(guideSelection.slugs) &&
    guideSelection.slugs.length >= 100 &&
    new Set(guideSelection.slugs).size === guideSelection.slugs.length,
  `${guideSelection.slugs?.length ?? 0} selected`,
);
check(
  "the curated Experience catalogue is not empty",
  guideRows.length >= 150,
  `${guideRows.length} Experiences`,
);
check(
  "only selected destinations became Experiences",
  guideSlugs.length === guideSelection.slugs?.length &&
    guideSlugs.every((slug) => guideSelection.slugs.includes(slug)) &&
    guideSelection.slugs.every((slug) => Boolean(guideItems[slug])),
  `${guideSlugs.length}/${guideSelection.slugs?.length ?? 0} selected`,
);
check(
  "Experience slugs are unique and pageable",
  guideSlugs.length === new Set(guideSlugs).size &&
    guideRows.length === guideSlugs.length &&
    guideRows.every((row) => pageSlugs.has(row.slug)),
  `${guideSlugs.length} slugs`,
);
check(
  "Experience kinds are known and represented",
  guideRows.every((row) => GUIDE_KINDS.includes(row.kind)) &&
    GUIDE_KINDS.every((kind) => guideRows.some((row) => row.kind === kind)),
  JSON.stringify(guideMeta.kinds ?? {}),
);
check(
  "Experience meta matches the records",
  guideMeta.total === guideRows.length &&
    (guideCatalog.items ?? []).length === guideRows.length &&
    guideCatalogSlugs.size === guideRows.length &&
    Object.entries(guideMeta.kinds ?? {}).every(
      ([kind, count]) => guideRows.filter((row) => row.kind === kind).length === count,
    ) &&
    Object.values(guideMeta.kinds ?? {}).reduce((sum, count) => sum + count, 0) ===
      guideRows.length,
  `${guideMeta.total}/${guideRows.length}`,
);
check(
  "Experience records are well formed and sourced",
  guideRows.every(
    (row) =>
      typeof row.name === "string" &&
      row.name.length > 0 &&
      coordOk(row.center?.lat, row.center?.lon) &&
      Array.isArray(row.bounds) &&
      row.bounds.length === 4 &&
      row.bounds.every(Number.isFinite) &&
      typeof row.summary === "string" &&
      row.summary.length > 0 &&
      Array.isArray(row.overview) &&
      row.overview.length >= 2 &&
      Array.isArray(row.reasons) &&
      row.reasons.length >= 3 &&
      Array.isArray(row.associated) &&
      row.source?.label === "Wikipedia" &&
      httpsUrl(row.source.url) &&
      /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/\S+$/i.test(row.source.url),
  ),
  `${guideRows.length} records`,
);
check(
  "Experience neighbours are pageable and inside the bounds",
  guideRows.every(
    (row) =>
      row.associated.every(
        (place) =>
          pageSlugs.has(place.slug) &&
          coordOk(place.lat, place.lon) &&
          Number.isFinite(place.km) &&
          place.km >= 0 &&
          place.lon >= row.bounds[0] - 0.01 &&
          place.lon <= row.bounds[2] + 0.01 &&
          place.lat >= row.bounds[1] - 0.01 &&
          place.lat <= row.bounds[3] + 0.01,
      ),
  ),
  `${guideRows.reduce((sum, row) => sum + row.associated.length, 0)} neighbours`,
);
check(
  "Experience statistics agree with their records",
  guideRows.every(
    (row) =>
      row.stats &&
      row.stats.places === row.associated.length &&
      row.stats.photos === row.photos.length &&
      (row.stats.elevation === undefined || Number.isFinite(row.stats.elevation)),
  ),
  "places and photos",
);
check(
  "Experience records claim no itinerary",
  guideRows.every(
    (row) =>
      !("itinerary" in row) &&
      !("days" in row) &&
      !("durationHours" in row) &&
      !("distanceKm" in row) &&
      !("difficulty" in row),
  ),
  "no route or day plan",
);
check(
  "Experience photographs keep their credit and licence",
  guideRows.every((row) =>
    row.photos.every(
      (photo) =>
        httpsUrl(photo.url) &&
        imageHosts.has(hostOf(photo.url)) &&
        typeof photo.credit === "string" &&
        photo.credit.length > 0 &&
        typeof photo.licence === "string" &&
        photo.licence.length > 0,
    ),
  ),
  "credited Commons images",
);
check(
  "every Experience source and photograph page was verified live",
  guideRows.every(
    (row) =>
      sourceVerified(row.source.url) &&
      row.photos.every((photo) => sourceVerified(photo.page)),
  ),
  `${new Set(guideRows.map((row) => row.source.url)).size} article URLs`,
);
check(
  "Experience official links are complete URLs",
  guideRows.every((row) => row.official === undefined || httpsUrl(row.official)),
  "official websites",
);
check(
  "the source verification artifact reconciles with the shipped links",
  sourceArtifact.counts?.urls === Object.keys(sourceArtifact.urls ?? {}).length &&
    sourceArtifact.counts?.verified +
      sourceArtifact.counts?.dead +
      sourceArtifact.counts?.unreachable ===
      sourceArtifact.counts?.urls &&
    sourceArtifact.counts?.articles + sourceArtifact.counts?.filePages ===
      sourceArtifact.counts?.urls &&
    Object.keys(sourceArtifact.urls ?? {}).length > 0,
  `${sourceArtifact.counts?.urls ?? 0} checked · ${sourceArtifact.counts?.dead ?? 0} dead`,
);
check(
  "the Experience catalogue agrees with its shards",
  guideRows.every((row) => guideCatalogSlugs.has(row.slug)) &&
    (guideCatalog.items ?? []).every((row) => guideItems[row.slug]) &&
    (guideCatalog.items ?? []).every((row) => {
      const record = guideItems[row.slug];
      return (
        record &&
        row.name === record.name &&
        row.kind === record.kind &&
        row.placeCount === record.associated.length
      );
    }),
  "names, kinds, counts",
);

/* The sitemap is build output, so this cannot inspect the file `gen-seo` will
   write later. It checks the same shared URL builder instead: every section
   index, every generated route, and the place pages must all be present. */
const sitemapUrls = sitemapPaths({
  slugs: pageSlugFile.slugs ?? [],
  experiences: guideCatalog.items ?? [],
});
const sitemapSet = new Set(sitemapUrls.map((entry) => entry.path));
check(
  "the sitemap covers the app routes and every detail page",
  sitemapSet.has("/lists") &&
    sitemapSet.has("/log") &&
    guideRows.every((row) => sitemapSet.has(`/experiences/${row.slug}`)) &&
    sitemapUrls.length ===
      3 + guideRows.length + (pageSlugFile.slugs ?? []).length &&
    new Set(sitemapUrls.map((entry) => entry.path)).size === sitemapUrls.length,
  `${sitemapUrls.length} urls · ${guideRows.length} Experiences · ${(pageSlugFile.slugs ?? []).length} places`,
);

const failed = checks.filter((c) => !c.ok);
const result = {
  ok: failed.length === 0,
  checks,
};
manifest.validation = result;
writeFileSync(join(root, "src/data/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

for (const c of checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
