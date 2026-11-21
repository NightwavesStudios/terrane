import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MlMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { guideKind, type GuideCatalogRow } from "../../data/guide";
import { createStyle } from "../../map/style";
import { installDemProtocol } from "../../map/dem";

/**
 * The Collection map: a small, flat view of the Experiences in one wide group.
 *
 * It reuses the app's basemap but none of the globe's runtime machinery — no 3D
 * mesh, hillshade, DEM protocol, contours or practical layers. Each member is
 * one DOM marker at its Experience centre; there is no connecting line, because
 * a Collection is not a route and drawing one would invent it.
 */
export default function CollectionMap({
  experiences,
  activeSlug,
  onSelect,
}: {
  experiences: GuideCatalogRow[];
  activeSlug?: string | null;
  onSelect: (slug: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || experiences.length === 0) return;

    const lats = experiences.map((experience) => experience.lat);
    const lons = experiences.map((experience) => experience.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];

    /* Same surface as the globe: the DEM protocol answers, and the style's own
       elevation tint and hillshade draw it. One visual language, two crops. */
    installDemProtocol();

    const map = new MlMap({
      container: container.current,
      style: createStyle(),
      bounds,
      fitBoundsOptions: { padding: 48, maxZoom: 8, animate: false },
      attributionControl: false,
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __terraneDetailMap?: MlMap }).__terraneDetailMap = map;
    }

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "© OpenStreetMap · OpenFreeMap",
      }),
      "bottom-right",
    );

    const created = markers.current;
    created.clear();

    for (const experience of experiences) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "exp-pin exp-pin--experience";
      element.style.setProperty("--pin", guideKind(experience.kind).colour);
      element.title = experience.name;
      element.dataset.experienceSlug = experience.slug;
      element.setAttribute("aria-label", experience.name);
      element.addEventListener("click", () => onSelectRef.current(experience.slug));
      new Marker({ element }).setLngLat([experience.lon, experience.lat]).addTo(map);
      created.set(experience.slug, element);
    }

    return () => {
      created.clear();
      map.remove();
    };
  }, [experiences]);

  useEffect(() => {
    for (const [slug, element] of markers.current) {
      element.classList.toggle("on", slug === activeSlug);
    }
  }, [activeSlug]);

  return (
    <div
      className="exp-map"
      ref={container}
      role="img"
      aria-label="Map of the Experiences in this collection"
    />
  );
}
