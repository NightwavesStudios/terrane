export function formatElevation(metres: number | undefined): string {
  if (metres === undefined || !Number.isFinite(metres)) return "—";
  return `${Math.round(metres).toLocaleString("en-US")} m`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatCoord(value: number, axis: "lat" | "lon"): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}° ${hemisphere}`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${formatCoord(lat, "lat")} · ${formatCoord(lon, "lon")}`;
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDistance(km: number): string {
  if (km < 1) return "same neighbourhood";
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

/** "2026-01-04" in local time, for date inputs and new entries. */
export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
