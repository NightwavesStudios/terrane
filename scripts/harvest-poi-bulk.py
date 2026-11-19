#!/usr/bin/env python3
"""
Harvests the outdoor POIs of the whole planet from Geofabrik country extracts into
the one-file-per-map-cell layout the map already reads.

    python3 scripts/harvest-poi-bulk.py                  # the whole world, resumable
    python3 scripts/harvest-poi-bulk.py --only=europe/albania,europe/austria
    python3 scripts/harvest-poi-bulk.py --region=africa
    python3 scripts/harvest-poi-bulk.py --deadline=2400  # stop after forty minutes
    python3 scripts/harvest-poi-bulk.py --refresh         # redo extracts OSM has changed
    python3 scripts/harvest-poi-bulk.py --merge           # rows → cells, validated
    python3 scripts/harvest-poi-bulk.py --report          # reports/poi-coverage.{md,json}
    python3 scripts/harvest-poi-bulk.py --status          # what is done, what is not

Why Geofabrik and pyosmium rather than Overpass: an Overpass query per cell makes the
public endpoint queue each request for about forty seconds before answering 502/429 —
fine for a province, impossible for 4,096 cells. Geofabrik
publishes the same OSM data as plain `.osm.pbf` downloads, one per country, no key and
no queue. This script streams those through pyosmium, keeps the categories below, and
writes the cells.

Source, licence and attribution
    Data: OpenStreetMap, https://www.openstreetmap.org/copyright
    Extracts: https://download.geofabrik.de/ (index: /index-v1.json)
    Licence: ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/
    Attribution shown in the app: "© OpenStreetMap contributors"
    Dependency: pyosmium (`pip install osmium`, an ~8 MB wheel, no compiler)
This script adds nothing of its own: every row is one mapped OSM feature, and the
absence of a feature means OSM has not mapped it — not that it does not exist.

Three resumable stages, each safe to interrupt:

    download  → .cache/poi-bulk/spool/*.osm.pbf   (deleted as soon as it is parsed)
    parse     → .cache/poi-bulk/rows/*.tsv        (one line per feature)
    merge     → public/poi/6/{x}/{y}.json         (staged, validated, then swapped in)

State lives in `.cache/poi-bulk/state.json`: one record per extract with its status,
byte count, row count, per-category counts, attempts, timestamps, source Last-Modified
and error text. `.cache/poi-bulk/failures.log` keeps the failures as plain lines. A run
that stops after forty countries resumes at the forty-first: an extract counts as done
only when its rows file exists and its state record says `parsed`.

What is kept
    lat, lon, category, name, OSM element type and id — for every feature.
    The mapped tags of camping and accommodation features (camp, caravan, hut,
    shelter): access, fee, charge, capacity, operator, opening_hours, reservation,
    facilities, accommodation type, and the extract it came from.
    Relations are counted, not placed: a campsite mapped as a multipolygon is rare
    next to the same ground mapped as a node or way, and resolving relation geometry
    means holding every member way of a file in memory. The count is reported as a
    known gap rather than silently dropped.

What is not kept, and why
    Footpath and route geometry (hiking routes, long-distance trails, via ferrata):
    those are lines, not pins. The basemap already serves OSM's path network as
    vector tiles and the Footpaths switch draws it, so copying it into cell files
    would duplicate a live layer with a static one. Route relations are counted per
    extract so the size of that network is reported (see the coverage report).
    Parking entrances, bicycle parking, individual picnic tables and wash basins:
    mapped so densely that they would swamp the layer; parking areas, toilets,
    showers, drinking water and springs are kept, which is what the layer can draw.
"""

import argparse
import json
import math
import os
import queue
import shutil
import atexit
import subprocess
import zlib
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

try:  # POSIX only; the harvest runs on Linux runners and macOS
    import fcntl
except ImportError:  # pragma: no cover - Windows fallback
    fcntl = None

INDEX_URL = "https://download.geofabrik.de/index-v1.json"
UA = "Terrane/0.1 (whole-world POI harvest; https://terrane.app)"

STATE = ".cache/poi-bulk"
SPOOL = os.path.join(STATE, "spool")
ROWS = os.path.join(STATE, "rows")
BUCKETS = os.path.join(STATE, "buckets")
PLAN_FILE = os.path.join(STATE, "plan.json")
STATE_FILE = os.path.join(STATE, "state.json")
FAILURES = os.path.join(STATE, "failures.log")
MERGE_FILE = os.path.join(STATE, "merge.json")

OUT_DIR = "public/poi"
STAGING = "public/.poi-staging"
PREVIOUS = "public/.poi-previous"
OUT_Z = 6

REPORTS = "reports"
REPORT_MD = os.path.join(REPORTS, "poi-coverage.md")
REPORT_JSON = os.path.join(REPORTS, "poi-coverage.json")

# Wire format, shared with `src/map/mapped.ts`. The first eight indices are frozen:
# cells written by the older radius/Overpass harvest and the client's icon table
# both depend on them. New categories are appended, never inserted.
KINDS = [
    "camp",  # 0
    "hut",  # 1
    "shelter",  # 2
    "water",  # 3
    "parking",  # 4
    "view",  # 5
    "picnic",  # 6
    "pass",  # 7
    "caravan",  # 8
    "toilets",  # 9
    "shower",  # 10
    "info",  # 11
    "trailhead",  # 12
]

TAGS = [
    # Camping and accommodation.
    ("tourism", "camp_site", "camp"),
    ("tourism", "camp_pitch", "camp"),
    ("tourism", "caravan_site", "caravan"),
    ("tourism", "alpine_hut", "hut"),
    ("tourism", "wilderness_hut", "hut"),
    ("amenity", "shelter", "shelter"),
    # Water and essentials.
    ("amenity", "drinking_water", "water"),
    ("amenity", "water_point", "water"),
    ("man_made", "water_tap", "water"),
    ("natural", "spring", "water"),
    ("amenity", "toilets", "toilets"),
    ("amenity", "shower", "shower"),
    # Access and parking.
    ("amenity", "parking", "parking"),
    ("highway", "trailhead", "trailhead"),
    # Recreation and landmarks.
    ("tourism", "viewpoint", "view"),
    ("tourism", "picnic_site", "picnic"),
    ("mountain_pass", "yes", "pass"),
    ("tourism", "information", "info"),
]
TAG_INDEX = {(k, v): KINDS.index(kind) for k, v, kind in TAGS}

# `tourism=information` covers audio guides and tappable terminals too; the boards,
# maps and signposts are the ones that mean "you are on the trail".
INFO_SUBTAGS = {"board", "map", "guidepost", "trail_blaze", "route_marker"}

# Route relations are not turned into pins, but counting them says how much trail
# network OSM holds and keeps the omission honest.
ROUTE_TAGS = [("route", "hiking"), ("route", "foot"), ("route", "bicycle")]

