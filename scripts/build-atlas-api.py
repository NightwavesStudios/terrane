#!/usr/bin/env python3
"""
Rebuilds src/data/atlas.json from the Wikidata Action API.

WDQS is not used here. The previous SPARQL harvest kept hitting 504/502/429 and
truncating large JSON responses, so this route asks the Action API for entity
JSON instead: `wbsearchentities` resolves the 68 former seed names to Q ids,
then batched `wbgetentities` (50 ids per call) supplies claims, labels and
sitelinks. The write is atomic, so a failed run leaves the old atlas in place.

The class rules, per-country caps and global targets are the same as
build-atlas.py: peaks need P31 Q8502, elevation > 1700 m and an enwiki sitelink;
parks need Q46169; land marks need one of the natural-feature classes. Peaks are
ranked by P2660 prominence then P2044 elevation, so `prominence` is retained in
the output instead of being dropped.

    python3 scripts/build-atlas-api.py

Set ATLAS_SEEDS to a JSON list of {slug,name,type,country,lat,lon,elevation,wd}
to use a different recovery seed set. The default is /tmp/atlas-recovery-seeds.json,
which is only a search seed list; every emitted row still comes from Wikidata.
"""

import gzip
import json
import math
import os
import random
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict

API = "https://www.wikidata.org/w/api.php"
UA = "Terrane/0.1 (atlas recovery; dev@terrane.app)"
OUT = "src/data/atlas.json"
META = "src/data/wikidata-meta.json"
SEEDS = os.environ.get("ATLAS_SEEDS", "/tmp/atlas-recovery-seeds.json")

TARGET = {"peak": 650, "park": 380, "landmark": 190}
PER_COUNTRY = {"peak": 42, "park": 15, "landmark": 6}

PEAK = "Q8502"
PARK = "Q46169"
LANDMARK = {"Q34038", "Q48214", "Q8072", "Q35666", "Q35509", "Q8514"}

COUNTRY_FIX = {
    "United States of America": "United States",
    "Russian Federation": "Russia",
    "People's Republic of China": "China",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
    "Czech Republic": "Czechia",
    "Republic of Ireland": "Ireland",
    "Kingdom of the Netherlands": "Netherlands",
    "Republic of South Africa": "South Africa",
    "Türkiye": "Turkey",
}

BATCH = 50
SLEEP = 0.25


class APIFailed(RuntimeError):
    pass


def api(params, label, attempt=1):
    url = API + "?" + urllib.parse.urlencode(
        {**params, "format": "json", "formatversion": "2"}
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            raw = response.read()
            if response.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
        data = json.loads(raw)
        if "error" in data:
            raise APIFailed(str(data["error"]))
        return data
    except Exception as err:  # every transport/parse failure retries
        if attempt >= 4:
            raise APIFailed(f"{label}: {err}") from err
        delay = min(20, 1.5 * (2 ** (attempt - 1))) + random.uniform(0, 0.8)
        print(f"    retry {attempt}/3 in {delay:.1f}s: {err}")
        time.sleep(delay)
        return api(params, label, attempt + 1)


def chunks(values, size):
    values = list(values)
    for i in range(0, len(values), size):
        yield values[i : i + size]


def search(name):
    data = api(
        {
            "action": "wbsearchentities",
            "search": name,
            "language": "en",
            "uselang": "en",
            "limit": "10",
            "type": "item",
        },
        f"search:{name}",
    )
    return [row["id"] for row in data.get("search", []) if row.get("id")]


def entity_map(data):
    raw = data.get("entities", {})
    if isinstance(raw, list):
        return {entity["id"]: entity for entity in raw}
    return raw


def fetch_entities(ids, label):
    out = {}
    for batch in chunks(sorted({i for i in ids if i}), BATCH):
        data = api(
            {
                "action": "wbgetentities",
                "ids": "|".join(batch),
                "props": "claims|labels|sitelinks",
                "languages": "en",
                "sitefilter": "enwiki",
            },
            label,
        )
        out.update(entity_map(data))
        time.sleep(SLEEP)
    return out


def fetch_labels(ids):
    out = {}
    for batch in chunks(sorted({i for i in ids if i}), BATCH):
        data = api(
            {
                "action": "wbgetentities",
                "ids": "|".join(batch),
                "props": "labels",
                "languages": "en",
            },
            "countries",
        )
        for qid, entity in entity_map(data).items():
            label = entity.get("labels", {}).get("en", {}).get("value")
            if label:
                out[qid] = label
        time.sleep(SLEEP)
    return out


def snaks(entity, prop):
    for claim in entity.get("claims", {}).get(prop, []):
        if claim.get("rank") == "deprecated":
            continue
        snak = claim.get("mainsnak", {})
        if snak.get("snaktype") != "value":
            continue
        yield snak


def ids_of(entity, prop):
    for snak in snaks(entity, prop):
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict) and value.get("id"):
            yield value["id"]


