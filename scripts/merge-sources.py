#!/usr/bin/env python3
"""Merge every ingested open source into the map's cells.

The rules are deliberately small and visible:

* one record per place: same category, within 50 m, same name (or one has no name);
* authority wins: agency data over OSM, RIDB over the other federal agencies;
* nothing is deleted silently — every dropped row is counted in ``reports/merge.json``;
* the cell wire format stays append-only. The fifth item is the source id; old rows
  without one are OSM.
"""

from __future__ import annotations

import gzip
import json
import math
import os
import urllib.error
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data", "sources")
POI = os.path.join(ROOT, "public", "poi")
TRAILS = os.path.join(ROOT, "public", "trails")
REPORTS = os.path.join(ROOT, "reports")
CELL = 6
# Trail lines are denser than points: a z6 cell over the Alps crossed the wire
# limit even after simplification. z7 keeps every route and makes each cell small.
TRAIL_CELL = 7
BUCKET = (os.environ.get("POI_BUCKET") or "").rstrip("/")
BUCKET_CELLS = 0
N = 2 ** CELL

KINDS = [
    "camp",
    "hut",
    "shelter",
    "water",
    "parking",
    "view",
    "picnic",
    "pass",
    "caravan",
    "toilets",
    "shower",
    "info",
    "trailhead",
]

AUTHORITY = [
    "ridb",
    "usfs_sites",
    "blm_sites",
    "doc_nz",
    "osm",
]

CATS = set(KINDS)


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def source_files():
    """One path per logical source, never both copies of it.

    The adapters write `<id>.ndjson`; a compressed `<id>.ndjson.gz` from an older
    run can sit next to it. Reading both ingests the same records twice, which
    doubled the trail segment count and inflated the merge accounting, so the
    uncompressed file wins whenever it exists.
    """
    by_base = {}
    for name in sorted(os.listdir(DATA)):
        base = name[:-3] if name.endswith(".gz") else name
        current = by_base.get(base)
        if current is None or current.endswith(".gz"):
            by_base[base] = name
    return [by_base[base] for base in sorted(by_base)]


def read_ndjson(path):
    if not os.path.exists(path):
        return
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if rec.get("cat") in CATS and "coords" not in rec:
                yield rec


def cell_of(lat, lon, zoom=CELL):
    n = 2 ** zoom
    lat = max(-85.05112878, min(85.05112878, lat))
    x = int((lon + 180) / 360 * n)
    rad = math.radians(lat)
    y = int((1 - math.log(math.tan(rad) + 1 / math.cos(rad)) / math.pi) / 2 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def distance_m(a, b):
    rad = math.pi / 180
    dlat = (b["lat"] - a["lat"]) * rad
    dlon = (b["lon"] - a["lon"]) * rad
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(a["lat"] * rad) * math.cos(b["lat"] * rad) * math.sin(dlon / 2) ** 2
    )
    return 2 * 6_371_000 * math.asin(min(1, math.sqrt(h)))


def norm_name(value):
    return " ".join((value or "").lower().replace("’", "'").split())


def rank(src):
    try:
        return len(AUTHORITY) - AUTHORITY.index(src)
    except ValueError:
        return 0


def point_records():
    records = []
    for name in source_files():
        base = name[:-3] if name.endswith(".gz") else name
        if not base.endswith(".ndjson") or base.endswith("_trails.ndjson") or base.startswith("osm_routes"):
            continue
        for rec in read_ndjson(os.path.join(DATA, name)):
            lat, lon = rec.get("lat"), rec.get("lon")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                continue
            rec["lat"], rec["lon"] = round(float(lat), 5), round(float(lon), 5)
            rec["src"] = rec.get("src") or base[:-7]
            records.append(rec)
    return records


def dedupe(records):
    """50 m grid, same category, same (or missing) name. Authority wins."""
    scale = 111_320 / 50
    cells = defaultdict(list)
    kept = []
    dropped = Counter()
    merged = 0
    for rec in sorted(records, key=lambda r: (-rank(r.get("src", "")), r.get("srcId", ""))):
        key = (rec["cat"], math.floor(rec["lat"] * scale), math.floor(rec["lon"] * scale))
        hit = None
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for other in cells.get((key[0], key[1] + dy, key[2] + dx), []):
                    if distance_m(rec, other) > 50:
                        continue
                    # Rows from one feed are distinct records unless they are the
                    # same id; only cross-source rows are candidates for a merge.
                    if rec.get("src") == other.get("src") and rec.get("srcId") != other.get("srcId"):
                        continue
                    a, b = norm_name(rec.get("name")), norm_name(other.get("name"))
                    if a and b and a != b:
                        continue
                    # Two unnamed points 50 m apart are two pitches, not one place.
                    if not a and not b and rec.get("srcId") != other.get("srcId"):
                        continue
                    hit = other
                    break
                if hit:
                    break
            if hit:
                break
        if hit is None:
            cells[key].append(rec)
            kept.append(rec)
            continue
        dropped[f"same_place_{rec.get('src')}_into_{hit.get('src')}"] += 1
        merged += 1
        for field in ("capacity", "url", "booking", "operator", "where"):
            if not hit.get(field) and rec.get(field):
                hit[field] = rec[field]
        hit.setdefault("also", []).append(
            {"src": rec.get("src"), "srcId": rec.get("srcId"), "name": rec.get("name")}
        )
    return kept, dropped, merged


