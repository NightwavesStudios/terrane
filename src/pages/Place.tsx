import { useEffect } from "react";
import Header from "../components/Header";
import PlaceCard from "../components/PlaceCard";
import RidgeArt from "../components/RidgeArt";
import SaveButton from "../components/SaveButton";
import { TYPE_LABEL, bySlug, nearbyFor } from "../data/places";
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

  const nearby = nearbyFor(place);

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button className="back" onClick={() => navigate("/explore")}>
          ← Index
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

            <section className="nearby">
              <h2>Nearby</h2>
              <div className="grid grid--small">
                {nearby.map((p) => (
                  <PlaceCard key={p.slug} place={p} />
                ))}
              </div>
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
          MAP © OPENSTREETMAP · OPENFREEMAP · TERRAIN: AWS · DATA: WIKIDATA
        </span>
      </footer>
    </div>
  );
}
