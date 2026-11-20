import { useEffect, useMemo } from "react";
import Header from "../components/Header";
import PlaceAside from "../components/place/PlaceAside";
import PlaceAssociationRow from "../components/place/PlaceAssociationRow";
import PlaceFacts, { type Fact } from "../components/place/PlaceFacts";
import PlaceHero from "../components/place/PlaceHero";
import PlaceSection from "../components/place/PlaceSection";
import RelationList from "../components/place/RelationList";
import { bySlug } from "../data/places";
import { category, destinationCategory, SOURCE_LABEL } from "../data/features";
import TRAIL_LINKS from "../data/trail-links.json";
import { startCatalog, useCatalog, type CatalogRow } from "../lib/catalog";
import { relatedPlaces } from "../lib/discover";
import { kmBetween } from "../lib/geo";
import { globeHref, readLastView } from "../lib/lastView";
import { setMeta } from "../lib/meta";
import {
  difficultyLabel,
  landscapeRows,
  sentence,
  thumbAt,
  usePlaceDetail,
} from "../lib/placeDetails";
import { coordinates, formatKm, placeLine } from "../lib/present";
import { toggleSaved, useSavedSlugs } from "../lib/saved";
import { focusZoomFor } from "../map/camera";
import { navigate } from "../lib/router";

type TrailLink = { name: string; km: number; src: string; difficulty: string };
const TRAILS = TRAIL_LINKS as { radiusKm: number; items: Record<string, TrailLink[]> };

