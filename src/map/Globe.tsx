import { useEffect, useRef, useState } from "react";
import { Map as MlMap } from "maplibre-gl";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createStyle } from "./style";
import { createContours, type ContourHandle } from "./contours";
import { DEFAULT_LAYERS, type LayerState } from "../components/LayerControl";
import type { Place } from "../data/places";

export interface GlobeFocus {
  lon: number;
  lat: number;
  zoom: number;
  key: number;
}

interface Props {
  places: Place[];
  selected: string | null;
  onSelect: (slug: string) => void;
  focus?: GlobeFocus | null;
  layers?: LayerState;
}

/* Which layers answer to which switch. Street-level furniture (roads, borders,
   landcover, water) travels together as "detail". */
const LAYER_GROUPS: Record<keyof LayerState, string[]> = {
  relief: ["relief-hillshade"],
  contours: ["contours-minor", "contours-major"],
  detail: [
    "landcover-wood",
    "landcover-grass",
    "landcover-ice",
    "landuse-residential",
    "water",
    "waterway",
    "water-label",
    "boundary-country",
    "boundary-state",
    "road-minor",
    "road-major",
    "road-highway",
  ],
  labels: [
    "label-country",
    "label-state",
    "label-city",
    "places-label-top",
    "places-label",
  ],
  places: [
    "places-heat",
    "places-halo",
    "places-dot",
    "places-curated",
    "places-selected",
  ],
};

function applyVisibility(map_: MlMap, layers: LayerState) {
  for (const key of Object.keys(LAYER_GROUPS) as (keyof LayerState)[]) {
    if (key === "contours") continue; // owned by the contour controller
    const visibility = layers[key] ? "visible" : "none";
    for (const id of LAYER_GROUPS[key]) {
      if (map_.getLayer(id)) map_.setLayoutProperty(id, "visibility", visibility);
    }
  }
}

const TYPE_COLOR = [
  "match",
  ["get", "type"],
  "peak",
  "#eaf7ff",
  "park",
  "#57f0b2",
  "landmark",
  "#ffc766",
  "gem",
  "#c99bff",
  "#57f0b2",
] as unknown as ExpressionSpecification;

const DOT_LAYERS = ["places-halo", "places-dot", "places-curated"];

/**
 * Zoom that shows the whole sphere without wasting the stage.
 *
 * At globe projection the rendered diameter is ≈ 161 · 2^zoom CSS px (measured
 * on MapLibre 5), so we can solve for the zoom that makes the planet about 90%
 * of the viewport width. Phones were otherwise cropped at both edges, and a
 * fixed low zoom left the globe looking lost on a narrow screen.
 */
/** Camera tilt for a given zoom: level at planet scale, oblique over ranges. */
function pitchForZoom(zoom: number) {
  return Math.max(0, Math.min(55, (zoom - 1.9) * 13));
}

export function worldZoom(width: number, height: number) {
  // Fit the sphere to whichever dimension binds first — a wide, short window
  // is limited by height, a phone by width.
  const fit = Math.log2(Math.min(width * 0.9, height * 0.82) / 161);
  return Math.max(0.6, Math.min(2.2, fit));
}

function toGeoJSON(places: Place[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: {
        slug: p.slug,
        name: p.name,
        type: p.type,
        curated: p.curated ? 1 : 0,
        // 1 = the eight headline places, 2 = other curated, 3 = atlas rows.
        // Labels stagger by tier so the globe doesn't explain itself at once.
        tier: p.featured ? 1 : p.curated ? 2 : 3,
      },
    })),
  };
}

