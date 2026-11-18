import { lazy, Suspense, useMemo, useState } from "react";
import { worldZoom } from "../map/camera";
import type { GlobeFocus } from "../map/Globe";

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
          onSelect={setSelected}
          focus={focus}
          layers={layers}
        />
      </Suspense>
      <div className="vignette" aria-hidden="true" />

      <Header tone="dark" />

      <div className="map-tools">
        <MapSearch onPick={(p) => setSelected(p.slug)} />
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
