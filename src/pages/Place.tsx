import { useEffect } from "react";
import Header from "../components/Header";
import RidgeArt from "../components/RidgeArt";
import SaveButton from "../components/SaveButton";
import { TYPE_LABEL, aroundPlace, bySlug } from "../data/places";
import { navigate } from "../lib/router";

export default function Place({ slug }: { slug: string }) {
  const place = bySlug.get(slug);

  useEffect(() => {
    document.title = place ? `${place.name} — Terrane` : "Place not found — Terrane";
  }, [place]);

  if (!place) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <h1 className="page-title">That place isn’t here.</h1>
          <p className="page-sub">It may have moved, or never existed.</p>
          <button className="btn btn-dark" onClick={() => navigate("/explore")}>
            Back to the index →
          </button>
        </div>
      </div>
    );
  }

  const around = aroundPlace(place);

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button className="back" onClick={() => navigate("/explore")}>
          ← All places
        </button>

        <div className="place-hero">
          <RidgeArt hue={place.hue} className="place-hero-art" />
          <div className="place-hero-text">
            <p className="eyebrow">
              {TYPE_LABEL[place.type]}
              {place.region ? ` · ${place.region}` : ""} · {place.country}
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
                  {Math.abs(place.lat).toFixed(2)}°{place.lat >= 0 ? "N" : "S"}{" "}
                  {Math.abs(place.lon).toFixed(2)}°{place.lon >= 0 ? "E" : "W"}
                </span>
              </div>
            </div>

            <section className="around">
              <div className="around-head">
                <h2>Around it</h2>
                <span className="mono around-note">
                  {around.nearest.length > 0
                    ? `${around.activities.reduce((n, a) => n + a.count, 0)} atlas entries within ${around.radiusKm} km`
                    : `nothing else within ${around.radiusKm} km`}
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

              {around.nearest.length > 0 && (
                <ol className="around-list">
                  {around.nearest.map(({ place: p, km }) => (
                    <li key={p.slug}>
                      <button
                        className="around-row"
                        onClick={() => navigate(`/place/${p.slug}`)}
                      >
                        <span className="around-name">{p.name}</span>
                        <span className="around-type mono">{TYPE_LABEL[p.type]}</span>
                        <span className="around-km mono">
                          {km < 10 ? km.toFixed(1) : Math.round(km)} km
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <p className="around-foot">
                Straight-line distance over the atlas, not a route database: peaks stand
                in for hiking terrain, so treat this as what is near, not as a trail list.
              </p>
            </section>
          </div>

          <aside className="place-aside">
            <div className="aside-card">
              <p className="mono k">Save this place</p>
              <SaveButton slug={place.slug} />
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
          MAP © OPENSTREETMAP · OPENFREEMAP · TERRAIN: MAPTERHORN · DATA: WIKIDATA
        </span>
      </footer>
    </div>
  );
}
