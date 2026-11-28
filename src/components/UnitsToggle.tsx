import { useState } from "react";
import type { Units } from "../lib/format";
import { useRecord } from "../state/RecordContext";

const options: { value: Units; label: string; name: string }[] = [
  { value: "imperial", label: "ft", name: "feet" },
  { value: "metric", label: "m", name: "metres" },
];

export default function UnitsToggle() {
  const { units, setUnits, hydrated } = useRecord();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(next: Units) {
    if (next === units || busy) return;
    setError("");
    setBusy(true);
    try {
      await setUnits(next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The unit preference could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="units-toggle-wrap"
      title={error || "Elevation units"}
      data-units={units}
    >
      <div className="units-toggle" role="group" aria-label="Elevation units">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`Use ${option.name}`}
            aria-pressed={units === option.value}
            disabled={busy || !hydrated}
            onClick={() => void choose(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {error
          ? `Unit preference not saved: ${error}`
          : `Elevations are shown in ${units === "metric" ? "metres" : "feet"}.`}
      </span>
    </div>
  );
}
