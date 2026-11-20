import { useEffect } from "react";
import Header from "../components/Header";
import { category } from "../data/features";
import { bySlug } from "../data/places";
import { setMeta } from "../lib/meta";
import { placeLine } from "../lib/present";
import { navigate } from "../lib/router";
import { toggleSaved, useSaved } from "../lib/saved";

export default function Saved() {
  const saved = useSaved();

  useEffect(() => {
    setMeta({
      title: "Saved — Terrane",
      description: "The destinations you have saved in this browser.",
      path: "/saved",
    });
  }, []);

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head saved-head">
        <p className="eyebrow">Saved</p>
        <h1 className="page-title">
          {saved.length
            ? `${saved.length} place${saved.length === 1 ? "" : "s"}`
            : "Nothing saved yet"}
        </h1>
        <p className="page-sub">
          Saved places live in this browser only. There is no account, and nothing
          is uploaded.
        </p>
      </div>

      <div className="saved">
        {saved.length === 0 ? (
          <div className="saved-empty">
            <p>Open a destination and press Save. It will appear here.</p>
            <button className="btn btn-dark" onClick={() => navigate("/")}>
              Find a place →
            </button>
          </div>
        ) : (
          <ol className="saved-list">
            {saved.map((item) => {
              const place = bySlug.get(item.slug);
              return (
                <li key={item.slug} className="saved-row">
                  <button
                    className="saved-main"
                    onClick={() => navigate(`/place/${item.slug}`)}
                  >
                    <span className="saved-name">{item.name}</span>
                    <span className="mono saved-meta">
                      {category(item.cat).one}
                      {place
                        ? ` · ${placeLine(place.region, place.country)}`
                        : " · no longer in the atlas"}
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
        )}
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
