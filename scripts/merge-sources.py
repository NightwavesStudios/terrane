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
import shutil
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from lib.geo import (  # noqa: E402
    clip_line_to_tiles,
    line_length_m,
    point_to_segment_m,
    sample_line,
    simplify_line,
    split_line_parts,
)

DATA = os.path.join(ROOT, "data", "sources")
POI = os.path.join(ROOT, "public", "poi")
TRAILS = os.path.join(ROOT, "public", "trails")
TRAILS_STAGING = os.path.join(ROOT, "public", ".trails-staging")
REPORTS = os.path.join(ROOT, "reports")
CELL = 6
# Trail lines are denser than points: a z6 cell over the Alps crossed the wire
# limit even after simplification. z7 keeps every route and makes each cell small.
TRAIL_CELL = 7
TRAIL_AUTHORITY = {"nps_trails": 4, "usfs_trails": 3, "blm_trails": 2, "osm_routes": 1}
AGENCY_TRAIL_SOURCES = {"nps_trails", "usfs_trails", "blm_trails"}
AGENCY_RADIUS_M = 30.0
AGENCY_COVERAGE = 0.70
DEDUPE_GRID_DEG = 0.005
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


def trail_priority(item):
    return TRAIL_AUTHORITY.get(item.get("src"), 0)


def exact_key(coords):
    return tuple((round(float(x), 6), round(float(y), 6)) for x, y in coords)


class SegmentGrid:
    """A coarse spatial hash of agency trail segments, for coverage tests."""

    def __init__(self):
        self.cells = defaultdict(list)

    def add_line(self, coords):
        for a, b in zip(coords, coords[1:]):
            span = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
            steps = max(1, min(2000, int(span / 0.001)))
            for i in range(steps + 1):
                lon = a[0] + (b[0] - a[0]) * i / steps
                lat = a[1] + (b[1] - a[1]) * i / steps
                key = (int(math.floor(lon / DEDUPE_GRID_DEG)), int(math.floor(lat / DEDUPE_GRID_DEG)))
                self.cells[key].append((a, b))

    def near(self, point, radius_m=AGENCY_RADIUS_M):
        gx = int(math.floor(point[0] / DEDUPE_GRID_DEG))
        gy = int(math.floor(point[1] / DEDUPE_GRID_DEG))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for a, b in self.cells.get((gx + dx, gy + dy), ()):
                    if point_to_segment_m(point, a, b) <= radius_m:
                        return True
        return False


def agency_coverage(coords, grid):
    """Fraction of an OSM line that lies within 30 m of an agency trail."""
    points = sample_line(coords, 100.0)
    if not points:
        return 0.0
    return sum(1 for p in points if grid.near(p)) / len(points)


def dedupe_trail_items(items):
    """Exact duplicates keep the authority; OSM pieces covered by an agency
    inventory are dropped so one physical trail is not drawn twice."""
    dropped = Counter()
    kept = []
    seen = {}
    for item in sorted(
        items, key=lambda i: (-trail_priority(i), i.get("src") or "", i.get("id") or "")
    ):
        key = exact_key(item["coords"])
        hit = seen.get(key)
        if hit is not None:
            dropped[f"duplicate_{item.get('src')}_into_{hit}"] += 1
            continue
        seen[key] = item.get("src") or ""
        kept.append(item)

    if any(item.get("src") in AGENCY_TRAIL_SOURCES for item in kept) and any(
        item.get("src") == "osm_routes" for item in kept
    ):
        grid = SegmentGrid()
        for item in kept:
            if item.get("src") in AGENCY_TRAIL_SOURCES:
                grid.add_line(item["coords"])
        filtered = []
        for item in kept:
            if item.get("src") == "osm_routes" and agency_coverage(item["coords"], grid) >= AGENCY_COVERAGE:
                dropped["osm_covered_by_agency"] += 1
                continue
            filtered.append(item)
        kept = filtered
    return kept, dropped


