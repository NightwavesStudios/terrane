#!/usr/bin/env python3
"""US Forest Service recreation sites and National Forest System trails."""

from __future__ import annotations

import sys
from collections import Counter

from common import (
    arcgis_features,
    clean,
    emit,
    line_length_m,
    lines_of,
    main_guard,
    number,
    point_of,
    registry_for,
    simplify,
)

SITES = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_InfraRecreationSites_01/MapServer/0"
TRAILS = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublish_01/MapServer/0"

SITE_CAT = {
    "CAMPING AREA": "camp",
    "CAMPGROUND": "camp",
    "GROUP CAMPGROUND": "camp",
    "CAMP UNIT": "camp",
    "CAMP UNIT - TENT": "camp",
    "HORSE CAMP": "camp",
    "TRAILHEAD": "trailhead",
    "LOOKOUT/CABIN": "hut",
    "OBSERVATION SITE": "view",
    "PICNIC SITE": "picnic",
    "GROUP PICNIC SITE": "picnic",
    "INFO SITE/FEE STATION": "info",
}


def sites() -> None:
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    cats = Counter()
    for f in arcgis_features(SITES):
        raw += 1
        p = f.get("properties") or {}
        subtype = clean(p.get("site_subtype")).upper()
        cat = SITE_CAT.get(subtype)
        if not cat:
            continue
        fetched += 1
        lat, lon = point_of(f)
        if lat is None or lon is None:
            rejected["no_coord"] += 1
            continue
        name = clean(p.get("site_name"))
        rows.append(
            {
                "srcId": clean(p.get("site_cn")) or clean(p.get("site_id")) or str(p.get("objectid")),
                "cat": cat,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "name": name,
                "country": "United States",
                "where": clean(p.get("recarea_name")) or "United States",
                "operator": clean(p.get("managing_org")) or "US Forest Service",
                "capacity": number(p.get("total_capacity")),
                "url": "",
                "booking": "",
                "tags": {
                    "site_type": subtype.title(),
                    "fee": "Yes" if clean(p.get("fee_charged")).upper() == "Y" else "",
                    "status": clean(p.get("development_status")),
                    "region": clean(p.get("region")),
                },
            }
        )
        cats[cat] += 1
    emit(
        "usfs_sites",
        rows,
        registry=registry_for("usfs_sites"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
        extra={"categories": dict(cats)},
    )


def trails() -> None:
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    fields = (
        "objectid,trail_name,segment_length,trail_class,trail_surface,trail_type,"
        "national_trail_designation,terra_motorized,allowed_terra_use,managing_org"
    )
    for f in arcgis_features(TRAILS, out_fields=fields, page=500):
        raw += 1
        if raw % 5000 == 0:
            print(f"usfs trails: {raw:,} features, {len(rows):,} lines", file=sys.stderr)
        p = f.get("properties") or {}
        lines = lines_of(f)
        fetched += len(lines) or 1
        if not lines:
            rejected["no_geometry"] += 1
            continue
        name = clean(p.get("trail_name"))
        for index, raw_line in enumerate(lines):
            coords = simplify(raw_line)
            if len(coords) < 2:
                rejected["short_geometry"] += 1
                continue
            length_m = number(p.get("segment_length"))
            rows.append(
                {
                    "srcId": f"usfs:{p.get('objectid')}:{index}",
                    "cat": "trail",
                    "name": name,
                    "country": "United States",
                    "where": clean(p.get("managing_org")) or "United States",
                    "operator": "US Forest Service",
                    "coords": coords,
                    "distance_m": round((length_m or 0) * 1609.344) or round(line_length_m(coords)),
                    "difficulty": clean(p.get("trail_class")),
                    "tags": {
                        "surface": clean(p.get("trail_surface")),
                        "type": clean(p.get("trail_type")),
                        "designation": clean(p.get("national_trail_designation")),
                        "motorized": clean(p.get("terra_motorized")),
                        "allowed_use": clean(p.get("allowed_terra_use")),
                    },
                }
            )
    emit(
        "usfs_trails",
        rows,
        registry=registry_for("usfs_trails"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
    )


if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else "sites"
    main_guard(sites if kind == "sites" else trails)
