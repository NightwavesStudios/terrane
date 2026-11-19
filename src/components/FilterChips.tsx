import { TYPE_LABEL_PLURAL } from "../data/places";
import type { Filter, HomeScope } from "../lib/filters";

export default function FilterChips({
  value,
  onChange,
  tone,
  scope,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  tone: "dark" | "light";
  scope?: HomeScope | null;
}) {
  /* Three destination filters, deliberately: practical pins are switched in the
     Layers panel, and the other destination categories remain in the map and
     search rather than becoming chips. */
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All destinations" },
    { id: "peak", label: TYPE_LABEL_PLURAL.peak },
    { id: "park", label: TYPE_LABEL_PLURAL.park },
  ];
  if (scope) filters.push({ id: "home", label: scope.label });

  return (
    <div className={`chips chips--${tone}`} role="group" aria-label="Filter places">
      {filters.map((f) => (
        <button
          key={f.id}
          className={`chip ${value === f.id ? "on" : ""}`}
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
