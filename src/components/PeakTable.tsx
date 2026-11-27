import { Link } from "react-router-dom";
import { peakListLabel } from "../data/lists";
import { formatElevation, type Units } from "../lib/format";
import type { Peak } from "../types/geography";

interface Props {
  peaks: Peak[];
  completed: Set<string>;
  units: Units;
  limit?: number;
  label?: string;
}

export default function PeakTable({ peaks, completed, units, limit, label = "Peak list" }: Props) {
  const rows = limit ? peaks.slice(0, limit) : peaks;

  return (
    <div className="peak-table" role="table" aria-label={label}>
      <div className="peak-table__head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">Peak</span>
        <span role="columnheader">Range</span>
        <span role="columnheader">Elevation</span>
        <span role="columnheader">Record</span>
      </div>
      {rows.map((peak) => {
        const climbed = completed.has(peak.slug);
        return (
          <Link
            key={peak.slug}
            to={`/peaks/${peak.slug}`}
            className={`peak-row${climbed ? " peak-row--climbed" : ""}`}
            role="row"
          >
            <span className="peak-row__rank" role="cell">
              {peak.rank}
            </span>
            <span className="peak-row__name" role="cell">
              {peak.name}
              <small>{peakListLabel(peak)}</small>
            </span>
            <span className="peak-row__range" role="cell">
              {peak.range ?? "Unknown range"}
            </span>
            <span className="peak-row__elevation" role="cell">
              {formatElevation(peak.elevationM, units, peak.elevationFt)}
            </span>
            <span className="peak-row__status" role="cell">
              {climbed ? "Climbed" : "Remaining"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
