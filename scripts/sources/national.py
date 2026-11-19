#!/usr/bin/env python3
"""National open-data sources outside the US, one registry entry per country."""

from __future__ import annotations

from collections import Counter

from common import (
    arcgis_features,
    clean,
    emit,
    main_guard,
    number,
    point_of,
    registry_for,
)


def doc_nz() -> None:
    url = "https://services1.arcgis.com/3JjYDyG3oajxU6HO/arcgis/rest/services/DOC_Campsites/FeatureServer/0"
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    for f in arcgis_features(url):
        raw += 1
        p = f.get("properties") or {}
        fetched += 1
        lat, lon = point_of(f)
        if lat is None or lon is None:
            rejected["no_coord"] += 1
            continue
        powered = number(p.get("numberOfPoweredSites")) or 0
        unpowered = number(p.get("numberOfUnpoweredSites")) or 0
        rows.append(
            {
                "srcId": str(p.get("OBJECTID")),
                "cat": "camp",
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "name": clean(p.get("name")),
                "country": "New Zealand",
                "where": clean(p.get("place")) or clean(p.get("region")) or "New Zealand",
                "operator": "Department of Conservation",
                "capacity": int(powered + unpowered) or None,
                "url": clean(p.get("staticLink")),
                "booking": clean(p.get("staticLink")) if clean(p.get("bookable")).lower() == "yes" else "",
                "tags": {
                    "category": clean(p.get("campsiteCategory")),
                    "bookable": clean(p.get("bookable")),
                    "free": clean(p.get("free")),
                    "facilities": clean(p.get("facilities"))[:160],
                    "access": clean(p.get("access")),
                    "region": clean(p.get("region")),
                },
            }
        )
    emit(
        "doc_nz",
        rows,
        registry=registry_for("doc_nz"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
    )


if __name__ == "__main__":
    main_guard(doc_nz)
