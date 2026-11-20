#!/usr/bin/env python3
"""Global route=hiking harvest, split into terminal Geofabrik leaf bboxes.

The public Overpass capacity mirrors cannot answer a continent-shaped query for
this layer, and this machine cannot hold the PBFs. This adapter therefore queries
the *terminal* Geofabrik leaves (US states, German regions, countries without
children), one cached gzipped response at a time, splitting a bbox further when
the server times out. Rows are cached separately, so a stopped run resumes at the
next leaf without asking Overpass for the finished ones again.

Members are assembled by endpoint, not by concatenating the relation in the order
Overpass happened to return. A gap starts a new part; it never becomes a chord.
Only main-path roles are drawn; approach, alternative and connection members are
counted and skipped. Each part is kept only if it intersects the leaf bbox.

`--offline` rebuilds the normalised rows from `.cache/osm-routes/raw` and refuses
to make a network request, so a fix to the assembler does not need a new harvest.

    python3 scripts/sources/osm_routes_global.py --workers 3
    python3 scripts/sources/osm_routes_global.py --offline --workers 4
"""

from __future__ import annotations

import argparse
import gzip
import json
import lzma
import multiprocessing
import os
import shutil
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from common import UA, emit, main_guard, registry_for  # noqa: E402
from lib.geo import (  # noqa: E402
    assemble_members,
    line_intersects_bbox,
    line_length_m,
    simplify_line,
    split_line_parts,
)

ENDPOINT = "https://overpass.openstreetmap.fr/api/interpreter"
INDEX_URL = "https://download.geofabrik.de/index-v1.json"
CACHE = os.path.join(ROOT, ".cache", "osm-routes")
QUERY = "[out:json][timeout:120];rel[route=hiking]({south},{west},{north},{east});out geom;"
ROWS_VERSION = 2
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
    urls = [row["url"] for row in rows]
    terminal = []
    for row in rows:
        prefix = row["url"][: -len("-latest.osm.pbf")] + "/"
        if any(other.startswith(prefix) for other in urls):
            continue
        terminal.append(row)
    return sorted(terminal, key=lambda r: r["id"])


def offline_plan():
    """The cached raw slices are the plan. No Geofabrik index request."""
    raw_dir = os.path.join(CACHE, "raw")
    if not os.path.isdir(raw_dir):
        return []
    plan = []
    for name in sorted(os.listdir(raw_dir)):
        if not name.endswith(".json.gz"):
            continue
        key = name[: -len(".json.gz")]
        leaf, _, box = key.rpartition("@")
        parts = box.split("_")
        if not leaf or len(parts) != 4:
            continue
        try:
            bbox = tuple(float(value) for value in parts)
        except ValueError:
            continue
        plan.append({"id": leaf, "bbox": bbox, "key": key})
    return plan


def query_bbox(bbox):
    if OFFLINE:
        return None, None
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


