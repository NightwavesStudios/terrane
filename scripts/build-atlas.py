#!/usr/bin/env python3
"""
Builds src/data/atlas.json from Wikidata (CC0).

Coverage is deliberately spread: candidates are deduped, ranked, then capped
per country so the globe fills out worldwide instead of only in the Himalaya.

WDQS will truncate or time out a single query that asks for every peak, park and
landmark at once, so the harvest is split by class and then by country. A batch
that still hits the row limit or fails after retries is split again; the output
is written atomically, so a failed run leaves the previous atlas in place.

    python3 scripts/build-atlas.py
"""

import gzip
import json
import os
import random
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "Terrane/0.1 (interactive globe; dev@terrane.app)"
OUT = "src/data/atlas.json"
META = "src/data/wikidata-meta.json"

# Everything here is meant to be somewhere you would actually go outside. Peaks
# carry the app, so they get the bulk of the budget; landmarks are natural
# features only (no cathedrals, no treasuries).
TARGET = {"peak": 650, "park": 380, "landmark": 190}
PER_COUNTRY = {"peak": 42, "park": 15, "landmark": 6}

# Country batches keep each query fast. A batch that reaches the row limit or
# keeps timing out is split, so a single heavy country cannot truncate the atlas.
COUNTRIES_PER_BATCH = 12
LIMIT = 50000
PAGE = 800
ATTEMPTS = 5

SITELINK = '?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .'

CLASSES = (
    "wd:Q8502 wd:Q46169 wd:Q34038 wd:Q48214 "
    "wd:Q8072 wd:Q35666 wd:Q35509 wd:Q8514"
)

# Every query takes a COUNTRIES token, replaced by a VALUES list of QIDs.
QUERIES = {
    # Elevations are not always stored in metres (US peaks are often in feet),
    # so read the quantity unit and normalise to metres before filtering.
    "peak": f"""
SELECT DISTINCT ?item ?name ?coord ?m ?countryLabel WHERE {{
  VALUES ?country {{ COUNTRIES }}
  ?item wdt:P31 wd:Q8502 ; wdt:P625 ?coord ; wdt:P17 ?country .
  ?item p:P2044 ?st . ?st psv:P2044 ?node .
  ?node wikibase:quantityAmount ?elev ; wikibase:quantityUnit ?unit .
  BIND(IF(?unit = wd:Q11573, ?elev, IF(?unit = wd:Q3710, ?elev * 0.3048, ?elev)) AS ?m)
  FILTER(?m > 1700)
  {SITELINK}
  ?country rdfs:label ?countryLabel . FILTER(lang(?countryLabel) = "en")
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
}}
LIMIT {LIMIT}""",
    "park": f"""
SELECT DISTINCT ?item ?name ?coord ?inception ?countryLabel WHERE {{
  VALUES ?country {{ COUNTRIES }}
  ?item wdt:P31 wd:Q46169 ; wdt:P625 ?coord ; wdt:P17 ?country .
  {SITELINK}
  ?country rdfs:label ?countryLabel . FILTER(lang(?countryLabel) = "en")
  OPTIONAL {{ ?item wdt:P571 ?inception }}
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
}}
LIMIT {LIMIT}""",
    # Was every UNESCO World Heritage site — which filled the map with cathedrals,
    # temples and treasuries. Now: natural features only, the things people walk to.
    "landmark": f"""
SELECT DISTINCT ?item ?name ?coord ?countryLabel WHERE {{
  VALUES ?country {{ COUNTRIES }}
  VALUES ?class {{ wd:Q34038 wd:Q48214 wd:Q8072 wd:Q35666 wd:Q35509 wd:Q8514 }}
  ?item wdt:P31 ?class ; wdt:P625 ?coord ; wdt:P17 ?country .
  {SITELINK}
  ?country rdfs:label ?countryLabel . FILTER(lang(?countryLabel) = "en")
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
}}
LIMIT {LIMIT}""",
}

# Prominence is what makes a summit a landmark rather than a high shoulder of a
# bigger neighbour, so it decides the ordering. Asking for it in the same query as
# names and coordinates pushed WDQS past its budget (504), so it runs separately
# and is merged by QID; if it fails the ranking falls back to height.
PROM_QUERY = f"""
SELECT DISTINCT ?item ?prom WHERE {{
  VALUES ?country {{ COUNTRIES }}
  ?item wdt:P31 wd:Q8502 ; wdt:P17 ?country .
  ?item p:P2660 ?pt . ?pt psv:P2660 ?node .
  ?node wikibase:quantityAmount ?pv ; wikibase:quantityUnit ?unit .
  BIND(IF(?unit = wd:Q11573, ?pv, IF(?unit = wd:Q3710, ?pv * 0.3048, ?pv)) AS ?prom)
  FILTER(?prom > 650)
}}
LIMIT {LIMIT}"""

