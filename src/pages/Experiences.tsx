import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import GuideCard from "../components/guide/GuideCard";
import CatalogControls, {
  type CatalogNear,
} from "../components/catalog/CatalogControls";
import StateNotice from "../components/StateNotice";
import { GUIDE_KINDS, type GuideKindId } from "../data/guide";
import { filterGuides, useGuideCatalog } from "../lib/guide";
import { setMeta } from "../lib/meta";

/**
 * The curated Experiences catalogue.
 *
 * These are the destinations Terrane has chosen to feature: a few hundred of the
 * most significant peaks, parks, falls, lakes and coastlines in the destination
 * database, each with its own editorial page. The full database remains on
 * Discover. Collections are elsewhere, and gather Experiences at wide scope.
 *
 * The search field, the nearby-place combobox and the kind row are the shared
 * catalogue controls, so this page and Collections cannot drift apart.
 */
export default function Experiences() {
  const catalog = useGuideCatalog();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<GuideKindId | null>(null);
  const [nearTerm, setNearTerm] = useState("");
  const [near, setNear] = useState<CatalogNear | null>(null);

  useEffect(() => {
    setMeta({
      title: "Experiences — Terrane",
      description:
        "A curated catalogue of the world's most significant outdoor destinations: parks, peaks, waterfalls, lakes and coastlines, each with an editorial page grounded in recorded geography.",
      path: "/experiences",
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(term), 150);
    return () => window.clearTimeout(id);
  }, [term]);

  const rows = useMemo(
    () => filterGuides(catalog.rows, { query, kind: activeKind, near }),
    [catalog.rows, query, activeKind, near],
  );

  const searching = query.trim().length > 0;

  const resetAll = () => {
    setTerm("");
    setQuery("");
    setActiveKind(null);
    setNearTerm("");
    setNear(null);
  };

  const kindLabel = activeKind
    ? GUIDE_KINDS.find((kind) => kind.id === activeKind)?.label
    : null;

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head exp-head guide-head">
        <p className="eyebrow">Experiences</p>
        <h1 className="page-title">The places worth the journey</h1>
        <p className="page-sub">
          A curated catalogue of significant outdoor destinations — not every
          mountain, lake or waterfall on the map. Each Experience is one real
          place, chosen for its scale, recorded features or protected status, and
          given a page built from its own geography. Discover remains the full
          database; Collections gather these Experiences by country, great range,
          area or recorded long-distance trail.
        </p>
      </div>

      <div className="exp-controls">
        <CatalogControls
          searchLabel="Search Experiences"
          searchPlaceholder="Search an Experience, country or nearby place…"
          term={term}
          onTerm={setTerm}
          nearPlaceholder="Near a place — town, park or peak…"
          nearTerm={nearTerm}
          onNearTerm={setNearTerm}
          near={near}
          onNear={setNear}
          chipsLabel="Filter Experiences by kind"
          chips={GUIDE_KINDS.map((kind) => ({
            id: kind.id,
            label: kind.label,
            title: kind.blurb,
          }))}
          activeChip={activeKind}
          onChip={(id) => setActiveKind(id as GuideKindId | null)}
          onReset={resetAll}
        />
      </div>

      <div className="exp-results">
        {catalog.status === "loading" ? (
          <StateNotice
            kind="loading"
            title="Loading the curated catalogue"
            rows={3}
          />
        ) : catalog.status === "error" ? (
          <StateNotice
            kind="error"
            title="The Experience index could not be loaded"
            body="Discover and its places are unaffected; this list is the only surface that needs it."
            action={{ label: "Back to Discover →", onClick: () => resetAll() }}
          />
        ) : rows.length === 0 ? (
          <StateNotice
            kind="empty"
            title={
              searching
                ? `Nothing matches “${query.trim()}”.`
                : "No Experiences match these filters."
            }
            body={
              searching
                ? "Try a country, a range or the name of a nearby place."
                : "Widen the kind or the distance, or clear everything."
            }
            action={{ label: "All Experiences →", onClick: resetAll }}
          />
        ) : (
          <>
            <p className="mono exp-count" role="status">
              {rows.length.toLocaleString()} Experience
              {rows.length === 1 ? "" : "s"}
              {kindLabel ? ` · ${kindLabel}` : ""}
              {near ? ` · within 250 km of ${near.label}` : ""}
              {searching ? ` · matching “${query.trim()}”` : ""}
              {catalog.generated ? ` · data ${catalog.generated}` : ""}
            </p>
            <div className="exp-grid">
              {rows.map((row) => (
                <GuideCard key={row.slug} row={row} near={near} />
              ))}
            </div>
            <p className="mono exp-note exp-note--foot">
              {catalog.rows.length.toLocaleString()} curated destinations selected
              from the full catalogue. Every page links its Wikipedia source and
              includes only recorded features; access, closures and seasonal
              conditions are not verified.
            </p>
          </>
        )}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          EXPERIENCES ARE CURATED DESTINATIONS, NOT ITINERARIES · MAP ©
          OPENSTREETMAP · DATA: WIKIDATA · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
