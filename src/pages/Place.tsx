import { useEffect } from "react";
import Header from "../components/Header";
import RidgeArt from "../components/RidgeArt";
import { TYPE_LABEL, aroundPlace, bySlug } from "../data/places";
import { category, SOURCE_LABEL } from "../data/features";
import TRAIL_LINKS from "../data/trail-links.json";
import { startCatalog, useCatalog, type CatalogRow } from "../lib/catalog";
import { relatedPlaces } from "../lib/discover";
import { coordinates, formatKm, placeLine } from "../lib/present";
import { focusZoomFor } from "../map/camera";
import { setMeta } from "../lib/meta";
import { navigate } from "../lib/router";

export default function Place({ slug }: { slug: string }) {
  const place = bySlug.get(slug);
  const catalog = useCatalog();

  /* The relationships come from the same lazy catalog Discover uses, so the
     page gains the long tail after the first paint instead of being frozen to
     the atlas's nearest six rows. */
  useEffect(() => {
    startCatalog();
  }, []);

  useEffect(() => {
    if (!place) {
      setMeta({
        title: "Place not found — Terrane",
        description: "That place isn’t on the globe.",
        path: `/place/${slug}`,
      });
      return;
    }
    const kind = TYPE_LABEL[place.type].toLowerCase();
    const where = placeLine(place.region, place.country);
    const height = place.elevation ? `, ${place.elevation.toLocaleString()} m high` : "";
    setMeta({
      title: `${place.name} — Terrane`,
      description: `${place.name} is a ${kind} in ${where}${height}. Coordinates, elevation and the places within 30 km of it.`,
      path: `/place/${place.slug}`,
      type: "article",
    });
  }, [place, slug]);

  if (!place) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <h1 className="page-title">That place isn’t here.</h1>
          <p className="page-sub">It may have moved, or never existed.</p>
          <button className="btn btn-dark" onClick={() => navigate("/")}>
            Back to the globe →
          </button>
        </div>
      </div>
    );
  }

  const around = aroundPlace(place);
  const base = catalog.rows.find((row) => row.pick.slug === place.slug);
  const relations = base ? relatedPlaces(base, catalog.rows, 6) : null;
  const seen = new Set<string>();
  const unique = (items: { row: CatalogRow; km: number }[] = []) =>
    items.filter(({ row }) => {
      if (seen.has(row.key)) return false;
      seen.add(row.key);
      return true;
    });
  const nearby = unique(relations?.nearby);
  const sameKind = unique(relations?.sameKind);
  const sameArea = unique(relations?.sameArea);
  const lesser = unique(relations?.lesser);
  const trails = (TRAIL_LINKS as { items: Record<string, { name: string; km: number; src: string; difficulty: string }[]> })
    .items[place.slug] ?? [];

  const openRow = (row: CatalogRow) => {
    if (row.pick.slug) navigate(`/place/${row.pick.slug}`);
    else navigate(`/?at=${row.lat.toFixed(3)},${row.lon.toFixed(3)},${focusZoomFor(row.cat)}`);
  };
  const relationList = (items: { row: CatalogRow; km: number }[]) => (
    <ol className="around-list">
      {items.map(({ row, km }) => (
        <li key={row.key}>
          <button className="around-row" onClick={() => openRow(row)}>
            <span className="around-name">{row.name}</span>
            <span className="around-type mono">{category(row.cat).one}</span>
            <span className="around-km mono">{formatKm(km)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
  const kindLabel = base ? category(base.cat).label.toLowerCase() : "";

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button className="back" onClick={() => navigate("/")}>
          ← Globe
        </button>

        <div className="place-hero">
          <RidgeArt hue={place.hue} className="place-hero-art" />
          <div className="place-hero-text">
            <p className="eyebrow">
              {TYPE_LABEL[place.type]}
              {placeLine(place.region, place.country)
                ? ` · ${placeLine(place.region, place.country)}`
                : ""}
            </p>
            <h1 className="place-title">{place.name}</h1>
            {place.elevation ? (
              <p className="place-tagline">{place.elevation.toLocaleString()} m</p>
            ) : null}
          </div>
        </div>

        <div className="place-main">
          <div className="place-body">
            <div className="stat-grid">
              <div className="stat">
                <span className="mono k">Type</span>
                <span className="v">{TYPE_LABEL[place.type]}</span>
              </div>
              <div className="stat">
                <span className="mono k">High point</span>
                <span className="v">
                  {place.elevation ? `${place.elevation.toLocaleString()} m` : "—"}
                </span>
              </div>
              <div className="stat">
                <span className="mono k">Country</span>
                <span className="v">{place.country}</span>
              </div>
              <div className="stat">
                <span className="mono k">Coordinates</span>
                <span className="v coord-v">
                  {coordinates(place.lat, place.lon)}
                </span>
              </div>
            </div>

            <section className="around">
              <div className="around-head">
                <h2>Around it</h2>
                <span className="mono around-note">
                  {nearby.length > 0
                    ? `within ${around.radiusKm} km`
                    : `nothing within ${around.radiusKm} km`}
                </span>
              </div>

              {around.activities.length > 0 && (
                <ul className="around-acts">
                  {around.activities.map((a) => (
                    <li key={a.type}>
                      <span className="n">{a.count}</span>
                      <span className="l">{a.label}</span>
                    </li>
                  ))}
                </ul>
              )}

              {nearby.length > 0 && (
                <>
                  <p className="mono around-sub">Closest destinations</p>
                  {relationList(nearby)}
                </>
              )}
            </section>

            {sameKind.length > 0 ? (
              <section className="around">
                <div className="around-head">
                  <h2>More {kindLabel} nearby</h2>
                  <span className="mono around-note">within 300 km</span>
                </div>
                {relationList(sameKind)}
              </section>
            ) : null}

            {lesser.length > 0 ? (
              <section className="around">
                <div className="around-head">
                  <h2>Lesser known nearby</h2>
                  <span className="mono around-note">tier 3–4 · within 50 km</span>
                </div>
                {relationList(lesser)}
              </section>
            ) : null}

            {relations?.areaLabel && sameArea.length > 0 ? (
              <section className="around">
                <div className="around-head">
                  <h2>Elsewhere in {relations.areaLabel}</h2>
                  <span className="mono around-note">nearest first</span>
                </div>
                {relationList(sameArea)}
              </section>
            ) : null}

            {trails.length > 0 ? (
              <section className="around trails-here">
                <div className="around-head">
                  <h2>Trails here</h2>
                  <span className="mono around-note">within {TRAIL_LINKS.radiusKm} km</span>
                </div>
                <ol className="around-list">
                  {trails.map((trail) => (
                    <li key={`${trail.name}-${trail.km}`}>
                      <div className="around-row around-row--static">
                        <span className="around-name">{trail.name}</span>
                        <span className="around-type mono">
                          {[trail.difficulty, SOURCE_LABEL[trail.src] ?? trail.src]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="around-km mono">{formatKm(trail.km)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <aside className="place-aside">
            <div className="aside-card">
              <button
                className="btn btn-dark btn-full"
                onClick={() => navigate(`/?place=${place.slug}`)}
              >
                See it on the globe →
              </button>
            </div>
          </aside>
        </div>
      </article>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          MAP © OPENSTREETMAP · OPENFREEMAP · TERRAIN: MAPTERHORN · DATA: WIKIDATA · OSM ODbL
          · US FEDERAL · PARKS CANADA · DOC NZ
        </span>
      </footer>
    </div>
  );
}
