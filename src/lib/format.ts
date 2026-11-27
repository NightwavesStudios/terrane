export type Units = "metric" | "imperial";

export function formatElevation(
  metres: number | undefined,
  units: Units = "metric",
  feet?: number | undefined,
): string {
  if (metres === undefined || !Number.isFinite(metres)) return "Unknown";
  if (units === "imperial") {
    const value = feet !== undefined && Number.isFinite(feet) ? feet : metres * 3.28084;
    return `${Math.round(value).toLocaleString("en-US")} ft`;
  }
  return `${Math.round(metres).toLocaleString("en-US")} m`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