# One union of three light queries is much faster than a single all-class scan.
COUNTRY_QUERIES = [
    (
        "peak",
        """SELECT DISTINCT ?country WHERE {
  ?item wdt:P31 wd:Q8502 ; wdt:P17 ?country .
}
LIMIT 2000""",
    ),
    (
        "park",
        """SELECT DISTINCT ?country WHERE {
  ?item wdt:P31 wd:Q46169 ; wdt:P17 ?country .
}
LIMIT 2000""",
    ),
    (
        "landmark",
        f"""SELECT DISTINCT ?country WHERE {{
  VALUES ?class {{ {CLASSES} }}
  ?item wdt:P31 ?class ; wdt:P17 ?country .
}}
LIMIT 2000""",
    ),
]


class QueryFailed(RuntimeError):
    pass


def query(sparql, label, attempt=1):
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"query": sparql, "format": "json"}
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/sparql-results+json",
            # The response can exceed the transport's plain-body ceiling. Gzip
            # keeps the same batch under it and urllib does not decode it for us.
            "Accept-Encoding": "gzip",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            raw = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
        payload = json.loads(raw)
        if "error" in payload:
            raise QueryFailed(str(payload["error"]))
        return payload["results"]["bindings"]
    except Exception as err:  # noqa: BLE001 — every transport/parse failure retries
        if attempt >= ATTEMPTS:
            raise QueryFailed(f"{label}: {err}") from err
        delay = min(90, 3 * (2 ** (attempt - 1))) + random.uniform(0, 1.5)
        print(f"    retry {attempt}/{ATTEMPTS - 1} in {delay:.0f}s: {err}")
        time.sleep(delay)
        return query(sparql, label, attempt + 1)


def rows_for(template, countries, label):
    """One country batch, split if it reaches the row limit."""
    values = " ".join(f"wd:{qid}" for qid in countries)
    rows = query(template.replace("COUNTRIES", values), label)
    if len(rows) < LIMIT:
        return rows
    if len(countries) == 1:
        raise QueryFailed(
            f"{label}: single-country batch {countries[0]} reached LIMIT {LIMIT}"
        )
    mid = len(countries) // 2
    print(f"    {label}: limit reached; splitting {len(countries)} countries")
    return rows_for(template, countries[:mid], label) + rows_for(
        template, countries[mid:], label
    )


def paginate(template, country, label):
    """One country too large for a single response: page it by row offset."""
    values = f"wd:{country}"
    base = template.replace("COUNTRIES", values)
    rows = []
    offset = 0
    while True:
        page = query(
            base.replace(f"LIMIT {LIMIT}", f"LIMIT {PAGE} OFFSET {offset}"),
            label,
        )
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        offset += PAGE


def batched(template, countries, label):
    """Country batches, split recursively if a batch keeps failing."""
    all_rows = []
    chunks = [
        countries[i : i + COUNTRIES_PER_BATCH]
        for i in range(0, len(countries), COUNTRIES_PER_BATCH)
    ]
    for index, chunk in enumerate(chunks, 1):
        try:
            rows = rows_for(template, chunk, label)
        except QueryFailed:
            if len(chunk) == 1:
                print(f"    {label}: single country {chunk[0]}; paging")
                rows = paginate(template, chunk[0], label)
            else:
                mid = len(chunk) // 2
                print(f"    {label}: batch failed; splitting {len(chunk)} countries")
                rows = batched(template, chunk[:mid], label) + batched(
                    template, chunk[mid:], label
                )
        print(f"    {label} {index}/{len(chunks)}: {len(rows)} rows")
        all_rows.extend(rows)
    return all_rows


def fetch_countries():
    countries = set()
    for label, sparql in COUNTRY_QUERIES:
        rows = query(sparql, f"countries:{label}")
        countries.update(
            row["country"]["value"].rsplit("/", 1)[-1]
            for row in rows
            if row.get("country")
        )
        print(f"    {label}: {len(countries)} countries so far")
    if not countries:
        raise QueryFailed("countries: no country/territory QIDs returned")
    return sorted(countries)


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "place"


def parse_point(wkt):
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", wkt)
    if not m:
        return None
    return float(m.group(1)), float(m.group(2))


