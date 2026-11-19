#!/usr/bin/env python3
"""Assemble OSM `route=hiking` relations into owned trail records.

Trail geometry already exists in the basemap. What the basemap does not give us is
the route identity: a name, a ref, a difficulty and a distance that survive from
z8.5. This adapter takes the relation members, stitches their ways in member order,
and emits one line per route. `merge-sources.py` splits the line at z6 cell edges.

Relations can contain other relations (Via Alpina is a parent of stages), so member
relations are expanded recursively. A route that cannot be assembled is counted,
not dropped silently.

    python3 scripts/sources/osm_routes.py --pbf .cache/osm/liechtenstein.osm.pbf
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import urllib.request
from collections import Counter

from common import (
    UA,
    download,
    emit,
    line_length_m,
    main_guard,
    registry_for,
    simplify,
)

ROUTE_VALUES = {"hiking", "foot"}
INDEX_URL = "https://download.geofabrik.de/index-v1.json"
CACHE = os.path.join(os.path.dirname(__file__), "..", "..", ".cache", "osm")


def relation_name(tags):
    return tags.get("name:en") or tags.get("name") or tags.get("ref") or ""


def assemble(members, rels, way_coords, seen=None):
    """Member order, relations expanded, ways flipped to keep the line continuous."""
    seen = set() if seen is None else seen
    coords = []

    def add_way(way_id):
        line = way_coords.get(way_id)
        if not line:
            return
        if coords:
            last = coords[-1]
            if (
                math.hypot(line[0][0] - last[0], line[0][1] - last[1])
                > math.hypot(line[-1][0] - last[0], line[-1][1] - last[1])
            ):
                line = list(reversed(line))
            if line[0] == last:
                line = line[1:]
        coords.extend(line)

    for member in members:
        kind, ref, _role = member
        if kind == "w":
            add_way(ref)
        elif kind == "r" and ref not in seen:
            seen.add(ref)
            child = rels.get(ref)
            if child:
                assemble(child["members"], rels, way_coords, seen)
    return coords


def region_pbfs(region: str, limit: int = 0) -> list[str]:
    """Download the Geofabrik leaves under one region, one resumable file each."""
    req = urllib.request.Request(INDEX_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as res:
        index = json.loads(res.read().decode("utf-8"))
    leaves = []
    for feature in index.get("features", []):
        props = feature.get("properties") or {}
        ident = props.get("id") or ""
        pbf = (props.get("urls") or {}).get("pbf")
        if not pbf or not ident:
            continue
        needle = f"/{region.strip('/')}"
        if ident != region and needle not in pbf:
            continue
        leaves.append((ident, pbf))
    leaves.sort()
    if limit:
        leaves = leaves[:limit]
    paths = []
    for ident, url in leaves:
        path = os.path.join(CACHE, f"{ident}.osm.pbf")
        print(f"osm routes: {ident}", file=sys.stderr)
        paths.append(download(url, path, timeout=1800))
    return paths


def run(pbfs) -> None:
    import osmium

    rels = {}
    routes = {}

    class Relations(osmium.SimpleHandler):
        def relation(self, r):
            tags = {k: v for k, v in r.tags}
            members = [(m.type, m.ref, m.role) for m in r.members]
            rels[r.id] = {"tags": tags, "members": members}
            if tags.get("route") in ROUTE_VALUES:
                routes[r.id] = r.id

    handler = Relations()
    for pbf in pbfs:
        handler.apply_file(pbf)

    needed = set()

    def collect(members, seen):
        for kind, ref, _role in members:
            if kind == "w":
                needed.add(ref)
            elif kind == "r" and ref not in seen:
                seen.add(ref)
                child = rels.get(ref)
                if child:
                    collect(child["members"], seen)

    for rel_id in routes:
        collect(rels[rel_id]["members"], {rel_id})

    way_coords = {}

    class Ways(osmium.SimpleHandler):
        def way(self, w):
            if w.id not in needed:
                return
            line = [
                (round(n.location.lon, 6), round(n.location.lat, 6))
                for n in w.nodes
                if n.location.valid()
            ]
            if len(line) >= 2:
                way_coords[w.id] = line

    ways = Ways()
    for pbf in pbfs:
        ways.apply_file(pbf, locations=True)

    rejected = Counter()
    rows = []
    for rel_id in routes:
        rec = rels[rel_id]
        tags = rec["tags"]
        coords = assemble(rec["members"], rels, way_coords, {rel_id})
        if len(coords) < 2:
            rejected["unassembled"] += 1
            continue
        if len(coords) < 2:
            rejected["short"] += 1
            continue
        coords = simplify(coords, max_points=400)
        rows.append(
            {
                "srcId": f"relation/{rel_id}",
                "cat": "trail",
                "name": relation_name(tags),
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

    emit(
        "osm_routes",
        rows,
        registry=registry_for("osm_routes"),
        raw=len(rels),
        fetched=len(routes),
        rejected=dict(rejected),
        extra={"pbfs": [os.path.basename(p) for p in pbfs], "ways_used": len(way_coords)},
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pbf", action="append", default=[])
    parser.add_argument("--region", help="Geofabrik region, e.g. europe or europe/liechtenstein")
    parser.add_argument("--limit", type=int, default=0, help="download at most N extracts")
    args = parser.parse_args()
    pbfs = list(args.pbf)
    if not pbfs and args.region:
        pbfs = region_pbfs(args.region, args.limit)
    if not pbfs:
        parser.error("give --pbf or --region")
    main_guard(lambda: run(pbfs))