def _empty_cell():
    return {"z": TRAIL_CELL, "sources": [], "items": []}


def write_trail_payload(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    return os.path.getsize(path)


def snapshot_trail_cells():
    """Cells the previous store held, for explicit empty payloads.

    A rebuild can run after the generated mirror has been removed to make disk
    room; in that case the list saved before deletion is the only record of which
    cells must be emptied rather than silently left stale in the store.
    """
    old = set()
    saved = read_json(os.path.join(REPORTS, "pre-rebuild-trail-cells.json"), None)
    if isinstance(saved, list):
        old.update(str(rel) for rel in saved if str(rel).endswith(".json"))
    if not os.path.isdir(TRAILS):
        return old
    for root, _dirs, files in os.walk(TRAILS):
        for name in files:
            if name.endswith(".json"):
                old.add(os.path.relpath(os.path.join(root, name), TRAILS))
    return old


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
    old_cells = snapshot_trail_cells()
    cells = defaultdict(list)
    parts = 0

    for rec in records:
        src = rec.get("src") or "osm"
        coords = rec.get("coords") or []
        if len(coords) < 2:
            continue
        for index, (x, y, run) in enumerate(clip_line_to_tiles(coords, TRAIL_CELL)):
            run = simplify_line(run, tolerance_m=10.0, max_points=300)
            # 1.8 km is inside the gate's 2 km chord definition, so small
            # differences between the Python and JS distance calculations can
            # never leave a segment on the failing side of the boundary.
            for sub, piece in enumerate(
                split_line_parts(run, max_gap_m=1800.0, chord_m=1200.0, chord_ratio=4.0)
            ):
                if len(piece) < 2:
                    continue
                parts += 1
                name = " ".join(str(rec.get("name") or "").split())
                country = str(rec.get("country") or "").strip()
                cells[(x, y)].append(
                    {
                        "src": src,
                        "name": name,
                        "difficulty": rec.get("difficulty") or "",
                        # The source's full-route distance is not the distance of a
                        # tile piece. Measure the piece that is actually stored.
                        "distance_m": int(round(line_length_m(piece))),
                        "url": rec.get("url") or "",
                        "coords": piece,
                        "where": rec.get("where") or country,
                        "country": country,
                        "id": f"{rec.get('srcId') or src}:{x}:{y}:{index}:{sub}",
                    }
                )

    if os.path.isdir(TRAILS_STAGING):
        shutil.rmtree(TRAILS_STAGING)
    dropped = Counter()
    by_source = Counter()
    written = set()
    max_cell = 0
    segments = 0
    empty_after_dedupe = 0

    for (x, y), items in sorted(cells.items()):
        kept, drops = dedupe_trail_items(items)
        dropped.update(drops)
        if not kept:
            empty_after_dedupe += 1
            continue
        sources = sorted({i["src"] for i in kept if i["src"]})
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
                        i["country"],
                    ]
                    for i in current
                ],
            }

        rel = f"{TRAIL_CELL}/{x}/{y}.json"
        path = os.path.join(TRAILS_STAGING, rel)
        size = write_trail_payload(path, payload_for(kept))
        # A dense cell can still cross the wire limit. Keep every route and
        # coarsen the lines with Douglas-Peucker, never by dropping every Nth
        # point.
        for max_points in (240, 160, 100, 60):
            if size <= 12_000_000:
                break
            expanded = []
            for item in kept:
                coords = simplify_line(item["coords"], 10.0, max_points)
                # The wire distance must describe the geometry that is actually
                # stored, including this second, tighter simplification. Split
                # again because coarsening can itself create a long segment.
                for sub, piece in enumerate(split_line_parts(coords, max_gap_m=1200.0)):
                    if len(piece) < 2:
                        continue
                    expanded.append(
                        {
                            **item,
                            "coords": piece,
                            "distance_m": int(round(line_length_m(piece))),
                            "id": f"{item['id']}:{sub}",
                        }
                    )
            kept = expanded
            size = write_trail_payload(path, payload_for(kept))
        max_cell = max(max_cell, size)
        segments += len(kept)
        for item in kept:
            by_source[item["src"]] += 1
        written.add(rel)

    # A cell that used to carry a route but no longer does gets an explicit empty
    # payload. The client already knows how to read it, and no delete endpoint is
    # needed in the store worker.
    stale = sorted(old_cells - written)
    for rel in stale:
        write_trail_payload(os.path.join(TRAILS_STAGING, rel), _empty_cell())
        written.add(rel)

    if os.path.isdir(TRAILS):
        shutil.rmtree(TRAILS)
    os.rename(TRAILS_STAGING, TRAILS)

    stats = {
        "input": len(records),
        "cells": len(written) - len(stale),
        "segments": segments,
        "max_cell_bytes": max_cell,
        "bySource": dict(sorted(by_source.items())),
        "dropped": dict(sorted(dropped.items())),
        "candidateParts": parts,
        "emptyCells": empty_after_dedupe,
        "staleCellsEmptied": len(stale),
    }
    with open(os.path.join(ROOT, "src", "data", "trail-stats.json"), "w", encoding="utf-8") as f:
        json.dump({**stats, "updated": __import__("datetime").datetime.utcnow().date().isoformat()}, f, indent=1)
    return stats


