#!/usr/bin/env python3
"""Global route=hiking harvest, split into terminal Geofabrik leaf bboxes.

The public Overpass capacity mirrors cannot answer a continent-shaped query for
this layer, and this machine cannot hold the PBFs. This adapter therefore queries
the *terminal* Geofabrik leaves (US states, German regions, countries without
children), one cached gzipped response at a time, splitting a bbox further when
the server times out. Rows are cached separately, so a stopped run resumes at the
next leaf without asking Overpass for the finished ones again.

It writes the same normalised rows and `osm_routes` manifest as the other route
adapters. Every returned relation counts as fetched; a relation with no usable
member geometry is rejected as `unassembled`.

    python3 scripts/sources/osm_routes_global.py --workers 3
"""

from __future__ import annotations

import argparse
import gzip
import json
import lzma
import math
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import UA, emit, line_length_m, main_guard, registry_for, simplify

ENDPOINT = "https://overpass.openstreetmap.fr/api/interpreter"
INDEX_URL = "https://download.geofabrik.de/index-v1.json"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".cache", "osm-routes")
QUERY = "[out:json][timeout:120];rel[route=hiking]({south},{west},{north},{east});out geom;"
lock = threading.Lock()


def safe(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "-" for ch in value)


def leaves():
    req = urllib.request.Request(INDEX_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as res:
        index = json.loads(res.read().decode("utf-8"))
    rows = []
    for feature in index.get("features", []):
        props = feature.get("properties") or {}
        url = (props.get("urls") or {}).get("pbf")
        geom = feature.get("geometry") or {}
        if not url:
            continue
        boxes = []
        for polygon in geom.get("coordinates") or []:
            for ring in polygon:
                for lon, lat in ring:
                    boxes.append((lat, lon))
        if not boxes:
            continue
        rows.append(
            {
                "id": props.get("id") or url,
                "url": url,
                "bbox": (
                    min(x[0] for x in boxes),
                    min(x[1] for x in boxes),
                    max(x[0] for x in boxes),
                    max(x[1] for x in boxes),
                ),
            }
        )
    # Keep only leaves with no children: a parent bbox duplicates its children and
    # is usually far too large for one Overpass response.
    urls = [row["url"] for row in rows]
    terminal = []
    for row in rows:
        prefix = row["url"][: -len("-latest.osm.pbf")] + "/"
        if any(other.startswith(prefix) for other in urls):
            continue
        terminal.append(row)
    return sorted(terminal, key=lambda r: r["id"])


def query_bbox(bbox):
    south, west, north, east = bbox
    data = urllib.parse.urlencode(
        {"data": QUERY.format(south=south, west=west, north=north, east=east)}
    ).encode()
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                ENDPOINT,
                data=data,
                headers={
                    "User-Agent": UA,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=140) as res:
                body = res.read()
            payload = json.loads(body)
            if payload.get("remark"):
                return None, None
            return body, payload
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            if attempt == 2:
                return None, None
            time.sleep(8 * (attempt + 1))
    return None, None


def member_coords(members):
    coords = []
    for member in members:
        kind = member.get("type")
        if kind == "node" and member.get("lat") is not None:
            point = (round(float(member["lon"]), 6), round(float(member["lat"]), 6))
            if coords and point == coords[-1]:
                continue
            coords.append(point)
        elif kind == "way" and member.get("geometry"):
            line = [
                (round(float(p["lon"]), 6), round(float(p["lat"]), 6))
                for p in member["geometry"]
                if p and p.get("lat") is not None and p.get("lon") is not None
            ]
            if not line:
                continue
            if coords:
                last = coords[-1]
                if (
                    math.hypot(line[0][0] - last[0], line[0][1] - last[1])
                    > math.hypot(line[-1][0] - last[0], line[-1][1] - last[1])
                ):
                    line.reverse()
                if line[0] == last:
                    line = line[1:]
            coords.extend(line)
    return coords


def rows_for(payload):
    rejected = Counter()
    rows = []
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        coords = member_coords(element.get("members") or [])
        if len(coords) < 2:
            rejected["unassembled"] += 1
            continue
        coords = simplify(coords, max_points=400)
        rows.append(
            {
                "srcId": f"relation/{element.get('id')}",
                "cat": "trail",
                "name": tags.get("name:en") or tags.get("name") or tags.get("ref") or "",
                "country": tags.get("addr:country", ""),
                "where": tags.get("network") or tags.get("operator") or "",
                "operator": tags.get("operator") or "",
                "coords": coords,
                "distance_m": round(line_length_m(coords)),
                "difficulty": tags.get("sac_scale") or tags.get("mtb:scale") or "",
                "url": "",
                "tags": {
                    "route": tags.get("route"),
                    "network": tags.get("network"),
                    "ref": tags.get("ref"),
                    "sac_scale": tags.get("sac_scale"),
                },
            }
        )
    return rows, rejected, len(payload.get("elements") or [])


def split(bbox):
    south, west, north, east = bbox
    mid_lat, mid_lon = (south + north) / 2, (west + east) / 2
    return [
        (south, west, mid_lat, mid_lon),
        (south, mid_lon, mid_lat, east),
        (mid_lat, west, north, mid_lon),
        (mid_lat, mid_lon, north, east),
    ]


def write_rows(key, rows, rejected, fetched):
    rows_path = os.path.join(CACHE, "rows", f"{key}.ndjson.xz")
    meta_path = os.path.join(CACHE, "rows", f"{key}.json")
    os.makedirs(os.path.dirname(rows_path), exist_ok=True)
    with lzma.open(rows_path, "wt", encoding="utf-8", preset=6) as f:
        for row in rows:
            f.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"fetched": fetched, "rejected": dict(rejected)}, f)