export default function Globe({
  places,
  selected,
  onSelect,
  focus,
  layers = DEFAULT_LAYERS,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const contours = useRef<ContourHandle | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const map = useRef<MlMap | null>(null);
  const selectRef = useRef(onSelect);
  const booted = useRef(false);
  const dataRef = useRef(places);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  selectRef.current = onSelect;
  dataRef.current = places;

  /* ── init once ─────────────────────────────────────── */
  useEffect(() => {
    if (!holder.current) return;

    const map_ = new MlMap({
      container: holder.current,
      style: createStyle(),
      center: [12, 22],
      zoom: worldZoom(
        holder.current.clientWidth,
        holder.current.clientHeight,
      ),
      minZoom: 0.4,
      maxZoom: 14,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: false,
      maxPitch: 60,

      /* Zooming is a tile-loading problem before it is anything else. These four
         settings are what stop the map flashing bare land as you go in:
         - fadeDuration: newly arrived tiles cross-fade instead of snapping in.
         - refreshExpiredTiles:false: never re-request a tile we already have
           (OSM tiles carry a short expiry; refetching them mid-zoom is what
           puts holes in a range you are descending into).
         - maxTileCacheSize: keep several zoom levels resident, so pulling back
           out and diving again costs nothing.
         - renderWorldCopies:false: a globe never needs the world twice, and the
           duplicate copies were extra tiles in flight. */
      fadeDuration: 280,
      refreshExpiredTiles: false,
      maxTileCacheSize: 160,
      renderWorldCopies: false,
    });
    map.current = map_;

    if (import.meta.env.DEV) {
      (window as unknown as { __terraneMap?: MlMap }).__terraneMap = map_;
    }

    const bootstrap = () => {
      if (booted.current) return;
      booted.current = true;

      try {
        map_.setProjection({ type: "globe" });
      } catch {
        /* mercator fallback */
      }
      /* Relief comes from hillshade alone.

         A `setTerrain` mesh was tried and removed: with globe projection it does
         not displace the surface, but it still fetches a full extra DEM pyramid
         (tiles at z3…z8 for one view) and re-tessellates on every gesture — all
         of the cost of 3D, none of the relief. The hillshade below is what you
         actually see, and dropping the mesh roughly halves the elevation traffic
         while zooming.

         It cannot live in the static style (a hillshade there fails style
         parsing) and it is added after the map settles. */
      window.setTimeout(() => {
        try {
          map_.addLayer(
            {
              id: "relief-hillshade",
              type: "hillshade",
              source: "relief",
              // No minzoom: exaggeration is a zoom expression, so relief ramps up
              // from nothing between z2 and z3.2 instead of the whole planet
              // snapping into 3D the moment you pass a threshold.
              paint: {
                // Exaggeration has to CLIMB with zoom, not sit at a constant.
                // Terra's deep tiles are bilinearly upsampled from a coarser
                // source, so the slope between neighbouring texels shrinks as you
                // zoom in: at a fixed exaggeration the shading flattens out and
                // the map reads as a grey wash with no relief at all.
                "hillshade-exaggeration": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  2,
                  0,
                  3.2,
                  1.15,
                  9,
                  1.6,
                  12,
                  2.6,
                  15,
                  3.4,
                ],
                // Light fixed to the terrain, not the screen: with the default
                // (viewport) a pitch or rotate swings the shadows across ridges
                // and the relief appears to slide.
                "hillshade-illumination-anchor": "map",
                "hillshade-shadow-color": "#030c08",
                "hillshade-highlight-color": "#46603f",
                "hillshade-accent-color": "#06120c",
              },
            },
            // Above the landcover fills but below water, roads and labels. It has
            // to sit ABOVE vegetation: a flat green fill on top of the shade is what
            // erased both the colour and the 3D at mid zoom.
            map_.getLayer("water") ? "water" : "label-country",
          );
                  } catch {
          /* hillshade unavailable */
        }
        // The relief layer only exists now, so re-apply the switches.
        applyVisibility(map_, layersRef.current);
        // ...and put contours back above the shade.
        contours.current?.reload();
      }, 2500);

      try {
        map_.setSky({
          "sky-color": "#02040a",
          "horizon-color": "#1d6f92",
          "fog-color": "#0a2434",
          "sky-horizon-blend": 0.72,
          "horizon-fog-blend": 0.42,
          "fog-ground-blend": 0.22,
          "atmosphere-blend": 0.45,
        });
      } catch {
        /* sky unsupported */
      }

      contours.current = createContours(map_);
      contours.current.setEnabled(layersRef.current.contours);
      applyVisibility(map_, layersRef.current);

      map_.addSource("places", { type: "geojson", data: toGeoJSON(dataRef.current) });
      map_.addSource("selected", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      /* Density wash. At world scale the individual points are switched off and
         these soft, blurred discs pile up wherever places are concentrated —
         a hint of where the world is busy, without a wall of dots. */
      map_.addLayer({
        id: "places-heat",
        type: "circle",
        source: "places",
        // Faded to nothing by ~4.6. Stopping the layer there keeps 1,288 blurred
        // circles out of the per-frame work once you are over a range.
        maxzoom: 4.7,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            7,
            2,
            13,
            4,
            22,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.05,
            2.4,
            0.045,
            3.6,
            0.02,
            4.6,
            0,
          ],
          "circle-blur": 1,
        },
      });

      map_.addLayer({
                      id: "places-halo",
        type: "circle",
        source: "places",
        // Blurred circles are the most expensive thing on screen at depth; past
        // z9.5 the dots and labels carry it alone.
        maxzoom: 9.5,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            3,
            4,
            6,
            8,
            11,
            14,
            17,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.1,
            4,
            0.2,
            9,
            0.16,
          ],
          "circle-blur": 1,
        },
      });

      map_.addLayer({
        id: "places-dot",
        type: "circle",
        source: "places",
        // Atlas rows fade in from ~2.2 rather than appearing all at once; below
        // that the density wash and the curated rings do the talking.
        minzoom: 2.2,
        paint: {
          "circle-color": TYPE_COLOR,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1.3,
            4,
            2.5,
            8,
            3.7,
            14,
            5,
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            2.2,
            0,
            3.4,
            0.95,
          ],
        },
      });

      /* Curated places get a fine white ring, so the written-up set stays
         findable at every zoom — including world view, where the dots are off. */
      map_.addLayer({
        id: "places-curated",
        type: "circle",
        source: "places",
        filter: ["==", ["get", "curated"], 1],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            2.6,
            4,
            4.4,
            8,
            5.8,
          ],
          "circle-color": "transparent",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.9,
          "circle-stroke-opacity": 0.6,
        },
      });

      map_.addLayer({
        id: "places-selected",
        type: "circle",
        source: "selected",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 6, 13],
          "circle-color": "transparent",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 0.85,
        },
      });

      map_.addLayer({
        id: "places-label-top",
        type: "symbol",
        source: "places",
        minzoom: 1.2,
        filter: ["==", ["get", "tier"], 1],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3.2, 9, 8, 11],
          "text-offset": [0, 0.95],
          "text-anchor": "top",
          "text-padding": 5,
          "text-optional": true,
          "text-max-width": 9,
        },
        paint: {
          "text-color": "#d7e7f5",
          "text-halo-color": "#04070c",
          "text-halo-width": 1.5,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1.2,
            0,
            2.1,
            0.9,
          ],
        },
      });

      // Second label pass: the rest of the curated set, later and quieter.
      map_.addLayer({
        id: "places-label",
        type: "symbol",
        source: "places",
        minzoom: 3.8,
        // Curated, but NOT tier 1 — those are already labelled by the layer above.
        // Without the exclusion every featured place got two identical labels at
        // the same offset from z3.8 on, and the two fought for placement frame by
        // frame: text flickering in and out over the Alps.
        filter: [
          "all",
          ["==", ["get", "curated"], 1],
          ["!=", ["get", "tier"], 1],
        ],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4.2, 10, 9, 12],
          "text-offset": [0, 0.95],
          "text-anchor": "top",
          "text-padding": 5,
          "text-optional": true,
          "text-max-width": 9,
        },
        paint: {
          "text-color": "#c8dced",
          "text-halo-color": "#04070c",
          "text-halo-width": 1.6,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3.8,
            0,
            4.7,
            0.85,
          ],
        },
      });

      const pick = (x: number, y: number): MapGeoJSONFeature | undefined => {
        const r = 9;
        const hits = map_.queryRenderedFeatures(
          [
            [x - r, y - r],
            [x + r, y + r],
          ],
          { layers: DOT_LAYERS.filter((id) => map_.getLayer(id)) },
        );
        return hits[0];
      };

      map_.on("click", (e) => {
        const hit = pick(e.point.x, e.point.y);
        if (hit?.properties?.slug) selectRef.current(hit.properties.slug);
      });

      /* Hit-testing is a spatial query over three layers and 1,288 features.
         Doing it on every pointer event means ~60 queries a second competing with
         tile loading — and during a wheel zoom the pointer never stops moving, so
         it ran through the whole gesture. Skip it while the camera is moving, and
         throttle the rest. */
      let lastPick = 0;
      let hovering = false;
      map_.on("mousemove", (e) => {
        if (map_.isMoving()) return;
        const now = performance.now();
        if (now - lastPick < 60) return;
        lastPick = now;
        const on = Boolean(pick(e.point.x, e.point.y));
        if (on !== hovering) {
          hovering = on;
          map_.getCanvas().style.cursor = on ? "pointer" : "";
        }
      });

      setReady(true);
    };

    map_.on("style.load", bootstrap);
    map_.on("load", bootstrap);
    const t = window.setTimeout(() => {
      if (map_.isStyleLoaded()) bootstrap();
    }, 2500);

    /* If the style never arrives, the usual cause is a page opened straight off
       disk: browsers block MapLibre's blob workers on file:// origins. Say so
       rather than leaving a black rectangle. */
    const guard = window.setTimeout(() => {
      if (!booted.current) setStalled(true);
    }, 8000);

    map_.on("error", (e) => {
      if (import.meta.env.DEV) console.error("[terrane] map error", e?.error);
    });

    const ro = new ResizeObserver(() => map_.resize());
    if (holder.current) ro.observe(holder.current);

    return () => {
      ro.disconnect();
      window.clearTimeout(t);
      window.clearTimeout(guard);
      contours.current?.destroy();
      contours.current = null;
      booted.current = false;
      map_.remove();
      map.current = null;
      setReady(false);
    };
  }, []);

  /* ── layer switches ────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    applyVisibility(map_, layers);
    contours.current?.setEnabled(layers.contours);
  }, [layers, ready]);

  /* ── data updates (filters) ────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const src = map_.getSource("places") as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(places));
  }, [places, ready]);

  /* ── selection ─────────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    const place = selected ? places.find((p) => p.slug === selected) : undefined;

    const src = map_.getSource("selected") as GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: place
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [place.lon, place.lat] },
              properties: {},
            },
          ]
        : [],
    });

    if (!place) return;
    map_.flyTo({
      center: [place.lon, place.lat],
      // Globe zoom covers far more ground than mercator at the same number, so
      // a place needs a closer zoom than the mercator value would suggest.
      zoom: Math.max(map_.getZoom(), 6.4),
      pitch: pitchForZoom(Math.max(map_.getZoom(), 6.4)),
      speed: 0.7,
      curve: 1.5,
      essential: true,
      padding:
        window.innerWidth > 900 ? { right: 380, bottom: 40 } : { bottom: 300 },
    });
  }, [selected, ready, places]);

  /* ── camera travel: pitch follows zoom ───────────────
     Far out you look straight at the globe; as you close on a range the camera
     tilts so ridges and valleys read as relief instead of paint. Automatic
     until the moment you pitch the camera yourself, then it hands over. */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !ready) return;
    let userPitched = false;

    const onPitchStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userPitched = true;
    };

    /* Never touch the camera while MapLibre is animating a flight — a setPitch
       mid-flight cancels it (that bug stopped selections at zoom 2 instead of
       6.4). Programmatic flights carry their own pitch; this only handles
       zooming by hand. */
    let lastPitch = 0;
    const applyPitch = () => {
      if (userPitched || map_.isEasing()) return;
      // setPitch re-renders the whole camera, so doing it on every zoom frame
      // doubles the work of a gesture. Eight times a second still reads as
      // continuous, and only when the tilt has actually moved.
      const now = performance.now();
      if (now - lastPitch < 120) return;
      const target = pitchForZoom(map_.getZoom());
      if (Math.abs(map_.getPitch() - target) > 1.2) {
        lastPitch = now;
        map_.setPitch(target);
      }
    };

    const onMoveEnd = () => {
      applyPitch();
    };

    /* Warm the HTTP cache for the level you are zooming into.

       MapLibre 5 has no tile prefetching (the old prefetchZoomDelta is gone), so
       every zoom step is a cold request for a whole new pyramid — that pause is
       the "unsmooth" part. While a gesture is running we fetch the tiles the next
       integer zoom will need, so MapLibre's own request is a cache hit. Capped at
       eight tiles every 700 ms so a long drag can't turn into a download. */
    let lastPrefetch = 0;
    const prefetch = () => {
      const now = performance.now();
      if (now - lastPrefetch < 700) return;
      lastPrefetch = now;

      const spec = map_.getStyle()?.sources?.openmaptiles;
      const template =
        spec && "tiles" in spec && Array.isArray(spec.tiles)
          ? spec.tiles[0]
          : undefined;
      if (!template || !template.includes("{z}")) return;

      const z = Math.min(13, Math.ceil(map_.getZoom() + 0.4));
      const n = 2 ** z;
      const b = map_.getBounds();
      const x0 = Math.floor(((b.getWest() + 180) / 360) * n);
      const x1 = Math.floor(((b.getEast() + 180) / 360) * n);
      const lat2y = (lat: number) => {
        const r = (lat * Math.PI) / 180;
        return Math.floor(
          ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
        );
      };
      const y0 = lat2y(Math.min(85, b.getNorth()));
      const y1 = lat2y(Math.max(-85, b.getSouth()));

      const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
      const tiles: [number, number][] = [];
      for (let x = x0; x <= x1 && tiles.length < 32; x += 1) {
        for (let y = y0; y <= y1 && tiles.length < 32; y += 1) {
          tiles.push([clamp(x), clamp(y)]);
        }
      }
      const step = Math.max(1, Math.ceil(tiles.length / 8));
      for (let i = 0; i < tiles.length; i += step) {
        const [x, y] = tiles[i];
        const url = template
          .replace("{z}", String(z))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        void fetch(url, { mode: "cors" }).catch(() => undefined);
      }
    };

    map_.on("pitchstart", onPitchStart);
    map_.on("zoom", prefetch);
    map_.on("zoom", applyPitch);
    map_.on("moveend", onMoveEnd);

    return () => {
      map_.off("zoom", applyPitch);
      map_.off("zoom", prefetch);
      map_.off("moveend", onMoveEnd);
      map_.off("pitchstart", onPitchStart);
    };
  }, [ready]);

  /* ── external focus ────────────────────────────────── */
  useEffect(() => {
    const map_ = map.current;
    if (!map_ || !focus || !ready) return;
    map_.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom,
      pitch: pitchForZoom(focus.zoom),
      speed: 0.75,
      curve: 1.45,
      essential: true,
    });
  }, [focus, ready]);

  return (
    <div className="globe" ref={holder} aria-label="Interactive globe">
      {stalled && (
        <p className="globe-stalled mono" role="status">
          The globe couldn’t start. Opening this file straight from disk blocks the
          map’s background workers — serve it instead, e.g.{" "}
          <code>npx serve .</code>
        </p>
      )}
    </div>
  );
}
