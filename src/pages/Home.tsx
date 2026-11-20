import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { worldZoom } from "../map/camera";
import type { GlobeFocus } from "../map/Globe";
import { rankPlaces } from "../data/rank";
import { pickOfPlace, type Pick } from "../data/features";

const Globe = lazy(() => import("../map/Globe"));
import Header from "../components/Header";
import FilterChips from "../components/FilterChips";
import { homeScope, matches, type Filter } from "../lib/filters";
import LayerControl, {
  DEFAULT_LAYERS,
  type LayerState,
} from "../components/LayerControl";
import MapSearch from "../components/MapSearch";
import FeatureCard from "../components/FeatureCard";
import { PLACES, bySlug } from "../data/places";
import { kmBetween } from "../lib/geo";
import { navigate } from "../lib/router";
import { useHome } from "../lib/locate";
import { dataDate, useCoverage, useManifest } from "../lib/live";

const WORLD = { lon: 12, lat: 22 };

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
      const toggle = document.querySelector(".layers-toggle");
      if (!bar) return;
      const barBox = bar.getBoundingClientRect();
      const filters = `${Math.round(barBox.height)}px`;
      if (root.getPropertyValue("--filters-h") !== filters) root.setProperty("--filters-h", filters);
      void toggle;
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
      setFocus({ lon: home.lon, lat: home.lat, zoom: 5.6, key: Date.now() });
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
          focus={focus}
          layers={layers}
        />
      </Suspense>
      <div className="vignette" aria-hidden="true" />

      <Header tone="dark" />

      <div className="map-tools">
        <MapSearch onPick={setPick} onOpen={() => setPick(null)} />
        <LayerControl value={layers} onChange={setLayers} onOpen={() => setPick(null)} />
      </div>

      {/* One map, one count. Every point is a category; nothing here separates
          the hand-written rows from the harvested ones, because the map does not. */}
      <p className="globe-hint mono">
        {manifest.totals.all.toLocaleString("en-US")} places · {manifest.categories}{" "}
        categories · {manifest.countries.mapped} countries · updated {updated} · drag
        to spin, click a point
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
        />
      </div>

      {pick && (
        <FeatureCard
          pick={pick}
          nearPlace={nearPlace}
          nearKm={nearKm}
          onClose={() => setPick(null)}
          onOpenPlace={(slug) => navigate(`/place/${slug}`)}
        />
      )}
    </div>
  );
}
