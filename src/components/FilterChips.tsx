import {
  PLACES,
  TYPE_LABEL_PLURAL,
  type PlaceType,
} from "../data/places";

export type Filter = "all" | PlaceType | "georgia";

export const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: `All ${PLACES.length.toLocaleString()}` },
  { id: "peak", label: TYPE_LABEL_PLURAL.peak },
  { id: "park", label: TYPE_LABEL_PLURAL.park },
  { id: "city", label: TYPE_LABEL_PLURAL.city },
  { id: "landmark", label: TYPE_LABEL_PLURAL.landmark },
  { id: "gem", label: TYPE_LABEL_PLURAL.gem },
  { id: "georgia", label: "Georgia" },
];

export function matches(place: { type: PlaceType; region?: string }, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "georgia") return place.region?.includes("Georgia") ?? false;
  return place.type === filter;
}

export default function FilterChips({
  value,
  onChange,
  tone,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  tone: "dark" | "light";
}) {
  return (
    <div className={`chips chips--${tone}`} role="group" aria-label="Filter places">
      {FILTERS.map((f) => (
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
