import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Discover from "../components/Discover";
import LogOutingDialog from "../components/LogOutingDialog";
import PlaceCard from "../components/PlaceCard";
import {
  ADVENTURES,
  KIND_META,
  KINDS,
  adventureById,
  kindCounts,
  type AdventureKind,
} from "../data/atlas";
import Icon from "../components/Icon";

const Globe = lazy(() => import("../components/MapGlobe"));

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    adventureById(params.get("place") ?? undefined)?.id ?? null,
  );
  const [kindFilter, setKindFilter] = useState<AdventureKind | "all">("all");
  const [logTargetId, setLogTargetId] = useState<string | null>(null);
  const counts = useMemo(() => kindCounts(), []);

  useEffect(() => {
    const paramId = params.get("place");
    if (paramId && adventureById(paramId)) setSelectedId(paramId);
  }, [params]);

  const selected = adventureById(selectedId ?? undefined);
  const logTarget = adventureById(logTargetId ?? undefined);

  function select(id: string) {
    setSelectedId(id);
    setParams({ place: id }, { replace: true });
  }

  function clear() {
    setSelectedId(null);
    setParams({}, { replace: true });
  }

  return (
    <section className={`home${selected ? " home--selected" : ""}`} aria-label="Terrane globe">
      <Suspense fallback={<div className="globe" aria-hidden="true" />}>
        <Globe selectedId={selectedId} kindFilter={kindFilter} onSelect={select} />
      </Suspense>
      <div className="globe-veil" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <header className="home-intro">
        <p className="eyebrow">
          <span>01</span> / Explore
        </p>
        <h1>
          Go where the <span className="display-italic">ground</span> rises.
        </h1>
        <p className="home-intro__copy">
          A discovery atlas for peaks, volcanoes, deserts, ice and coast — and a logbook
          for the ones you have stood on. Browse the globe, then log the outing.
        </p>
        <ul className="home-intro__facts mono">
          <li>
            <strong>{ADVENTURES.length}</strong> places
          </li>
          <li>
            <strong>7</strong> continents
          </li>
          <li>
            <strong>{KINDS.length}</strong> kinds of ground
          </li>
        </ul>
        <p className="home-intro__note mono">
          Discovery &amp; tracking · no routes, no live navigation
        </p>
      </header>

      <div className="map-tools">
        <Discover
          onSelect={select}
          kindFilter={kindFilter}
          onKindChange={setKindFilter}
        />

        {selected ? (
          <PlaceCard
            adventure={selected}
            onClose={clear}
            onLog={() => setLogTargetId(selected.id)}
          />
        ) : (
          <nav className="globe-rail" aria-label="Filter the globe by kind">
            <span className="globe-rail__label mono">Show</span>
            <button
              type="button"
              className={`globe-filter${kindFilter === "all" ? " globe-filter--active" : ""}`}
              aria-pressed={kindFilter === "all"}
              onClick={() => setKindFilter("all")}
            >
              <span className="globe-filter__icon">
                <Icon name="compass" size={15} />
              </span>
              <span className="globe-filter__name">Everything</span>
              <span className="globe-filter__count">{counts.all}</span>
            </button>
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`globe-filter${kindFilter === kind ? " globe-filter--active" : ""}`}
                aria-pressed={kindFilter === kind}
                onClick={() => setKindFilter(kindFilter === kind ? "all" : kind)}
              >
                <span className="globe-filter__icon" style={{ color: KIND_META[kind].color }}>
                  <Icon name={KIND_META[kind].icon} size={15} />
                </span>
                <span className="globe-filter__name">{KIND_META[kind].label}</span>
                <span className="globe-filter__count">{counts[kind]}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {!selected ? (
        <p className="globe-hint mono">
          Drag to orbit · select a marker to open it · ⌘K to search
        </p>
      ) : null}

      {logTarget ? (
        <LogOutingDialog adventure={logTarget} onClose={() => setLogTargetId(null)} />
      ) : null}
    </section>
  );
}
