#!/usr/bin/env python3
"""Bureau of Land Management recreation sites and GTLF trails."""

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

SITES = "https://gis.blm.gov/arcgis/rest/services/recreation/BLM_Natl_Recreation_Sites_Facilities/MapServer/1"
TRAIL_SERVICE = "https://gis.blm.gov/arcgis/rest/services/transportation/BLM_Natl_GTLF_Public_Display/MapServer"
TRAIL_LAYERS = {
    2: "motorized",
    3: "limited motorized",
    4: "non-motorized",
    5: "non-mechanized",
    6: "not assessed",
    7: "managed public",
}


def classify(*parts) -> str | None:
    text = " ".join(clean(p).lower() for p in parts)
    if "trailhead" in text or "trail head" in text:
        return "trailhead"
    if "camp" in text or "overnight" in text:
        return "camp"
    if "picnic" in text:
        return "picnic"
    if "viewpoint" in text or "overlook" in text:
        return "view"
    return None


def sites() -> None:
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    cats = Counter()
    for f in arcgis_features(SITES):
        raw += 1
        p = f.get("properties") or {}
        cat = classify(p.get("RecAreaName"), p.get("Keywords"), p.get("RecAreaDescription"))
        if not cat:
            continue
        fetched += 1
        lat, lon = point_of(f)
        if lat is None or lon is None:
            lat, lon = number(p.get("RecAreaLatitude")), number(p.get("RecAreaLongitude"))
        if lat is None or lon is None:
            rejected["no_coord"] += 1
            continue
        rows.append(
            {
                "srcId": clean(p.get("RecAreaID")) or str(p.get("OBJECTID")),
                "cat": cat,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "name": clean(p.get("RecAreaName")),
                "country": "United States",
                "where": clean(p.get("State")) or "United States",
                "operator": "Bureau of Land Management",
                "capacity": None,
                "url": clean(p.get("BLMRecURL")) or clean(p.get("RecAreaMapURL")),
                "booking": clean(p.get("RecAreaReservationURL")),
                "tags": {
                    "state": clean(p.get("State")),
                    "stay_limit": clean(p.get("StayLimit")),
                    "phone": clean(p.get("RecAreaPhone")),
                    "keywords": clean(p.get("Keywords"))[:160],
                },
            }
        )
        cats[cat] += 1
    emit(
        "blm_sites",
        rows,
        registry=registry_for("blm_sites"),
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
    per_layer = {}
    for layer, label in TRAIL_LAYERS.items():
        before = len(rows)
        for f in arcgis_features(TRAIL_SERVICE, layer=layer):
            raw += 1
            p = f.get("properties") or {}
            lines = lines_of(f)
            fetched += len(lines) or 1
            if not lines:
                rejected["no_geometry"] += 1
                continue
            name = clean(p.get("ROUTE_PRMRY_NM")) or clean(p.get("ROUTE_SCNDRY_SPCL_DSGNTN_NM"))
            coords_all = []
            for index, raw_line in enumerate(lines):
                coords = simplify(raw_line)
                if len(coords) < 2:
                    rejected["short_geometry"] += 1
                    continue
                miles = abs(number(p.get("GIS_MILES")) or number(p.get("BLM_MILES")) or 0)
                rows.append(
                    {
                        "srcId": f"blm:{p.get('OBJECTID')}:{index}",
                        "cat": "trail",
                        "name": name,
                        "country": "United States",
                        "where": clean(p.get("ADMIN_ST")) or "United States",
                        "operator": "Bureau of Land Management",
                        "coords": coords,
                        "distance_m": round(miles * 1609.344) or round(line_length_m(coords)),
                        "difficulty": clean(p.get("PLAN_ASSET_CLASS")),
                        "tags": {
                            "layer": label,
                            "state": clean(p.get("ADMIN_ST")),
                            "mode": clean(p.get("PLAN_MODE_TRNSPRT")),
                            "use": clean(p.get("OBSRVE_ROUTE_USE_CLASS")),
                            "surface": clean(p.get("OBSRVE_SRFCE_TYPE")),
                        },
                    }
                )
                coords_all.append(coords)
        per_layer[label] = len(rows) - before
    emit(
        "blm_trails",
        rows,
        registry=registry_for("blm_trails"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
        extra={"layers": per_layer},
    )


if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else "sites"
    main_guard(sites if kind == "sites" else trails)
