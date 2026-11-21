import { useEffect } from "react";
import Header from "../components/Header";
import { category } from "../data/features";
import { guideKind } from "../data/guide";
import { bySlug } from "../data/places";
import { setMeta } from "../lib/meta";
import { placeLine } from "../lib/present";
import { navigate } from "../lib/router";
import { toggleSaved, useSaved } from "../lib/saved";
import { toggleSavedGuide, useSavedGuides } from "../lib/savedGuides";

/**
 * Everything saved in this browser, in two lists.
 *
 * Places and Experiences are separate versioned keys with separate shapes, so
 * neither has to migrate the other. Collections are deliberately absent: they
 * are thematic groups, not personal destinations. The page is still one page:
 * a place and a featured destination are the same kind of intention.
 */
export default function Saved() {
  const places = useSaved();
  const experiences = useSavedGuides();
  const total = places.length + experiences.length;

  useEffect(() => {
    setMeta({
      title: "Saved — Terrane",
      description: "The places and experiences you have saved in this browser.",
      path: "/saved",
    });
  }, []);

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head saved-head">
        <p className="eyebrow">Saved</p>
        <h1 className="page-title">
          {total
            ? [
                `${places.length} place${places.length === 1 ? "" : "s"}`,
                `${experiences.length} experience${experiences.length === 1 ? "" : "s"}`,
              ].join(" · ")
            : "Nothing saved yet"}
        </h1>
        <p className="page-sub">
          Saves live in this browser only. There is no account, and nothing is
          uploaded.
        </p>
      </div>

      <div className="saved">
        {total === 0 ? (
          <div className="saved-empty">
            <p>
              Open a place or a curated Experience and press Save. It will appear
              here.
            </p>
            <div className="saved-empty-actions">
              <button className="btn btn-dark" onClick={() => navigate("/")}>
                Find a place →
              </button>
              <button className="btn btn-dark" onClick={() => navigate("/experiences")}>
                Browse Experiences →
              </button>
            </div>
          </div>
        ) : null}

        {places.length > 0 ? (
          <section className="saved-block" aria-label="Saved places">
            <h2 className="mono saved-block-title">Places</h2>
            <ol className="saved-list">
              {places.map((item) => {
                const place = bySlug.get(item.slug);
                const where = place
                  ? placeLine(place.region, place.country)
                  : placeLine(item.region, item.country);
                return (
                  <li key={item.slug} className="saved-row">
                    <button
                      className="saved-main"
                      onClick={() => navigate(`/place/${item.slug}`)}
                    >
                      <span className="saved-name">{item.name}</span>
                      <span className="mono saved-meta">
                        {category(item.cat).one}
                        {where ? ` · ${where}` : ""}
                      </span>
                    </button>
                    <span className="mono saved-date">
                      {new Date(item.at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <button
                      className="saved-globe mono"
                      onClick={() => navigate(`/?place=${item.slug}`)}
                    >
                      Globe
                    </button>
                    <button
                      className="saved-remove mono"
                      onClick={() => toggleSaved(item)}
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {experiences.length > 0 ? (
          <section className="saved-block" aria-label="Saved Experiences">
            <h2 className="mono saved-block-title">Experiences</h2>
            <ol className="saved-list">
              {experiences.map((item) => (
                <li key={item.slug} className="saved-row saved-row--exp">
                  <button
                    className="saved-main"
                    onClick={() => navigate(`/experiences/${item.slug}`)}
                  >
                    <span className="saved-name">{item.name}</span>
                    <span className="mono saved-meta">
                      {[guideKind(item.kind).one, placeLine(item.region, item.country)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <span className="mono saved-date">
                    {new Date(item.at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <button
                    className="saved-remove mono"
                    onClick={() => toggleSavedGuide(item)}
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          SAVES ARE LOCAL TO THIS BROWSER · MAP © OPENSTREETMAP · DATA: WIKIDATA
        </span>
      </footer>
    </div>
  );
}