def rows_for(payload, bbox):
    """Return (rows, rejected, accounted, relations, extra).

    `accounted` is the number of parts plus rejected relations. `raw` stays the
    number of relations returned by Overpass, so coverage can report both.
    """
    rejected = Counter()
    extra = Counter()
    rows = []
    relations = 0
    elements = payload.get("elements") or []
    for element in elements:
        relations += 1
        tags = element.get("tags") or {}
        chains, stats = assemble_members(element.get("members") or [])
        for key in ("role_skipped", "nested_relations", "node_members", "empty_ways", "gaps"):
            extra[key] += int(stats.get(key) or 0)
        if not chains:
            rejected["unassembled"] += 1
            continue
        parts = [
            (index, chain)
            for index, chain in enumerate(chains)
            if line_intersects_bbox(chain, bbox)
        ]
        if not parts:
            extra["outside_bbox"] += 1
            continue
        name = " ".join(
            str(
                tags.get("name:en")
                or tags.get("name")
                or tags.get("ref")
                or ""
            ).split()
        )
        country = str(tags.get("addr:country") or tags.get("country") or "").strip()
        where = str(tags.get("network") or tags.get("operator") or "").strip()
        for index, chain in parts:
            coords = simplify_line(chain, tolerance_m=8.0, max_points=400)
            for sub, piece in enumerate(split_line_parts(coords)):
                if len(piece) < 2:
                    rejected["short_geometry"] += 1
                    continue
                src_id = (
                    f"relation/{element.get('id')}"
                    if len(chains) == 1 and sub == 0
                    else f"relation/{element.get('id')}:{index}:{sub}"
                )
                rows.append(
                    {
                        "srcId": src_id,
                        "relation": f"relation/{element.get('id')}",
                        "cat": "trail",
                        "name": name,
                        "country": country,
                        "where": where,
                        "operator": tags.get("operator") or "",
                        "coords": piece,
                        "distance_m": round(line_length_m(piece)),
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
    return rows, rejected, len(rows) + sum(rejected.values()), relations, extra


def split(bbox):
    south, west, north, east = bbox
    mid_lat, mid_lon = (south + north) / 2, (west + east) / 2
    return [
        (south, west, mid_lat, mid_lon),
        (south, mid_lon, mid_lat, east),
        (mid_lat, west, north, mid_lon),
        (mid_lat, mid_lon, north, east),
    ]


def write_rows(key, rows, accounted, rejected, relations, extra):
    rows_path = os.path.join(CACHE, "rows", f"{key}.ndjson.xz")
    meta_path = os.path.join(CACHE, "rows", f"{key}.json")
    os.makedirs(os.path.dirname(rows_path), exist_ok=True)
    with lzma.open(rows_path, "wt", encoding="utf-8", preset=6) as f:
        for row in rows:
            f.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "v": ROWS_VERSION,
                "fetched": accounted,
                "relations": relations,
                "rejected": dict(rejected),
                "extra": dict(extra),
            },
            f,
        )


def process(leaf_id, bbox, depth=0):
    """Return (rows, accounted, rejected, relations, extra) for one bbox."""
    key = leaf_id if "@" in leaf_id else f"{safe(leaf_id)}@{bbox[0]:.3f}_{bbox[1]:.3f}_{bbox[2]:.3f}_{bbox[3]:.3f}"
    rows_path = os.path.join(CACHE, "rows", f"{key}.ndjson.xz")
    gz_path = os.path.join(CACHE, "rows", f"{key}.ndjson.gz")
    old_path = os.path.join(CACHE, "rows", f"{key}.ndjson")
    meta_path = os.path.join(CACHE, "rows", f"{key}.json")
    raw_path = os.path.join(CACHE, "raw", f"{key}.json.gz")
    cached = next(
        (p for p in (rows_path, gz_path, old_path) if os.path.exists(p) and os.path.getsize(p) > 0),
        None,
    )
    meta = None
    if cached and os.path.exists(meta_path):
        try:
            meta = json.load(open(meta_path, encoding="utf-8"))
        except ValueError:
            meta = None
    if cached and meta and meta.get("v") == ROWS_VERSION:
        opener = lzma.open if cached.endswith(".xz") else gzip.open if cached.endswith(".gz") else open
        mode = "rt" if cached.endswith((".xz", ".gz")) else "r"
        with opener(cached, mode, encoding="utf-8") as f:
            rows = [json.loads(line) for line in f if line.strip()]
        return (
            rows,
            int(meta.get("fetched", 0)),
            Counter(meta.get("rejected") or {}),
            int(meta.get("relations", 0)),
            Counter(meta.get("extra") or {}),
        )

    # The row slice is a derived cache; the raw body is the durable one. A v1
    # row cache was built by the old stitcher, so it is deliberately ignored.
    if os.path.exists(raw_path) and os.path.getsize(raw_path):
        with gzip.open(raw_path, "rb") as f:
            payload = json.loads(f.read().decode("utf-8"))
        rows, rejected, accounted, relations, extra = rows_for(payload, bbox)
        write_rows(key, rows, accounted, rejected, relations, extra)
        return rows, accounted, rejected, relations, extra

    if OFFLINE:
        print(f"osm routes: offline, no raw slice for {key}", file=sys.stderr)
        return [], 0, Counter({"offline_missing": 1}), 0, Counter()

    body, payload = query_bbox(bbox)
    if body is None:
        if depth >= 5 or (bbox[2] - bbox[0] < 0.25 and bbox[3] - bbox[1] < 0.25):
            print(f"osm routes: FAILED {key}", file=sys.stderr)
            return [], 0, Counter({"query_failed": 1}), 0, Counter()
        rows, accounted, rejected, relations, extra = [], 0, Counter(), 0, Counter()
        for child in split(bbox):
            r, f, x, rel, e = process(leaf_id, child, depth + 1)
            rows.extend(r)
            accounted += f
            rejected.update(x)
            relations += rel
            extra.update(e)
        return rows, accounted, rejected, relations, extra

    rows, rejected, accounted, relations, extra = rows_for(payload, bbox)
    # The raw Overpass body is larger but is what survives a cache clear.
    if os.environ.get("KEEP_RAW", "1") == "1" and not OFFLINE:
        os.makedirs(os.path.dirname(raw_path), exist_ok=True)
        with gzip.open(raw_path, "wb", compresslevel=6) as f:
            f.write(body)
    write_rows(key, rows, accounted, rejected, relations, extra)
    print(
        f"osm routes: {key}: {relations:,} relations · {len(rows):,} parts · "
        f"{sum(rejected.values()):,} rejected",
        file=sys.stderr,
    )
    return rows, accounted, rejected, relations, extra