def first_id(entity, prop):
    return next(ids_of(entity, prop), None)


def string_of(entity, prop):
    for snak in snaks(entity, prop):
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def quantity_of(entity, prop):
    for snak in snaks(entity, prop):
        value = snak.get("datavalue", {}).get("value")
        if not isinstance(value, dict):
            continue
        try:
            amount = float(value.get("amount"))
        except (TypeError, ValueError):
            continue
        unit = str(value.get("unit", ""))
        if unit.rsplit("/", 1)[-1] == "Q3710":
            amount *= 0.3048
        return round(amount)
    return None


def point_of(entity):
    for snak in snaks(entity, "P625"):
        value = snak.get("datavalue", {}).get("value")
        if isinstance(value, dict):
            try:
                return float(value["longitude"]), float(value["latitude"])
            except (KeyError, TypeError, ValueError):
                continue
    return None


def year_of(entity):
    for snak in snaks(entity, "P571"):
        value = snak.get("datavalue", {}).get("value")
        if not isinstance(value, dict):
            continue
        match = re.search(r"([+-]?\d+)", str(value.get("time", "")))
        if not match:
            continue
        year = int(match.group(1))
        return year if year > 0 else None
    return None


def label_of(entity):
    return entity.get("labels", {}).get("en", {}).get("value")


def sitelink_of(entity):
    return entity.get("sitelinks", {}).get("enwiki", {}).get("title")


def kind_of(entity):
    classes = set(ids_of(entity, "P31"))
    if PEAK in classes:
        return "peak"
    if PARK in classes:
        return "park"
    if classes & LANDMARK:
        return "landmark"
    return None


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "place"


def clean_name(name):
    return re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()


def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def km_between(a, b, c, d):
    rad = math.pi / 180
    dlat = (c - a) * rad
    dlon = (d - b) * rad
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(a * rad) * math.cos(c * rad) * math.sin(dlon / 2) ** 2
    )
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def candidate(qid, entity, fallback=None, seed=None, country_labels=None):
    country_labels = country_labels or {}
    entity = entity or {}
    if fallback:
        # An existing atlas row keeps the type it was selected under. P31 is
        # used for new places only, so a fresh build cannot silently move a
        # current landmark into the peak pool and drop it under that cap.
        kind = fallback.get("type")
    else:
        kind = kind_of(entity)
        if kind is None:
            return None, "no documented P31 class"
    if kind not in TARGET:
        return None, f"unknown atlas type {kind}"

    name = clean_name(
        label_of(entity)
        or (fallback or {}).get("name")
        or (seed or {}).get("name")
        or ""
    )
    point = point_of(entity)
    if point is None and fallback:
        point = (fallback["lon"], fallback["lat"])
    if point is None and seed:
        point = (seed["lon"], seed["lat"])
    if point is None:
        return None, "no coordinate"

    country_id = first_id(entity, "P17")
    country = country_labels.get(country_id)
    if not country and fallback:
        country = fallback.get("country")
    if not country and seed:
        country = seed.get("country")
    if not country:
        return None, "no P17 country"
    country = COUNTRY_FIX.get(country, country)

    elevation = quantity_of(entity, "P2044")
    if elevation is None and fallback:
        elevation = fallback.get("elevation")
    prominence = quantity_of(entity, "P2660")
    if prominence is None and fallback:
        prominence = fallback.get("prominence")
    inception = year_of(entity)

    sitelink = bool(sitelink_of(entity)) or bool(fallback)
    if seed and not fallback:
        if not sitelink:
            return None, "no enwiki sitelink"
        if kind == "peak" and (elevation or 0) <= 1700:
            return None, f"peak elevation {elevation} <= 1700"
    if len(name) < 3 or len(name) > 60:
        return None, f"name length {len(name)}"

    also = list(fallback.get("also", [])) if fallback else []
    if qid == "Q1091113" and not any(a.get("id") == "Q143008" for a in also):
        also.append({"src": "atlas", "id": "Q143008", "name": "Tavan Bogd"})

    return {
        "wd": qid,
        "name": name,
        "type": kind,
        "country": country,
        "lon": round(point[0], 3),
        "lat": round(point[1], 3),
        "elevation": elevation,
        "prominence": prominence if kind == "peak" else None,
        "inception": inception,
        "also": also,
        "slug": (fallback or {}).get("slug"),
        "seed": seed,
    }, None