def process(leaf_id, bbox, depth=0):
    """Return (rows, fetched, rejected, slices) for one bbox, recursively splitting."""
    key = f"{safe(leaf_id)}@{bbox[0]:.3f}_{bbox[1]:.3f}_{bbox[2]:.3f}_{bbox[3]:.3f}"
    rows_path = os.path.join(CACHE, "rows", f"{key}.ndjson.xz")
    gz_path = os.path.join(CACHE, "rows", f"{key}.ndjson.gz")
    old_path = os.path.join(CACHE, "rows", f"{key}.ndjson")
    meta_path = os.path.join(CACHE, "rows", f"{key}.json")
    raw_path = os.path.join(CACHE, "raw", f"{key}.json.gz")
    cached = next(
        (p for p in (rows_path, gz_path, old_path) if os.path.exists(p) and os.path.getsize(p) > 0),
        None,
    )
    if cached and os.path.exists(meta_path):
        opener = lzma.open if cached.endswith(".xz") else gzip.open if cached.endswith(".gz") else open
        mode = "rt" if cached.endswith((".xz", ".gz")) else "r"
        with opener(cached, mode, encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        meta = json.load(open(meta_path, encoding="utf-8"))
        return rows, meta.get("fetched", 0), Counter(meta.get("rejected") or {})

    # The row slice is a derived cache and has been cleared under disk pressure
    # before; the raw gzipped body is the durable one. Rebuilding rows from it
    # costs no query, so a cleared slice never sends us back to Overpass.
    if os.path.exists(raw_path) and os.path.getsize(raw_path):
        with gzip.open(raw_path, "rb") as f:
            payload = json.loads(f.read().decode("utf-8"))
        rows, rejected, fetched = rows_for(payload)
        write_rows(key, rows, rejected, fetched)
        return rows, fetched, rejected

    body, payload = query_bbox(bbox)
    if body is None:
        if depth >= 5 or (bbox[2] - bbox[0] < 0.25 and bbox[3] - bbox[1] < 0.25):
            print(f"osm routes: FAILED {key}", file=sys.stderr)
            return [], 0, Counter({"query_failed": 1})
        rows, fetched, rejected = [], 0, Counter()
        for child in split(bbox):
            r, f, x = process(leaf_id, child, depth + 1)
            rows.extend(r)
            fetched += f
            rejected.update(x)
        return rows, fetched, rejected

    rows, rejected, fetched = rows_for(payload)
    # The normalised row slice is the fast resume cache. The raw Overpass body is
    # larger but is what survives a cache clear, so it is written by default and
    # can be skipped with KEEP_RAW=0 when the disk is tight.
    if os.environ.get("KEEP_RAW", "1") == "1":
        os.makedirs(os.path.dirname(raw_path), exist_ok=True)
        with gzip.open(raw_path, "wb", compresslevel=6) as f:
            f.write(body)
    write_rows(key, rows, rejected, fetched)
    print(
        f"osm routes: {key}: {fetched:,} fetched · {len(rows):,} placed · "
        f"{sum(rejected.values()):,} rejected",
        file=sys.stderr,
    )
    return rows, fetched, rejected


def run(workers: int, limit: int = 0) -> None:
    os.makedirs(os.path.join(CACHE, "rows"), exist_ok=True)
    os.makedirs(os.path.join(CACHE, "raw"), exist_ok=True)
    plan = leaves()
    if limit:
        plan = plan[:limit]
    all_rows = {}
    fetched = 0
    raw_placed = 0
    rejected = Counter()
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(process, leaf["id"], leaf["bbox"]): leaf for leaf in plan}
        for future in as_completed(futures):
            leaf = futures[future]
            rows, count, bad = future.result()
            with lock:
                fetched += count
                raw_placed += len(rows)
                rejected.update(bad)
                for row in rows:
                    old = all_rows.get(row["srcId"])
                    if old is None or len(row["coords"]) > len(old["coords"]):
                        all_rows[row["srcId"]] = row
                done += 1
                if done % 10 == 0:
                    print(
                        f"osm routes: {done}/{len(plan)} leaves · "
                        f"{fetched:,} fetched · {len(all_rows):,} unique · "
                        f"{sum(rejected.values()):,} rejected",
                        file=sys.stderr,
                    )
    rows = list(all_rows.values())
    # Adjacent Geofabrik leaf boxes overlap at their edges, so the same relation
    # can be returned by more than one slice. That is a duplicate, not a silent
    # loss; account for it explicitly so coverage can still reconcile fetched.
    duplicates = max(0, raw_placed - len(rows))
    if duplicates:
        rejected["duplicate_relation"] += duplicates
    emit(
        "osm_routes",
        rows,
        registry=registry_for("osm_routes"),
        raw=fetched,
        fetched=fetched,
        rejected=dict(rejected),
        extra={
            "leaves": len(plan),
            "uniqueRelations": len(all_rows),
            "overpass": True,
            "endpoint": ENDPOINT,
        },
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    main_guard(lambda: run(args.workers, args.limit))