# Names are drawn by the map only for these kinds, and they are most of the bytes in
# a cell file, so only these carry one. Caravan sites are named often enough to be
# worth the label.
NAMED = {KINDS.index(k) for k in ("camp", "hut", "pass", "caravan")}
NAME_MAX = 40

# Camping and accommodation keep their tags: "is it free, is there water, does it take
# motorhomes" is the whole reason to have a campsite in a map like this, and the
# source is ODbL so the useful fields can travel with the point. The list is a
# whitelist on purpose — dumping every tag would multiply the download for facts
# nobody asked for.
DETAIL_KINDS = {KINDS.index(k) for k in ("camp", "caravan", "hut", "shelter")}
DETAIL_TAGS = (
    "name",
    "name:en",
    "operator",
    "access",
    "fee",
    "charge",
    "capacity",
    "reservation",
    "opening_hours",
    "website",
    "phone",
    "description",
    "surface",
    "tent",
    "caravan",
    "motorhome",
    "backcountry",
    "informal",
    "shelter_type",
    "toilets",
    "drinking_water",
    "shower",
    "power_supply",
    "ele",
    "dog",
    "seasonal",
    "rooms",
    "beds",
)
DETAIL_VALUE_MAX = 90

# Extracts that are a second copy of ground covered by other extracts. The plan
# already drops every directory that has sub-extracts (so `us` loses to its fifty
# states); these are the ones Geofabrik also publishes as a plain file next to the
# pieces, and downloading them would only produce rows to deduplicate.
SKIP_IDS = {
    "alps",
    "britain-and-ireland",
    "dach",
    "great-britain",
    "sea",
    "us-south",
    "us-west",
    "us-midwest",
    "us-northeast",
    "us-pacific",
    "south-africa-and-lesotho",
}

FILE_VERSION = 2


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def human(n):
    for unit in ("B", "kB", "MB", "GB"):
        if abs(n) < 1000 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1000
    return f"{n:.1f} GB"


# ── state ────────────────────────────────────


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                state = json.load(f)
            if state.get("version") == FILE_VERSION:
                state.setdefault("extracts", {})
                return state
        except Exception:
            pass
    return {
        "version": FILE_VERSION,
        "created": now(),
        "updated": now(),
        "index": INDEX_URL,
        "extracts": {},
    }


_STATE_LOCK = threading.Lock()
_STATE_LOCK_PATH = os.path.join(STATE, ".state.lock")


