#!/usr/bin/env python3
"""Aggregate the resumable route slices without another network pass.

The harvest writes one row slice and one accounting sidecar per leaf/sub-bbox.
This reads those slices, deduplicates the same OSM relation returned by adjacent
leaf boxes, and emits the normal source manifest. It is deliberately separate
from the fetcher so a completed or interrupted run can be recovered from disk.
"""

from __future__ import annotations

import glob
import gzip
import json
import lzma
import os
from collections import Counter

from common import emit, registry_for

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ROWS = os.path.join(ROOT, ".cache", "osm-routes", "rows")


def opener(path):
    if path.endswith(".xz"):
        return lzma.open(path, "rt", encoding="utf-8")
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, encoding="utf-8")


def main():
    rows_by_id = {}
    fetched = 0
    raw_placed = 0
    rejected = Counter()
    slices = 0
    for meta_path in sorted(glob.glob(os.path.join(ROWS, "*.json"))):
        meta = json.load(open(meta_path, encoding="utf-8"))
        key = meta_path[:-5]
        row_path = next(
            (p for p in (key + ".ndjson.xz", key + ".ndjson.gz", key + ".ndjson") if os.path.exists(p)),
            None,
        )
        if not row_path or os.path.getsize(row_path) == 0:
            continue
        slices += 1
        fetched += int(meta.get("fetched") or 0)
        rejected.update(meta.get("rejected") or {})
        count = 0
        with opener(row_path) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                count += 1
                old = rows_by_id.get(row.get("srcId"))
                if old is None or len(row.get("coords") or []) > len(old.get("coords") or []):
                    rows_by_id[row.get("srcId")] = row
        raw_placed += count

    duplicates = max(0, raw_placed - len(rows_by_id))
    if duplicates:
        rejected["duplicate_relation"] += duplicates
    rows = list(rows_by_id.values())
    emit(
        "osm_routes",
        rows,
        registry=registry_for("osm_routes"),
        raw=fetched,
        fetched=fetched,
        rejected=dict(rejected),
        extra={
            "leaves": slices,
            "uniqueRelations": len(rows),
            "collectedSlices": slices,
            "overpass": True,
            "endpoint": "https://overpass.openstreetmap.fr/api/interpreter",
        },
    )


if __name__ == "__main__":
    main()
