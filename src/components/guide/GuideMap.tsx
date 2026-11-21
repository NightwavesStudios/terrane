import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MlMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GuideExperience } from "../../data/guide";
import { createStyle } from "../../map/style";

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

    const base = createStyle();
    const sources = Object.fromEntries(
      Object.entries(base.sources ?? {}).filter(([id]) => id !== "relief"),
    );
    const layers = base.layers.filter(
      (layer) => (layer as { source?: string }).source !== "relief",
    );

    const map = new MlMap({
      container: container.current,
      style: { ...base, sources, layers },
      bounds: [
        [guide.bounds[0], guide.bounds[1]],
        [guide.bounds[2], guide.bounds[3]],
      ],
      fitBoundsOptions: { padding: 48, maxZoom: 10, animate: false },
      attributionControl: false,
    });

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
      element.style.setProperty("--pin", `hsl(${guide.hue} 48% 46%)`);
      element.title = place.name;
      element.setAttribute("aria-label", place.name);
      element.addEventListener("click", () => onSelectRef.current(place.slug));
      new Marker({ element }).setLngLat([place.lon, place.lat]).addTo(map);
      created.set(place.slug, element);
    }

    return () => {
      created.clear();
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
