#!/usr/bin/env python3
"""
Harvests camping POIs for the whole world from OpenStreetMap (via Overpass) into
one small JSON file per map cell, so the browser can fetch only what it is
looking at.

The previous kit harvest was radius-based: 8 km around the 1,288 written-up
places. That is why Georgia looked rich and Kazakhstan looked empty — coverage
followed the atlas, not the ground. This one has no seed list. It asks Overpass
for every campsite, mountain hut, shelter, water point, spring, viewpoint,
picnic site and pass inside each z6 cell of the planet and keeps them all.

    python3 scripts/harvest-poi.py                 # whole planet, resumable
    python3 scripts/harvest-poi.py --bbox=40,41,46,44   # one box (lon,lat,lon,lat)
    python3 scripts/harvest-poi.py --workers=2     # be polite; 2 is polite

Output: public/poi/6/{x}/{y}.json, columnar `[lat, lon, kind, name?]`. Cells the
map cannot answer are not written at all, and a re-run skips whatever is already
there, so the job can be stopped and restarted as many times as needed.

A z6 cell is roughly 600 km across. A cell that times out or comes back too big
is split into four z7 cells and those answers are merged into the same file —
that is the only reason the planet gets done at all: one query for "all of
Europe" never finishes, four hundred small ones do.
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "Terrane/0.1 (interactive globe; dev@terrane.app)"
OUT_DIR = "public/poi"
CACHE = "/tmp/terrane-poi-cache"
# Requests are made per query cell, files are written per output cell: a z5 query
# (~1100 km) saves four requests over z6, and the browser still fetches z6 (~600 km)
# because one file per 1100 km of Alpine campsites is a megabyte.
Z = 5
OUT_Z = 6

# Wire format. Order is load-bearing — the browser maps index → pictogram, and
# parking is deliberately absent: it is millions of rows and the least useful
# thing when planning. (Parking still comes from the radius harvest near places.)
KINDS = ["camp", "hut", "shelter", "water", "parking", "view", "picnic", "pass"]

TAGS = [
    ("tourism", "camp_site", "camp"),
    ("tourism", "alpine_hut", "hut"),
    ("tourism", "wilderness_hut", "hut"),
    ("amenity", "shelter", "shelter"),
    ("amenity", "drinking_water", "water"),
    ("natural", "spring", "water"),
    ("tourism", "viewpoint", "view"),
    ("tourism", "picnic_site", "picnic"),
    ("mountain_pass", "yes", "pass"),
]

MAX_ELEMENTS = 200_000
MIN_SPLIT_Z = 9


def tile_bbox(z, x, y):
    """lon/lat box for an XYZ tile."""
    n = 2 ** z
    lon0 = x / n * 360 - 180
    lon1 = (x + 1) / n * 360 - 180
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat0 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lon0, lat0, lon1, lat1


def query_body(bbox):
    lon0, lat0, lon1, lat1 = bbox
    box = f"{lat0},{lon0},{lat1},{lon1}"
    parts = []
    for key, value, _ in TAGS:
        parts.append(f'  node["{key}"="{value}"]({box});')
        parts.append(f'  way["{key}"="{value}"]({box});')
    return "[out:json][timeout:600];\n(\n" + "\n".join(parts) + "\n);\nout center tags;"


def fetch(bbox, attempt=0, endpoint_index=0):
    body = query_body(bbox)
    endpoint = ENDPOINTS[endpoint_index % len(ENDPOINTS)]
    req = urllib.request.Request(
        endpoint,
        data=urllib.parse.urlencode({"data": body}).encode(),
        headers={"User-Agent": UA, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=700) as r:
            elements = json.load(r)["elements"]
        time.sleep(1.5)  # one request at a time, and not a fast one
        return elements
    except Exception as err:
        if attempt >= 6:
            raise
        # Overpass answers 429 when it wants us to slow down and 502 when it is
        # simply busy; both want patience, not a different query.
        throttled = "429" in str(err)
        wait = (60 if throttled else 10) * (attempt + 1)
        print(f"    retry {attempt + 1} on {endpoint.split('/')[2]} after {err}", flush=True)
        time.sleep(wait)
        return fetch(bbox, attempt + 1, endpoint_index + 1)


def centroid(element):
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    center = element.get("center")
    if center:
        return center["lat"], center["lon"]
    return None


def kind_of(tags):
    for key, value, kind in TAGS:
        if tags.get(key) == value:
            return kind
    return None


def harvest_cell(z, x, y, depth=0):
    """Elements in this cell, splitting into four children when it is too much."""
    cache_path = os.path.join(CACHE, f"{z}-{x}-{y}.json")
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)

    bbox = tile_bbox(z, x, y)
    try:
        elements = fetch(bbox)
    except Exception as err:
        print(f"  {z}/{x}/{y}: failed ({err})", flush=True)
        elements = None

    too_much = elements is not None and len(elements) >= MAX_ELEMENTS
    if (elements is None or too_much) and z < MIN_SPLIT_Z - 1:
        print(f"  {z}/{x}/{y}: splitting ({'too big' if too_much else 'timeout'})", flush=True)
        merged = []
        for dx in (0, 1):
            for dy in (0, 1):
                merged.extend(harvest_cell(z + 1, x * 2 + dx, y * 2 + dy, depth + 1))
        elements = merged

    if elements is None:
        elements = []

    os.makedirs(CACHE, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(elements, f)
    return elements


def rows_from(elements):
    rows = []
    seen = set()
    for element in elements:
        tags = element.get("tags") or {}
        kind = kind_of(tags)
        if not kind:
            continue
        point = centroid(element)
        if not point:
            continue
        lat, lon = round(point[0], 4), round(point[1], 4)
        key = (lat, lon, kind)
        if key in seen:
            continue
        seen.add(key)
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        if len(name) > 48:
            name = name[:47].rstrip() + "…"
        rows.append([lat, lon, KINDS.index(kind), name] if name else [lat, lon, KINDS.index(kind)])
    return rows


def load_known():
    """Everything the radius harvest already ships, so the two never double up."""
    known = set()
    for path in ("src/data/kit.json", "src/data/kit-detail.json"):
        if not os.path.exists(path):
            continue
        with open(path) as f:
            data = json.load(f)
        for row in data["items"]:
            known.add((round(row[0], 3), round(row[1], 3)))
    return known


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", help="lon0,lat0,lon1,lat1 to harvest instead of the planet")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--limit", type=int, default=0, help="stop after N cells (0 = no limit)")
    ap.add_argument("--z", type=int, default=Z, help="query cell zoom (default 5)")
    args = ap.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    known = load_known()
    print(f"  {len(known)} existing POIs to avoid duplicating", flush=True)

    z = args.z
    if args.bbox:
        lon0, lat0, lon1, lat1 = (float(v) for v in args.bbox.split(","))
        n = 2 ** z
        def xtile(lon):
            return int((lon + 180) / 360 * n)
        def ytile(lat):
            r = math.radians(lat)
            return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
        cells = [
            (z, x, y)
            for x in range(xtile(lon0), xtile(lon1) + 1)
            for y in range(ytile(lat1), ytile(lat0) + 1)
        ]
    else:
        cells = [(z, x, y) for x in range(2 ** z) for y in range(2 ** z)]

    if args.limit:
        cells = cells[: args.limit]

    print(f"  {len(cells)} cells to visit", flush=True)
    t0 = time.time()
    done = written = total_rows = 0

    def out_path(lat, lon):
        n = 2 ** OUT_Z
        x = int((lon + 180) / 360 * n)
        r = math.radians(lat)
        y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
        return os.path.join(OUT_DIR, str(OUT_Z), str(x), f"{y}.json")

    def write_rows(rows):
        """Group by output cell, merge with what is on disk, and keep it deduped."""
        groups = {}
        for row in rows:
            groups.setdefault(out_path(row[0], row[1]), []).append(row)
        written_rows = 0
        for path, group in groups.items():
            existing = []
            if os.path.exists(path):
                try:
                    with open(path) as f:
                        existing = json.load(f)["items"]
                except Exception:
                    existing = []
            seen = {(r[0], r[1], r[2]) for r in existing}
            fresh = [r for r in group if (r[0], r[1], r[2]) not in seen]
            if not fresh:
                continue
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                json.dump(
                    {"z": OUT_Z, "kinds": KINDS, "items": existing + fresh},
                    f,
                    separators=(",", ":"),
                    ensure_ascii=False,
                )
            written_rows += len(fresh)
        return written_rows

    def job(cell):
        nonlocal done, written, total_rows
        qz, x, y = cell
        elements = harvest_cell(qz, x, y)
        rows = rows_from(elements)
        before = len(rows)
        rows = [r for r in rows if (round(r[0], 3), round(r[1], 3)) not in known]
        done += 1
        if not rows:
            return None
        fresh = write_rows(rows)
        written += 1
        total_rows += fresh
        print(
            f"  q{qz}/{x}/{y}: {len(rows):>6} rows ({before - len(rows)} already known) "
            f"[{done}/{len(cells)} queries, {total_rows} rows, {time.time() - t0:.0f}s]",
            flush=True,
        )
        return len(rows)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(job, cells))

    print(f"\n  {written} cells written · {total_rows} rows · {done} visited · {time.time() - t0:.0f}s")
    print(f"  {sum(1 for _ in os.walk(OUT_DIR))} directories under {OUT_DIR}")


if __name__ == "__main__":
    main()
