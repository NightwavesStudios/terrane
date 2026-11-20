"""Geometry used by the trail pipeline.

The harvest and the merge both need the same rules, so they live here rather
than in either script:

* assemble route members only where their endpoints actually meet;
* clip a line to a Web-Mercator tile instead of relabelling it at a vertex;
* simplify with Douglas-Peucker in metres, not by taking every Nth point;
* measure a line in metres.

Everything is plain Python and WGS84 lon/lat, so the adapters do not need a
mapping dependency.
"""

from __future__ import annotations

import math
import unicodedata
from collections import Counter

EARTH_M = 6_371_000.0
MERCATOR_MAX = 85.05112878
ALLOWED_ROLES = {"", "main", "forward", "backward"}


# ── names ─────────────────────────────────────────────────────────────────


def normalize_name(value: object) -> str:
    """Collapse whitespace and case without changing the displayed name."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    text = "".join(ch if ch.isprintable() else " " for ch in text)
    return " ".join(text.strip().lower().split())


def name_key(value: object) -> str:
    """A comparison key: punctuation removed and generic suffixes dropped."""
    text = normalize_name(value)
    text = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    words = [w for w in text.split() if w not in {"trail", "route", "path", "track", "the"}]
    return " ".join(words)


# ── distance ──────────────────────────────────────────────────────────────


def haversine_m(a, b) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    rad = math.pi / 180.0
    dlat = (lat2 - lat1) * rad
    dlon = (lon2 - lon1) * rad
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(dlon / 2) ** 2
    )
    return 2 * EARTH_M * math.asin(min(1.0, math.sqrt(h)))


def line_length_m(coords) -> float:
    return sum(haversine_m(a, b) for a, b in zip(coords, coords[1:]))


def _local_m(p, origin_lat: float):
    """Metres east/north of a point, good enough for a few hundred kilometres."""
    lon, lat = p
    return (
        lon * 111_320.0 * math.cos(math.radians(origin_lat)),
        lat * 110_540.0,
    )


def point_to_segment_m(p, a, b) -> float:
    lat0 = (a[1] + b[1] + p[1]) / 3.0
    px, py = _local_m(p, lat0)
    ax, ay = _local_m(a, lat0)
    bx, by = _local_m(b, lat0)
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def point_to_polyline_m(p, coords) -> float:
    if len(coords) == 1:
        return haversine_m(p, coords[0])
    return min(point_to_segment_m(p, a, b) for a, b in zip(coords, coords[1:]))


def sample_line(coords, step_m: float = 100.0):
    """Points every `step_m` along a line, including both ends."""
    if not coords:
        return []
    points = [tuple(coords[0])]
    for a, b in zip(coords, coords[1:]):
        length = haversine_m(a, b)
        steps = max(1, int(round(length / step_m)))
        for i in range(1, steps + 1):
            t = i / steps
            points.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return points


# ── Web Mercator and tiles ────────────────────────────────────────────────


def lonlat_to_merc(lon: float, lat: float):
    """Normalised (0..1) Web-Mercator x/y. y increases south, like a tile."""
    x = (lon + 180.0) / 360.0
    lat = max(-MERCATOR_MAX, min(MERCATOR_MAX, lat))
    r = math.radians(lat)
    y = (1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0
    return x, y


def merc_to_lonlat(x: float, y: float):
    lon = x * 360.0 - 180.0
    n = math.pi * (1.0 - 2.0 * y)
    lat = math.degrees(math.atan(math.sinh(n)))
    return lon, lat


def tile_of(lon: float, lat: float, zoom: int):
    n = 2**zoom
    x = int((lon + 180.0) / 360.0 * n)
    rad = math.radians(max(-MERCATOR_MAX, min(MERCATOR_MAX, lat)))
    y = int((1.0 - math.log(math.tan(rad) + 1.0 / math.cos(rad)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_bounds_merc(zoom: int, x: int, y: int):
    """(xmin, ymin, xmax, ymax) in normalised Mercator coordinates."""
    n = 2**zoom
    return (x / n, y / n, (x + 1) / n, (y + 1) / n)


def tile_bounds_lonlat(zoom: int, x: int, y: int):
    xmin, ymin, xmax, ymax = tile_bounds_merc(zoom, x, y)
    west, north = merc_to_lonlat(xmin, ymin)
    east, south = merc_to_lonlat(xmax, ymax)
    return south, west, north, east


def _clip_segment(p0, p1, rect):
    """Liang-Barsky. Returns the clipped pair, or None."""
    xmin, ymin, xmax, ymax = rect
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - xmin), (dx, xmax - x0), (-dy, y0 - ymin), (dy, ymax - y0)):
        if p == 0:
            if q < 0:
                return None
            continue
        r = q / p
        if p < 0:
            if r > t1:
                return None
            if r > t0:
                t0 = r
        else:
            if r < t0:
                return None
            if r < t1:
                t1 = r
    a = (x0 + t0 * dx, y0 + t0 * dy)
    b = (x0 + t1 * dx, y0 + t1 * dy)
    if abs(a[0] - b[0]) < 1e-15 and abs(a[1] - b[1]) < 1e-15:
        return None
    return a, b


def _dedupe_points(points):
    out = []
    for p in points:
        if not out or abs(out[-1][0] - p[0]) > 1e-12 or abs(out[-1][1] - p[1]) > 1e-12:
            out.append((p[0], p[1]))
    return out


def _clip_merc_runs(merc, rect):
    runs = []
    current = []
    for a, b in zip(merc, merc[1:]):
        hit = _clip_segment(a, b, rect)
        if hit is None:
            if len(current) >= 2:
                runs.append(_dedupe_points(current))
            current = []
            continue
        ca, cb = hit
        if not current:
            current = [ca, cb]
        else:
            last = current[-1]
            if abs(last[0] - ca[0]) <= 1e-12 and abs(last[1] - ca[1]) <= 1e-12:
                current.append(cb)
            else:
                if len(current) >= 2:
                    runs.append(_dedupe_points(current))
                current = [ca, cb]
        if abs(cb[0] - b[0]) > 1e-12 or abs(cb[1] - b[1]) > 1e-12:
            # The line left the tile between this vertex and the next.
            if len(current) >= 2:
                runs.append(_dedupe_points(current))
            current = []
    if len(current) >= 2:
        runs.append(_dedupe_points(current))
    return [r for r in runs if len(r) >= 2]


def clip_line_to_tile(coords, zoom: int, x: int, y: int):
    """Clip one lon/lat line to one tile and return every inside run."""
    if not coords or len(coords) < 2:
        return []
    merc = [lonlat_to_merc(lon, lat) for lon, lat in coords]
    runs = _clip_merc_runs(merc, tile_bounds_merc(zoom, x, y))
    out = []
    for run in runs:
        line = []
        for mx, my in run:
            lon, lat = merc_to_lonlat(mx, my)
            line.append([round(lon, 6), round(lat, 6)])
        line = _dedupe_points(line)
        if len(line) >= 2:
            out.append(line)
    return out


def clip_line_to_tiles(coords, zoom: int):
    """Return [(x, y, run)] for every tile the line actually enters."""
    if not coords or len(coords) < 2:
        return []
    n = 2**zoom
    merc = [lonlat_to_merc(lon, lat) for lon, lat in coords]
    xs = [p[0] for p in merc]
    ys = [p[1] for p in merc]
    x0 = max(0, min(n - 1, int(math.floor(min(xs) * n))))
    x1 = max(0, min(n - 1, int(math.floor(max(xs) * n))))
    y0 = max(0, min(n - 1, int(math.floor(min(ys) * n))))
    y1 = max(0, min(n - 1, int(math.floor(max(ys) * n))))
    out = []
    # A sane route crosses a handful of z7 tiles. A corrupted transcontinental
    # line can cross thousands; clip those segment by segment rather than
    # walking every tile in its bounding box.
    if (x1 - x0 + 1) * (y1 - y0 + 1) > 8192:
        for a, b in zip(coords, coords[1:]):
            for x, y, run in clip_line_to_tiles([a, b], zoom):
                out.append((x, y, run))
        return out
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            for run in clip_line_to_tile(coords, zoom, x, y):
                out.append((x, y, run))
    return out


def line_intersects_bbox(coords, bbox) -> bool:
    """bbox is (south, west, north, east)."""
    south, west, north, east = bbox
    xmin, ymax = lonlat_to_merc(west, south)
    xmax, ymin = lonlat_to_merc(east, north)
    rect = (min(xmin, xmax), min(ymin, ymax), max(xmin, xmax), max(ymin, ymax))
    merc = [lonlat_to_merc(lon, lat) for lon, lat in coords]
    for p in merc:
        if rect[0] <= p[0] <= rect[2] and rect[1] <= p[1] <= rect[3]:
            return True
    return any(_clip_segment(a, b, rect) for a, b in zip(merc, merc[1:]))


# ── simplification ────────────────────────────────────────────────────────


def _rdp_indices(points, epsilon: float):
    """Douglas-Peucker on projected points, returned as kept indices."""
    if len(points) <= 2:
        return list(range(len(points)))
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        if end - start < 2:
            continue
        x1, y1 = points[start]
        x2, y2 = points[end]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        best = -1.0
        index = start
        for i in range(start + 1, end):
            px, py = points[i]
            dist = abs(dy * (px - x1) - dx * (py - y1)) / norm
            if dist > best:
                best = dist
                index = i
        if best > epsilon:
            keep.add(index)
            stack.append((start, index))
            stack.append((index, end))
    return sorted(keep)


def split_line_parts(
    coords,
    max_gap_m: float = 5000.0,
    chord_m: float = 2000.0,
    chord_ratio: float = 6.0,
):
    """Split a line at gaps and relative chords instead of drawing them.

    A way member can itself contain a missing section, and a relation can carry
    a bad segment between two real sections. Those survive endpoint assembly
    because there is only one member. They are still not a trail: a >5 km jump,
    or a >2 km jump that is also 6x the line's median spacing, starts a new part.
    """
    if not coords or len(coords) < 2:
        return []
    lengths = [haversine_m(a, b) for a, b in zip(coords, coords[1:])]
    ordered = sorted(lengths)
    median = ordered[len(ordered) // 2] if ordered else 0.0
    parts = []
    current = [coords[0]]
    for a, b, length in zip(coords, coords[1:], lengths):
        bad = length > max_gap_m or (length > chord_m and length > median * chord_ratio)
        if bad:
            if len(current) >= 2:
                parts.append(current)
            current = [b]
        else:
            current.append(b)
    if len(current) >= 2:
        parts.append(current)
    return parts


def simplify_line(coords, tolerance_m: float = 10.0, max_points: int = 300):
    """Douglas-Peucker in metres, with a hard point cap."""
    if not coords or len(coords) <= 2:
        return [list(p) for p in coords] if coords else []
    lat0 = sum(p[1] for p in coords) / len(coords)
    projected = [_local_m(p, lat0) for p in coords]
    epsilon = max(0.5, tolerance_m)
    keep = _rdp_indices(projected, epsilon)
    while len(keep) > max_points and epsilon < 100_000:
        epsilon *= 1.7
        keep = _rdp_indices(projected, epsilon)
    if len(keep) > max_points:
        keep = keep[: max_points - 1] + [len(coords) - 1]
    return [list(coords[i]) for i in keep]


# ── route member assembly ─────────────────────────────────────────────────


def _turn_deg(a, b, c) -> float:
    """Turn at b from a->b to b->c, in degrees (0 straight, 180 reversal)."""
    lat0 = b[1]
    ax, ay = _local_m(a, lat0)
    bx, by = _local_m(b, lat0)
    cx, cy = _local_m(c, lat0)
    v1 = (bx - ax, by - ay)
    v2 = (cx - bx, cy - by)
    n1 = math.hypot(*v1) or 1.0
    n2 = math.hypot(*v2) or 1.0
    cosine = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))
    return math.degrees(math.acos(cosine))


def _append(chain, line, at_start: bool, snap_m: float):
    line = list(line)
    if at_start:
        if haversine_m(chain[0], line[0]) <= snap_m:
            # Both lines start at the join; reverse the incoming line so it ends
            # there, then drop the duplicate vertex.
            return line[::-1][:-1] + chain
        if haversine_m(chain[0], line[-1]) <= snap_m:
            return line + chain[1:]
        return None
    if haversine_m(chain[-1], line[0]) <= snap_m:
        return chain + line[1:]
    if haversine_m(chain[-1], line[-1]) <= snap_m:
        return chain + line[-2::-1]
    return None


def _chain_in_order(lines, snap_m: float):
    chains = []
    current = list(lines[0])
    for line in lines[1:]:
        reverse = list(reversed(line))
        joined = _append(current, line, False, snap_m) or _append(current, reverse, False, snap_m)
        if joined is None:
            joined = _append(current, line, True, snap_m) or _append(current, reverse, True, snap_m)
        if joined is None:
            chains.append(_dedupe_points(current))
            current = list(line)
        else:
            current = joined
    chains.append(_dedupe_points(current))
    return [c for c in chains if len(c) >= 2]


def _join_chains(chains, snap_m: float):
    """Join chains whose ends meet, even when the relation order is shuffled."""
    chains = [list(c) for c in chains]
    changed = True
    while changed:
        changed = False
        for i in range(len(chains)):
            if changed:
                break
            for j in range(i + 1, len(chains)):
                a, b = chains[i], chains[j]
                options = []
                # A end to B start / B end, and A start to B start / B end.
                if haversine_m(a[-1], b[0]) <= snap_m:
                    options.append((False, False))
                if haversine_m(a[-1], b[-1]) <= snap_m:
                    options.append((False, True))
                if haversine_m(a[0], b[0]) <= snap_m:
                    options.append((True, False))
                if haversine_m(a[0], b[-1]) <= snap_m:
                    options.append((True, True))
                for reverse_a, reverse_b in options:
                    aa = list(reversed(a)) if reverse_a else a
                    bb = list(reversed(b)) if reverse_b else b
                    # Do not turn a shared trailhead into one route: a U-turn at
                    # the join is two trails leaving the same point.
                    if len(aa) >= 2 and len(bb) >= 2 and _turn_deg(aa[-2], aa[-1], bb[1]) > 165:
                        continue
                    merged = aa + bb[1:]
                    merged = _dedupe_points(merged)
                    chains[i] = merged
                    chains.pop(j)
                    changed = True
                    break
                if changed:
                    break
    return chains


def assemble_members(members, snap_m: float = 25.0):
    """Turn relation members into connected line parts.

    Roles are filtered to the main path; nodes and nested relations are counted
    but not drawn. A gap is never bridged: a new part starts instead, which is
    the difference between a route and a 171 km chord.
    """
    stats = Counter()
    lines = []
    for member in members or []:
        kind = member.get("type")
        if kind == "node":
            stats["node_members"] += 1
            continue
        if kind == "relation":
            stats["nested_relations"] += 1
            continue
        if kind != "way":
            continue
        role = str(member.get("role") or "").strip()
        if role not in ALLOWED_ROLES:
            stats["role_skipped"] += 1
            continue
        line = []
        for point in member.get("geometry") or []:
            if not point or point.get("lat") is None or point.get("lon") is None:
                continue
            line.append([round(float(point["lon"]), 6), round(float(point["lat"]), 6)])
        line = _dedupe_points(line)
        if len(line) >= 2:
            lines.append(line)
        else:
            stats["empty_ways"] += 1
    stats["ways"] = len(lines)
    if not lines:
        return [], stats
    chains = _chain_in_order(lines, snap_m)
    chains = _join_chains(chains, snap_m)
    stats["parts"] = len(chains)
    stats["gaps"] = max(0, len(chains) - 1)
    return [c for c in chains if len(c) >= 2], stats