def parse_num(value):
    try:
        return round(float(re.sub(r"[^0-9.\-]", "", value)))
    except (TypeError, ValueError):
        return None


def clean_name(name):
    """Drop disambiguation parentheses and stray markup."""
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return name


def main():
    # Documented merges: a massif and its highest summit are one destination.
    merges = json.load(open("src/data/atlas-merges.json"))
    dropped_ids = {d for m in merges for d in m["drop"]}
    merge_by_keep = {m["keep"]: m for m in merges}

    print("→ countries: querying…")
    countries = fetch_countries()
    print(f"    {len(countries)} country/territory QIDs")

    print("→ prominence: querying…")
    prominence = {}
    try:
        for row in batched(PROM_QUERY, countries, "prominence"):
            qid = row["item"]["value"].rsplit("/", 1)[-1]
            prominence[qid] = parse_num(row.get("prom", {}).get("value"))
        print(f"    {len(prominence)} peaks with prominence")
    except QueryFailed as err:
        # Ranking is optional, but a partial prominence map must not be mistaken
        # for a complete one. Fall back to height for every peak.
        print(f"    unavailable ({err}); ranking by height only")
        prominence = {}

    result = []
    seen_slugs = set()

    for kind, template in QUERIES.items():
        print(f"→ {kind}: querying…")
        rows = batched(template, countries, kind)
        print(f"    {len(rows)} rows")

        by_item = {}
        for row in rows:
            qid = row["item"]["value"].rsplit("/", 1)[-1]
            if qid in by_item:
                continue
            point = parse_point(row.get("coord", {}).get("value", ""))
            if not point:
                continue
            name = clean_name(row.get("name", {}).get("value", "").strip())
            if len(name) < 3 or len(name) > 60:
                continue
            country = row.get("countryLabel", {}).get("value", "").strip()
            item = {
                "wd": qid,
                "name": name,
                "type": kind,
                "country": country,
                "lon": round(point[0], 3),
                "lat": round(point[1], 3),
                "elevation": parse_num(row.get("m", {}).get("value"))
                if kind == "peak"
                else None,
                "inception": parse_num(row.get("inception", {}).get("value")),
            }
            if kind == "peak":
                item["prominence"] = prominence.get(qid)
            by_item[qid] = item

        candidates = []
        for item in by_item.values():
            if not item["country"]:
                continue
            if item["wd"] in dropped_ids:
                continue
            candidates.append(item)

        # peaks: most prominent first, height as tie-break. parks: prefer dated,
        # established parks.
        if kind == "peak":
            candidates.sort(
                key=lambda p: (-(p.get("prominence") or 0), -(p["elevation"] or 0))
            )
        else:
            candidates.sort(key=lambda p: (p["inception"] is None, p["name"]))
            candidates.sort(key=lambda p: p["inception"] is None)

        per_country = defaultdict(int)
        picked = []
        for item in candidates:
            if per_country[item["country"]] >= PER_COUNTRY[kind]:
                continue
            slug = slugify(item["name"])
            if slug in seen_slugs:
                slug = f"{slug}-{item['wd'].lower()}"
            if slug in seen_slugs:
                continue
            per_country[item["country"]] += 1
            seen_slugs.add(slug)
            item["slug"] = slug
            merge = merge_by_keep.get(item["wd"])
            if merge:
                item["also"] = [
                    {"src": "atlas", "id": d, "name": n}
                    for d, n in zip(merge["drop"], merge.get("dropNames", merge["drop"]))
                ]
            item.pop("inception", None)
            picked.append(item)
            if len(picked) >= TARGET[kind]:
                break

        print(f"    kept {len(picked)} across {len(per_country)} countries")
        result.extend(picked)

    result.sort(key=lambda p: (p["type"], p["name"]))

    # Write only after every batch has succeeded; a failed run leaves the old
    # atlas and meta exactly as they were.
    tmp = f"{OUT}.tmp"
    with open(tmp, "w") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, OUT)

    try:
        meta = json.load(open(META))
    except (OSError, ValueError):
        meta = {}
    meta["atlas"] = time.strftime("%Y-%m-%d", time.gmtime())
    meta_tmp = f"{META}.tmp"
    with open(meta_tmp, "w") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
    os.replace(meta_tmp, META)

    print(f"\nwrote {OUT}: {len(result)} places")
    counts = defaultdict(int)
    for item in result:
        counts[item["type"]] += 1
    print(dict(counts))
    print("countries:", len({p["country"] for p in result}))


if __name__ == "__main__":
    main()