def run(workers: int, limit: int = 0) -> None:
    os.makedirs(os.path.join(CACHE, "rows"), exist_ok=True)
    os.makedirs(os.path.join(CACHE, "raw"), exist_ok=True)
    plan = offline_plan() if OFFLINE else leaves()
    if limit:
        plan = plan[:limit]
    all_rows = {}
    rejected = Counter()
    extra = Counter()
    raw_placed = 0
    relations = 0
    done = 0
    # An offline rebuild is CPU-bound (gzip + JSON + assembly), so threads would
    # sit behind the GIL. Online harvesting is I/O-bound and keeps the thread
    # pool; the fork context is safe because each child only reads its own slice
    # and writes its own cache pair.
    if OFFLINE and workers > 1:
        context = multiprocessing.get_context("fork")
        pool = ProcessPoolExecutor(max_workers=workers, mp_context=context)
    else:
        pool = ThreadPoolExecutor(max_workers=workers)
    with pool:
        futures = {
            pool.submit(process, item.get("key") or item["id"], item["bbox"]): item
            for item in plan
        }
        for future in as_completed(futures):
            rows, _accounted, bad, rels, ex = future.result()
            with lock:
                raw_placed += len(rows)
                rejected.update(bad)
                relations += rels
                extra.update(ex)
                for row in rows:
                    old = all_rows.get(row["srcId"])
                    if old is None or len(row["coords"]) > len(old["coords"]):
                        all_rows[row["srcId"]] = row
                done += 1
                if done % 10 == 0:
                    print(
                        f"osm routes: {done}/{len(plan)} slices · "
                        f"{relations:,} relations · {len(all_rows):,} parts · "
                        f"{sum(rejected.values()):,} rejected",
                        file=sys.stderr,
                    )
    rows = list(all_rows.values())
    # The per-slice row cache exists so an interrupted rebuild can resume. Once
    # every slice is assembled it is redundant, and on a full disk those hundreds
    # of megabytes are the difference between writing the source and failing at
    # the final emit. The raw Overpass cache remains the durable input.
    if OFFLINE:
        shutil.rmtree(os.path.join(CACHE, "rows"), ignore_errors=True)
    duplicates = max(0, raw_placed - len(rows))
    fetched = len(rows) + sum(rejected.values())
    unique_relations = len({row.get("relation") for row in rows if row.get("relation")})
    emit(
        "osm_routes",
        rows,
        registry=registry_for("osm_routes"),
        raw=relations,
        fetched=fetched,
        rejected=dict(rejected),
        extra={
            "leaves": len(plan),
            "slices": len(plan),
            "relations": relations,
            "uniqueRelations": unique_relations,
            "parts": len(rows),
            "duplicateParts": duplicates,
            "gapSplit": int(extra.get("gaps") or 0),
            "roleSkipped": int(extra.get("role_skipped") or 0),
            "nestedRelationsSkipped": int(extra.get("nested_relations") or 0),
            "outsideBbox": int(extra.get("outside_bbox") or 0),
            "overpass": not OFFLINE,
            "offline": OFFLINE,
            "endpoint": ENDPOINT,
        },
    )


OFFLINE = False

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument(
        "--offline",
        action="store_true",
        help="rebuild from .cache/osm-routes/raw and never query Overpass",
    )
    args = parser.parse_args()
    OFFLINE = args.offline
    main_guard(lambda: run(args.workers, args.limit))
