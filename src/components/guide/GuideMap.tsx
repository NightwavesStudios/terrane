import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MlMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { guideKind, type GuideExperience } from "../../data/guide";
import { createStyle } from "../../map/style";
import { installDemProtocol } from "../../map/dem";
import { attachTerrain } from "../../map/detailTerrain";

/**
 * A small, flat map of one Experience and its recorded neighbours.
 *
 * It reuses the basemap but none of the globe's runtime machinery. Markers are
 * neutral: no connecting line, no numbering and no implied order. Clicking a
 * marker scrolls the corresponding row into view.
 */
export default function GuideMap({
  guide,
  activeSlug,
  onSelect,
}: {
  guide: GuideExperience;
  activeSlug?: string | null;
  onSelect: (slug: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;

    /* The DEM protocol has to answer before the style asks for a relief tile.
       With it, this small map gets the same tinted, hillshaded surface as the
       globe instead of a thinner, flatter basemap. */
    installDemProtocol();

    const map = new MlMap({
      container: container.current,
      style: createStyle(),
      bounds: [
        [guide.bounds[0], guide.bounds[1]],
        [guide.bounds[2], guide.bounds[3]],
      ],
      fitBoundsOptions: { padding: 48, maxZoom: 10, animate: false },
      attributionControl: false,
      maxPitch: 68,
    });

    /* The globe's 3D treatment: one mesh, and a camera that tilts with the zoom
       instead of staying level over the range. */
    let detachTerrain = () => {};
    map.once("load", () => {
      detachTerrain = attachTerrain(map);
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

    const places = [
      {
        slug: guide.slug,
        name: guide.name,
        lat: guide.center.lat,
        lon: guide.center.lon,
      },
      ...guide.associated,
    ];

    for (const place of places) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "exp-pin exp-pin--place";
      element.style.setProperty("--pin", guideKind(guide.kind).colour);
      element.title = place.name;
      element.setAttribute("aria-label", place.name);
      element.addEventListener("click", () => {
        onSelectRef.current(place.slug);
        /* A click on a pin is a request to look at that pin: recentre and step
           in, rather than only highlighting it in a list off to the side. */
        map.easeTo({
          center: [place.lon, place.lat],
          zoom: Math.max(map.getZoom(), 12),
          duration: 700,
        });
      });
      new Marker({ element }).setLngLat([place.lon, place.lat]).addTo(map);
      created.set(place.slug, element);
    }

    return () => {
      created.clear();
      detachTerrain();
      map.remove();
    };
  }, [guide]);

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
      aria-label={`Map of ${guide.name} and nearby catalogued places`}
    />
  );
}
