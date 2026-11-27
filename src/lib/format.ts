export type Units = "metric" | "imperial";

export function formatElevation(
  metres: number | undefined,
  units: Units = "metric",
): string {
  if (metres === undefined || !Number.isFinite(metres)) return "Unknown";
  if (units === "imperial") {
    return `${Math.round(metres * 3.28084).toLocaleString("en-US")} ft`;
  }
  return `${Math.round(metres).toLocaleString("en-US")} m`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
