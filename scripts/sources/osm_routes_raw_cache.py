#!/usr/bin/env python3
"""Best-effort raw response cache for the global route harvest.

This is the cache the fetch pass prefers for a re-run: one gzipped Overpass body
per leaf (or per split child when a leaf is too large). It never writes normalized
rows, so it can be run after a completed harvest without touching the published
data.
"""

from __future__ import annotations

import gzip
import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from osm_routes_global import CACHE, leaves, query_bbox, safe, split

RAW = os.path.join(CACHE, "raw")
done_lock = threading.Lock()
done = 0


def cache(leaf_id, bbox, depth=0):
    key = f"{safe(leaf_id)}@{bbox[0]:.3f}_{bbox[1]:.3f}_{bbox[2]:.3f}_{bbox[3]:.3f}"
    path = os.path.join(RAW, f"{key}.json.gz")
    if os.path.exists(path) and os.path.getsize(path):
        return 1
    body, _ = query_bbox(bbox)
    if body is None:
        if depth >= 5 or (bbox[2] - bbox[0] < 0.25 and bbox[3] - bbox[1] < 0.25):
            return 0
        return sum(cache(leaf_id, child, depth + 1) for child in split(bbox))
    os.makedirs(RAW, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=6) as f:
        f.write(body)
    return 1


def main():
    os.makedirs(RAW, exist_ok=True)
    plan = leaves()
    count = 0
    with ThreadPoolExecutor(max_workers=24) as pool:
        futures = [pool.submit(cache, leaf["id"], leaf["bbox"]) for leaf in plan]
        for future in as_completed(futures):
            try:
                count += future.result()
            except Exception as exc:  # noqa: BLE001
                print(f"raw cache slice failed: {exc}", file=sys.stderr)
            if count and count % 50 == 0:
                print(f"raw cache: {count} responses", file=sys.stderr)
    print(f"raw cache: {count} responses in {RAW}", file=sys.stderr)


if __name__ == "__main__":
    main()
