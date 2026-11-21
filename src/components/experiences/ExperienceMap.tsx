import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MlMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ExperienceStop } from "../../data/experiences";
import { createStyle } from "../../map/style";

/**
 * The experience map: a small, flat MapLibre view of one collection.
 *
 * It reuses the app's basemap but none of the globe's runtime machinery — no 3D
 * mesh, hillshade, DEM protocol, contours, practical layers or trail cells. That
 * is deliberate: this map answers "where are these places", not "what order do I
 * walk them in".
 *
 * Each place is a DOM marker in the collection's hue. There is no connecting
 * line and no numbering: the record holds a group of places, not a route, and
 * drawing a path between them would invent one. A real button keeps the marker
 * keyboard- and screen-reader-friendly; clicking one highlights its row.
 */
export default function ExperienceMap({
  stops,
  hue,
  activeSlug,
  onSelect,
}: {
  stops: ExperienceStop[];
  hue: number;
  activeSlug?: string | null;
  onSelect: (slug: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || stops.length === 0) return;

    const lats = stops.map((stop) => stop.lat);
    const lons = stops.map((stop) => stop.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];

    /* The basemap carries a `terranedem://` relief source and its elevation
       tint. The globe installs that protocol; this map deliberately does not,
       and an unregistered protocol leaves the style unloaded, which would take
       the markers' basemap with it. The tint is the only static layer on that
       source, so both go. */
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
      bounds,
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

    /* Markers are DOM overlays, so they do not wait for the style or for a tile.
       A collection that appears only after `load` disappears whenever the tile
       server is slow or throttled — and the places are the point of the map. */
    for (const stop of stops) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "exp-pin exp-pin--place";
      element.style.setProperty("--pin", `hsl(${hue} 48% 46%)`);
      element.title = stop.name;
      element.setAttribute("aria-label", stop.name);
      element.addEventListener("click", () => onSelectRef.current(stop.slug));
      new Marker({ element }).setLngLat([stop.lon, stop.lat]).addTo(map);
      created.set(stop.slug, element);
    }

    return () => {
      created.clear();
      map.remove();
    };
  }, [stops, hue]);

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
      aria-label="Map of the places in this experience"
    />
  );
}