export default function Place({ slug }: { slug: string }) {
  const place = bySlug.get(slug);
  const catalog = useCatalog();
  const detail = usePlaceDetail(slug);
  const savedSlugs = useSavedSlugs();

  /* The relationships come from the same lazy catalog Discover uses, so the
     page gains the long tail after the first paint instead of being frozen to
     the atlas's nearest six rows. */
  useEffect(() => {
    startCatalog();
  }, []);

  const trails = useMemo(
    () => (place ? TRAILS.items[place.slug] ?? [] : []),
    [place],
  );

  /* Activities are what is actually around, by category: one count per category
     within 30 km from the full catalog, plus named trails within 10 km. Nothing
     is inferred beyond the records. */
  const activities = useMemo(() => {
    if (!place) return [] as { id: string; label: string; count: number }[];
    const counts = new Map<string, number>();
    for (const row of catalog.rows) {
      if (row.pick.slug === place.slug) continue;
      if (kmBetween(place.lat, place.lon, row.lat, row.lon) > 30) continue;
      counts.set(row.cat, (counts.get(row.cat) ?? 0) + 1);
    }
    const list = [...counts.entries()]
      .map(([id, count]) => ({ id, label: category(id).label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    if (trails.length > 0) {
      list.push({ id: "hiking", label: "Hiking", count: trails.length });
    }
    return list;
  }, [catalog.rows, place, trails.length]);

  useEffect(() => {
    if (!place) {
      setMeta({
        title: "Place not found — Terrane",
        description: "That place isn’t on the globe.",
        path: `/place/${slug}`,
      });
      return;
    }

    const cat = category(destinationCategory(place));
    const height = place.elevation ?? detail?.elev;
    const where = placeLine(place.region, place.country);
    const description = detail?.desc
      ? sentence(detail.desc)
      : `${place.name} is a ${cat.one.toLowerCase()} in ${where}${
          height ? `, ${height.toLocaleString()} m high` : ""
        }. Coordinates and the places around it.`;
    const image = detail?.img?.[0]
      ? thumbAt(detail.img[0].url, 1440, detail.img[0].max)
      : undefined;
    const sameAs = [
      detail?.wiki,
      detail?.site,
      detail?.commons,
      place.wd ? `https://www.wikidata.org/wiki/${place.wd}` : undefined,
    ].filter((value): value is string => Boolean(value));

    setMeta({
      title: `${place.name} — Terrane`,
      description,
      path: `/place/${place.slug}`,
      type: "article",
      image,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": place.type === "peak" ? "Mountain" : "TouristAttraction",
        name: place.name,
        description,
        url: `${location.origin}/place/${place.slug}`,
        geo: {
          "@type": "GeoCoordinates",
          latitude: place.lat,
          longitude: place.lon,
        },
        ...(height ? { elevation: `${height} m` } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
    });
  }, [place, detail, slug]);

  if (!place) {
    return (
      <div className="page">
        <Header tone="light" />
        <div className="page-head">
          <h1 className="page-title">That place isn’t here.</h1>
          <p className="page-sub">It may have moved, or never existed.</p>
          <button
            className="btn btn-dark"
            onClick={() => navigate(globeHref(readLastView()))}
          >
            Back to the globe →
          </button>
        </div>
      </div>
    );
  }

  const cat = category(destinationCategory(place));
  const elevation = place.elevation ?? detail?.elev;
  const prominence =
    place.type === "peak" ? place.prominence ?? detail?.prom : undefined;
  const saved = savedSlugs.has(place.slug);
  const landscape = landscapeRows(detail);

  const facts: Fact[] = [
    { k: "Category", v: cat.one },
    { k: "Elevation", v: elevation ? `${elevation.toLocaleString()} m` : "—" },
    ...(prominence
      ? [{ k: "Prominence", v: `${prominence.toLocaleString()} m` }]
      : []),
    { k: "Coordinates", v: coordinates(place.lat, place.lon), mono: true },
    { k: "Where", v: placeLine(place.region, place.country) || place.country },
  ];

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
  const kindLabel = cat.label.toLowerCase();

  const openRow = (row: CatalogRow) => {
    if (row.pick.slug) navigate(`/place/${row.pick.slug}`);
    else {
      navigate(
        `/?at=${row.lat.toFixed(3)},${row.lon.toFixed(3)},${focusZoomFor(row.cat)}`,
      );
    }
  };

  const onToggleSave = () => {
    toggleSaved({
      slug: place.slug,
      name: place.name,
      cat: cat.id,
      lat: place.lat,
      lon: place.lon,
      country: place.country,
      region: place.region,
    });
  };

  return (
    <div className="page">
      <Header tone="light" />

      <article className="place">
        <button
          className="back"
          onClick={() => navigate(globeHref(readLastView()))}
        >
          ← Globe
        </button>

        <PlaceHero
          name={place.name}
          alt={`${place.name}, ${cat.one.toLowerCase()}`}
          eyebrow={`${cat.one} · ${placeLine(place.region, place.country)}`}
          elevation={elevation}
          hue={place.hue}
          image={detail?.img?.[0]}
          saved={saved}
          onToggleSave={onToggleSave}
        />

        <div className="place-main">
          <div className="place-body">
            <PlaceFacts facts={facts} />

            {detail?.desc ? (
              <PlaceSection title="About" note="Description: Wikidata">
                <p className="place-about-text">{sentence(detail.desc)}</p>
                {place.wd ? (
                  <p className="mono place-source">
                    <a
                      href={`https://www.wikidata.org/wiki/${place.wd}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Wikidata {place.wd}
                    </a>
                  </p>
                ) : null}
              </PlaceSection>
            ) : null}

            {landscape.length > 0 ? (
              <PlaceSection title="In the landscape" note="recorded or nearest">
                <ol className="around-list">
                  {landscape.map((row) => (
                    <PlaceAssociationRow
                      key={`${row.label}-${row.assoc.name}`}
                      assoc={row.assoc}
                      label={row.label}
                    />
                  ))}
                </ol>
              </PlaceSection>
            ) : null}

            {trails.length > 0 ? (
              <PlaceSection title="Trails here" note={`within ${TRAILS.radiusKm} km`}>
                <ol className="around-list">
                  {trails.map((trail) => (
                    <li key={`${trail.name}-${trail.km}`}>
                      <div className="around-row around-row--static">
                        <span className="around-name">{trail.name}</span>
                        <span className="around-type mono">
                          {[
                            difficultyLabel(trail.difficulty),
                            SOURCE_LABEL[trail.src] ?? trail.src,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="around-km mono">{formatKm(trail.km)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </PlaceSection>
            ) : null}

            {activities.length > 0 ? (
              <PlaceSection
                title="Activities"
                note={
                  trails.length > 0
                    ? "within 30 km · hiking counts trails within 10 km"
                    : "within 30 km"
                }
              >
                <ul className="around-acts">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <span className="n">{activity.count}</span>
                      <span className="l">{activity.label}</span>
                    </li>
                  ))}
                </ul>
              </PlaceSection>
            ) : null}

            {nearby.length > 0 ? (
              <PlaceSection title="Nearby destinations" note="closest first">
                <RelationList items={nearby} onOpen={openRow} />
              </PlaceSection>
            ) : null}

            {sameKind.length > 0 ? (
              <PlaceSection
                title={`More ${kindLabel} nearby`}
                note="within 300 km"
              >
                <RelationList items={sameKind} onOpen={openRow} />
              </PlaceSection>
            ) : null}

            {lesser.length > 0 ? (
              <PlaceSection title="Lesser known nearby" note="tier 3–4 · within 50 km">
                <RelationList items={lesser} onOpen={openRow} />
              </PlaceSection>
            ) : null}

            {relations?.areaLabel && sameArea.length > 0 ? (
              <PlaceSection
                title={`Elsewhere in ${relations.areaLabel}`}
                note="nearest first"
              >
                <RelationList items={sameArea} onOpen={openRow} />
              </PlaceSection>
            ) : null}
          </div>

          <PlaceAside
            saved={saved}
            onToggleSave={onToggleSave}
            onOpenGlobe={() => navigate(`/?place=${place.slug}`)}
            coordinatesText={coordinates(place.lat, place.lon)}
            site={detail?.site}
            wiki={detail?.wiki}
            commons={detail?.commons}
            wd={place.wd}
            photo={detail?.img?.[0]}
          />
        </div>
      </article>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          MAP © OPENSTREETMAP · OPENFREEMAP · TERRAIN: MAPTERHORN · DATA: WIKIDATA ·
          PHOTOS: WIKIMEDIA COMMONS · OSM ODbL
        </span>
      </footer>
    </div>
  );
}
