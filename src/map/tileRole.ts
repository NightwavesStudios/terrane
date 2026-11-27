/**
 * Which level a DEM request is, and what may stand in for it.
 *
 * MapLibre asks for more than one level at a time: the camera's own level, the
 * level one deeper (mesh refinement, drawn on top of the camera's surface), and
 * coarser parents that sit *behind* it. A camera or child tile answered from a
 * coarse ancestor — or from the fallback provider — lands beside native tiles
 * whose heights differ by tens of metres at the shared edge, and MapLibre draws
 * its terrain skirt wall on exactly that disagreement. That is the fin.
 *
 * Kept free of MapLibre and of the worker so the rule can be pinned in a test.
 */

export type TileRole = "camera" | "child" | "under" | "over" | "unknown";

export function tileRole(z: number, cameraZoom: number, moving: boolean): TileRole {
  if (cameraZoom < 0) return "unknown";
  if (moving) return "unknown";
  const ideal = Math.round(cameraZoom);
  if (z === ideal) return "camera";
  if (z === ideal + 1) return "child";
  if (z < ideal) return "under";
  return "over";
}

/**
 * Whether a coarser surface may stand in for this tile.
 *
 * Only for tiles that are not on screen in their own right: the parents drawn
 * behind the camera's surface, and levels deeper than the refinement. Mid-gesture
 * nothing is settled and the answer is thrown away anyway, so the old behaviour
 * is kept for that window.
 */
export function allowsCoarseStandIn(role: TileRole, moving: boolean): boolean {
  if (moving) return true;
  return role === "under" || role === "over";
}

/** Tiles that must be served by a native surface or not at all. */
export function needsNativeSurface(role: TileRole): boolean {
  return role === "camera" || role === "child";
}
