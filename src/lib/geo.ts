/** A closed lon/lat ring of `radiusKm` around a point, for map area outlines. */
export function circleRing(
  lat: number,
  lon: number,
  radiusKm: number,
  steps = 64,
): [number, number][] {
  const rad = Math.PI / 180;
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.max(0.12, Math.cos(lat * rad)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lon + Math.cos(angle) * dLon, lat + Math.sin(angle) * dLat]);
  }
  return ring;
}

/** Great-circle distance in kilometres between two decimal-degree points. */
export function kmBetween(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
