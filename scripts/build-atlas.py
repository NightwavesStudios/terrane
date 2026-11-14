#!/usr/bin/env python3
"""
Builds src/data/atlas.json from Wikidata (CC0).

Coverage is deliberately spread: candidates are deduped, ranked, then capped
per country so the globe fills out worldwide instead of only in the Himalaya.

    python3 scripts/build-atlas.py
"""

import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict

ENDPOINT = "https://query.wikidata.org/sparql"
UA = "Terrane/0.1 (interactive globe; dev@terrane.app)"
OUT = "src/data/atlas.json"

# Everything here is meant to be somewhere you would actually go outside. Peaks
# carry the app, so they get the bulk of the budget; landmarks are natural
# features only (no cathedrals, no treasuries).
TARGET = {"peak": 650, "park": 380, "landmark": 190}
PER_COUNTRY = {"peak": 42, "park": 15, "landmark": 6}

SITELINK = '?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .'

QUERIES = {
    # Elevations are not always stored in metres (US peaks are often in feet),
    # so read the quantity unit and normalise to metres before filtering.
    # Ranked by topographic prominence, not just height: prominence is what makes
    # a mountain a landmark (Kilimanjaro, Fuji, Table Mountain) rather than a high
    # shoulder of a bigger neighbour. Elevation is the fallback when prominence is
    # missing, so remote high summits still qualify.
    "peak": f"""
SELECT ?item ?name ?coord ?m ?countryLabel WHERE {{
  ?item wdt:P31 wd:Q8502 ; wdt:P625 ?coord .
  ?item p:P2044 ?st . ?st psv:P2044 ?node .
  ?node wikibase:quantityAmount ?elev ; wikibase:quantityUnit ?unit .
  BIND(IF(?unit = wd:Q11573, ?elev, IF(?unit = wd:Q3710, ?elev * 0.3048, ?elev)) AS ?m)
  FILTER(?m > 1700)
  {SITELINK}
  OPTIONAL {{ ?item wdt:P17 ?country }}
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 6000""",
    "park": f"""
SELECT ?item ?name ?coord ?inception ?countryLabel WHERE {{
  ?item wdt:P31 wd:Q46169 ; wdt:P625 ?coord .
  {SITELINK}
  OPTIONAL {{ ?item wdt:P17 ?country }}
  OPTIONAL {{ ?item wdt:P571 ?inception }}
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 5000""",
    # Was every UNESCO World Heritage site — which filled the map with cathedrals,
    # temples and treasuries. Now: natural features only, the things people walk to.
    "landmark": f"""
SELECT ?item ?name ?coord ?countryLabel WHERE {{
  VALUES ?class {{ wd:Q34038 wd:Q48214 wd:Q8072 wd:Q35666 wd:Q35509 wd:Q8514 }}
  ?item wdt:P31 ?class ; wdt:P625 ?coord .
  {SITELINK}
  OPTIONAL {{ ?item wdt:P17 ?country }}
  ?item rdfs:label ?name . FILTER(lang(?name) = "en")
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 5000""",
}


# Prominence is what makes a summit a landmark rather than a high shoulder of a
# bigger neighbour, so it decides the ordering. Asking for it in the same query as
# names and coordinates pushed WDQS past its budget (504), so it runs separately
# and is merged by QID; if it fails the ranking falls back to height.
PROM_QUERY = """
SELECT ?item ?prom WHERE {
  ?item wdt:P31 wd:Q8502 .
  ?item p:P2660 ?pt . ?pt psv:P2660 ?node .
  ?node wikibase:quantityAmount ?pv ; wikibase:quantityUnit ?unit .
  BIND(IF(?unit = wd:Q11573, ?pv, IF(?unit = wd:Q3710, ?pv * 0.3048, ?pv)) AS ?prom)
  FILTER(?prom > 650)
}
LIMIT 8000"""


def query(sparql, attempt=1):
    url = ENDPOINT + "?" + urllib.parse.urlencode(
        {"query": sparql, "format": "json"}
    )
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)["results"]["bindings"]
    except Exception as err:
        if attempt >= 3:
            raise
        print(f"    retry {attempt} after {err}")
        time.sleep(4 * attempt)
        return query(sparql, attempt + 1)


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


def norm_key(name):
    """'Yosemite National Park' and 'Yosemite' should collide."""
    s = name.lower()
    s = re.sub(r"\b(national|state|provincial|marine|nature|natural)?\s*"
               r"(park|reserve|monument|conservation area|protected area|site)\b", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def clean_name(name):
    """Drop disambiguation parentheses and stray markup."""
    name = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return name


def main():
    curated = json.load(open("src/data/curated-index.json"))
    curated_keys = {(norm_key(c["name"]), c["country"]) for c in curated}
    curated_names = {norm_key(c["name"]) for c in curated}

    result = []
    seen_slugs = set(c["slug"] for c in curated)

    print("→ prominence: querying…")
    prominence = {}
    try:
        for row in query(PROM_QUERY):
            qid = row["item"]["value"].rsplit("/", 1)[-1]
            prominence[qid] = parse_num(row.get("prom", {}).get("value"))
        print(f"    {len(prominence)} peaks with prominence")
    except Exception as err:  # noqa: BLE001 — ranking is optional
        print(f"    unavailable ({err}); ranking by height only")

    for kind, sparql in QUERIES.items():
        print(f"→ {kind}: querying…")
        rows = query(sparql)
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
            by_item[qid] = {
                "wd": qid,
                "name": name,
                "type": kind,
                "country": country,
                "lon": round(point[0], 3),
                "lat": round(point[1], 3),
                "elevation": parse_num(row.get("m", {}).get("value"))
                if kind == "peak" else None,
                "prominence": parse_num(row.get("prom", {}).get("value"))
                if kind == "peak" else None,
                "inception": parse_num(row.get("inception", {}).get("value")),
            }

        candidates = []
        for item in by_item.values():
            if kind == "peak":
                item["prominence"] = prominence.get(item["wd"])
            key = (norm_key(item["name"]), item["country"])
            if key in curated_keys or norm_key(item["name"]) in curated_names:
                continue
            if not item["country"]:
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
            item.pop("inception", None) if kind != "park" else None
            picked.append(item)
            if len(picked) >= TARGET[kind]:
                break

        print(f"    kept {len(picked)} across {len(per_country)} countries")
        result.extend(picked)

    for item in result:
        item.pop("inception", None)
        item.pop("prominence", None)  # ranking signal only, not shown in the UI

    result.sort(key=lambda p: (p["type"], p["name"]))
    json.dump(result, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nwrote {OUT}: {len(result)} places")
    counts = defaultdict(int)
    for item in result:
        counts[item["type"]] += 1
    print(dict(counts))
    print("countries:", len({p["country"] for p in result}))


if __name__ == "__main__":
    main()
