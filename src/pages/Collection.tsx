import { Suspense, lazy, useEffect, useState } from "react";
import Header from "../components/Header";
import PlaceFacts, { type Fact } from "../components/place/PlaceFacts";
import PlaceSection from "../components/place/PlaceSection";
import RidgeArt from "../components/RidgeArt";
import ExperiencePois from "../components/experiences/ExperiencePois";
import { category } from "../data/features";
import { experienceCategory } from "../data/experiences";
import { useExperiencePois } from "../lib/experiencePois";
import {
  experienceWhere,
  nearbyExperiences,
  useExperience,
  useExperienceCatalog,
} from "../lib/experiences";
import { setMeta } from "../lib/meta";
import { thumbAt } from "../lib/placeDetails";
import { coordinates, formatKm, placeLine } from "../lib/present";
import { navigate } from "../lib/router";


const ExperienceMap = lazy(
  () => import("../components/experiences/ExperienceMap"),
);

/**
 * One generated collection.
 *
 * The record is one lazy shard: title, prose, places, photos and the evidence.
 * The map is a second lazy chunk, so the page paints without MapLibre. Practical
 * places arrive after that from the cell store and never block the collection.
 *
 * Nothing here claims a route: places are listed by how well they are recorded,
 * not by walking order, and distances are only the extent of the group.
 */