def resolve_seed(seed, entities):
    if seed.get("wd"):
        return seed["wd"], "wd"
    best = None
    for qid in seed.get("_search", []):
        entity = entities.get(qid)
        if not entity:
            continue
        point = point_of(entity)
        if point is None:
            continue
        distance = km_between(seed["lat"], seed["lon"], point[1], point[0])
        if distance > 150:
            continue
        label = norm(label_of(entity) or "")
        target = norm(seed["name"])
        label_score = (
            0 if label == target else 1 if (target in label or label in target) else 2
        )
        kind_score = 0 if kind_of(entity) else 1
        score = (label_score, kind_score, distance)
        if best is None or score < best[0]:
            best = (score, qid)
    return (best[1], "search") if best else (None, "no coordinate match")


def main():
    atlas = json.load(open(OUT))
    try:
        seeds = json.load(open(SEEDS))
    except (OSError, ValueError):
        # A fresh checkout still has the committed atlas; without a seed list
        # this rebuilds it from the current Q ids rather than failing.
        seeds = []
    merges = json.load(open("src/data/atlas-merges.json"))
    dropped = {q for merge in merges for q in merge["drop"]}

    current_by_qid = {}
    for row in atlas:
        current_by_qid.setdefault(row["wd"], row)

    print(f"→ seeds: {len(seeds)} · current atlas: {len(current_by_qid)} Q ids")

    search_ids = set()
    for seed in seeds:
        if seed.get("wd"):
            search_ids.add(seed["wd"])
        else:
            found = search(seed["name"])
            if seed.get("type") == "park":
                # "Acadia" alone returns the region and the university; the
                # national park only appears when the type word is included.
                found += search(f"{seed['name']} National Park")
            found = list(dict.fromkeys(found))
            seed["_search"] = found
            search_ids.update(found)
            print(f"    {seed['name']}: {len(found)} candidates")
            time.sleep(0.15)

    entities = fetch_entities(set(current_by_qid) | search_ids, "entities")
    print(f"    {len(entities)} entities")

    country_ids = set()
    for entity in entities.values():
        cid = first_id(entity, "P17")
        if cid:
            country_ids.add(cid)
    country_labels = fetch_labels(country_ids)
    print(f"    {len(country_labels)} country labels")

    candidates = []
    states = {}
    for qid, row in current_by_qid.items():
        if qid in dropped:
            continue
        item, reason = candidate(
            qid, entities.get(qid), fallback=row, country_labels=country_labels
        )
        if item:
            candidates.append(item)
        else:
            print(f"    current {qid} {row['name']}: {reason}")

    for seed in seeds:
        qid, how = resolve_seed(seed, entities)
        seed["_qid"] = qid
        seed["_how"] = how
        if not qid:
            states[seed["slug"]] = ("unresolved", seed)
            continue
        if qid in dropped:
            states[seed["slug"]] = ("dropped_merge", seed)
            continue
        if qid in current_by_qid:
            states[seed["slug"]] = ("already", seed)
            continue
        item, reason = candidate(
            qid, entities.get(qid), seed=seed, country_labels=country_labels
        )
        if item:
            candidates.append(item)
            states[seed["slug"]] = ("candidate", seed)
        else:
            states[seed["slug"]] = ("ineligible", (seed, reason))
            print(f"    seed {seed['name']} -> {qid}: {reason}")

    used = set()
    current_slugs = {row["slug"] for row in atlas}
    result = []
    for kind in ("peak", "park", "landmark"):
        pool = [item for item in candidates if item["type"] == kind]
        if kind == "peak":
            pool.sort(
                key=lambda item: (
                    -(item.get("prominence") or 0),
                    -(item.get("elevation") or 0),
                    item["name"],
                )
            )
        else:
            pool.sort(key=lambda item: (item.get("inception") is None, item["name"]))
        per_country = defaultdict(int)
        picked = []
        for item in pool:
            if per_country[item["country"]] >= PER_COUNTRY[kind]:
                continue
            if item.get("slug"):
                slug = item["slug"]
            else:
                slug = slugify(item["name"])
                if slug in current_slugs or slug in used:
                    slug = f"{slug}-{item['wd'].lower()}"
            if slug in used:
                continue
            used.add(slug)
            per_country[item["country"]] += 1
            item["slug"] = slug
            if not item.get("also"):
                item.pop("also", None)
            item.pop("seed", None)
            item.pop("inception", None)
            picked.append(item)
            if len(picked) >= TARGET[kind]:
                break
        print(f"    {kind}: {len(picked)} across {len(per_country)} countries")
        result.extend(picked)

    result.sort(key=lambda item: (item["type"], item["name"]))
    if not result:
        raise APIFailed("no candidates selected")
    if len({row["wd"] for row in result}) != len(result):
        raise APIFailed("duplicate Q id in selected atlas")
    if len({row["slug"] for row in result}) != len(result):
        raise APIFailed("duplicate slug in selected atlas")

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

    selected_qids = {row["wd"] for row in result}
    report = {
        "seeds": len(seeds),
        "total": len(result),
        "by_type": {
            kind: sum(1 for row in result if row["type"] == kind) for kind in TARGET
        },
        "qids": len(selected_qids),
        "already": [],
        "returned": [],
        "cap_excluded": [],
        "ineligible": [],
        "unresolved": [],
        "dropped": [],
    }
    for seed in seeds:
        state = states.get(seed["slug"])
        if not state:
            continue
        status, payload = state
        if status == "already":
            (report["already"] if seed["_qid"] in selected_qids else report["dropped"]).append(
                {"seed": seed["slug"], "name": seed["name"], "qid": seed["_qid"]}
            )
        elif status == "candidate":
            if seed["_qid"] in selected_qids:
                report["returned"].append(
                    {"seed": seed["slug"], "name": seed["name"], "qid": seed["_qid"]}
                )
            else:
                report["cap_excluded"].append(
                    {"seed": seed["slug"], "name": seed["name"], "qid": seed["_qid"]}
                )
        elif status == "ineligible":
            reason = payload[1] if isinstance(payload, tuple) else "ineligible"
            report["ineligible"].append(
                {
                    "seed": seed["slug"],
                    "name": seed["name"],
                    "qid": seed["_qid"],
                    "reason": reason,
                }
            )
        elif status == "unresolved":
            report["unresolved"].append({"seed": seed["slug"], "name": seed["name"]})
        elif status == "dropped_merge":
            report["dropped"].append(
                {"seed": seed["slug"], "name": seed["name"], "qid": seed["_qid"]}
            )

    with open("/tmp/atlas-api-report.json", "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(
        f"\nwrote {OUT}: {len(result)} places · "
        f"returned {len(report['returned'])} · already {len(report['already'])} · "
        f"cap-excluded {len(report['cap_excluded'])} · ineligible {len(report['ineligible'])} · "
        f"unresolved {len(report['unresolved'])}"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
