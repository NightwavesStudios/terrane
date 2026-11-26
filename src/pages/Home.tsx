import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { worldZoom } from "../map/camera";
import type { GlobeFocus } from "../map/Globe";
import type { ListedPoint } from "../map/listed";
import type { LogMapPoint } from "../map/log";
import { rankPlaces } from "../data/rank";
import { pickOfPlace, type Pick } from "../data/features";
import { atlasCatalogRows } from "../lib/catalog";
import { relatedRows } from "../lib/discover";
import { SUMMIT_LISTS, SUMMIT_PEAK_COUNT, summitList } from "../data/summits";
import { logStats, mappedEntries, useLog } from "../lib/log";

const Globe = lazy(() => import("../map/Globe"));
import Header from "../components/Header";
import GlobeDock from "../components/GlobeDock";
import LayerControl, {
  layersForLens,
  type GlobeLens,
  type LayerState,
} from "../components/LayerControl";
import Discover from "../components/Discover";
import FeatureCard from "../components/FeatureCard";
import ExperiencePickCard from "../components/experiences/ExperiencePickCard";
import ListLens from "../components/ListLens";
import { PLACES, bySlug, useAtlas, type Place } from "../data/places";
import { guidePick, loadGuideCatalog } from "../lib/guide";
import { kmBetween } from "../lib/geo";
import { navigate } from "../lib/router";
import { rememberView } from "../lib/lastView";
import { useManifest } from "../lib/live";
import { usePlacePage } from "../lib/placePages";

const WORLD = { lon: 12, lat: 22 };

type View = { lon: number; lat: number; zoom: number };

function readLens(): GlobeLens {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "places" || mode === "around" || mode === "all" ? mode : "peaks";
}

