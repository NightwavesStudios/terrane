import { Suspense, lazy, useEffect, useState } from "react";
import Header from "../components/Header";
import PlaceFacts, { type Fact } from "../components/place/PlaceFacts";
import PlaceSection from "../components/place/PlaceSection";
import RidgeArt from "../components/RidgeArt";
import ExperiencePois from "../components/experiences/ExperiencePois";
import { category } from "../data/features";
import { guideKind } from "../data/guide";
import { useExperiencePois } from "../lib/experiencePois";
import {
  guideWhere,
  nearbyGuides,
  useGuide,
  useGuideCatalog,
} from "../lib/guide";
import { setMeta } from "../lib/meta";
import { thumbAt } from "../lib/placeDetails";
import { coordinates, formatKm } from "../lib/present";
import { navigate } from "../lib/router";
import { toggleSavedGuide, useSavedGuideSlugs } from "../lib/savedGuides";

const GuideMap = lazy(() => import("../components/guide/GuideMap"));

/**
 * One curated Experience.
 *
 * One destination, one lazy shard. The page states what the records hold — its
 * description, protected area, range, elevation, neighbouring destinations,
 * named trails and credited photographs — and nothing about current access,
 * closures, facilities or a route. Those are deliberately not claimed because
 * they are not verified.
 */
