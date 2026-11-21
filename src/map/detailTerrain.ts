import type { Map as MlMap } from "maplibre-gl";
import { pitchForZoom, terrainExaggeration } from "./camera";

/**
 * The globe's 3D treatment, on the two small detail maps.
 *
 * The Guide and Collection maps draw the same basemap and the same relief source
 * as the globe, but they used to stop at the hillshade: a flat picture with light
 * on it. Relief has to stand up and the camera has to be oblique before those
 * pages read as the same product, so this attaches one terrain mesh and the same
 * zoom-to-pitch curve the globe uses.
 *
 * The mesh is created once, like the globe's, and the per-zoom height is written
 * to `terrain.exaggeration` — a uniform every frame reads — instead of calling
 * `setTerrain` again, which is what made the earlier globe flatten out at rest.
 *
 * Returns a detach function so a remount can unbind before the map is removed.
 */
export function attachTerrain(map: MlMap, base = 1.4): () => void {
  if (!map.getSource("relief")) return () => {};

  /* Same normalisation as the globe: the slider's 1.4 means "× real height" at
     detail zoom, and the ramp decides how much more the wide views need. */
  const height = () => base * (terrainExaggeration(map.getZoom()) / 1.4);

  const applyHeight = () => {
    const value = height();
    if (!map.getTerrain()) {
      map.setTerrain({ source: "relief", exaggeration: value });
      return;
    }
    if (map.terrain && Math.abs(map.terrain.exaggeration - value) > 0.01) {
      map.terrain.exaggeration = value;
      map.triggerRepaint();
    }
  };

  let userPitched = false;
  const onPitchStart = (event: { originalEvent?: unknown }) => {
    if (event.originalEvent) userPitched = true;
  };

  /* Pitch is applied when the camera comes to rest, never mid-gesture: a
     `setPitch` during a gesture re-projects the camera and throws away the tiles
     that are on screen. Once the reader has tilted by hand, the map stops
     deciding for them. */
  const onSettle = () => {
    applyHeight();
    if (userPitched) return;
    const target = pitchForZoom(map.getZoom());
    if (Math.abs(map.getPitch() - target) > 1.2) map.setPitch(target);
  };

  map.on("pitchstart", onPitchStart);
  map.on("moveend", onSettle);

  map.setPitch(pitchForZoom(map.getZoom()));
  applyHeight();

  return () => {
    map.off("pitchstart", onPitchStart);
    map.off("moveend", onSettle);
  };
}
