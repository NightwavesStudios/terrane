#!/usr/bin/env python3
"""National Park Service public trails."""

from __future__ import annotations

from collections import Counter

from common import (
    arcgis_features,
    clean,
    emit,
    line_length_m,
    lines_of,
    main_guard,
    registry_for,
    simplify,
)

TRAILS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails/FeatureServer/0"


def run() -> None:
    rows = []
    rejected = Counter()
    raw = 0
    fetched = 0
    for f in arcgis_features(TRAILS):
        raw += 1
        p = f.get("properties") or {}
        lines = lines_of(f)
        fetched += len(lines) or 1
        if not lines:
            rejected["no_geometry"] += 1
            continue
        name = clean(p.get("TRLNAME")) or clean(p.get("MAPLABEL")) or clean(p.get("TRLALTNAME"))
        for index, raw_line in enumerate(lines):
            coords = simplify(raw_line)
            if len(coords) < 2:
                rejected["short_geometry"] += 1
                continue
            rows.append(
                {
                    "srcId": f"nps:{p.get('FEATUREID') or p.get('OBJECTID')}:{index}",
                    "cat": "trail",
                    "name": name,
                    "country": "United States",
                    "where": clean(p.get("UNITNAME")) or "United States",
                    "operator": "National Park Service",
                    "coords": coords,
                    "distance_m": round(line_length_m(coords)),
                    "difficulty": clean(p.get("TRLCLASS")),
                    "tags": {
                        "surface": clean(p.get("TRLSURFACE")),
                        "type": clean(p.get("TRLTYPE")),
                        "use": clean(p.get("TRLUSE")),
                        "status": clean(p.get("TRLSTATUS")),
                        "unit": clean(p.get("UNITNAME")),
                    },
                }
            )
    emit(
        "nps_trails",
        rows,
        registry=registry_for("nps_trails"),
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
    )


if __name__ == "__main__":
    main_guard(run)