export default function Home() {
  const [lens, setLens] = useState<GlobeLens>(readLens);
  const [layers, setLayers] = useState<LayerState>(() => layersForLens(readLens()));
  const [pick, setPick] = useState<Pick | null>(() => {
    const slug = new URLSearchParams(window.location.search).get("place");
    const place = slug ? bySlug.get(slug) : undefined;
    return place ? pickOfPlace(place) : null;
  });
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [layersSignal, setLayersSignal] = useState(0);
  const [listsOpen, setListsOpen] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get("list")),
  );
  const placeSlug = useMemo(
    () => new URLSearchParams(window.location.search).get("place"),
    [],
  );
  const guideSlug = useMemo(
    () => new URLSearchParams(window.location.search).get("guide"),
    [],
  );
  const listSlug = useMemo(
    () => new URLSearchParams(window.location.search).get("list"),
    [],
  );
  const [view, setView] = useState<View>(() => ({
    lon: WORLD.lon,
    lat: WORLD.lat,
    zoom: worldZoom(window.innerWidth, window.innerHeight),
  }));
  const viewRef = useRef(view);
  const discoverOpen = useRef(false);

  useEffect(() => {
    if (!guideSlug) return;
    let alive = true;
    void loadGuideCatalog().then((rows) => {
      if (!alive) return;
      const row = rows.find((candidate) => candidate.slug === guideSlug);
      if (row) {
        setPick(guidePick(row));
        /* A deep link to a curated place must show its kind, not just a ring on
           a peaks-only layer. An explicit ?mode= still wins. */
        if (!new URLSearchParams(window.location.search).get("mode")) {
          setLens("all");
          setLayers(layersForLens("all"));
        }
      }
    });
    return () => {
      alive = false;
    };
  }, [guideSlug]);

  useEffect(() => {
    if (!listSlug) return;
    const list = summitList(listSlug);
    if (!list) return;
    setListsOpen(true);
    setFocus({ ...list.center, zoom: list.zoom, key: Date.now() });
  }, [listSlug]);

  const manifest = useManifest();
  const atlas = useAtlas();
  /* A listed summit's place slug can be outside the atlas (the club list is
     complete; the atlas is a selection). Resolve the page shard too, so the
     list's "Globe →" link opens a real card instead of silently doing nothing. */
  const pagePlace = usePlacePage(placeSlug ?? "").place;
  const log = useLog();
  const stats = logStats(log);

  /* Rank once for the atlas bands. Visibility is a category switch now, not a
     second filtered copy of the rows: a lens cannot disagree with the dots. */
  const places = useMemo(() => rankPlaces(PLACES), [atlas]);

  const logPoints = useMemo<LogMapPoint[]>(
    () =>
      mappedEntries(log, (slug) => {
        const place = bySlug.get(slug);
        return place ? { lat: place.lat, lon: place.lon } : undefined;
      }).map((entry) => ({
        key: entry.key,
        name: entry.name,
        cat: entry.kind === "peak" ? "peak" : entry.cat,
        state: entry.state,
        lat: entry.lat,
        lon: entry.lon,
        slug: entry.slug,
        elev: entry.elev,
        where: entry.where,
        listId: entry.listId,
        listName: entry.listName,
        peakName: entry.peakName,
      })),
    [log, atlas],
  );

  /* Only list peaks with a real place page get a ring. The rest stay rows. */
  const listedPoints = useMemo<ListedPoint[]>(() => {
    if (!atlas) return [];
    const out: ListedPoint[] = [];
    for (const list of SUMMIT_LISTS) {
      for (const peak of list.peaks) {
        if (!peak.place) continue;
        const place = bySlug.get(peak.place);
        if (!place) continue;
        out.push({
          lat: place.lat,
          lon: place.lon,
          listId: list.id,
          listName: list.name,
          peakName: peak.name,
          place: peak.place,
          elev: place.elevation,
        });
      }
    }
    return out;
  }, [atlas]);

  useEffect(() => {
    if (!placeSlug) return;
    const atlasPlace = bySlug.get(placeSlug);
    if (atlasPlace) {
      setPick((current) => current ?? pickOfPlace(atlasPlace));
      return;
    }
    if (!pagePlace) return;
    const asPlace = {
      ...pagePlace,
      type: pagePlace.type ?? "landmark",
      country: pagePlace.country ?? "",
    } as Place;
    /* A reach page carries its final category; the atlas fallback only knows
       the broad place type, which would label a waterfall a landmark. */
    setPick((current) => current ?? { ...pickOfPlace(asPlace), cat: pagePlace.cat });
  }, [atlas, pagePlace, placeSlug]);

  /* A `?guide=` selection is a curated place; its card carries the same log
     actions as a peak. */

  const nearPlace = useMemo(() => {
    if (!pick) return undefined;
    if (pick.near) {
      const named = bySlug.get(pick.near);
      if (named) return named;
    }
    if (pick.slug) return undefined;
    let best: (typeof PLACES)[number] | undefined;
    let bestKm = Infinity;
    for (const p of PLACES) {
      const km = kmBetween(pick.lat, pick.lon, p.lat, p.lon);
      if (km < bestKm) {
        bestKm = km;
        best = p;
      }
    }
    return bestKm <= 60 ? best : undefined;
  }, [pick, atlas]);

  const nearKm =
    nearPlace && pick
      ? kmBetween(pick.lat, pick.lon, nearPlace.lat, nearPlace.lon)
      : null;

  const related = useMemo(
    () =>
      pick
        ? relatedRows(pick, atlasCatalogRows(), 3).map((item) => item.row.pick)
        : [],
    [pick, atlas],
  );

  const onView = useCallback((next: View) => {
    viewRef.current = next;
    rememberView({ lat: next.lat, lon: next.lon, zoom: next.zoom });
    if (discoverOpen.current) setView(next);
  }, []);

  const onDiscoverOpenChange = useCallback((open: boolean) => {
    discoverOpen.current = open;
    if (open) setView(viewRef.current);
  }, []);

  const goToArea = useCallback((area: { lon: number; lat: number; zoom: number }) => {
    setPick(null);
    setFocus({ ...area, key: Date.now() });
  }, []);

  const closePick = useCallback(() => setPick(null), []);

  const changeLens = useCallback((next: GlobeLens) => {
    setLens(next);
    setLayers(layersForLens(next));
    setPick(null);
  }, []);

  const showAround = useCallback(() => {
    setLens("around");
    setLayers(layersForLens("around"));
  }, []);

  const focusList = useCallback((listId: string) => {
    const list = summitList(listId);
    if (!list) return;
    setPick(null);
    setListsOpen(false);
    setFocus({ ...list.center, zoom: list.zoom, key: Date.now() });
  }, []);

  useEffect(() => {
    const root = document.documentElement.style;
    const measure = () => {
      const bar = document.querySelector(".globe-filters");
      if (!bar) return;
      const barBox = bar.getBoundingClientRect();
      const filters = `${Math.round(barBox.height)}px`;
      if (root.getPropertyValue("--filters-h") !== filters) root.setProperty("--filters-h", filters);
    };
    measure();
    const later = window.setTimeout(measure, 400);
    const settled = window.setTimeout(measure, 1400);
    const ro = new ResizeObserver(measure);
    for (const sel of [".globe-filters", ".globe-filters .chips", ".globe"]) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.clearTimeout(later);
      window.clearTimeout(settled);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  const peakCount = manifest.byCategory.peak ?? 0;

  return (
    <div className="home" data-pick={pick ? "on" : undefined}>
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe
          places={places}
          pick={pick}
          onPick={setPick}
          onView={onView}
          focus={focus}
          layers={layers}
          logPoints={logPoints}
          listedPoints={listedPoints}
        />
      </Suspense>
      <div className="globe-veil" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <Header tone="dark" />

      <div className="map-tools">
        <Discover
          view={view}
          pick={pick}
          onSelect={setPick}
          onArea={goToArea}
          onOpen={closePick}
          onOpenChange={onDiscoverOpenChange}
        />
        <LayerControl
          value={layers}
          onChange={setLayers}
          onOpen={closePick}
          openSignal={layersSignal}
        />
      </div>

      <p className="globe-hint mono">
        ▲ {peakCount.toLocaleString("en-US")} recorded peaks ·{" "}
        {SUMMIT_PEAK_COUNT.toLocaleString("en-US")} listed summits ·{" "}
        {SUMMIT_LISTS.length} lists
        {stats.bagged ? ` · ${stats.bagged.toLocaleString("en-US")} bagged` : ""}
        <span className="hint-input hint-input--mouse"> · drag to spin, click a point</span>
        <span className="hint-input hint-input--touch"> · drag to spin, tap a point</span>
      </p>
      <p className="globe-credits mono">
        Mapped surroundings are OpenStreetMap, and coverage varies.
        <br />© OpenStreetMap contributors · OpenFreeMap · Terrain: Mapterhorn · Data:
        OSM, Recreation.gov (RIDB), USFS, NPS, BLM, Parks Canada, DOC · <button className="credit-link" onClick={() => navigate("/coverage")}>coverage</button>
      </p>

      <div className="globe-filters">
        <GlobeDock
          value={lens}
          onChange={changeLens}
          onLists={() => setListsOpen(true)}
          onMore={() => setLayersSignal((n) => n + 1)}
        />
      </div>

      {listsOpen ? (
        <ListLens
          onClose={() => setListsOpen(false)}
          onFocus={(list) => focusList(list.id)}
          onOpen={(id) => navigate(`/lists/${id}`)}
        />
      ) : null}

      {pick?.cat === "experience" && pick.slug ? (
        <ExperiencePickCard key={pick.slug} pick={pick} onClose={closePick} />
      ) : pick ? (
        <FeatureCard
          key={pick.slug ?? `${pick.lat}:${pick.lon}`}
          pick={pick}
          nearPlace={nearPlace}
          nearKm={nearKm}
          related={related}
          onRelated={setPick}
          onClose={closePick}
          onOpenPlace={(slug) => navigate(`/place/${slug}`)}
          onShowAround={showAround}
        />
      ) : null}
    </div>
  );
}
