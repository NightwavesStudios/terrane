import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { worldZoom } from "../map/camera";
import type { GlobeFocus, KitPick, ReachPick } from "../map/Globe";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import REACH_META from "../data/reach-meta.json";
import POI_STATS from "../data/poi-stats.json";
import { rankPlaces } from "../data/rank";

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

/* The same four colours the dots use on the map: rock, water, green, sand. A
   card that showed a different hue than the dot you clicked would undo the one
   thing the dot was doing. */
const REACH_COLOUR = ["#8ab4d8", "#5fc9d4", "#79cf9b", "#d9bd85"];
function reachColour(kind: number) {
  if ([3, 4, 8, 13].includes(kind)) return REACH_COLOUR[1];
  if ([5, 6, 11, 14].includes(kind)) return REACH_COLOUR[2];
  if ([7, 12].includes(kind)) return REACH_COLOUR[3];
  return REACH_COLOUR[0];
}

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
  /* A dot from the long tail: a peak, lake, park or coast with no page yet. */
  const [reachPick, setReachPick] = useState<ReachPick | null>(null);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);

  /* Resolved after first paint, so the chip bar never waits on a network
     request: it is the same row of chips, plus one more if the lookup worked. */
  const home = useHome();
  const scope = useMemo(() => homeScope(home), [home]);

  /* Written-up and generated places go to the map as one set, ranked by how major
     they are rather than by which file they came from: the first label pass is two
     names per country, so a country's written entries no longer out-vote a summit
     that was only ever an atlas row. */
  const places = useMemo(
    () => rankPlaces(PLACES.filter((p) => matches(p, filter, scope))),
    [filter, scope],
  );
  const place = selected ? bySlug.get(selected) : undefined;
  const pinned = kitPick ?? reachPick;
  const nearSlugOf = kitPick?.near ?? reachPick?.near;
  /* A pinned POI from the world set has no nearest place baked in — it was not
     harvested around one. One pass over the 1,288 written-up places on a click is
     cheaper than shipping 20,000 indices. */
  const nearPlace = (() => {
    if (nearSlugOf) return bySlug.get(nearSlugOf);
    if (!pinned) return undefined;
    let best: (typeof PLACES)[number] | undefined;
    let bestKm = Infinity;
    for (const p of PLACES) {
      const km = kmApart(pinned.lat, pinned.lon, p.lat, p.lon);
      if (km < bestKm) {
        bestKm = km;
        best = p;
      }
    }
    return bestKm <= 60 ? best : undefined;
  })();
  const nearKm =
    nearPlace && pinned
      ? kmApart(pinned.lat, pinned.lon, nearPlace.lat, nearPlace.lon)
      : null;
  /* The mapped facts behind a world POI (fee, capacity, what is there) arrive
     with the picking code in `src/map/Globe.tsx`. Read through the optional shape
     so the card builds either way, and stay silent when a pin has none. */
  const kitNote = (kitPick as (KitPick & { note?: string }) | null)?.note;

  /* Escape is the way out of every overlay here, so it has to work on a pin too. */
  useEffect(() => {
    if (!kitPick && !reachPick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setKitPick(null);
      setReachPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kitPick, reachPick]);

  function pickPlace(slug: string) {
    setKitPick(null);
    setReachPick(null);
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
            if (pick) {
              setReachPick(null);
              setSelected(null);
            }
          }}
          reachPick={reachPick}
          onPickReach={(pick) => {
            setReachPick(pick);
            if (pick) {
              setKitPick(null);
              setSelected(null);
            }
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
        {PLACES.length.toLocaleString()} written up · {(REACH_META.famous + REACH_META.more).toLocaleString()} more as you zoom · {COUNTRY_COUNT} countries ·
        drag to spin, click a point
      </p>
      {/* What the harvest found, above the licences: the number is read from the
          coverage report (`npm run poi:stats`), never typed, so it cannot drift
          away from the cells the map is actually serving. */}
      <p className="globe-credits mono">
        {POI_STATS.total.toLocaleString("en-US")} outdoor places · {POI_STATS.files.toLocaleString("en-US")} files ·
        {" "}
        {POI_STATS.extracts} country extracts
        <br />
        © OpenStreetMap contributors · OpenFreeMap · Terrain: Mapterhorn · Data: Wikidata
      </p>

      <div className="globe-filters">
        <FilterChips
          value={filter}
          onChange={changeFilter}
          tone="dark"
          scope={scope}
        />
      </div>

      {reachPick && !place && (
        <aside className="pick pick--reach" aria-live="polite">
          <button
            className="pick-close"
            onClick={() => setReachPick(null)}
            aria-label="Close place card"
          >
            ×
          </button>
          <div className="pick-art pick-art--reach">
            <span
              className="pick-reach-dot"
              style={{ background: reachColour(reachPick.kind) }}
            />
          </div>
          <div className="pick-body">
            <p className="mono pick-eyebrow">
              {reachPick.label}
              {nearPlace && nearKm !== null && nearKm < 15 ? ` · near ${nearPlace.name}` : ""}
            </p>
            <h2>{reachPick.name}</h2>
            <p className="mono pick-meta">
              {nearKm !== null
                ? `${nearKm < 10 ? nearKm.toFixed(1) : Math.round(nearKm)} km from ${nearPlace?.name}`
                : "No written-up place within 60 km"}
            </p>
            <div className="pick-actions">
              {nearPlace && (
                <button
                  className="btn btn-light"
                  onClick={() => navigate(`/place/${nearPlace.slug}`)}
                >
                  {nearKm !== null && nearKm < 15
                    ? `Read about ${nearPlace.name}`
                    : `Nearest place: ${nearPlace.name}`}{" "}
                  →
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

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
              {nearPlace && nearKm !== null && nearKm < 15
                ? ` · near ${nearPlace.name}`
                : ""}
            </p>
            <h2>{kitPick.name || `Unnamed ${kitPick.label.toLowerCase()}`}</h2>
            {kitNote ? <p className="mono pick-meta">{kitNote}</p> : null}
            <p className="mono pick-meta">
              {nearKm !== null ? `${nearKm < 10 ? nearKm.toFixed(1) : Math.round(nearKm)} km from ${nearPlace?.name}` : ""}
            </p>
            <div className="pick-actions">
              {nearPlace && (
                <button
                  className="btn btn-light"
                  onClick={() => navigate(`/place/${nearPlace.slug}`)}
                >
                  {nearKm !== null && nearKm < 15
                    ? `Read about ${nearPlace.name}`
                    : `Nearest place: ${nearPlace.name}`}{" "}
                  →
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
