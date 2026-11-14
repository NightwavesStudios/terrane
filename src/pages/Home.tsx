import { useMemo, useState } from "react";
import Globe, { worldZoom, type GlobeFocus } from "../map/Globe";
import Header from "../components/Header";
import FilterChips, { matches, type Filter } from "../components/FilterChips";
import LayerControl, {
  DEFAULT_LAYERS,
  type LayerState,
} from "../components/LayerControl";
import MapSearch from "../components/MapSearch";
import RidgeArt from "../components/RidgeArt";
import SaveButton from "../components/SaveButton";
import {
  COUNTRY_COUNT,
  DIFFICULTY_LABEL,
  PLACES,
  TYPE_LABEL,
  bySlug,
} from "../data/places";
import { navigate } from "../lib/router";

const WORLD = { lon: 12, lat: 22 };

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("place"),
  );
  const [focus, setFocus] = useState<GlobeFocus | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);

  const places = useMemo(() => PLACES.filter((p) => matches(p, filter)), [filter]);
  const place = selected ? bySlug.get(selected) : undefined;

  function changeFilter(next: Filter) {
    setFilter(next);
    setSelected(null);
    setFocus(
      next === "georgia"
        ? { lon: -83.55, lat: 32.9, zoom: 5.2, key: Date.now() }
        : {
            ...WORLD,
            zoom: worldZoom(window.innerWidth, window.innerHeight),
            key: Date.now(),
          },
    );
  }

  return (
    <div className="home">
      <Globe
        places={places}
        selected={selected}
        onSelect={setSelected}
        focus={focus}
        layers={layers}
      />
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
        © OpenStreetMap · OpenFreeMap · Terrain: AWS · Data: Wikidata
      </p>

      <div className="globe-filters">
        <FilterChips value={filter} onChange={changeFilter} tone="dark" />
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
              <SaveButton slug={place.slug} compact />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
