#!/usr/bin/env python3
"""Parks Canada accommodation points.

The open federal layer lists every campsite and roofed accommodation Parks Canada
administers: front-country and backcountry camping, oTENTik, yurts, tipis, cabins
and base camps. It is the first non-US national source in the catalogue.

    python3 scripts/sources/parks_canada.py
"""

from __future__ import annotations

import sys
from collections import Counter

from common import arcgis_features, clean, emit, point_of, registry_for

ENDPOINT = (
    "https://services2.arcgis.com/wCOMu5IS7YdSyPNx/arcgis/rest/services/"
    "Accommodation_Hebergement_APCA_OpenOuvert/FeatureServer/0"
)

# Coded values from the layer metadata.
CAMP = {1, 2, 10, 12}
HUT = {3, 4, 5, 6, 7, 8, 9, 13}


def run() -> None:
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    for feature in arcgis_features(ENDPOINT, out_fields="*", page=500):
        raw += 1
        fetched += 1
        p = feature.get("properties") or {}
        try:
            kind = int(p.get("Accommodation_Type"))
        except (TypeError, ValueError):
            rejected["not_relevant"] += 1
            continue
        if kind in CAMP:
            cat = "camp"
        elif kind in HUT:
            cat = "hut"
        else:
            rejected["not_relevant"] += 1
            continue
        lat, lon = point_of(feature)
        if lat is None or lon is None:
            rejected["no_coord"] += 1
            continue
        name = clean(p.get("Name_e")) or clean(p.get("Nom_f"))
        rows.append(
            {
                "srcId": str(p.get("Site_Num_Site") or p.get("OBJECTID")),
                "cat": cat,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "name": name,
                "country": "Canada",
                "where": "Parks Canada",
                "operator": "Parks Canada",
                "url": clean(p.get("URL_e")) or clean(p.get("URL_f")),
                "booking": "",
                "tags": {
                    "accommodation_type": kind,
                    "site_number": clean(p.get("Site_Num_Site")),
                },
            }
        )

    emit(
        "parks_canada",
        rows,
        registry=registry_for("parks_canada"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
    )


if __name__ == "__main__":
    sys.exit(run())