def fetch_bucket_cell(x, y):
    """CI starts with an empty checkout. The OSM cells only exist in R2.

    A 404 means "this cell was never published", which is a real empty cell and
    safe to write agency rows into. Any other failure is not: treating an
    unreachable or unreadable bucket as an empty cell writes a cell holding only
    agency rows over a published cell full of OSM rows, and the upload step then
    publishes that loss. Those failures raise, and the run stops.
    """
    global BUCKET_CELLS
    if not BUCKET:
        return None
    url = f"{BUCKET}/poi/{CELL}/{x}/{y}.json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Terrane-merge/1"})
        with urllib.request.urlopen(req, timeout=30) as res:
            BUCKET_CELLS += 1
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return None
        raise BucketCellError(f"{url}: HTTP {err.code}") from err
    except (urllib.error.URLError, TimeoutError) as err:
        raise BucketCellError(f"{url}: {getattr(err, 'reason', err)}") from err
    except ValueError as err:
        raise BucketCellError(f"{url}: unparseable JSON ({err})") from err


class BucketCellError(RuntimeError):
    """A cell could not be read from the bucket for a reason other than absence."""


def load_cell(x, y):
    path = os.path.join(POI, str(CELL), str(x), f"{y}.json")
    cell = read_json(path) or fetch_bucket_cell(x, y)
    if not cell:
        return {"z": CELL, "kinds": KINDS, "items": [], "ids": [], "detail": [], "sources": []}
    detail = {i: tags for i, tags in cell.get("detail", [])}
    rows = []
    for i, item in enumerate(cell.get("items", [])):
        rows.append(
            {
                "lat": item[0],
                "lon": item[1],
                "kind": KINDS[item[2]] if isinstance(item[2], int) else item[2],
                "name": item[3] if len(item) > 3 else "",
                "src": item[4] if len(item) > 4 else "osm",
                "id": (cell.get("ids") or [None] * len(cell["items"]))[i],
                "tags": detail.get(i, {}),
            }
        )
    return {
        "z": CELL,
        "kinds": cell.get("kinds") or KINDS,
        "items": rows,
        "ids": [],
        "detail": [],
        "sources": cell.get("sources") or [],
    }


def band_for(rec):
    if rec.get("kind", rec.get("cat")) != "camp":
        return 2
    if rec.get("src") in ("ridb", "usfs_sites", "blm_sites", "doc_nz") and (
        rec.get("capacity") or rec.get("booking")
    ):
        return 0
    if rec.get("name"):
        return 1
    return 2