export default function Collection({ slug }: { slug: string }) {
  const { experience, loading } = useExperience(slug);
  const catalog = useExperienceCatalog();

  const pois = useExperiencePois(experience?.bounds ?? null);
  const [active, setActive] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const hero = experience?.photos[0];

  useEffect(() => {
    setHeroFailed(false);
  }, [hero?.url]);

  useEffect(() => {
    if (!experience) {
      if (loading) return;
      setMeta({
        title: "Experience not found — Terrane",
        description: "That collection isn’t in the generated set.",
        path: `/collections/${slug}`,
      });
      return;
    }

    const cat = experienceCategory(experience.category);
    const image = hero ? thumbAt(hero.url, 1200, hero.max) : undefined;
    setMeta({
      title: `${experience.title} — Terrane`,
      description: experience.summary,
      path: `/collections/${experience.slug}`,
      type: "article",
      image,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: experience.title,
        description: experience.summary,
        url: `${location.origin}/collections/${experience.slug}`,
        about: cat.label,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: experience.stops.length,
          itemListElement: experience.stops.map((stop, position) => ({
            "@type": "ListItem",
            position: position + 1,
            item: {
              "@type": "TouristAttraction",
              name: stop.name,
              url: `${location.origin}/place/${stop.slug}`,
              sameAs: stop.source?.url,
              geo: {
                "@type": "GeoCoordinates",
                latitude: stop.lat,
                longitude: stop.lon,
              },
            },
          })),
        },
      },
    });
  }, [experience, hero, loading, slug]);

  if (!experience) {
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

  const cat = experienceCategory(experience.category);
  const where = experienceWhere(experience);
  const related = catalog.status === "ready"
    ? nearbyExperiences(catalog.rows, experience.center, experience.slug, 4)
    : [];

  /* Activities are counted from the places themselves, not from a tag list: a
     peak is a summit, a lake is water, and a named trail is hiking. */
  const activityCounts = new Map<string, number>();
  for (const stop of experience.stops) {
    activityCounts.set(stop.cat, (activityCounts.get(stop.cat) ?? 0) + 1);
  }
  const activityRows = [...activityCounts.entries()]
    .map(([id, count]) => ({ id, label: category(id).label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (experience.stats.trails > 0) {
    activityRows.push({
      id: "trails",
      label: "Named trails nearby",
      count: experience.stats.trails,
    });
  }

  const facts: Fact[] = [
    { k: "Category", v: cat.one },
    { k: "Places", v: `${experience.stats.stops}` },
    { k: "Across", v: formatKm(experience.spanKm) },
    ...(experience.stats.elevationMax
      ? [
          {
            k: "High point",
            v: `${experience.stats.elevationMax.toLocaleString("en-US")} m`,
          },
        ]
      : []),
    {
      k: "Sources",
      v: `${experience.stats.sourced} of ${experience.stats.stops} on Wikipedia`,
    },
    {
      k: "Coordinates",
      v: coordinates(experience.center.lat, experience.center.lon),
      mono: true,
    },
  ];

  const selectStop = (stopSlug: string) => {
    setActive(stopSlug);
    document.getElementById(`stop-${stopSlug}`)?.scrollIntoView({ block: "center" });
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
              alt={`${experience.title}, ${cat.one.toLowerCase()}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setHeroFailed(true)}
            />
          ) : (
            <RidgeArt hue={experience.hue} className="place-hero-art" />
          )}

          <div className="place-hero-text">
            <p className="eyebrow">
              {[cat.one, where].filter(Boolean).join(" · ")}
            </p>
            <h1 className="place-title">{experience.title}</h1>
            <p className="place-tagline">
              {experience.stats.stops} places across {formatKm(experience.spanKm)} ·{" "}
              a collection, not a route
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

            <PlaceSection title="What this is" note={`generated ${experience.generated}`}>
              {experience.description.map((paragraph) => (
                <p className="place-about-text" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </PlaceSection>

            <PlaceSection
              title="Places in this collection"
              note={`${experience.stops.length} places · each has its own page and source`}
            >
              <ul className="exp-stops">
                {experience.stops.map((stop) => {
                  const stopCat = category(stop.cat);
                  const activities = [
                    stopCat.one,
                    stop.trails.length
                      ? `${stop.trails.length} named trail${stop.trails.length === 1 ? "" : "s"}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={stop.slug}
                      id={`stop-${stop.slug}`}
                      className={`exp-stop${active === stop.slug ? " on" : ""}`}
                    >
                      <button
                        className="exp-stop-main"
                        onClick={() => navigate(`/place/${stop.slug}`)}
                      >
                        <span className="mono exp-stop-n">{stopCat.one}</span>
                        <span className="exp-stop-text">
                          <span className="exp-stop-name">{stop.name}</span>
                          <span className="mono exp-stop-meta">
                            {[
                              activities,
                              placeLine(stop.region, stop.country),
                              stop.elevation
                                ? `${stop.elevation.toLocaleString("en-US")} m`
                                : "",
                              stop.note ?? "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {stop.trails.length > 0 ? (
                            <span className="mono exp-stop-trails">
                              {stop.trails
                                .map((trail) =>
                                  trail.difficulty
                                    ? `${trail.name} (${trail.difficulty})`
                                    : trail.name,
                                )
                                .join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        <span className="mono exp-stop-go">Place →</span>
                      </button>
                      {stop.source ? (
                        <a
                          className="mono exp-stop-source"
                          href={stop.source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {stop.source.label} ↗
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </PlaceSection>

            <PlaceSection
              title="Map"
              note={`${experience.stops.length} places · collection, not a route`}
            >
              <Suspense
                fallback={<div className="exp-map exp-map--loading mono">Loading the map…</div>}
              >
                <ExperienceMap
                  stops={experience.stops}
                  hue={experience.hue}
                  activeSlug={active}
                  onSelect={selectStop}
                />
              </Suspense>
            </PlaceSection>

            {activityRows.length > 0 ? (
              <PlaceSection title="Activities" note="counted from the places">
                <ul className="around-acts">
                  {activityRows.map((activity) => (
                    <li key={activity.id}>
                      <span className="n">{activity.count}</span>
                      <span className="l">{activity.label}</span>
                    </li>
                  ))}
                </ul>
              </PlaceSection>
            ) : null}

            <PlaceSection
              title="Campsites, huts and trailheads nearby"
              note="OpenStreetMap cells"
            >
              <ExperiencePois pois={pois.pois} status={pois.status} />
            </PlaceSection>

            {experience.photos.length > 1 ? (
              <PlaceSection title="Photographs" note="Wikimedia Commons">
                <ul className="exp-gallery">
                  {experience.photos.map((photo) => (
                    <li key={photo.url}>
                      <a href={photo.page} target="_blank" rel="noreferrer">
                        <img
                          src={thumbAt(photo.url, 640, photo.max)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="mono exp-gallery-credit">
                          {photo.credit} · {photo.licence}
                        </span>
                      </a>
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
                          {experienceCategory(row.category).one}
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
              <p className="exp-aside-line">{experience.summary}</p>
              <p className="mono exp-aside-note">
                Every place links to its own Terrane page and to a Wikipedia
                article. No itinerary, walking day or distance between places is
                claimed: the records hold places, not a trail. Collections are
                not part of the Saved library.
              </p>
              <p className="mono exp-aside-note">
                Generated from {experience.stats.stops} destinations and their
                recorded trails. No hand-written additions.
              </p>
            </div>
          </aside>
        </div>
      </article>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          MAP © OPENSTREETMAP · OPENFREEMAP · DATA: WIKIDATA · TRAILS: OSM AND AGENCY
          INVENTORIES · PHOTOS: WIKIMEDIA COMMONS
        </span>
      </footer>
    </div>
  );
}
