import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { radiusZoom, readCamera, worldZoom } from "../map/camera";
import type { GlobeFocus } from "../map/Globe";
import { rankPlaces } from "../data/rank";
import { pickOfPlace, type Pick } from "../data/features";
import { ATLAS_CATALOG_ROWS } from "../lib/catalog";
import { relatedRows } from "../lib/discover";

const Globe = lazy(() => import("../map/Globe"));
import Header from "../components/Header";
import FilterChips from "../components/FilterChips";
import { homeScope, matches, type Filter } from "../lib/filters";
import LayerControl, {
  DEFAULT_LAYERS,
  type LayerState,
} from "../components/LayerControl";
import Discover from "../components/Discover";
import FeatureCard from "../components/FeatureCard";
import ExperiencePickCard from "../components/experiences/ExperiencePickCard";
import { PLACES, bySlug } from "../data/places";
import { guidePick, loadGuideCatalog } from "../lib/guide";
import { kmBetween } from "../lib/geo";
import { navigate } from "../lib/router";
import { useHome } from "../lib/locate";
import { rememberView } from "../lib/lastView";
import { dataDate, useCoverage, useManifest } from "../lib/live";

const WORLD = { lon: 12, lat: 22 };

type View = { lon: number; lat: number; zoom: number };

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  /* One pick for every point: a summit, a lake, a campsite or a car park. */
  const [pick, setPick] = useState<Pick | null>(() => {
    const slug = new URLSearchParams(window.location.search).get("place");
    const place = slug ? bySlug.get(slug) : undefined;
    return place ? pickOfPlace(place) : null;
  });
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  /* The map dock's trailing chip opens the Layers panel; a counter rather than a
     boolean so the chip can open it again after it was dismissed. */
  const [layersSignal, setLayersSignal] = useState(0);
  /* `?guide=<slug>` is the Experiences → Globe hand-off: open the map with the
     curated destination already selected, not just centred on its coordinate. */
  const guideSlug = useMemo(
    () => new URLSearchParams(window.location.search).get("guide"),
    [],
  );
  /* The settled camera. Discover's nearby lists follow it, but it is only read
     while the panel is open, so panning never recomputes a closed panel. */
  const [view, setView] = useState<View>(() => {
    const camera = readCamera();
    return {
      lon: camera.center[0],
      lat: camera.center[1],
      zoom: camera.zoom ?? worldZoom(window.innerWidth, window.innerHeight),
    };
  });
  const viewRef = useRef(view);
  const discoverOpen = useRef(false);

  useEffect(() => {
    if (!guideSlug) return;
    let alive = true;
    void loadGuideCatalog().then((rows) => {
      if (!alive) return;
      const row = rows.find((candidate) => candidate.slug === guideSlug);
      if (row) setPick(guidePick(row));
    });
    return () => {
      alive = false;
    };
  }, [guideSlug]);

  const home = useHome();
  const manifest = useManifest();
  const coverage = useCoverage();
  const updated = dataDate(manifest);
  const stale = Boolean(coverage?.gaps?.stale?.length);
  const scope = useMemo(() => homeScope(home), [home]);

  const places = useMemo(
    () => rankPlaces(PLACES.filter((p) => matches(p, filter, scope))),
    [filter, scope],
  );

  /* The nearest destination to a practical pin: baked into the record when the
     harvest recorded one, otherwise one pass over the atlas on the click. */
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
  }, [pick]);

  const nearKm =
    nearPlace && pick
      ? kmBetween(pick.lat, pick.lon, nearPlace.lat, nearPlace.lon)
      : null;

  /* Same-kind near neighbours from the bundled atlas: instant, no extra chunk
     on a map click. Tail relationships live in Discover, where the tail is
     already loaded. */
  const related = useMemo(
    () =>
      pick
        ? relatedRows(pick, ATLAS_CATALOG_ROWS, 3).map((item) => item.row.pick)
        : [],
    [pick],
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

  /* The filter bar grows and shrinks with the viewport (chips wrap on a narrow
     phone, the scope chip carries a place name), and every other piece of chrome
     has to sit above it. Instead of hard-coding a height per breakpoint, the bar
     and the tools are measured and published as two custom properties that the
     stylesheet reads: `--filters-h` for the bar itself and `--panel-max` for the
     space between the layers toggle and the bar. Both follow a rotation. */
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
    /* Chips arrive with the scope and the bar re-wraps as they do, so watch it
       for a few seconds as well as on every resize. */
    let frames = 0;
    let raf = window.requestAnimationFrame(function tick() {
      measure();
      if (++frames < 180) raf = window.requestAnimationFrame(tick);
    });
    const ro = new ResizeObserver(measure);
    for (const sel of [".globe-filters", ".globe-filters .chips", ".globe"]) {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.cancelAnimationFrame(raf);
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

  function changeFilter(next: Filter) {
    setFilter(next);
    setPick(null);
    if (next === "home" && home) {
      /* A radius scope is framed to its own radius, or the list would keep 120 km
         of places while the camera showed a continent. A scope named after a
         country keeps the regional view it always used. */
      const zoom = scope?.radiusKm
        ? radiusZoom(scope.radiusKm, home.lat, window.innerWidth, window.innerHeight)
        : 5.6;
      setFocus({ lon: home.lon, lat: home.lat, zoom, key: Date.now() });
      return;
    }
    setFocus({
      ...WORLD,
      zoom: worldZoom(window.innerWidth, window.innerHeight),
      key: Date.now(),
    });
  }

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
        />
      </Suspense>
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

      {/* One map, one count. Every point is a category; nothing here separates
          the atlas rows from the reach tail, because the map does not. */}
      <p className="globe-hint mono">
        {manifest.totals.all.toLocaleString("en-US")} places · {manifest.categories}{" "}
        categories · {manifest.countries.mapped} countries · updated {updated}
        <span className="hint-input hint-input--mouse"> · drag to spin, click a point</span>
        <span className="hint-input hint-input--touch"> · drag to spin, tap a point</span>
        {stale ? <span className="stale-badge"> · stale source</span> : null}
      </p>
      <p className="globe-credits mono">
        Coverage varies by region — OpenStreetMap is densest in Europe.
        <br />© OpenStreetMap contributors · OpenFreeMap · Terrain: Mapterhorn · Data:
        OSM, Recreation.gov (RIDB), USFS, NPS, BLM, Parks Canada, DOC · <button className="credit-link" onClick={() => navigate("/coverage")}>coverage</button>
      </p>

      <div className="globe-filters">
        <FilterChips
          value={filter}
          onChange={changeFilter}
          tone="dark"
          scope={scope}
          onMore={() => setLayersSignal((n) => n + 1)}
        />
      </div>

      {pick?.cat === "experience" && pick.slug ? (
        <ExperiencePickCard key={pick.slug} pick={pick} onClose={closePick} />
      ) : pick ? (
        <FeatureCard
          /* A new pick is a new sheet: the minimised state belongs to the card */
          key={pick.slug ?? `${pick.lat}:${pick.lon}`}
          pick={pick}
          nearPlace={nearPlace}
          nearKm={nearKm}
          related={related}
          onRelated={setPick}
          onClose={closePick}
          onOpenPlace={(slug) => navigate(`/place/${slug}`)}
        />
      ) : null}
    </div>
  );
}
