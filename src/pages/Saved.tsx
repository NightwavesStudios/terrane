import Header from "../components/Header";
import PlaceCard from "../components/PlaceCard";
import { bySlug, type Place } from "../data/places";
import {
  removeCollection,
  useCollections,
} from "../lib/saved";
import { navigate } from "../lib/router";

export default function Saved() {
  const collections = useCollections();
  const total = new Set(collections.flatMap((c) => c.slugs)).size;

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head">
        <p className="eyebrow eyebrow--light">Saved</p>
        <h1 className="page-title">Your shortlist.</h1>
        <p className="page-sub">
          {total === 0
            ? "Nothing saved yet. Tap the star on any place and it lands here."
            : `${total} ${total === 1 ? "place" : "places"} across ${collections.length} ${
                collections.length === 1 ? "collection" : "collections"
              }.`}
        </p>
      </div>

      <div className="page-body">
        {total === 0 && (
          <div className="empty-block">
            <p className="empty">Your collections are empty.</p>
            <button className="btn btn-dark" onClick={() => navigate("/explore")}>
              Find something worth the detour →
            </button>
          </div>
        )}

        {collections.map((c) => {
          const places = c.slugs
            .map((s) => bySlug.get(s))
            .filter((p): p is Place => Boolean(p));
          return (
            <section className="collection" key={c.id}>
              <div className="collection-head">
                <h2>
                  {c.name} <span className="mono">{places.length}</span>
                </h2>
                {collections.length > 1 && (
                  <button
                    className="link-btn"
                    onClick={() => removeCollection(c.id)}
                    aria-label={`Delete collection ${c.name}`}
                  >
                    Delete collection
                  </button>
                )}
              </div>
              {places.length === 0 ? (
                <p className="empty">Empty — save a place into it from any field guide.</p>
              ) : (
                <div className="grid">
                  {places.map((p, i) => (
                    <PlaceCard key={p.slug} place={p} index={i} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="foot">
        <span>Saved locally in this browser.</span>
        <span className="mono">TERRANE · THE WORLD, WORTH THE DETOUR</span>
      </footer>
    </div>
  );
}
