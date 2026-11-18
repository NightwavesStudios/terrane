#!/usr/bin/env python3
"""
Harvests the long tail of outdoor places from Wikidata (CC0) into
src/data/reach.json + src/data/reach-more.json.

The atlas in build-atlas.py is deliberately edited: ~1,220 rows, capped per
country, every one of them a place we are willing to write a paragraph about.
This script is the opposite end of the telescope. It takes everything with a
coordinate and an English label — summits, lakes, waterfalls, parks, glaciers,
caves, canyons, islands, beaches, hot springs — and ranks each one by how many
Wikipedia language versions have an article about it. That count is the closest
free proxy for "have I heard of this", which is exactly what a zoom level needs
to know: Fuji at country scale, a 2,400 m shoulder only when you are on top of
it.

    python3 scripts/harvest-reach.py            # full run (~8 min, WDQS is slow)
    python3 scripts/harvest-reach.py --cache    # reuse the responses in /tmp

Writes columnar rows [lat, lon, kind, tier, name, nearIdx?] so the browser
parses arrows, not 25,000 objects.
"""

import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "Terrane/0.1 (interactive globe; dev@terrane.app)"
CACHE = "/tmp/terrane-reach-cache"
OUT = "src/data/reach.json"
OUT_MORE = "src/data/reach-more.json"

# kind order is the wire format — append, never reorder
KINDS = [
    "peak",
    "volcano",
    "range",
    "lake",
    "waterfall",
    "park",
    "reserve",
    "beach",
    "glacier",
    "cave",
    "canyon",
    "island",
    "desert",
    "spring",
    "valley",
]

CLASSES = {
    "Q8502": "peak",
    "Q8072": "volcano",
    "Q46831": "range",
    "Q23397": "lake",
    "Q34038": "waterfall",
    "Q46169": "park",
    "Q473972": "reserve",
    "Q179049": "reserve",
    "Q40080": "beach",
    "Q35666": "glacier",
    "Q35509": "cave",
    # Q15003 is the canyon class, but almost nothing is tagged with it directly;
    # valleys (Q39816) are what people actually mean and they are plentiful.
    "Q15003": "canyon",
    "Q23442": "island",
    "Q8514": "desert",
    "Q177380": "spring",
    "Q39816": "valley",
}

# How many of each we are willing to carry. A rank by sitelinks already settles
# which ones matter; these caps settle how much of the map we are prepared to
# give them. Peaks and lakes carry the app, so they get the bulk.
CAPS = {
    "peak": 7000,
    "volcano": 700,
    "range": 550,
    "lake": 3800,
    "waterfall": 2600,
    "park": 1600,
    "reserve": 2200,
    "beach": 1300,
    "glacier": 1000,
    "cave": 1000,
    "canyon": 450,
    "island": 2600,
    "desert": 260,
    "spring": 500,
    "valley": 900,
}

# Sitelink buckets, widest first. Narrow buckets are what keep WDQS inside its
# 60 s budget, and running one class at a time is what keeps it inside that budget
# too: a VALUES over fifteen classes with a sitelink filter times out, every time.
# Measured: one class, links >= 6, names included → 34 s for 12,000 rows.
BUCKETS = [(40, None), (12, 39), (8, 11), (4, 7)]

# Tier is fame: the same table the map uses as zoom bands.
def tier_of(links):
    if links >= 60:
        return 1
    if links >= 25:
        return 2
    if links >= 10:
        return 3
    return 4


def class_query(qid, lo, hi):
    upper = f"FILTER(?links <= {hi})" if hi is not None else ""
    return f"""
SELECT ?item ?name ?coord ?links WHERE {{
  ?item wdt:P31 wd:{qid} ; wdt:P625 ?coord ; wikibase:sitelinks ?links .
  FILTER(?links >= {lo}) {upper}
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
}}
LIMIT 12000"""


def fetch(sparql, name, refresh=False):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + ".json")
    if not refresh and os.path.exists(path) and os.path.getsize(path) > 100:
        with open(path) as f:
            return json.load(f)
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"}
    )
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                rows = json.load(r)["results"]["bindings"]
            with open(path, "w") as f:
                json.dump(rows, f)
            return rows
        except Exception as err:  # WDQS 502s and 504s are routine
            if attempt == 3:
                print(f"    {name}: gave up after {err}")
                return []
            print(f"    {name}: retry {attempt} after {err}")
            time.sleep(5 * attempt)
    return []


def parse_point(wkt):
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", wkt)
    if not m:
        return None
    return float(m.group(2)), float(m.group(1))  # lat, lon