def main():
    points_only = "--points-only" in sys.argv
    trails_only = "--trails-only" in sys.argv
    if points_only and trails_only:
        raise SystemExit("merge: --points-only and --trails-only are different runs")

    previous = read_json(os.path.join(REPORTS, "merge.json"), {}) or {}
    trail_records = None
    if not points_only:
        # Validate the trail input before the point merge writes anything: a run
        # that cannot rebuild trails must abort whole, not publish its points and
        # leave the trails reduced.
        trail_records = read_trails()
        require_trail_input(trail_records)

    if trails_only:
        # Leave the published points untouched; a trail repair must not need a
        # bucket round-trip for 9.4 million points.
        points = previous.get("points") or {}
        print("points: carried forward (trails-only run)")
    else:
        try:
            points = merge_points()
        except BucketCellError as err:
            print(
                "merge: refusing to write cells — the OSM bucket could not be read"
                f" ({err}).\n  Writing anyway would replace published OSM rows with the "
                "agency rows in that cell, so nothing was written.",
                file=sys.stderr,
            )
            raise SystemExit(1)

    if points_only:
        trails = previous.get("trails")
        if trails:
            trails = {**trails, "carried_from": trails.get("carried_from") or "reports/merge.json"}
        if not trails:
            stats = read_json(os.path.join(ROOT, "src", "data", "trail-stats.json"), {}) or {}
            if stats.get("segments"):
                trails = {
                    "input": stats.get("input"),
                    "segments": stats["segments"],
                    "cells": stats.get("cells"),
                    "max_cell_bytes": stats.get("max_cell_bytes"),
                    "carried_from": "src/data/trail-stats.json",
                }
    else:
        trails = merge_trails(trail_records)

    os.makedirs(REPORTS, exist_ok=True)
    report = {
        "points": points,
        "trails": trails,
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    with open(os.path.join(REPORTS, "merge.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)
    if points:
        print(
            f"points: {points.get('input', 0):,} in · {points.get('kept', 0):,} kept · "
            f"{points.get('merged', 0):,} merged · {points.get('replaced_osm', 0):,} OSM replaced · "
            f"{points.get('cells', 0):,} cells"
        )
    if trails:
        carried = " (carried forward, trails not rebuilt)" if points_only else ""
        print(
            f"trails: {int(trails.get('input') or 0):,} lines · "
            f"{int(trails.get('segments') or 0):,} segments · "
            f"{int(trails.get('cells') or 0):,} cells · "
            f"dropped {sum((trails.get('dropped') or {}).values()):,}{carried}"
        )


if __name__ == "__main__":
    main()
