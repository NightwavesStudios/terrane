import { useRef } from "react";
import { useScrollRow } from "../lib/useScrollRow";
import type { GlobeLens } from "./LayerControl";

const MODES: { id: GlobeLens; label: string; hint: string }[] = [
  { id: "peaks", label: "Peaks", hint: "Peaks and volcanoes, with curated peak places" },
  { id: "places", label: "Places", hint: "Curated parks, lakes, coasts and landmarks" },
  { id: "around", label: "Around", hint: "Mapped camps, huts, water and trailheads" },
  { id: "all", label: "All", hint: "Every recorded destination and practical pin" },
];

/**
 * The globe's one row of choices.
 *
 * The old strip listed every destination kind and left the practical pins
 * unspoken. These four lenses answer the questions the map is actually asked,
 * and Lists opens the sourced progress sheet without leaving the globe.
 */
export default function GlobeDock({
  value,
  onChange,
  onLists,
  onMore,
}: {
  value: GlobeLens;
  onChange: (lens: GlobeLens) => void;
  onLists: () => void;
  onMore: () => void;
}) {
  const row = useScrollRow();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="map-dock map-dock--dark">
      <div
        className="chip-row map-dock-row"
        data-start={row.edges.start ? "" : undefined}
        data-end={row.edges.end ? "" : undefined}
      >
        <div
          className="chips chips--dark chip-row-track"
          ref={row.ref}
          {...row.handlers}
          role="group"
          aria-label="What the globe shows"
        >
          {MODES.map((mode) => (
            <button
              key={mode.id}
              data-row-item
              ref={mode.id === value ? activeRef : undefined}
              className={`chip${value === mode.id ? " on" : ""}`}
              aria-pressed={value === mode.id}
              title={mode.hint}
              onClick={() => onChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
          <button
            data-row-item
            className="chip chip--lists"
            onClick={onLists}
            title="The sourced peakbagging lists"
          >
            Lists
          </button>
          <button
            data-row-item
            className="chip chip--more"
            onClick={onMore}
            title="Every map layer and switch"
          >
            Layers
          </button>
        </div>
      </div>
    </div>
  );
}
