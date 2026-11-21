import { Suspense, lazy, useEffect, useState } from "react";
import Header from "../components/Header";
import GuideCard from "../components/guide/GuideCard";
import PlaceFacts, { type Fact } from "../components/place/PlaceFacts";
import PlaceSection from "../components/place/PlaceSection";
import RidgeArt from "../components/RidgeArt";
import { collectionScope } from "../data/collections";
import {
  nearbyCollections,
  useCollection,
  useCollectionCatalog,
} from "../lib/collections";
import { setMeta } from "../lib/meta";
import { thumbAt } from "../lib/placeDetails";
import { coordinates, formatKm } from "../lib/present";
import { navigate } from "../lib/router";

const CollectionMap = lazy(
  () => import("../components/collections/CollectionMap"),
);

/**
 * One wide Collection.
 *
 * The record is one lazy shard: title, prose, member Experiences, photos and
 * geography. The map is a second lazy chunk, so the page paints without
 * MapLibre. There are no practical POIs here: a country or a great range is too
 * large for a useful single-cell POI list, and each Experience page already
 * carries its own nearby campsites, huts and trailheads.
 *
 * Nothing here claims a route. The experiences are listed in editorial order,
 * and the distance is the extent of the group.
 */
export default function Collection({ slug }: { slug: string }) {
  const { collection, loading } = useCollection(slug);
  const catalog = useCollectionCatalog();
  const [active, setActive] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const hero = collection?.photos[0];

  useEffect(() => {
    setHeroFailed(false);
  }, [hero?.url]);

  useEffect(() => {
    if (!collection) {
      if (loading) return;
      setMeta({
        title: "Collection not found — Terrane",
        description: "That collection isn’t in the generated set.",
        path: `/collections/${slug}`,
      });
      return;
    }

    const scope = collectionScope(collection.scope);
    const image = hero ? thumbAt(hero.url, 1200, hero.max) : undefined;
    setMeta({
      title: `${collection.title} — Terrane`,
      description: collection.summary,
      path: `/collections/${collection.slug}`,
      type: "article",
      image,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: collection.title,
        description: collection.summary,
        url: `${location.origin}/collections/${collection.slug}`,
        about: scope.label,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: collection.experiences.length,
          itemListElement: collection.experiences.map((experience, position) => ({
            "@type": "ListItem",
            position: position + 1,
            item: {
              "@type": "TouristAttraction",
              name: experience.name,
              url: `${location.origin}/experiences/${experience.slug}`,
              geo: {
                "@type": "GeoCoordinates",
                latitude: experience.lat,
                longitude: experience.lon,
              },
            },
          })),
        },
      },
    });
  }, [collection, hero, loading, slug]);

  if (!collection) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <h1 className="page-title">
            {loading ? "Reading the geography…" : "That collection isn’t here."}
          </h1>
          <p className="page-sub">
            {loading
              ? "Loading this collection."
              : "It may have been replaced by a newer generation of the data."}
          </p>
          {loading ? null : (
            <button
              className="btn btn-dark"
              onClick={() => navigate("/collections")}
            >
              All collections →
            </button>
          )}
        </div>
      </div>
    );
  }

  const scope = collectionScope(collection.scope);
  const related =
    catalog.status === "ready"
      ? nearbyCollections(catalog.rows, collection.center, collection.slug, 4)
      : [];

  const facts: Fact[] = [
    { k: "Scope", v: scope.one },
    { k: "Experiences", v: `${collection.stats.experiences}` },
    { k: "Countries", v: `${collection.stats.countries}` },
    { k: "Across", v: formatKm(collection.spanKm) },
    {
      k: "Nearby places",
      v: `${collection.stats.places.toLocaleString()} recorded at member Experiences`,
    },
    {
      k: "Sources",
      v: `${collection.stats.sourced} of ${collection.stats.experiences} Experiences on Wikipedia`,
    },
    {
      k: "Coordinates",
      v: coordinates(collection.center.lat, collection.center.lon),
      mono: true,
    },
  ];

  const selectExperience = (experienceSlug: string) => {
    setActive(experienceSlug);
    document
      .getElementById(`collection-experience-${experienceSlug}`)
      ?.scrollIntoView({ block: "center" });
  };

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button className="back" onClick={() => navigate("/collections")}>
          ← Collections
        </button>

        <div className="place-hero">
          {hero && !heroFailed ? (
            <img
              className="place-hero-photo"
              src={thumbAt(hero.url, 1440, hero.max)}
              srcSet={[640, 960, 1440]
                .map((width) => `${thumbAt(hero.url, width, hero.max)} ${width}w`)
                .join(", ")}
              sizes="(max-width: 860px) 100vw, 1240px"
              alt={`${collection.title}, ${scope.one.toLowerCase()}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setHeroFailed(true)}
            />
          ) : (
            <RidgeArt hue={collection.hue} className="place-hero-art" />
          )}

          <div className="place-hero-text">
            <p className="eyebrow">
              {[scope.one, collection.where].filter(Boolean).join(" · ")}
            </p>
            <h1 className="place-title">{collection.title}</h1>
            <p className="place-tagline">
              {collection.stats.experiences} Experiences ·{" "}
              {collection.stats.countries} countries ·{" "}
              {formatKm(collection.spanKm)} across · a collection, not a route
            </p>
          </div>

          {hero?.credit ? (
            <a
              className="place-credit mono"
              href={hero.page}
              target="_blank"
              rel="noreferrer"
            >
              {hero.credit} · {hero.licence}
            </a>
          ) : null}
        </div>

        <div className="place-main">
          <div className="place-body">
            <PlaceFacts facts={facts} />

            <PlaceSection title="What this is" note={`generated ${collection.generated}`}>
              {collection.description.map((paragraph) => (
                <p className="place-about-text" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </PlaceSection>

            <PlaceSection
              title="Experiences in this collection"
              note={`${collection.experiences.length} curated destinations · each has its own page and source`}
            >
              <div className="exp-grid collection-experiences">
                {collection.experiences.map((experience) => (
                  <div
                    key={experience.slug}
                    id={`collection-experience-${experience.slug}`}
                    data-experience-slug={experience.slug}
                    className={`collection-member${active === experience.slug ? " on" : ""}`}
                  >
                    <GuideCard row={experience} />
                  </div>
                ))}
              </div>
            </PlaceSection>

            <PlaceSection
              title="Map"
              note={`${collection.experiences.length} Experiences · collection, not a route`}
            >
              <Suspense
                fallback={
                  <div className="exp-map exp-map--loading mono">
                    Loading the map…
                  </div>
                }
              >
                <CollectionMap
                  experiences={collection.experiences}
                  activeSlug={active}
                  onSelect={selectExperience}
                />
              </Suspense>
            </PlaceSection>

            {collection.basisTrails?.length ? (
              <PlaceSection
                title="Trails that thread this collection"
                note="recorded trail links · condition not verified"
              >
                <ul className="guide-trails">
                  {collection.basisTrails.map((trail) => (
                    <li key={trail}>
                      <span className="guide-trail-name">{trail}</span>
                      <span className="mono guide-trail-meta">
                        recorded at a member Experience
                      </span>
                    </li>
                  ))}
                </ul>
              </PlaceSection>
            ) : null}

            {related.length > 0 ? (
              <PlaceSection title="Other collections nearby" note="closest first">
                <ol className="around-list">
                  {related.map(({ row, km }) => (
                    <li key={row.slug}>
                      <button
                        className="around-row"
                        onClick={() => navigate(`/collections/${row.slug}`)}
                      >
                        <span className="around-name">{row.title}</span>
                        <span className="around-type mono">
                          {collectionScope(row.scope).one}
                        </span>
                        <span className="around-km mono">{formatKm(km)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </PlaceSection>
            ) : null}
          </div>

          <aside className="place-aside">
            <div className="aside-card">
              <p className="mono k">This collection</p>
              <p className="exp-aside-line">{collection.summary}</p>
              <p className="mono exp-aside-note">
                Every Experience links to its own Terrane page and to a Wikipedia
                article. The collection groups Experiences; it does not claim a
                walking day, a route or a distance between them.
              </p>
              <p className="mono exp-aside-note">
                {collection.stats.experiences} Experiences ·{" "}
                {collection.stats.places} recorded nearby places ·{" "}
                {collection.stats.trails} named trails. Collections are not part
                of the Saved library.
              </p>
              <button
                className="btn btn-light"
                onClick={() => navigate("/experiences")}
              >
                Browse all Experiences →
              </button>
            </div>
          </aside>
        </div>
      </article>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          COLLECTIONS GATHER EXPERIENCES · MAP © OPENSTREETMAP · OPENFREEMAP ·
          DATA: WIKIDATA · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
