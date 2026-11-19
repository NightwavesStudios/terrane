#!/usr/bin/env python3
"""Global route=hiking harvest from Overpass, cached and resumable.

The Geofabrik/PBF path needs a copy of every continent on disk. This machine has
about a gigabyte free, so this adapter queries one continent bbox at a time and
keeps the raw response gzipped. A rerun reads the cache instead of Overpass.

The output is the same normalised trail row and `osm_routes` accounting manifest
as `osm_routes.py`. Every relation returned is fetched; a relation with no usable
member geometry is rejected with a reason, never silently omitted.

    python3 scripts/sources/osm_routes_overpass.py --all
    python3 scripts/sources/osm_routes_overpass.py --region europe
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from common import UA, emit, line_length_m, main_guard, registry_for, simplify

ENDPOINT = "https://overpass.osm.ch/api/interpreter"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, ".cache", "osm-routes")
QUERY = "[out:json][timeout:1800];rel[route=hiking]({south},{west},{north},{east});out geom;"

REGIONS = {
    "europe": (35, -25, 72, 45),
    "asia": (-12, 25, 82, 180),
    "africa": (-35, -20, 38, 55),
    "north-america": (7, -170, 85, -50),
    "south-america": (-56, -85, 15, -30),
    "oceania": (-50, 110, 0, 180),
}


def safe(name: str) -> str:
    return name.replace("/", "-")


def fetch_region(name: str, bbox) -> bytes:
    os.makedirs(os.path.join(CACHE, "raw"), exist_ok=True)
    os.makedirs(os.path.join(CACHE, "rows"), exist_ok=True)
    raw_path = os.path.join(CACHE, "raw", f"{safe(name)}.json.gz")
    if os.path.exists(raw_path):
        with gzip.open(raw_path, "rb") as f:
            return f.read()
    query = QUERY.format(south=bbox[0], west=bbox[1], north=bbox[2], east=bbox[3])
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                ENDPOINT,
                data=data,
                headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(req, timeout=1900) as res:
                body = res.read()
            with gzip.open(raw_path, "wb", compresslevel=6) as f:
                f.write(body)
            return body
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            last = err
            wait = 10 * (attempt + 1)
            print(f"osm routes: {name}: {err}; retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit(f"osm routes: {name} failed: {last}")


def member_coords(members):
    coords = []
    for member in members:
        kind = member.get("type")
        if kind == "node" and "lat" in member and "lon" in member:
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


def rows_for(body: bytes, region: str):
    data = json.loads(body)
    elements = data.get("elements") or []
    rejected = Counter()
    rows = []
    for element in elements:
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
    return rows, rejected, len(elements)


def run(regions) -> None:
    os.makedirs(CACHE, exist_ok=True)
    all_rows = {}
    fetched = 0
    raw = 0
    rejected = Counter()
    slices = []
    for name in regions:
        rows_path = os.path.join(CACHE, "rows", f"{safe(name)}.ndjson")
        if os.path.exists(rows_path):
            with open(rows_path, encoding="utf-8") as f:
                rows = [json.loads(line) for line in f if line.strip()]
            # The slice manifest carries the exact relation count, including rows
            # that did not produce a line.
            meta_path = os.path.join(CACHE, "rows", f"{safe(name)}.json")
            meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
            region_fetched = meta.get("fetched", len(rows))
            region_raw = meta.get("raw", region_fetched)
            region_rejected = Counter(meta.get("rejected") or {})
        else:
            body = fetch_region(name, REGIONS[name])
            rows, region_rejected, region_raw = rows_for(body, name)
            region_fetched = region_raw
            with gzip.open(os.path.join(CACHE, "raw", f"{safe(name)}.json.gz"), "wb") as f:
                f.write(body)
            with open(rows_path, "w", encoding="utf-8") as f:
                for row in rows:
                    f.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
            json.dump(
                {"fetched": region_fetched, "raw": region_raw, "rejected": dict(region_rejected)},
                open(os.path.join(CACHE, "rows", f"{safe(name)}.json"), "w", encoding="utf-8"),
            )
        raw += region_raw
        fetched += region_fetched
        rejected.update(region_rejected)
        slices.append(name)
        for row in rows:
            old = all_rows.get(row["srcId"])
            if old is None or len(row["coords"]) > len(old["coords"]):
                all_rows[row["srcId"]] = row
        print(
            f"osm routes: {name}: {region_fetched:,} fetched · {len(rows):,} placed · "
            f"{sum(region_rejected.values()):,} rejected",
            file=sys.stderr,
        )

    rows = list(all_rows.values())
    emit(
        "osm_routes",
        rows,
        registry=registry_for("osm_routes"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
        extra={"regions": slices, "uniqueRelations": len(all_rows), "overpass": True},
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", action="append", choices=sorted(REGIONS))
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    names = list(REGIONS) if args.all else (args.region or [])
    if not names:
        parser.error("give --all or --region")
    main_guard(lambda: run(names))
