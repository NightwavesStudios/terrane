export function formatElevation(metres: number | undefined): string {
  if (metres === undefined || !Number.isFinite(metres)) return "—";
  return `${Math.round(metres).toLocaleString("en-US")} m`;
}