def export_state(state, path):
    """Write this run's extract records where another job can import them."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=0, sort_keys=True)
    os.replace(tmp, path)


def _replace_state(tmp):
    """Rename under an advisory file lock so separate processes cannot interleave."""
    with open(_STATE_LOCK_PATH, "w") as lock_file:
        if fcntl is not None:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            os.replace(tmp, STATE_FILE)
        finally:
            if fcntl is not None:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def save_state(state):
    """Atomic per-writer temp file plus a lock, so no save is lost.

    Every writer used to share `state.json.tmp`: one writer's replace removed
    another writer's temp file and the loser raised FileNotFoundError on
    os.replace, silently dropping that save (and the failure record with it).
    """
    state["updated"] = now()
    os.makedirs(STATE, exist_ok=True)
    body = json.dumps(state, indent=0, sort_keys=True)
    with _STATE_LOCK:
        fd, tmp = tempfile.mkstemp(prefix="state.", suffix=".tmp", dir=STATE)
        try:
            with os.fdopen(fd, "w") as f:
                f.write(body)
                f.flush()
                os.fsync(f.fileno())
            _replace_state(tmp)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)


def record(state, extract_id):
    return state["extracts"].setdefault(extract_id, {})


def fail(state, extract_id, stage, message):
    """One failure, in the manifest and in the plain-text log. Never silent."""
    entry = record(state, extract_id)
    entry["status"] = "failed"
    entry["attempts"] = int(entry.get("attempts", 0)) + 1
    entry["error"] = f"{stage}: {message}"[:400]
    entry["failed"] = now()
    os.makedirs(STATE, exist_ok=True)
    with open(FAILURES, "a") as f:
        f.write(f"{now()}\t{extract_id}\t{stage}\t{message}\n")
    save_state(state)


# ── the plan ─────────────────────────────────


def fetch_index():
    req = urllib.request.Request(INDEX_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def build_plan(force=False):
    """Leaf extracts with a pbf URL, plus their sizes, cached between runs."""
    if os.path.exists(PLAN_FILE) and not force:
        with open(PLAN_FILE) as f:
            plan = json.load(f)
        if plan and all(e.get("size") for e in plan):
            return plan

    data = fetch_index()["features"]
    entries = []
    for f in data:
        p = f["properties"]
        url = (p.get("urls") or {}).get("pbf")
        if not url:
            continue
        # What an extract covers is its path without the file name: `europe`,
        # `north-america/us`, `asia/japan`. An extract that contains another one's
        # path is a summary of it — the whole of Europe next to every European
        # country, or the whole of the US next to its fifty states — and is dropped,
        # because the pieces are the same ground for a smaller download.
        rel = url.split("download.geofabrik.de/", 1)[-1]
        cover = rel.replace("-latest.osm.pbf", "").rstrip("/")
        entries.append(
            {
                "id": p["id"],
                "name": p.get("name") or p["id"],
                "url": url,
                "cover": cover,
                "region": cover.split("/")[0],
            }
        )

    covers = [e["cover"] for e in entries]
    leaves = [
        e
        for e in entries
        if e["id"] not in SKIP_IDS
        and e["cover"].count("/") < 3
        and not any(c != e["cover"] and c.startswith(e["cover"] + "/") for c in covers)
    ]

    head(leaves)
    # Small countries first, largest last: a stopped run still leaves every continent
    # with real coverage instead of three quarters of Europe and nothing else.
    leaves.sort(key=lambda e: (e["size"], e["id"]))
    os.makedirs(STATE, exist_ok=True)
    with open(PLAN_FILE, "w") as f:
        json.dump(leaves, f, indent=0)
    total = sum(e["size"] for e in leaves)
    print(f"  plan: {len(leaves)} extracts, {total / 1e9:.1f} GB\n", flush=True)
    return leaves


def head(entries, workers=12):
    """Content-Length (and Last-Modified) for each extract, so the job can be
    ordered, budgeted, and later refreshed without downloading anything."""
    lock = threading.Lock()
    q = queue.Queue()
    for e in entries:
        q.put(e)

    def run():
        while True:
            try:
                e = q.get_nowait()
            except queue.Empty:
                return
            size = 0
            modified = ""
            for attempt in range(3):
                try:
                    req = urllib.request.Request(
                        e["url"], method="HEAD", headers={"User-Agent": UA}
                    )
                    with urllib.request.urlopen(req, timeout=60) as r:
                        size = int(r.headers.get("Content-Length") or 0)
                        modified = r.headers.get("Last-Modified") or ""
                    break
                except Exception:
                    time.sleep(1 + attempt)
            with lock:
                e["size"] = size
                e["modified"] = modified

    threads = [threading.Thread(target=run) for _ in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()


# ── parse one extract ───────────────────────


def slug(extract_id):
    return extract_id.replace("/", "_")


def kind_of(tags):
    for (key, value), kind in TAG_INDEX.items():
        if tags.get(key) != value:
            continue
        if kind == KINDS.index("info") and tags.get("information") not in INFO_SUBTAGS:
            continue
        return kind
    return None


def tidy_name(tags):
    name = (tags.get("name:en") or tags.get("name") or "").strip()
    # Tabs and newlines are the row format's delimiters, and a handful of OSM names
    # contain them.
    name = " ".join(name.split())
    if len(name) > NAME_MAX:
        name = name[: NAME_MAX - 1].rstrip() + "…"
    return name


def detail(tags, extract_id):
    """The mapped facts worth keeping with a camping feature, as compact JSON."""
    out = {"region": extract_id}
    for key in DETAIL_TAGS:
        value = tags.get(key)
        if not value:
            continue
        value = " ".join(value.split())
        if len(value) > DETAIL_VALUE_MAX:
            value = value[: DETAIL_VALUE_MAX - 1] + "…"
        out[key] = value
    return json.dumps(out, separators=(",", ":"), ensure_ascii=False)


def parse(path, out_path, extract_id):
    """Stream one .osm.pbf into a row file: nodes, and way centroids.

    Columns: lat, lon, kind, name, element type, element id, detail JSON. The element
    type and id are OSM's own identity, which is what makes a sorted, deduplicated,
    updatable store possible; the detail JSON is empty except for camping kinds.
    """
    import osmium
    import osmium.filter as ofilter

    rows = []
    counts = {k: 0 for k in KINDS}
    routes = {"hiking": 0, "foot": 0, "bicycle": 0}
    unplaced = 0

    def add(tags, lat, lon, otype, oid):
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or not math.isfinite(lat + lon):
            return
        kind = kind_of(tags)
        if kind is None:
            return
        name = tidy_name(tags) if kind in NAMED else ""
        extra = detail(tags, extract_id) if kind in DETAIL_KINDS else ""
        rows.append((round(lat, 4), round(lon, 4), kind, name, otype, oid, extra))
        counts[KINDS[kind]] += 1

    class Collector(osmium.SimpleHandler):
        def node(self, n):
            if not n.tags:
                return
            if not n.location.valid():
                return
            add(n.tags, n.location.lat, n.location.lon, "n", n.id)

        def way(self, w):
            if not w.tags:
                return
            if kind_of(w.tags) is None:
                return
            # Mean of the outline. Area-weighted would be better and costs three
            # times the work for a position that only has to be inside the site.
            lat = lon = 0.0
            n = 0
            for node in w.nodes:
                if node.location.valid():
                    lat += node.location.lat
                    lon += node.location.lon
                    n += 1
            if n:
                add(w.tags, lat / n, lon / n, "w", w.id)

        def relation(self, r):
            # Counted, not placed: see the module docstring.
            nonlocal unplaced
            if not r.tags:
                return
            route = r.tags.get("route")
            if route in routes:
                routes[route] += 1
            if kind_of(r.tags) is not None:
                unplaced += 1

    handler = Collector()
    # A node-location index on disk, not in memory: a two-gigabyte extract holds
    # hundreds of millions of nodes, and only the way centroids ever read them.
    idx = os.path.join(SPOOL, os.path.basename(out_path) + ".nodes")
    # The tag filter is what makes this a whole-planet job: it runs in C++ and hands
    # only objects carrying one of the tag pairs to Python. Albania alone is 8.1
    # million nodes and 1,670 of them matter — filtering costs 1.8 s, calling back
    # for every node costs 20.8 s, and at 75 GB that is the difference between an
    # evening and forty minutes.
    pairs = [(k, v) for k, v, _ in TAGS] + ROUTE_TAGS
    handler.apply_file(
        path,
        locations=True,
        idx="sparse_file_array," + idx,
        filters=[ofilter.TagFilter(*pairs)],
    )
    if os.path.exists(idx):
        os.remove(idx)

    os.makedirs(ROWS, exist_ok=True)
    tmp = out_path + ".part"
    with open(tmp, "w") as f:
        for lat, lon, kind, name, otype, oid, extra in rows:
            f.write(f"{lat}\t{lon}\t{kind}\t{name}\t{otype}\t{oid}\t{extra}\n")
    os.replace(tmp, out_path)  # a half-written row file is never mistaken for a parse
    return len(rows), counts, routes, unplaced


# ── downloading ──────────────────────────────


def download(entry, path, attempts=6):
    """Fetch one extract. Geofabrik serves through a pool of mirrors, and some of
    them answer 404 for a file the others have; a retry is the whole fix."""
    part = path + ".part"
    last_error = ""
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(entry["url"], headers={"User-Agent": UA})
            start = os.path.getsize(part) if os.path.exists(part) else 0
            if start:
                req.add_header("Range", f"bytes={start}-")
            # A 30 s socket timeout, not two minutes: Geofabrik's mirrors sometimes
            # hold a connection open without sending, and a job that waits for the
            # OS to notice spends the evening on ten dead sockets. The retry below
            # resumes from the partial file with Range, so nothing is lost.
            with urllib.request.urlopen(req, timeout=30) as r:
                mode = "ab" if start and r.status == 206 else "wb"
                with open(part, mode) as f:
                    while True:
                        chunk = r.read(1 << 18)
                        if not chunk:
                            break
                        f.write(chunk)
            os.replace(part, path)
            return True, ""
        except OSError as err:
            last_error = f"{type(err).__name__}: {err}"
            if err.errno == 28:  # ENOSPC: stop this one, the disk is full
                return False, last_error
            time.sleep(3 * (attempt + 1))
        except urllib.error.HTTPError as err:
            last_error = f"HTTP {err.code}"
            if err.code == 416 and os.path.exists(part):  # already complete
                os.replace(part, path)
                return True, ""
            if err.code == 404:
                time.sleep(1.5 * (attempt + 1))
                continue
            time.sleep(3 * (attempt + 1))
        except Exception as err:  # timeouts, resets, a full disk
            last_error = f"{type(err).__name__}: {err}"
            time.sleep(3 * (attempt + 1))
    return False, last_error


# What to charge the disk budget for an extract whose size a HEAD did not return.
UNKNOWN_SIZE = 400_000_000


def spool_bytes():
    total = 0
    try:
        for name in os.listdir(SPOOL):
            try:
                total += os.path.getsize(os.path.join(SPOOL, name))
            except OSError:
                pass
    except FileNotFoundError:
        pass
    return total


def spool_budget():
    """Leave room on the disk for the rest of the machine; never fill it."""
    try:
        free = shutil.disk_usage(".").free
    except OSError:
        return 2_000_000_000
    # Three gigabytes of headroom for the merge, git and the machine itself. On a
    # nearly full disk that means one download at a time, not none.
    return max(700_000_000, min(12_000_000_000, free - 3_000_000_000))


# ── merge rows into cells ───────────────────


# Parking is the largest category by a wide margin — often two thirds of the rows in
# a dense country — and it is only wanted at street zoom. It is written to a sibling
# file (`{y}.parking.json`) that the browser fetches only above z14.4, so a normal
# cell stays small and a pan across a country does not drag car parks along.
PARKING = KINDS.index("parking")


def cell_of(lat, lon):
    n = 2 ** OUT_Z
    x = int((lon + 180) / 360 * n)
    r = math.radians(lat)
    y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def bucket_rows():
    """Rows → 256 bucket files, each already carrying its cell. Planet-scale rows
    never sit in memory at once."""
    files = sorted(os.listdir(ROWS)) if os.path.isdir(ROWS) else []
    if not files:
        return 0

    os.makedirs(BUCKETS, exist_ok=True)
    for name in os.listdir(BUCKETS):
        os.remove(os.path.join(BUCKETS, name))

    total = 0
    t0 = time.time()
    handles = {}
    try:
        for i, name in enumerate(files, 1):
            with open(os.path.join(ROWS, name)) as f:
                for line in f:
                    parts = line.rstrip("\n").split("\t", 6)
                    if len(parts) != 7:
                        continue
                    lat_s, lon_s, kind_s, name_s, otype, oid, extra = parts
                    try:
                        lat, lon, kind = float(lat_s), float(lon_s), int(kind_s)
                    except ValueError:
                        continue
                    x, y = cell_of(lat, lon)
                    bucket = (x * 73856093 ^ y * 19349663) % 256
                    h = handles.get(bucket)
                    if h is None:
                        h = open(os.path.join(BUCKETS, f"{bucket}.tsv"), "w")
                        handles[bucket] = h
                    h.write(
                        f"{x}\t{y}\t{lat_s}\t{lon_s}\t{kind_s}\t{name_s}\t"
                        f"{otype}\t{oid}\t{extra}\n"
                    )
                    total += 1
            if i % 25 == 0 or i == len(files):
                print(
                    f"  bucketed {i}/{len(files)} extracts · {total} rows · "
                    f"{time.time() - t0:.0f}s",
                    flush=True,
                )
    finally:
        for h in handles.values():
            h.close()
    return total


def merge(plan, state, allow_partial=False):
    """Rows → cells in a staging directory, validated, then swapped in."""
    if not os.path.isdir(ROWS) or not os.listdir(ROWS):
        print("  nothing to merge — no rows have been parsed yet")
        return False

    done = {
        eid for eid, rec in state["extracts"].items() if rec.get("status") == "parsed"
    }
    missing = [e["id"] for e in plan if e["id"] not in done]
    if missing and not allow_partial:
        print(
            f"  refusing to merge: {len(missing)} of {len(plan)} extracts have no rows "
            f"(first: {', '.join(missing[:5])}).\n"
            "  A partial store must not replace a whole one — finish the harvest, or "
            "pass --allow-partial to write what is there anyway."
        )
        return False

    t0 = time.time()
    rows_in = bucket_rows()
    if not rows_in:
        print("  nothing to merge — the row store is empty")
        return False

    if os.path.isdir(STAGING):
        shutil.rmtree(STAGING)
    os.makedirs(STAGING, exist_ok=True)

    stats = {
        "at": now(),
        "rows_in": rows_in,
        "cells": 0,
        "rows_out": 0,
        "bytes": 0,
        "parking_cells": 0,
        "parking_rows": 0,
        "parking_bytes": 0,
        "dropped": {
            "same_element": 0,
            "same_ground": 0,
            "unreadable": 0,
        },
        "kinds": {k: 0 for k in KINDS},
        "extracts_merged": len(done),
        "partial": bool(missing),
    }

    for bucket in sorted(os.listdir(BUCKETS)):
        cells = {}
        seen_elements = set()
        with open(os.path.join(BUCKETS, bucket)) as f:
            for line in f:
                parts = line.rstrip("\n").split("\t", 8)
                if len(parts) != 9:
                    stats["dropped"]["unreadable"] += 1
                    continue
                x_s, y_s, lat_s, lon_s, kind_s, name_s, otype, oid, extra = parts
                try:
                    lat, lon, kind = float(lat_s), float(lon_s), int(kind_s)
                except ValueError:
                    stats["dropped"]["unreadable"] += 1
                    continue
                if not (0 <= kind < len(KINDS)) or not (
                    -90 <= lat <= 90 and -180 <= lon <= 180
                ):
                    stats["dropped"]["unreadable"] += 1
                    continue
                element = (otype, oid)
                if element in seen_elements:
                    stats["dropped"]["same_element"] += 1
                    continue
                seen_elements.add(element)

                key = (int(x_s), int(y_s))
                cell = cells.get(key)
                if cell is None:
                    cell = cells[key] = {"grid": {}, "rows": [], "sources": set()}
                # Same site mapped twice — a node inside its own outline, or the same
                # ground in an overlapping extract — is one row per 25 m square per
                # kind. Two rows that are close but carry different names are two
                # different places and both stay: proximity alone must never merge a
                # campsite with its neighbour.
                grid = (int(lat * 4000), int(lon * 4000), kind)
                previous = cell["grid"].get(grid)
                if previous is not None and not (
                    name_s and previous and name_s != previous
                ):
                    stats["dropped"]["same_ground"] += 1
                    continue
                cell["grid"][grid] = name_s
                cell["rows"].append(
                    (round(lat, 4), round(lon, 4), kind, name_s, otype, oid, extra)
                )
                if extra:
                    try:
                        source = json.loads(extra).get("region")
                    except ValueError:
                        source = None
                    if source:
                        cell["sources"].add(source)

        for (x, y), cell in cells.items():
            rows = cell["rows"]
            rows.sort(key=lambda r: (r[2], -r[0], r[1]))
            for row in rows:
                stats["kinds"][KINDS[row[2]]] += 1
            parking = [r for r in rows if r[2] == PARKING]
            main = [r for r in rows if r[2] != PARKING]

            path = os.path.join(STAGING, str(OUT_Z), str(x), f"{y}.json")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            count, size = write_cell(path, main, cell["sources"])
            stats["cells"] += 1
            stats["rows_out"] += count
            stats["bytes"] += size

            if parking:
                pcount, psize = write_cell(
                    path[: -len(".json")] + ".parking.json", parking, cell["sources"]
                )
                stats["parking_cells"] += 1
                stats["parking_rows"] += pcount
                stats["parking_bytes"] += psize
        os.remove(os.path.join(BUCKETS, bucket))

    ok, problems = validate_cells(STAGING)
    stats["validation"] = {"ok": ok, "problems": problems[:20], "checked": "every cell"}
    stats["seconds"] = round(time.time() - t0, 1)

    if not ok:
        print(f"\n  validation failed — leaving {OUT_DIR} untouched")
        for problem in problems[:10]:
            print(f"    {problem}")
        with open(MERGE_FILE, "w") as f:
            json.dump(stats, f, indent=1)
        return False

    # Swap: the previous tree is kept until the new one is in place, so a crash
    # between the two renames leaves a complete tree under one name or the other.
    if os.path.isdir(PREVIOUS):
        shutil.rmtree(PREVIOUS)
    if os.path.isdir(OUT_DIR):
        os.replace(OUT_DIR, PREVIOUS)
    os.replace(STAGING, OUT_DIR)
    if os.path.isdir(PREVIOUS):
        shutil.rmtree(PREVIOUS)

    with open(MERGE_FILE, "w") as f:
        json.dump(stats, f, indent=1)

    dropped = stats["dropped"]
    print(
        f"\n  {stats['cells']} cells · {stats['rows_out']} rows · "
        f"{stats['bytes'] / 1e6:.1f} MB on disk · {stats['seconds']:.0f}s\n"
        f"  parking: {stats['parking_cells']} files · {stats['parking_rows']} rows · "
        f"{stats['parking_bytes'] / 1e6:.1f} MB (fetched only at street zoom)\n"
        f"  dropped: {dropped['same_element']} same element · "
        f"{dropped['same_ground']} same ground · "
        f"{dropped['unreadable']} unreadable",
        flush=True,
    )
    if stats["partial"]:
        print("  ! this merge is partial — some extracts are still missing")
    return True


def write_cell(path, rows, sources):
    """One cell payload: the coordinate/kind tuples, the ids parallel to them, and
    the tag detail for the rows that have any."""
    items = []
    ids = []
    detail = []
    for index, (lat, lon, kind, name_s, otype, oid, extra) in enumerate(rows):
        items.append([lat, lon, kind, name_s] if name_s else [lat, lon, kind])
        ids.append(f"{otype}{oid}")
        if extra:
            detail.append([index, json.loads(extra)])
    payload = {"z": OUT_Z, "kinds": KINDS, "items": items, "ids": ids}
    if sources:
        payload["sources"] = sorted(sources)
    if detail:
        payload["detail"] = detail
    with open(path, "w") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    return len(items), os.path.getsize(path)


def validate_cells(directory):
    """Read every staged cell back and check the invariants the browser relies on."""
    problems = []
    for root, _, names in os.walk(directory):
        for name in names:
            if not name.endswith(".json"):
                problems.append(f"{root}/{name}: not a .json cell")
                continue
            path = os.path.join(root, name)
            try:
                with open(path) as f:
                    cell = json.load(f)
            except Exception as err:
                problems.append(f"{path}: unreadable ({err})")
                continue
            items = cell.get("items")
            ids = cell.get("ids")
            if cell.get("z") != OUT_Z:
                problems.append(f"{path}: z is {cell.get('z')}, expected {OUT_Z}")
            if not isinstance(items, list):
                problems.append(f"{path}: items is not a list")
                continue
            if not isinstance(ids, list) or len(ids) != len(items):
                problems.append(f"{path}: {len(items)} items but ids={len(ids or [])}")
            if cell.get("kinds") != KINDS:
                problems.append(f"{path}: kinds table does not match the client")
            for row in items:
                if not isinstance(row, list) or len(row) not in (3, 4):
                    problems.append(f"{path}: malformed item {row!r}")
                    break
                lat, lon, kind = row[0], row[1], row[2]
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    problems.append(f"{path}: coordinate out of range {row!r}")
                    break
                if not isinstance(kind, int) or not 0 <= kind < len(KINDS):
                    problems.append(f"{path}: unknown kind {kind!r}")
                    break
            for entry in cell.get("detail", []):
                if not (isinstance(entry, list) and len(entry) == 2):
                    problems.append(f"{path}: malformed detail entry")
                    break
                index = entry[0]
                if not isinstance(index, int) or not 0 <= index < len(items):
                    problems.append(f"{path}: detail points at item {index!r}")
                    break
    return not problems, problems


# ── report ───────────────────────────────────


def read_merge():
    if not os.path.exists(MERGE_FILE):
        return None
    with open(MERGE_FILE) as f:
        try:
            return json.load(f)
        except ValueError:
            return None


def write_report(plan, state):
    ex = state["extracts"]
    parsed = [e for e in plan if ex.get(e["id"], {}).get("status") == "parsed"]
    failed = [
        e for e in plan if ex.get(e["id"], {}).get("status") == "failed"
    ]
    pending = [
        e
        for e in plan
        if ex.get(e["id"], {}).get("status") not in ("parsed", "failed")
    ]

    per_region = {}
    for extract in plan:
        region = per_region.setdefault(
            extract["region"],
            {"extracts": 0, "parsed": 0, "rows": 0, "kinds": {k: 0 for k in KINDS}},
        )
        region["extracts"] += 1
        rec = ex.get(extract["id"], {})
        if rec.get("status") == "parsed":
            region["parsed"] += 1
            region["rows"] += int(rec.get("rows", 0))
            for kind in KINDS:
                region["kinds"][kind] += int((rec.get("counts") or {}).get(kind, 0))

    extracted_kinds = {k: 0 for k in KINDS}
    routes = {"hiking": 0, "foot": 0, "bicycle": 0}
    unplaced = 0
    for rec in ex.values():
        if rec.get("status") != "parsed":
            continue
        for kind in KINDS:
            extracted_kinds[kind] += int((rec.get("counts") or {}).get(kind, 0))
        for route in routes:
            routes[route] += int((rec.get("routes") or {}).get(route, 0))
        unplaced += int(rec.get("unplaced_relations", 0))

    merged = read_merge()
    total_bytes = 0
    total_cells = 0

    if os.path.isdir(OUT_DIR):
        for root, _, names in os.walk(OUT_DIR):
            for name in names:
                total_bytes += os.path.getsize(os.path.join(root, name))
                total_cells += 1

    top = sorted(
        (e for e in plan if ex.get(e["id"], {}).get("status") == "parsed"),
        key=lambda e: -int(ex[e["id"]].get("rows", 0)),
    )[:20]

    report = {
        "generated": now(),
        "source": INDEX_URL,
        "license": "ODbL 1.0 — © OpenStreetMap contributors",
        "attribution": "© OpenStreetMap contributors",
        "plan": {
            "extracts": len(plan),
            "bytes": sum(e.get("size", 0) for e in plan),
        },
        "coverage": {
            "extracts_parsed": len(parsed),
            "extracts_failed": len(failed),
            "extracts_pending": len(pending),
            # Geofabrik's leaves are countries, or states/provinces for the dozen
            # largest countries; an id without a slash is a whole country.
            "countries_parsed": len({e["id"] for e in parsed if "/" not in e["id"]}),
            "countries_in_plan": len({e["id"] for e in plan if "/" not in e["id"]}),
            "extract_bytes_parsed": sum(
                int(ex[e["id"]].get("bytes", 0)) for e in parsed
            ),
            "regions": per_region,
        },
        "features": {
            "extracted": extracted_kinds,
            "in_cells": (merged or {}).get("kinds"),
            "cells": total_cells,
            "cell_bytes": total_bytes,
            "detail_records": None,
        },
        "duplicates": (merged or {}).get("dropped"),
        "routes_observed": {**routes, "camp_relations_unplaced": unplaced},
        "failures": [
            {
                "extract": e["id"],
                "error": ex[e["id"]].get("error", ""),
                "attempts": ex[e["id"]].get("attempts", 0),
            }
            for e in failed
        ],
        "pending": [e["id"] for e in pending],
        "validation": (merged or {}).get("validation"),
        "top_extracts": [
            {
                "extract": e["id"],
                "region": e["region"],
                "rows": ex[e["id"]].get("rows", 0),
                "bytes": e["size"],
            }
            for e in top
        ],
    }

    os.makedirs(REPORTS, exist_ok=True)
    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)

    def row(label, value):
        return f"| {label} | {value} |"

    lines = [
        "# World POI coverage",
        "",
        f"Generated {report['generated']} by `scripts/harvest-poi-bulk.py --report`.",
        "",
        "Source: [Geofabrik](https://download.geofabrik.de/) `.osm.pbf` extracts of",
        "OpenStreetMap, streamed through pyosmium. Licence: ODbL 1.0.",
        "Attribution: **© OpenStreetMap contributors**.",
        "",
        "## Extracts",
        "",
        "| | |",
        "| --- | --- |",
        row("Extracts in plan", report["plan"]["extracts"]),
        row("Countries in plan", report["coverage"]["countries_in_plan"]),
        row("Countries parsed", report["coverage"]["countries_parsed"]),
        row("Parsed", len(parsed)),
        row("Failed", len(failed)),
        row("Still pending", len(pending)),
        row("Source bytes parsed", human(report["coverage"]["extract_bytes_parsed"])),
        row("Cells written", total_cells),
        row("Cell bytes", human(total_bytes)),
        row(
            "Parking rows (separate files)",
            f"{(merged or {}).get('parking_rows', 0):,}",
        ),
        row("Partial merge", "yes" if (merged or {}).get("partial") else "no"),
        "",
        "## Features",
        "",
        "`extracted` counts rows as they came out of the PBF files; `in cells` is what",
        "survived deduplication, the radius-harvest exclusion and the cell merge.",
        "",
        "| Category | Extracted | In cells |",
        "| --- | ---: | ---: |",
    ]
    for kind in KINDS:
        lines.append(
            f"| {kind} | {extracted_kinds[kind]:,} | "
            f"{(report['features']['in_cells'] or {}).get(kind, 0):,} |"
        )
    merged_dropped = report["duplicates"] or {}
    lines += [
        "",
        "## Duplicates and drops",
        "",
        "| Reason | Rows |",
        "| --- | ---: |",
        f"| Same OSM element seen twice (overlapping extracts) | "
        f"{merged_dropped.get('same_element', 0):,} |",
        f"| Same ground, same kind, within 25 m | "
        f"{merged_dropped.get('same_ground', 0):,} |",
        f"| Unreadable rows | {merged_dropped.get('unreadable', 0):,} |",
        "",
        "Two rows closer than 25 m with different names are kept as two places.",
        "",
        "## By region",
        "",
        "| Region | Extracts parsed | Campsites | Caravan sites | Huts | Shelters | Water | Viewpoints | Parking |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for name in sorted(per_region):
        r = per_region[name]
        k = r["kinds"]
        lines.append(
            f"| {name} | {r['parsed']}/{r['extracts']} | {k['camp']:,} | "
            f"{k['caravan']:,} | {k['hut']:,} | {k['shelter']:,} | {k['water']:,} | "
            f"{k['view']:,} | {k['parking']:,} |"
        )
    lines += [
        "",
        "## Trail network observed",
        "",
        "Route relations are counted, not drawn: the basemap already serves OSM's path",
        "network as vector tiles and the Footpaths switch shows it.",
        "",
        f"- hiking routes: {routes['hiking']:,}",
        f"- foot routes: {routes['foot']:,}",
        f"- bicycle routes: {routes['bicycle']:,}",
        "",
        "Camping or hut features mapped as relations (multipolygons) and not placed:",
        f"{unplaced:,} — they are rarer than the same ground mapped as a node or way.",
        "",
        "## Largest extracts",
        "",
        "| Extract | Region | Rows | Download |",
        "| --- | --- | ---: | ---: |",
    ]
    for e in top:
        lines.append(
            f"| {e['id']} | {e['region']} | "
            f"{int(ex[e['id']].get('rows', 0)):,} | {human(e['size'])} |"
        )
    if failed:
        lines += ["", "## Failures", "", "| Extract | Error | Attempts |", "| --- | --- | ---: |"]
        for e in failed:
            rec = ex[e["id"]]
            lines.append(
                f"| {e['id']} | `{rec.get('error', '')}` | {rec.get('attempts', 0)} |"
            )
    validation = report["validation"]
    lines += [
        "",
        "## Validation",
        "",
        (
            "Every cell was read back after the merge and checked: valid coordinates, "
            "a known category, an id for every item, detail records pointing at real "
            "items, and the category table matching the client."
            if validation and validation.get("ok")
            else "No merged dataset has been validated yet."
        ),
        "",
    ]
    if pending:
        lines += ["## Pending", "", f"{len(pending)} extracts:", ""]
        lines += [f"- {name}" for name in pending[:40]]
        if len(pending) > 40:
            lines.append(f"- … and {len(pending) - 40} more")
        lines.append("")

    with open(REPORT_MD, "w") as f:
        f.write("\n".join(lines))
    print(f"  wrote {REPORT_MD} and {REPORT_JSON}")
    print(
        f"  {len(parsed)}/{len(plan)} extracts parsed · {len(failed)} failed · "
        f"{len(pending)} pending · {total_cells} cells · {human(total_bytes)}"
    )


def print_status(plan, state):
    ex = state["extracts"]
    counts = {"parsed": 0, "failed": 0, "pending": 0}
    rows = 0
    for extract in plan:
        status = ex.get(extract["id"], {}).get("status", "pending")
        counts[status if status in counts else "pending"] += 1
        rows += int(ex.get(extract["id"], {}).get("rows", 0))
    print(
        f"  plan {len(plan)} extracts ({human(sum(e.get('size', 0) for e in plan))})\n"
        f"  parsed {counts['parsed']} · failed {counts['failed']} · "
        f"pending {counts['pending']} · {rows} rows"
    )
    left = sum(
        e.get("size", 0)
        for e in plan
        if ex.get(e["id"], {}).get("status") != "parsed"
    )
    if left:
        print(f"  {human(left)} still to download")
    merged = read_merge()
    if merged:
        print(
            f"  last merge {merged['at']}: {merged['cells']} cells · "
            f"{merged['rows_out']} rows · {human(merged['bytes'])}"
        )
    for extract in plan:
        rec = ex.get(extract["id"], {})
        if rec.get("status") == "failed":
            print(f"  ! {extract['id']}: {rec.get('error', '')}")


# ── refresh ─────────────────────────────────


def refresh(plan, state, workers=12):
    """Re-queue extracts whose source file has changed since it was parsed.

    Geofabrik rebuilds every extract daily and sends Last-Modified. This is the
    practical increment: only changed extracts are downloaded and re-parsed, then
    the cells are merged again. It is coarse — a cell is rewritten when any extract
    overlapping it changed — but it never leaves a stale country in the store.
    """
    todo = [
        e
        for e in plan
        if state["extracts"].get(e["id"], {}).get("status") == "parsed"
    ]
    if not todo:
        return 0
    lock = threading.Lock()
    q = queue.Queue()
    for e in todo:
        q.put(e)
    changed = []

    def run():
        while True:
            try:
                e = q.get_nowait()
            except queue.Empty:
                return
            try:
                req = urllib.request.Request(
                    e["url"], method="HEAD", headers={"User-Agent": UA}
                )
                with urllib.request.urlopen(req, timeout=60) as r:
                    modified = r.headers.get("Last-Modified") or ""
            except Exception:
                continue
            stored = state["extracts"][e["id"]].get("modified") or ""
            if modified and stored and modified != stored:
                with lock:
                    changed.append((e, modified))

    threads = [threading.Thread(target=run) for _ in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for extract, modified in changed:
        rows = os.path.join(ROWS, slug(extract["id"]) + ".tsv")
        if os.path.exists(rows):
            os.remove(rows)
        rec = state["extracts"][extract["id"]]
        rec["status"] = "pending"
        rec["previous_modified"] = rec.get("modified")
        rec["modified"] = modified
        save_state(state)
    print(f"  refresh: {len(changed)} of {len(todo)} parsed extracts have new data")
    return len(changed)


# ── main ─────────────────────────────────────


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--only", help="comma-separated extract ids, e.g. europe/albania")
    ap.add_argument(
        "--shard",
        metavar="I/N",
        help="process only extracts where crc32(id) %% N == I (CI splits the world across jobs)",
    )
    ap.add_argument("--region", help="comma-separated top-level regions, e.g. africa,asia")
    ap.add_argument("--limit", type=int, default=0, help="stop after N extracts")
    ap.add_argument("--workers", type=int, default=8, help="parallel downloads (default 8)")
    ap.add_argument("--deadline", type=float, default=0, help="stop starting new work after N seconds")
    ap.add_argument("--skip-big", type=int, default=0, help="skip extracts over N MB")
    ap.add_argument("--max-attempts", type=int, default=4, help="stop retrying an extract after N failures")
    ap.add_argument("--retry-failed", action="store_true", help="retry extracts that already failed")
    ap.add_argument("--refresh", action="store_true", help="re-queue extracts whose source changed")
    ap.add_argument("--merge", action="store_true", help="rebuild the cells from parsed rows")
    ap.add_argument("--allow-partial", action="store_true", help="merge even when extracts are missing")
    ap.add_argument(
        "--state-add",
        action="append",
        default=[],
        metavar="PATH",
        help="import another shard's exported state before working",
    )
    ap.add_argument(
        "--state-export",
        metavar="PATH",
        help="write this run's state to PATH so another job can import it",
    )
    ap.add_argument("--report", action="store_true", help="write reports/poi-coverage.{md,json}")
    ap.add_argument("--status", action="store_true", help="say what is parsed, failed and pending")
    ap.add_argument("--replan", action="store_true", help="rebuild the cached extract plan")
    ap.add_argument("--clean", action="store_true", help="drop the spool before starting")
    ap.add_argument("--parse-one", nargs=3, metavar=("PBF", "OUT", "ID"), help=argparse.SUPPRESS)
    args = ap.parse_args()

    # The child half of the split below. It parses exactly one extract, writes the row
    # file and a small summary, and exits; the parent keeps downloading meanwhile.
    if args.parse_one:
        pbf, out, extract_id = args.parse_one
        n, counts, routes, unplaced = parse(pbf, out, extract_id)
        with open(out + ".meta.json", "w") as f:
            json.dump(
                {"rows": n, "counts": counts, "routes": routes, "unplaced": unplaced},
                f,
            )
        return

    os.makedirs(SPOOL, exist_ok=True)
    os.makedirs(ROWS, exist_ok=True)

    print("  resolving extracts…", flush=True)
    plan = build_plan(force=args.replan)
    state = load_state()
    state.setdefault("extracts", {})
    for path in args.state_add:
        try:
            with open(path) as f:
                other = json.load(f)
        except (OSError, ValueError) as err:
            print(f"  ! state import failed: {path}: {err}")
            sys.exit(2)
        imported = 0
        for extract_id, imported_record in (other.get("extracts") or {}).items():
            current = state["extracts"].get(extract_id) or {}
            # A parsed shard record wins; a failed one only fills a gap.
            if imported_record.get("status") == "parsed" or current.get("status") != "parsed":
                state["extracts"][extract_id] = imported_record
                imported += 1
        print(f"  state: imported {imported} records from {path}")
    if args.state_export:
        atexit.register(export_state, state, args.state_export)
    state.setdefault("plan", {})
    state["plan"] = {
        "extracts": len(plan),
        "bytes": sum(e.get("size", 0) for e in plan),
        "index": INDEX_URL,
        "built": state["plan"].get("built") or now(),
    }

    if args.status:
        print_status(plan, state)
        save_state(state)
        return
    if args.report:
        write_report(plan, state)
        return
    if args.merge:
        ok = merge(plan, state, allow_partial=args.allow_partial)
        if ok:
            write_report(plan, state)
        save_state(state)
        sys.exit(0 if ok else 1)

    if args.clean:
        for name in os.listdir(SPOOL):
            path = os.path.join(SPOOL, name)
            os.remove(path) if os.path.isfile(path) else shutil.rmtree(path)
        print("  spool cleared")

    if args.refresh:
        refresh(plan, state)

    if args.shard:
        # A stable partition of the whole plan: every extract lands in exactly one
        # shard, so parallel CI jobs together cover the world with no overlap and
        # no gap. Balanced by extract count, which is what the download budget
        # tracks far better than continent boundaries do.
        try:
            index_s, count_s = args.shard.split("/")
            index, count = int(index_s), int(count_s)
        except ValueError:
            print(f"  ! --shard expects I/N, got {args.shard!r}")
            sys.exit(2)
        if not (0 <= index < count):
            print(f"  ! --shard {index}/{count}: I must be 0..{count - 1}")
            sys.exit(2)
        plan = [e for e in plan if zlib.crc32(e["id"].encode("utf-8")) % count == index]
        print(f"  shard {index}/{count}: {len(plan)} of {state['plan'].get('extracts')} extracts")
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        plan = [e for e in plan if e["id"] in wanted]
    if args.region:
        regions = {s.strip() for s in args.region.split(",") if s.strip()}
        plan = [e for e in plan if e["region"] in regions]
    if args.skip_big:
        plan = [e for e in plan if e["size"] <= args.skip_big * 1e6]

    todo = []
    for e in plan:
        rec = state["extracts"].get(e["id"], {})
        if rec.get("status") == "parsed" and os.path.exists(
            os.path.join(ROWS, slug(e["id"]) + ".tsv")
        ):
            continue
        if (
            rec.get("status") == "failed"
            and int(rec.get("attempts", 0)) >= args.max_attempts
            and not args.retry_failed
        ):
            continue
        todo.append(e)

    parsed_before = sum(
        1 for e in plan if state["extracts"].get(e["id"], {}).get("status") == "parsed"
    )
    print(
        f"  {parsed_before}/{len(plan)} extracts already parsed · {len(todo)} left · "
        f"{human(sum(e['size'] for e in todo))} to download",
        flush=True,
    )
    if args.limit:
        todo = todo[: args.limit]
    if not todo:
        print("  nothing to do — run --merge, or --report for coverage")
        save_state(state)
        return

    save_state(state)

    t0 = time.time()
    finished = queue.Queue()
    lock = threading.Lock()
    budget = spool_budget()
    reserved = [0]

    def worker():
        while True:
            with lock:
                if not todo:
                    return
                if args.deadline and time.time() - t0 > args.deadline:
                    return
                usage = spool_bytes() + reserved[0]
                # Recomputed every pass, not once at the start: the rest of the
                # machine keeps writing to the same disk, and a job that starts with
                # three gigabytes of room must not keep filling it after a browser
                # has taken two of them.
                budget_now = min(budget, spool_budget())
                # When the next extract alone is bigger than the whole budget there
                # is nothing to wait for — take it, or the queue stalls forever.
                if usage > budget_now and reserved[0]:
                    entry = None
                else:
                    entry = todo.pop(0)
                    # A failed HEAD leaves size 0. Charging nothing for it is how the
                    # spool filled the whole disk once: assume a big file instead.
                    reserved[0] += entry["size"] or UNKNOWN_SIZE
            if entry is None:
                time.sleep(1)
                continue
            path = os.path.join(SPOOL, slug(entry["id"]) + ".osm.pbf")
            created = not os.path.exists(path)
            ok, error = (True, "") if not created else download(entry, path)
            with lock:
                reserved[0] -= entry["size"] or UNKNOWN_SIZE
            if ok:
                finished.put((entry, path, error))
            else:
                fail(state, entry["id"], "download", error or "download failed")

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(max(1, args.workers))]
    for t in threads:
        t.start()

    parsed = 0
    rows_total = 0
    bytes_done = 0
    while True:
        try:
            entry, path, _ = finished.get(timeout=2)
        except queue.Empty:
            if not any(t.is_alive() for t in threads) and finished.empty():
                break
            continue
        size = os.path.getsize(path)
        out = os.path.join(ROWS, slug(entry["id"]) + ".tsv")
        rec = record(state, entry["id"])
        rec.update(
            {
                "id": entry["id"],
                "name": entry.get("name") or entry["id"],
                "region": entry["region"],
                "url": entry["url"],
                "size": entry["size"],
                "modified": entry.get("modified") or "",
                "attempts": int(rec.get("attempts", 0)),
                "started": now(),
            }
        )
        t1 = time.time()
        # Parse in a child process. pyosmium runs in C but comes back into Python for
        # every row, so a gigabyte extract holds the interpreter for a minute — and
        # with the parse in this process the GIL froze every download thread for that
        # minute. A child keeps the next extracts arriving while this one is read.
        meta = out + ".meta.json"
        worker = subprocess.run(
            [sys.executable, os.path.abspath(__file__), "--parse-one", path, out, entry["id"]]
        )
        if worker.returncode != 0 or not os.path.exists(out):
            fail(state, entry["id"], "parse", f"parse worker exited {worker.returncode}")
            print(f"  ! {entry['id']}: parse failed (exit {worker.returncode})", flush=True)
            for leftover in (path, out, meta):
                if os.path.exists(leftover):
                    os.remove(leftover)
            continue
        try:
            with open(meta) as f:
                summary = json.load(f)
            os.remove(meta)
        except (OSError, ValueError) as err:
            fail(state, entry["id"], "parse", f"no summary: {err}")
            print(f"  ! {entry['id']}: parse summary unreadable ({err})", flush=True)
            for leftover in (path, out):
                if os.path.exists(leftover):
                    os.remove(leftover)
            continue
        n = int(summary["rows"])
        counts = summary["counts"]
        routes = summary["routes"]
        unplaced = int(summary["unplaced"])
        os.remove(path)
        rows_total += n
        bytes_done += size
        parsed += 1
        elapsed = time.time() - t0
        rec.update(
            {
                "status": "parsed",
                "rows": n,
                "counts": counts,
                "routes": routes,
                "unplaced_relations": unplaced,
                "bytes": size,
                "error": "",
                "finished": now(),
            }
        )
        save_state(state)
        left = sum(e["size"] for e in list(todo))
        top = ", ".join(f"{k} {counts[k]}" for k in KINDS if counts[k])
        print(
            f"  {entry['id']:<32} {n:>6} rows  {time.time() - t1:>4.1f}s  "
            f"{size / 1e6:>5.0f} MB  [{parsed} done · {rows_total} rows · "
            f"{bytes_done / 1e6 / max(elapsed, 1e-9):.1f} MB/s · {human(left)} left]",
            flush=True,
        )
        print(f"      {top}", flush=True)

    save_state(state)
    print(f"\n  {parsed} extracts parsed this run · {rows_total} rows · {time.time() - t0:.0f}s")
    left = [
        e
        for e in plan
        if state["extracts"].get(e["id"], {}).get("status") != "parsed"
    ]
    if left:
        print(f"  {len(left)} extracts still to do ({human(sum(e['size'] for e in left))})")
    else:
        print("  every extract parsed — run --merge to rebuild the cells")


if __name__ == "__main__":
    main()
