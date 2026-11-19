#!/usr/bin/env python3
"""Shared plumbing for the open-data adapters.

Every adapter writes two things and nothing else:

* ``data/sources/<id>.ndjson`` — one normalized record per line.
* ``data/sources/<id>.json`` — the accounting: fetched, placed, rejected by reason,
  endpoint, licence, date and errors.

The accounting is the point. A source that silently returns zero is indistinguishable
from a place that does not exist, so the coverage step fails the run instead.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "data", "sources")
CACHE = os.path.join(ROOT, ".cache", "sources")
UA = "Terrane/0.2 (open recreation data; dev@terrane.app)"
TIMEOUT = 120

CATS = {
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
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_dirs() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)


def clean(value) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def number(value):
    if value is None or value == "":
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def coord_ok(lat, lon) -> bool:
    return (
        lat is not None
        and lon is not None
        and -90 <= lat <= 90
        and -180 <= lon <= 180
        and not (lat == 0 and lon == 0)
    )


def fetch(url: str, params: dict | None = None, timeout: int = TIMEOUT) -> bytes:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            last = err
            time.sleep(2 + attempt * 3)
    raise RuntimeError(f"{url}: {last}")


def fetch_json(url: str, params: dict | None = None, timeout: int = TIMEOUT):
    raw = fetch(url, params, timeout)
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError as err:
        raise RuntimeError(f"{url}: not JSON ({raw[:120]!r})") from err


def download(url: str, path: str, timeout: int = 600) -> str:
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as res, open(tmp, "wb") as out:
        while True:
            chunk = res.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, path)
    return path


def unzip_member(zip_path: str, name: str, dest_dir: str) -> str:
    target = os.path.join(dest_dir, name)
    if os.path.exists(target):
        return target
    with zipfile.ZipFile(zip_path) as zf:
        zf.extract(name, dest_dir)
    return target


def arcgis_features(
    service_url: str,
    layer: int = 0,
    where: str = "1=1",
    out_fields: str = "*",
    page: int = 500,
    geometry: str | None = None,
):
    """Yield GeoJSON features from an ArcGIS MapServer/FeatureServer layer.

    ``f=geojson`` keeps the geometry in WGS84 and the properties flat. Pagination is
    explicit because several of these layers are far larger than one response.
    """
    base = service_url.rstrip("/")
    if not base.endswith("/query"):
        tail = base.rsplit("/", 1)[-1]
        # A service URL can already point at one layer (`.../MapServer/0`).
        if tail.isdigit() or tail.lower().startswith("layer"):
            base = f"{base}/query"
        else:
            base = f"{base}/{layer}/query"
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": out_fields,
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": page,
            "orderByFields": "OBJECTID",
        }
        if geometry:
            params.update(
                {
                    "geometry": geometry,
                    "geometryType": "esriGeometryEnvelope",
                    "inSR": "4326",
                    "spatialRel": "esriSpatialRelIntersects",
                }
            )
        try:
            data = fetch_json(base, params)
        except RuntimeError:
            params["f"] = "json"
            data = fetch_json(base, params)
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"{base}: {data['error']}")
        feats = data.get("features") or []
        for feature in feats:
            yield feature
        if len(feats) < page:
            return
        offset += page


def point_of(feature: dict):
    geom = feature.get("geometry") or {}
    if geom.get("type") == "Point":
        coords = geom.get("coordinates") or []
        if len(coords) >= 2:
            return number(coords[1]), number(coords[0])
    # ArcGIS f=json fallback
    if "x" in geom and "y" in geom:
        return number(geom.get("y")), number(geom.get("x"))
    return None, None


def lines_of(feature: dict):
    geom = feature.get("geometry") or {}
    kind = geom.get("type")
    coords = geom.get("coordinates") or []
    if kind == "LineString":
        return [coords]
    if kind == "MultiLineString":
        return coords
    if "paths" in geom:
        return geom["paths"]
    return []


def simplify(coords, max_points: int = 80):
    """Keep the shape, drop the surveying. Douglas-Peucker in degrees."""
    pts = [(number(x), number(y)) for x, y in coords]
    pts = [(x, y) for x, y in pts if x is not None and y is not None]
    if len(pts) <= 2:
        return [[round(x, 5), round(y, 5)] for x, y in pts]
    if len(pts) <= max_points:
        return [[round(x, 5), round(y, 5)] for x, y in pts]

    def rdp(points, eps):
        if len(points) < 3:
            return points
        x1, y1 = points[0]
        x2, y2 = points[-1]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        best, index = -1.0, 0
        for i in range(1, len(points) - 1):
            px, py = points[i]
            dist = abs(dy * (px - x1) - dx * (py - y1)) / norm
            if dist > best:
                best, index = dist, i
        if best <= eps:
            return [points[0], points[-1]]
        left = rdp(points[: index + 1], eps)
        right = rdp(points[index:], eps)
        return left[:-1] + right

    eps = 0.00005
    out = rdp(pts, eps)
    while len(out) > max_points:
        eps *= 1.8
        out = rdp(pts, eps)
    return [[round(x, 5), round(y, 5)] for x, y in out]


def line_length_m(coords) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        lat = math.radians((y1 + y2) / 2)
        total += math.hypot((x2 - x1) * 111_320 * math.cos(lat), (y2 - y1) * 110_540)
    return total


def emit(source: str, rows, *, registry: dict, raw: int, fetched: int, rejected: dict, extra: dict | None = None):
    """Write the NDJSON and the accounting manifest for one source."""
    ensure_dirs()
    path = os.path.join(OUT_DIR, f"{source}.ndjson")
    placed = 0
    with open(path, "w", encoding="utf-8") as out:
        for row in rows:
            if not row.get("srcId") or not row.get("cat"):
                continue
            row["src"] = source
            row.setdefault("fetchedAt", now())
            out.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
            placed += 1

    manifest = {
        "id": source,
        "name": registry.get("name", source),
        "licence": registry.get("licence", ""),
        "family": registry.get("family", "points"),
        "coverage": registry.get("coverage", ""),
        "endpoint": registry.get("endpoint", ""),
        "cadence": registry.get("cadence", ""),
        "expected": registry.get("expected"),
        "gate": registry.get("gate"),
        "note": registry.get("note", ""),
        "fetchedAt": now(),
        "updated": now()[:10],
        "raw": raw,
        "fetched": fetched,
        "placed": placed,
        "rejected": rejected,
        "unaccounted": fetched - placed - sum(rejected.values()),
        "bytes": os.path.getsize(path),
        **(extra or {}),
    }
    with open(os.path.join(OUT_DIR, f"{source}.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    print(
        f"{source}: raw {raw:,} · fetched {fetched:,} · placed {placed:,} · "
        f"rejected {sum(rejected.values()):,} · {manifest['bytes'] / 1e6:.1f} MB"
    )
    return manifest


def registry_for(source: str) -> dict:
    with open(os.path.join(ROOT, "src", "data", "sources.json"), encoding="utf-8") as f:
        data = json.load(f)
    for row in data.get("sources", []):
        if row.get("id") == source:
            return row
    raise KeyError(f"source {source!r} is not in src/data/sources.json")


def main_guard(fn):
    try:
        fn()
    except Exception as err:  # noqa: BLE001 - the workflow must see a non-zero exit
        print(f"FAILED: {err}", file=sys.stderr)
        raise