def slugify(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s


def load_curated():
    """The 68 hand-written places, with coordinates.

    curated-index.json is slugs and names only, so the coordinates are read out of
    places.ts, which is the one place they exist.
    """
    src = open("src/data/places.ts").read()
    start = src.index("const CURATED: Place[] = [")
    block = src[start:]
    rows = []
    for match in re.finditer(
        r'slug: "([^"]+)"[\s\S]*?lat: (-?[\d.]+),\s*\n\s*lon: (-?[\d.]+),', block
    ):
        rows.append(
            {"slug": match.group(1), "lat": float(match.group(2)), "lon": float(match.group(3))}
        )
    print(f"  {len(rows)} curated places with coordinates")
    return rows


def main():
    refresh = "--refresh" in sys.argv
    t0 = time.time()

    harvested = {}  # qid -> (links, name, lat, lon, kind)
    # One class at a time, widest sitelink bucket first, stopping once there is
    # enough for the cap that class will be trimmed to anyway.
    for kind in KINDS:
        qids = [qid for qid, k in CLASSES.items() if k == kind]
        want = int(CAPS[kind] * 1.6)
        got = 0
        for bucket_lo, bucket_hi in BUCKETS:
            if got >= want:
                break
            for qid in qids:
                label = f"{kind}-{qid}-{bucket_lo}-{bucket_hi if bucket_hi else 'up'}"
                rows = fetch(class_query(qid, bucket_lo, bucket_hi), label, refresh)
                got += len(rows)
                print(
                    f"  {kind:<10} {qid} links {bucket_lo}+"
                    f"{'..' + str(bucket_hi) if bucket_hi else ''}: {len(rows):>6} rows",
                    flush=True,
                )
                for row in rows:
                    item = row["item"]["value"].rsplit("/", 1)[-1]
                    point = parse_point(row["coord"]["value"])
                    if not point:
                        continue
                    name = row["name"]["value"].strip()
                    if len(name) < 2 or len(name) > 64:
                        continue
                    links = int(row["links"]["value"])
                    prev = harvested.get(item)
                    if prev and KINDS.index(prev[4]) <= KINDS.index(kind):
                        continue
                    harvested[item] = (links, name, point[0], point[1], kind)

    print(f"  {len(harvested)} unique items, {time.time() - t0:.0f}s", flush=True)

    # ── dedupe ───────────────────────────────────────────────────────────────
    # 1. against the atlas itself (a peak we already have a page for), and
    # 2. within the harvest, where OSM-minded mappers have entered the same
    #    summit twice under different items.
    atlas = json.load(open("src/data/atlas.json"))
    curated = load_curated()
    known = [(row["lat"], row["lon"]) for row in atlas]
    known += [(row["lat"], row["lon"]) for row in curated]

    def grid_key(lat, lon, size=0.05):
        return (int(lat // size), int(lon // size))

    def too_close(lat, lon, points, metres):
        """points: dict[cell] -> list of (lat, lon) — 0.05° is ~5.5 km."""
        span = 1 if metres <= 5500 else 2
        gx, gy = grid_key(lat, lon)
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                for plat, plon in points.get((gx + dx, gy + dy), ()):
                    d = metres_between(lat, lon, plat, plon)
                    if d <= metres:
                        return True
        return False

    def add(points, lat, lon):
        points.setdefault(grid_key(lat, lon), []).append((lat, lon))

    atlas_grid = {}
    for lat, lon in known:
        add(atlas_grid, lat, lon)

    items = sorted(harvested.values(), key=lambda r: (-r[0], r[1]))
    kept = []
    kept_grid = {}
    per_kind = defaultdict(int)
    dropped_atlas = dropped_close = dropped_cap = 0
    for links, name, lat, lon, kind in items:
        if too_close(lat, lon, atlas_grid, 1200):
            dropped_atlas += 1
            continue
        if too_close(lat, lon, kept_grid, 350):
            dropped_close += 1
            continue
        if per_kind[kind] >= CAPS[kind]:
            dropped_cap += 1
            continue
        per_kind[kind] += 1
        kept.append((links, name, lat, lon, kind))
        add(kept_grid, lat, lon)

    print(
        f"  kept {len(kept)} · atlas overlap {dropped_atlas} · "
        f"duplicates {dropped_close} · over cap {dropped_cap}"
    )

    # ── nearest atlas place, for the card's link ─────────────────────────────
    near_names = []
    near_index = {}
    placed = {}
    for row in atlas + curated:
        slug = row["slug"]
        if slug not in near_index:
            near_index[slug] = len(near_names)
            near_names.append(slug)
        placed.setdefault(grid_key(row["lat"], row["lon"], 0.25), []).append(
            (row["lat"], row["lon"], slug)
        )

    def nearest_place(lat, lon):
        gx, gy = grid_key(lat, lon, 0.25)
        best = None
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                for plat, plon, slug in placed.get((gx + dx, gy + dy), ()):
                    d = metres_between(lat, lon, plat, plon)
                    if best is None or d < best[0]:
                        best = (d, slug)
        return best

    rows = []
    for links, name, lat, lon, kind in kept:
        row = [round(lat, 4), round(lon, 4), KINDS.index(kind), tier_of(links), name]
        near = nearest_place(lat, lon)
        if near and near[0] <= 60000:
            row.append(near_index[near[1]])
        rows.append(row)

    # ── write ────────────────────────────────────────────────────────────────
    def payload(subset):
        return {
            "kinds": KINDS,
            "near": near_names,
            "items": subset,
        }

    count = "--print-only" in sys.argv

    famous = [r for r in rows if r[3] <= 2]
    rest = [r for r in rows if r[3] > 2]
    if not count:
        with open(OUT, "w") as f:
            json.dump(payload(famous), f, separators=(",", ":"), ensure_ascii=False)
        with open(OUT_MORE, "w") as f:
            json.dump(payload(rest), f, separators=(",", ":"), ensure_ascii=False)
        # A count the UI can show without importing 23,000 rows.
        with open("src/data/reach-meta.json", "w") as f:
            json.dump({"famous": len(famous), "more": len(rest)}, f)

    by_tier = defaultdict(int)
    by_kind = defaultdict(int)
    for row in rows:
        by_tier[row[3]] += 1
        by_kind[KINDS[row[2]]] += 1
    print(f"\n  tiers {dict(sorted(by_tier.items()))}")
    print(f"  kinds {dict(sorted(by_kind.items()))}")
    print(f"  {len(famous)} famous + {len(rest)} more = {len(rows)} rows")
    print(f"  {time.time() - t0:.0f}s total")


def metres_between(lat1, lon1, lat2, lon2):
    rad = math.pi / 180
    dlat = (lat2 - lat1) * rad
    dlon = (lon2 - lon1) * rad
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(dlon / 2) ** 2
    )
    return 2 * 6371000 * math.asin(min(1, math.sqrt(h)))


if __name__ == "__main__":
    main()
