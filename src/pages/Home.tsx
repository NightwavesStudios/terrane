import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { worldZoom } from "../map/camera";
import type { GlobeFocus, KitPick } from "../map/Globe";
import { iconDataUrl, type KitIcon } from "../map/campIcon";

/* MapLibre is by far the biggest thing this app ships (~1 MB), and it is only
   needed by the globe. Loading it through `lazy` lets the header, the filters
   and the caption paint immediately while the map library streams in behind
   them, instead of the whole screen waiting on one 1.4 MB chunk. */
const Globe = lazy(() => import("../map/Globe"));
import Header from "../components/Header";
import FilterChips, {
  homeScope,
  matches,
  type Filter,
} from "../components/FilterChips";
import LayerControl, {
  DEFAULT_LAYERS,
  type LayerState,
} from "../components/LayerControl";
import MapSearch from "../components/MapSearch";
import RidgeArt from "../components/RidgeArt";
import {
  COUNTRY_COUNT,
  DIFFICULTY_LABEL,
  PLACES,
  TYPE_LABEL,
  bySlug,
  kmApart,
} from "../data/places";
import { navigate } from "../lib/router";
import { useHome } from "../lib/locate";

const WORLD = { lon: 12, lat: 22 };

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("place"),
  );
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  /* A clicked camp, hut, tap or car park. Kept apart from `selected` (an atlas
     place) because they are different things: one has a page to read, the other
     is a pin on the ground. */
  const [kitPick, setKitPick] = useState<KitPick | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);

  /* Resolved after first paint, so the chip bar never waits on a network
     request: it is the same row of chips, plus one more if the lookup worked. */
  const home = useHome();
  const scope = useMemo(() => homeScope(home), [home]);

  const places = useMemo(
    () => PLACES.filter((p) => matches(p, filter, scope)),
    [filter, scope],
  );
  const place = selected ? bySlug.get(selected) : undefined;
  const nearPlace = kitPick?.near ? bySlug.get(kitPick.near) : undefined;
  const nearKm =
    nearPlace && kitPick
      ? kmApart(kitPick.lat, kitPick.lon, nearPlace.lat, nearPlace.lon)
      : null;

  /* Escape is the way out of every overlay here, so it has to work on a pin too. */
  useEffect(() => {
    if (!kitPick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKitPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kitPick]);

  function pickPlace(slug: string) {
    setKitPick(null);
    setSelected(slug);
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    setSelected(null);
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
    <div className="home">
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe
          places={places}
          selected={selected}
          onSelect={pickPlace}
          focus={focus}
          layers={layers}
          kitPick={kitPick}
          onPickKit={(pick) => {
            setKitPick(pick);
            if (pick) setSelected(null);
          }}
        />
      </Suspense>
      <div className="vignette" aria-hidden="true" />

      <Header tone="dark" />

      <div className="map-tools">
        <MapSearch onPick={(p) => pickPlace(p.slug)} />
        <LayerControl value={layers} onChange={setLayers} />
      </div>

      <p className="globe-hint mono">
        {PLACES.length.toLocaleString()} places · {COUNTRY_COUNT} countries ·
        drag to spin, click a point
      </p>
      <p className="globe-credits mono">
        © OpenStreetMap · OpenFreeMap · Terrain: Mapterhorn · Data: Wikidata
      </p>

      <div className="globe-filters">
        <FilterChips
          value={filter}
          onChange={changeFilter}
          tone="dark"
          scope={scope}
        />
      </div>

      {kitPick && !place && (
        <aside className="pick pick--kit" aria-live="polite">
          <button
            className="pick-close"
            onClick={() => setKitPick(null)}
            aria-label="Close pin card"
          >
            ×
          </button>
          <div className="pick-art pick-art--kit">
            <img src={iconDataUrl(kitPick.icon as KitIcon, 120)} alt="" width={74} height={74} />
          </div>
          <div className="pick-body">
            <p className="mono pick-eyebrow">
              {kitPick.label}
              {nearPlace ? ` · near ${nearPlace.name}` : ""}
            </p>
            <h2>{kitPick.name || `Unnamed ${kitPick.label.toLowerCase()}`}</h2>
            <p className="mono pick-meta">
              {nearKm !== null ? `${nearKm < 10 ? nearKm.toFixed(1) : Math.round(nearKm)} km from ${nearPlace?.name}` : ""}
            </p>
            <div className="pick-actions">
              {nearPlace && (
                <button
                  className="btn btn-light"
                  onClick={() => navigate(`/place/${nearPlace.slug}`)}
                >
                  Read about {nearPlace.name} →
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {place && (
        <aside className="pick" aria-live="polite">
          <button
            className="pick-close"
            onClick={() => setSelected(null)}
            aria-label="Close place card"
          >
            ×
          </button>
          <div className="pick-art">
            <RidgeArt hue={place.hue} className="pick-art-svg" />
          </div>
          <div className="pick-body">
            <p className="mono pick-eyebrow">
              {TYPE_LABEL[place.type]} · {place.region ?? place.country}
            </p>
            <h2>{place.name}</h2>
            <p className="mono pick-meta">
              {place.elevation ? `${place.elevation.toLocaleString()} m` : ""}
              {place.elevation && place.difficulty ? " · " : ""}
              {place.difficulty ? DIFFICULTY_LABEL[place.difficulty] : ""}
            </p>
            <div className="pick-actions">
              <button
                className="btn btn-light"
                onClick={() => navigate(`/place/${place.slug}`)}
              >
                View place →
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
