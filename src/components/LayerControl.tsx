import { useEffect, useMemo, useRef, useState } from "react";
import { KIT_ICONS, iconDataUrl, type KitIcon } from "../map/campIcon";

export interface LayerState {
  relief: boolean;
  contours: boolean;
  trails: boolean;
  roads: boolean;
  borders: boolean;
  labels: boolean;
  places: boolean;
  reach: boolean;
  poi: boolean;
  camp: boolean;
}

export const DEFAULT_LAYERS: LayerState = {
  relief: true,
  contours: false,
  trails: true,
  roads: true,
  borders: true,
  labels: true,
  places: true,
  reach: true,
  poi: true,
  camp: true,
};

/* One row per thing you can see. Land and water are deliberately absent: they are
   the base of the map, and a switch that removes the ocean is not a layer switch. */
/* The key. Half of it is text for the atlas dots, half is the same pictograms the
   map draws — the images come from campIcon.ts, so a change to a shape here and a
   change on the map can never disagree. */
const KIT_LABEL: Record<KitIcon, string> = {
  "camp-tent": "Camp site",
  "camp-hut": "Hut",
  "camp-shelter": "Shelter",
  "water-drop": "Water",
  parking: "Parking",
  "picnic-table": "Picnic table",
  viewpoint: "Viewpoint",
};

/* The long tail's four colours. Fourteen kinds would be a colour wheel nobody can
   read at four pixels; these four say rock, water, green, sand. */
const REACH_KEY: { label: string; color: string }[] = [
  { label: "Rock", color: "#8ab4d8" },
  { label: "Water", color: "#5fc9d4" },
  { label: "Green", color: "#79cf9b" },
  { label: "Sand", color: "#d9bd85" },
];

const PLACE_KEY: { label: string; color: string }[] = [
  { label: "Peak", color: "#eaf7ff" },
  { label: "Park", color: "#57f0b2" },
  { label: "Landmark", color: "#ffc766" },
  { label: "Hidden gem", color: "#c99bff" },
];

const ROWS: { key: keyof LayerState; label: string; note: string }[] = [
  { key: "relief", label: "Relief", note: "Hillshade from the DEM" },
  { key: "contours", label: "Contours", note: "From zoom 10" },
  { key: "trails", label: "Footpaths", note: "Dashed lines and names, from zoom 12" },
  { key: "roads", label: "Roads", note: "Tracks and roads, from zoom 10" },
  { key: "borders", label: "Borders", note: "Country and state lines" },
  { key: "labels", label: "Map labels", note: "Countries, cities, water" },
  { key: "places", label: "Places", note: "The 1,288 written-up markers" },
  {
    key: "reach",
    label: "More places",
    note: "Peaks, lakes, parks and coasts worldwide — the famous ones first",
  },
  {
    key: "poi",
    label: "World POIs",
    note: "Every campsite, hut, shelter, tap and viewpoint — loaded as you pan",
  },
  {
    key: "camp",
    label: "Camps near places",
    note: "Click any pin to focus it — nearest first, the rest as you zoom",
  },
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

  /* Drawn the first time the panel opens, and not again: five canvases per render
     would be work with nothing to show for it, and a closed panel should not pay
     to paint a key nobody is looking at. */
  const kitSrc = useMemo(
    () =>
      (open
        ? (Object.fromEntries(KIT_ICONS.map((n) => [n, iconDataUrl(n, 40)])) as Record<
            KitIcon,
            string
          >)
        : ({} as Record<KitIcon, string>)),
    [open],
  );

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
          <div className="layers-key">
            <span className="layers-key-title mono">Key</span>
            {PLACE_KEY.map((p) => (
              <span className="layers-key-item" key={p.label}>
                <i style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </span>
            ))}
            {REACH_KEY.map((p) => (
              <span className="layers-key-item layers-key-dot" key={p.label}>
                <i style={{ background: p.color }} aria-hidden="true" />
                {p.label}
              </span>
            ))}
            {KIT_ICONS.map((n) => (
              <span className="layers-key-item" key={n}>
                <img src={kitSrc[n]} alt="" width={14} height={14} />
                {KIT_LABEL[n]}
              </span>
            ))}
          </div>

          <p className="layers-fixed mono">
            Land, water and rivers are always drawn
          </p>
        </div>
      )}
    </div>
  );
}