def write_cell(x, y, rows):
    rows.sort(key=lambda r: (KINDS.index(r["kind"]) if r["kind"] in KINDS else 99, -r["lat"], r["lon"]))
    items, ids, detail = [], [], []
    for index, row in enumerate(rows):
        name = row.get("name") or ""
        item = [row["lat"], row["lon"], KINDS.index(row["kind"]), name] if name else [
            row["lat"],
            row["lon"],
            KINDS.index(row["kind"]),
        ]
        if row.get("src") and row["src"] != "osm":
            while len(item) < 4:
                item.append("")
            item.append(row["src"])
        items.append(item)
        ids.append(row.get("id"))
        tags = dict(row.get("tags") or {})
        tags.setdefault("src", row.get("src"))
        tags.setdefault("src_id", str(row.get("id") or ""))
        for key in ("operator", "capacity", "url", "booking", "where"):
            if row.get(key):
                tags.setdefault(key, row[key])
        tags["band"] = band_for(row)
        detail.append([index, tags])
    payload = {"z": CELL, "kinds": KINDS, "items": items, "ids": ids, "detail": detail}
    if rows and any(r.get("src") != "osm" for r in rows):
        payload["sources"] = sorted({r.get("src") for r in rows if r.get("src")})
    path = os.path.join(POI, str(CELL), str(x), f"{y}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    return os.path.getsize(path)


def merge_points():
    records = point_records()
    kept, dropped, merged = dedupe(records)
    by_cell = defaultdict(list)
    for rec in kept:
        by_cell[cell_of(rec["lat"], rec["lon"])].append(rec)

    # Read every cell this run will touch before writing any of them. Reading
    # lazily inside the write loop meant a bucket failure halfway through left
    # the cells already visited rewritten and the rest untouched — a partial
    # publish that looks exactly like a successful merge.
    loaded = {key: load_cell(*key) for key in by_cell}

    cells = 0
    replaced = 0
    max_cell = 0
    for (x, y), incoming in by_cell.items():
        cell = loaded[(x, y)]
        rows = cell["items"]
        existing_ids = {str(r.get("id")) for r in rows if r.get("id")}
        # Authority over OSM: an agency row within 50 m of an OSM row replaces it.
        kept_rows = []
        for row in rows:
            near = next(
                (
                    rec
                    for rec in incoming
                    if rec["cat"] == row["kind"] and distance_m(rec, row) <= 50
                ),
                None,
            )
            if near and row.get("src") in (None, "", "osm"):
                replaced += 1
                continue
            kept_rows.append(row)
        rows = kept_rows
        for rec in incoming:
            if str(rec.get("srcId")) in existing_ids:
                continue
            rows.append(
                {
                    "lat": rec["lat"],
                    "lon": rec["lon"],
                    "kind": rec["cat"],
                    "name": rec.get("name") or "",
                    "src": rec.get("src"),
                    "id": rec.get("srcId"),
                    "tags": rec.get("tags") or {},
                    "operator": rec.get("operator"),
                    "capacity": rec.get("capacity"),
                    "url": rec.get("url"),
                    "booking": rec.get("booking"),
                    "where": rec.get("where"),
                }
            )
        max_cell = max(max_cell, write_cell(x, y, rows))
        cells += 1
    return {
        "input": len(records),
        "kept": len(kept),
        "dropped": dict(dropped),
        "merged": merged,
        "replaced_osm": replaced,
        "cells": cells,
        "max_cell_bytes": max_cell,
        "bucket_cells": BUCKET_CELLS,
    }


def read_trails():
    records = []
    for name in source_files():
        base = name[:-3] if name.endswith(".gz") else name
        if not base.endswith("_trails.ndjson") and base != "osm_routes.ndjson":
            continue
        path = os.path.join(DATA, name)
        if not os.path.exists(path):
            continue
        opener = gzip.open if base != name else open
        with opener(path, "rt", encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if rec.get("cat") == "trail" and rec.get("coords"):
                    records.append(rec)
    return records


def simplify(coords, max_points=60):
    if len(coords) <= max_points:
        return coords
    step = max(1, len(coords) // max_points)
    out = coords[::step]
    if out[-1] != coords[-1]:
        out.append(coords[-1])
    return out[:max_points]


def split_by_cell(coords, zoom=CELL):
    runs = []
    current = [coords[0]]
    current_cell = cell_of(coords[0][1], coords[0][0], zoom)
    for point in coords[1:]:
        cell = cell_of(point[1], point[0], zoom)
        if cell == current_cell:
            current.append(point)
            continue
        current.append(point)
        runs.append((current_cell, current))
        current = [point]
        current_cell = cell
    if len(current) >= 2:
        runs.append((current_cell, current))
    return runs


def line_length(coords):
    total = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        lat = math.radians((y1 + y2) / 2)
        total += math.hypot((x2 - x1) * 111_320 * math.cos(lat), (y2 - y1) * 110_540)
    return total


def require_trail_input(records):
    """Refuse to rebuild trails from less than the published store.

    OSM hiking routes are about 70% of the trail cells. A run that rebuilds from
    the agency feeds alone replaces ~449k published segments with ~325k and then
    reports success, so a missing required source — or an input that has collapsed
    against the last known-good merge — aborts the whole run before any cell is
    written. `--points-only` is the supported way to leave trails alone.
    """
    if not any(r.get("src") == "osm_routes" for r in records):
        raise SystemExit(
            "merge: refusing to rebuild trails — no osm_routes rows are present.\n"
            "  The three agency trail feeds alone are ~325k segments against a "
            "published ~449k.\n"
            "  Run the OSM route harvest first (scripts/sources/osm_routes_global.py), "
            "or use --points-only to carry trails forward. Nothing was written."
        )
    stats = read_json(os.path.join(ROOT, "src", "data", "trail-stats.json"), {}) or {}
    known = int(stats.get("input") or 0)
    if known and len(records) < known * 0.9:
        raise SystemExit(
            f"merge: refusing to rebuild trails — {len(records):,} input records is "
            f"under 90% of the last known-good {known:,}.\n  Nothing was written."
        )


def merge_trails(records=None):
    records = read_trails() if records is None else records
    cells = defaultdict(list)
    for rec in records:
        for index, (cell, run) in enumerate(split_by_cell(rec["coords"], TRAIL_CELL)):
            run = simplify(run, 45)
            if len(run) < 2:
                continue
            cells[cell].append(
                {
                    "src": rec.get("src"),
                    "name": rec.get("name") or "",
                    "difficulty": rec.get("difficulty") or "",
                    "distance_m": rec.get("distance_m") or round(line_length(run)),
                    "url": rec.get("url") or "",
                    "coords": run,
                    "where": rec.get("where") or "",
                    "id": f"{rec.get('srcId', '')}:{index}",
                }
            )
    max_cell = 0
    for (x, y), items in cells.items():
        sources = sorted({i["src"] for i in items if i["src"]})
        src_index = {src: index for index, src in enumerate(sources)}

        def payload_for(current):
            return {
                "z": TRAIL_CELL,
                "sources": sources,
                "items": [
                    [
                        src_index.get(i["src"], 0),
                        i["name"],
                        i["difficulty"],
                        i["distance_m"],
                        i["url"],
                        i["coords"],
                        i["where"],
                    ]
                    for i in current
                ],
            }

        path = os.path.join(TRAILS, str(TRAIL_CELL), str(x), f"{y}.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload_for(items), f, separators=(",", ":"), ensure_ascii=False)
        # A z6 cell over the Alps can hold enough long routes to cross the 12 MB
        # wire limit. Keep every route but coarsen its line until the cell fits.
        for max_points in (30, 20, 12):
            if os.path.getsize(path) <= 12_000_000:
                break
            for item in items:
                item["coords"] = simplify(item["coords"], max_points)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload_for(items), f, separators=(",", ":"), ensure_ascii=False)
        max_cell = max(max_cell, os.path.getsize(path))
    stats = {
        "input": len(records),
        "cells": len(cells),
        "segments": sum(len(v) for v in cells.values()),
        "max_cell_bytes": max_cell,
    }
    with open(os.path.join(ROOT, "src", "data", "trail-stats.json"), "w", encoding="utf-8") as f:
        json.dump({**stats, "updated": __import__("datetime").datetime.utcnow().date().isoformat()}, f, indent=1)
    return stats


def main():
    points_only = "--points-only" in os.sys.argv
    trail_records = None
    if not points_only:
        # Validate the trail input before the point merge writes anything: a run
        # that cannot rebuild trails must abort whole, not publish its points and
        # leave the trails reduced.
        trail_records = read_trails()
        require_trail_input(trail_records)
    try:
        points = merge_points()
    except BucketCellError as err:
        print(
            "merge: refusing to write cells — the OSM bucket could not be read "
            f"({err}).\n  Writing anyway would replace published OSM rows with the "
            "agency rows in that cell, so nothing was written.",
            file=os.sys.stderr,
        )
        raise SystemExit(1)
    previous = read_json(os.path.join(REPORTS, "merge.json"), {}) or {}
    # A points-only run does not touch the trail cells, so it must not erase the
    # trail numbers the published coverage page is built from. Carry the last full
    # merge forward; if there is none, fall back to the stats the cells came from.
    trails = merge_trails(trail_records) if not points_only else previous.get("trails")
    if points_only and trails:
        # Mark the carry explicitly, so the coverage report can say the trail cells
        # were carried forward rather than implying they were rebuilt this run.
        trails = {**trails, "carried_from": trails.get("carried_from") or "reports/merge.json"}
    if points_only and not trails:
        stats = read_json(os.path.join(ROOT, "src", "data", "trail-stats.json"), {}) or {}
        if stats.get("segments"):
            trails = {
                "input": stats.get("input"),
                "segments": stats["segments"],
                "cells": stats.get("cells"),
                "max_cell_bytes": stats.get("max_cell_bytes"),
                "carried_from": "src/data/trail-stats.json",
            }
    os.makedirs(REPORTS, exist_ok=True)
    report = {"points": points, "trails": trails, "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z"}
    with open(os.path.join(REPORTS, "merge.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)
    print(
        f"points: {points['input']:,} in · {points['kept']:,} kept · "
        f"{points['merged']:,} merged · {points['replaced_osm']:,} OSM replaced · "
        f"{points['cells']:,} cells"
    )
    if trails:
        carried = " (carried forward, trails not rebuilt)" if points_only else ""
        print(
            f"trails: {int(trails.get('input') or 0):,} lines · "
            f"{int(trails['segments']):,} segments · "
            f"{int(trails.get('cells') or 0):,} cells{carried}"
        )


if __name__ == "__main__":
    main()
