import { useEffect, useRef, useState } from "react";

export interface LayerState {
  relief: boolean;
  contours: boolean;
  trails: boolean;
  detail: boolean;
  labels: boolean;
  places: boolean;
}

export const DEFAULT_LAYERS: LayerState = {
  relief: true,
  contours: false,
  trails: true,
  detail: true,
  labels: true,
  places: true,
};

const ROWS: { key: keyof LayerState; label: string; note: string }[] = [
  { key: "relief", label: "Relief", note: "Hillshade from the DEM" },
  { key: "contours", label: "Contours", note: "From zoom 10" },
  { key: "trails", label: "Hiking trails", note: "Marked routes, from zoom 10" },
  { key: "detail", label: "Roads & borders", note: "Access and boundaries" },
  { key: "labels", label: "Place labels", note: "Names as you zoom" },
  { key: "places", label: "Places", note: "Peaks, parks, landmarks" },
];

export default function LayerControl({
  value,
  onChange,
}: {
  value: LayerState;
  onChange: (next: LayerState) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = ROWS.filter((r) => value[r.key]).length;

  return (
    <div className="layers" ref={box}>
      <button
        className="layers-toggle mono"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Layers
        <span className="layers-count">
          {active}/{ROWS.length}
        </span>
      </button>

      {open && (
        <div className="layers-panel" role="group" aria-label="Map layers">
          {ROWS.map((row) => (
            <label className="layers-row" key={row.key}>
              <input
                type="checkbox"
                checked={value[row.key]}
                onChange={() => onChange({ ...value, [row.key]: !value[row.key] })}
              />
              <span className="layers-text">
                <span className="layers-label">{row.label}</span>
                <span className="layers-note mono">{row.note}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
