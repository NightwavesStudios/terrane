import { useEffect, useRef } from "react";
import { TYPE_LABEL_PLURAL, type PlaceType } from "../data/places";
import { revealRowItem, useScrollRow } from "../lib/useScrollRow";
import type { Filter, HomeScope } from "../lib/filters";

/**
 * The map's filter strip: where you are first, then the destination kinds.
 *
 * The visitor's own scope is pinned to the leading edge and never scrolls away,
 * because "near me" is the first question the map is asked. The destination
 * types scroll beside it — right to left, by drag, trackpad, swipe or arrow key
 * — and the row never wraps, so the bar keeps one height at every width instead
 * of reflowing the card above it when a region name arrives.
 *
 * The trailing chip opens the full category list in the Layers panel, so the
 * strip can stay short without hiding the other thirteen categories.
 */
export default function FilterChips({
  value,
  onChange,
  tone,
  scope,
  onMore,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  tone: "dark" | "light";
  scope?: HomeScope | null;
  /** Opens the Layers panel, where every category lives. */
  onMore?: () => void;
}) {
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All destinations" },
    ...(Object.keys(TYPE_LABEL_PLURAL) as PlaceType[]).map((id) => ({
      id: id as Filter,
      label: TYPE_LABEL_PLURAL[id],
    })),
  ];

  const row = useScrollRow();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (value === "all" || value === "home") return;
    revealRowItem(activeRef.current);
  }, [value]);

  return (
    <div className={`map-dock map-dock--${tone}`}>
      {scope ? (
        <button
          className={`map-dock-scope${value === "home" ? " on" : ""}`}
          aria-pressed={value === "home"}
          onClick={() => onChange("home")}
          title={`Near you: ${scope.label}`}
        >
          <span className="map-dock-pin" aria-hidden="true">
            ◉
          </span>
          <span className="map-dock-scope-name">{scope.label}</span>
          <span className="sr-only"> — places near your location</span>
        </button>
      ) : null}

      <div
        className="chip-row map-dock-row"
        data-start={row.edges.start ? "" : undefined}
        data-end={row.edges.end ? "" : undefined}
      >
        <div
          className={`chips chips--${tone} chip-row-track`}
          ref={row.ref}
          {...row.handlers}
          role="group"
          aria-label="Filter places by kind"
        >
          {filters.map((f) => (
            <button
              key={f.id}
              data-row-item
              ref={f.id === value ? activeRef : undefined}
              className={`chip ${value === f.id ? "on" : ""}`}
              aria-pressed={value === f.id}
              onClick={() => onChange(f.id)}
            >
              {f.label}
            </button>
          ))}
          {onMore ? (
            <button
              data-row-item
              className="chip chip--more"
              onClick={onMore}
              title="Every category, in the Layers panel"
            >
              All categories
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