export default function Experience({ slug }: { slug: string }) {
  const { guide, loading } = useGuide(slug);
  const catalog = useGuideCatalog();
  const savedSlugs = useSavedGuideSlugs();
  const pois = useExperiencePois(guide?.bounds ?? null);
  const [active, setActive] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const hero = guide?.photo ?? guide?.photos[0];

  useEffect(() => {
    setHeroFailed(false);
  }, [hero?.url]);

  useEffect(() => {
    if (!guide) {
      if (loading) return;
      setMeta({
        title: "Experience not found — Terrane",
        description: "That Experience isn’t in the curated catalogue.",
        path: `/experiences/${slug}`,
      });
      return;
    }

    const kind = guideKind(guide.kind);
    setMeta({
      title: `${guide.name} — Terrane`,
      description: guide.summary,
      path: `/experiences/${guide.slug}`,
      type: "article",
      image: hero ? thumbAt(hero.url, 1200, hero.max) : undefined,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "TouristAttraction",
        name: guide.name,
        description: guide.summary,
        url: `${location.origin}/experiences/${guide.slug}`,
        sameAs: guide.source.url,
        touristType: kind.label,
        geo: {
          "@type": "GeoCoordinates",
          latitude: guide.center.lat,
          longitude: guide.center.lon,
        },
      },
    });
  }, [guide, hero, loading, slug]);

  if (!guide) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <h1 className="page-title">
            {loading ? "Reading the geography…" : "That Experience isn’t here."}
          </h1>
          <p className="page-sub">
            {loading
              ? "Loading this destination."
              : "It may have been removed from the curated selection."}
          </p>
          {loading ? null : (
            <button className="btn btn-dark" onClick={() => navigate("/experiences")}>
              All Experiences →
            </button>
          )}
        </div>
      </div>
    );
  }

  const kind = guideKind(guide.kind);
  const saved = savedSlugs.has(guide.slug);
  const where = guideWhere(guide);
  const related =
    catalog.status === "ready"
      ? nearbyGuides(catalog.rows, guide.center, guide.slug, 4)
      : [];

  const facts: Fact[] = [
    { k: "Kind", v: kind.one },
    ...(where ? [{ k: "Location", v: where }] : []),
    {
      k: "Nearby places",
      v: guide.stats.places
        ? `${guide.stats.places} catalogued within 30 km`
        : "none recorded",
    },
    {
      k: "Trails",
      v: guide.stats.trails
        ? `${guide.stats.trails} named within 10 km`
        : "none recorded",
    },
    ...(guide.stats.elevation
      ? [{ k: "Recorded elevation", v: `${guide.stats.elevation.toLocaleString("en-US")} m` }]
      : []),
    {
      k: "Coordinates",
      v: coordinates(guide.center.lat, guide.center.lon),
      mono: true,
    },
  ];

  const onToggleSave = () => {
    toggleSavedGuide({
      slug: guide.slug,
      name: guide.name,
      kind: guide.kind,
      country: guide.country,
      region: guide.region,
    });
  };

  const selectPlace = (placeSlug: string) => {
    setActive(placeSlug);
    if (placeSlug === guide.slug) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById(`guide-place-${placeSlug}`)?.scrollIntoView({ block: "center" });
  };

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button className="back" onClick={() => navigate("/experiences")}>
          ← Experiences
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
              alt={`${guide.name}, ${kind.one.toLowerCase()}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setHeroFailed(true)}
            />
          ) : (
            <RidgeArt hue={guide.hue} className="place-hero-art" />
          )}

          <div className="place-hero-text">
            <p className="eyebrow">{[kind.one, where].filter(Boolean).join(" · ")}</p>
            <h1 className="place-title">{guide.name}</h1>
            <p className="place-tagline">{guide.summary}</p>
          </div>

          <button
            className={`place-save${saved ? " on" : ""}`}
            onClick={onToggleSave}
            aria-pressed={saved}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>

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

            <PlaceSection
              title="Why this is an Experience"
              note="curated selection · recorded evidence"
            >
              <ul className="guide-reasons">
                {guide.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mono exp-note">
                Selected from the destination database, not promoted by a category
                count. Membership is an editorial decision recorded in the
                committed selection file.
              </p>
            </PlaceSection>

            <PlaceSection title="Overview" note={`data ${guide.generated}`}>
              {guide.overview.map((paragraph) => (
                <p className="place-about-text" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </PlaceSection>

            {guide.associated.length > 0 ? (
              <PlaceSection
                title="What’s here"
                note={`${guide.associated.length} other catalogued places within 30 km`}
              >
                <ul className="exp-stops">
                  {guide.associated.map((place) => (
                    <li
                      key={place.slug}
                      id={`guide-place-${place.slug}`}
                      className={`exp-stop${active === place.slug ? " on" : ""}`}
                    >
                      <button
                        className="exp-stop-main"
                        onClick={() => navigate(`/place/${place.slug}`)}
                      >
                        <span className="mono exp-stop-n">{category(place.cat).one}</span>
                        <span className="exp-stop-text">
                          <span className="exp-stop-name">{place.name}</span>
                          <span className="mono exp-stop-meta">
                            {formatKm(place.km)} from {guide.name}
                          </span>
                        </span>
                        <span className="mono exp-stop-go">Place →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </PlaceSection>
            ) : null}

            {guide.trails.length > 0 ? (
              <PlaceSection
                title="Trails recorded nearby"
                note={`${guide.trails.length} named within 10 km`}
              >
                <ul className="guide-trails">
                  {guide.trails.map((trail) => (
                    <li key={trail.name}>
                      <span className="guide-trail-name">{trail.name}</span>
                      <span className="mono guide-trail-meta">
                        {[trail.difficulty, formatKm(trail.km)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mono exp-note">
                  Trail names and lengths are recorded data. Their condition,
                  access and seasonal status are not verified here.
                </p>
              </PlaceSection>
            ) : null}

            <PlaceSection
              title="Map"
              note={`${guide.associated.length + 1} catalogued places · no route`}
            >
              <Suspense
                fallback={<div className="exp-map exp-map--loading mono">Loading the map…</div>}
              >
                <GuideMap guide={guide} activeSlug={active} onSelect={selectPlace} />
              </Suspense>
            </PlaceSection>

            <PlaceSection
              title="Campsites, huts and trailheads nearby"
              note="OpenStreetMap cells"
            >
              <ExperiencePois pois={pois.pois} status={pois.status} />
            </PlaceSection>

            {guide.photos.length > 1 ? (
              <PlaceSection title="Photographs" note="Wikimedia Commons">
                <ul className="exp-gallery">
                  {guide.photos.map((photo) => (
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

            <PlaceSection title="Sources and official resources" note="external links">
              <ul className="guide-sources">
                <li>
                  <a href={guide.source.url} target="_blank" rel="noreferrer">
                    {guide.source.label} article ↗
                  </a>
                </li>
                {guide.official ? (
                  <li>
                    <a href={guide.official} target="_blank" rel="noreferrer">
                      Official website ↗
                    </a>
                  </li>
                ) : null}
                {hero ? (
                  <li>
                    <a href={hero.page} target="_blank" rel="noreferrer">
                      Lead photograph on Wikimedia Commons ↗
                    </a>
                  </li>
                ) : null}
              </ul>
              <p className="mono exp-note">
                Links are recorded, not a live statement about opening hours,
                closures or access. Check the official source before travelling.
              </p>
            </PlaceSection>

            {related.length > 0 ? (
              <PlaceSection title="Other Experiences nearby" note="closest first">
                <ol className="around-list">
                  {related.map(({ row, km }) => (
                    <li key={row.slug}>
                      <button
                        className="around-row"
                        onClick={() => navigate(`/experiences/${row.slug}`)}
                      >
                        <span className="around-name">{row.name}</span>
                        <span className="around-type mono">{guideKind(row.kind).one}</span>
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
              <p className="mono k">This Experience</p>
              <p className="exp-aside-line">{guide.summary}</p>
              <button
                className={`btn btn-light${saved ? " btn-saved" : ""}`}
                onClick={onToggleSave}
              >
                {saved ? "Saved ✓" : "Save this Experience"}
              </button>
              <p className="mono exp-aside-note">
                A curated destination, not an itinerary. Access, closures,
                facilities and seasonal conditions are not verified; the page
                states only what the records hold.
              </p>
              <p className="mono exp-aside-note">
                {guide.stats.places} catalogued places within 30 km ·{" "}
                {guide.stats.trails} named trails within 10 km ·{" "}
                {guide.stats.photos} credited photographs.
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
