#!/usr/bin/env python3
"""Recreation.gov RIDB full export → normalized campground records.

RIDB publishes a daily CSV/JSON export, so the bulk path needs no API key. A
campground is a facility; the individual campsites are counted as capacity rather
than plotted one by one (131k site rows at a campground's coordinate would be
noise, not coverage).
"""

from __future__ import annotations

import csv
import os
import sys
from collections import Counter, defaultdict

from common import (
    CACHE,
    clean,
    download,
    emit,
    ensure_dirs,
    main_guard,
    number,
    registry_for,
    unzip_member,
)

ZIP = os.path.join(CACHE, "ridb.zip")
URL = "https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip"

CAMP_TYPES = {"Campground"}
CAMP_NAME_HINTS = (
    "campground",
    "camp ground",
    "camping area",
    "camp area",
    "group camp",
    "horse camp",
    "dispersed camp",
)

CAT_BY_NAME = (
    ("trailhead", ("trailhead", "trail head")),
    ("camp", CAMP_NAME_HINTS),
    ("view", ("overlook", "viewpoint")),
    ("picnic", ("picnic",)),
)


def read_csv(name: str):
    path = unzip_member(ZIP, name, CACHE)
    with open(path, newline="", encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def classify(row) -> str | None:
    kind = clean(row.get("FacilityTypeDescription")).lower()
    if kind in {t.lower() for t in CAMP_TYPES}:
        return "camp"
    name = clean(row.get("FacilityName")).lower()
    for cat, hints in CAT_BY_NAME:
        if any(h in name for h in hints):
            return cat
    return None


def run() -> None:
    ensure_dirs()
    download(URL, ZIP)

    orgs = {
        clean(r.get("OrgID")): clean(r.get("OrgName"))
        for r in read_csv("Organizations_API_v1.csv")
    }
    states = {}
    for r in read_csv("FacilityAddresses_API_v1.csv"):
        state = clean(r.get("AddressStateCode"))
        if state:
            states[clean(r.get("FacilityID"))] = state

    site_counts = Counter()
    for r in read_csv("Campsites_API_v1.csv"):
        site_counts[clean(r.get("FacilityID"))] += 1

    official = defaultdict(list)
    for r in read_csv("Links_API_v1.csv"):
        if clean(r.get("EntityType")) != "Facility":
            continue
        url = clean(r.get("URL"))
        if url:
            official[clean(r.get("EntityID"))].append((clean(r.get("LinkType")), url))

    rows = []
    rejected = Counter()
    fetched = 0
    raw = 0
    category_counts = Counter()

    for r in read_csv("Facilities_API_v1.csv"):
        raw += 1
        cat = classify(r)
        if not cat:
            continue
        fetched += 1
        lat = number(r.get("FacilityLatitude"))
        lon = number(r.get("FacilityLongitude"))
        if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            rejected["no_coord"] += 1
            continue
        fid = clean(r.get("FacilityID"))
        name = clean(r.get("FacilityName"))
        booking = clean(r.get("FacilityReservationURL"))
        links = official.get(fid) or []
        link = next((u for t, u in links if "official" in t.lower()), "")
        if not link:
            link = next((u for _, u in links), "")
        org = orgs.get(clean(r.get("ParentOrgID")), "") or clean(r.get("ParentOrgID"))
        site_state = states.get(fid, "")
        fee = clean(r.get("FacilityUseFeeDescription"))
        tags = {
            "facility_type": clean(r.get("FacilityTypeDescription")),
            "reservable": clean(r.get("Reservable")),
            "stay_limit": clean(r.get("StayLimit")),
            "phone": clean(r.get("FacilityPhone")),
            "state": site_state,
            "fee": fee[:160],
            "region": clean(r.get("ParentRecAreaID")),
        }
        rows.append(
            {
                "srcId": fid,
                "cat": cat,
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "name": name,
                "country": "United States",
                "where": site_state or "United States",
                "operator": org,
                "capacity": site_counts.get(fid) or None,
                "url": link or booking,
                "booking": booking,
                "tags": {k: v for k, v in tags.items() if v},
            }
        )
        category_counts[cat] += 1

    registry = registry_for("ridb")
    emit(
        "ridb",
        rows,
        registry=registry,
        raw=raw,
        fetched=fetched,
        rejected=dict(rejected),
        extra={
            "campsites": sum(site_counts.values()),
            "facility_types": dict(Counter(clean(r.get("FacilityTypeDescription")) for r in read_csv("Facilities_API_v1.csv")).most_common(12)),
            "categories": dict(category_counts),
        },
    )


if __name__ == "__main__":
    main_guard(run)
