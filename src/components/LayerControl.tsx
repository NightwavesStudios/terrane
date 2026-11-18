import { useEffect, useMemo, useRef, useState } from "react";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import POI_STATS from "../data/poi-stats.json";

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

const KIT_LABEL: Record<KitIcon, string> = {
  "camp-tent": "Camp",
  "camp-hut": "Hut",
  "camp-shelter": "Shelter",
  "water-drop": "Water",
  parking: "Parking",
  "picnic-table": "Picnic",
  viewpoint: "View",
  caravan: "Caravan",
  toilets: "Toilets",
  shower: "Shower",
  info: "Boards",
  trailhead: "Trailhead",
};

/* The key lists only what you go out there for: a night, water, somewhere to park,
   a view. The colour families and the rest of the pictograms are explained by the
   map itself, and a legend that explains everything is read by nobody. */
const PRACTICAL: KitIcon[] = [
  "camp-tent",
  "camp-hut",
  "camp-shelter",
  "water-drop",
  "parking",
  "viewpoint",
];

/* The map's own furniture. Short labels, no explanations: every one of these is a
   thing you can see, and a sentence under it does not make it easier to find. */
const BASE_ROWS: { key: keyof LayerState; label: string }[] = [
  { key: "relief", label: "Relief" },
  { key: "contours", label: "Contours" },
  { key: "trails", label: "Paths" },
  { key: "roads", label: "Roads" },
  { key: "borders", label: "Borders" },
  { key: "labels", label: "Labels" },
];

/* Every pin on the map, highest priority first. One note, one line. */
const POINT_ROWS: { key: keyof LayerState; label: string; note: string }[] = [
  { key: "places", label: "Named places", note: "ranked" },
  { key: "reach", label: "Famous places", note: "as you zoom" },
  { key: "poi", label: "Everything mapped", note: POI_STATS.extracts + " extracts" },
  { key: "camp", label: "Camps nearby", note: "nearest first" },
];

const POINT_KEYS = POINT_ROWS.map((r) => r.key);

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

  const pointsOn = POINT_KEYS.filter((k) => value[k]).length;
  const allPoints = pointsOn === POINT_KEYS.length;
  const total = BASE_ROWS.length + 1 + POINT_ROWS.length;
  const active =
    BASE_ROWS.filter((r) => value[r.key]).length + (allPoints ? 1 : 0) + pointsOn;

  function setPoints(on: boolean) {
    const next = { ...value };
    for (const key of POINT_KEYS) next[key] = on;
    onChange(next);
  }

  /* Drawn the first time the panel opens, and not again: canvases per render would
     be work with nothing to show for it, and a closed panel should not pay to paint
     a key nobody is looking at. */
  const kitSrc = useMemo(
    () =>
      (open
        ? (Object.fromEntries(PRACTICAL.map((n) => [n, iconDataUrl(n, 40)])) as Record<
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
          {active}/{total}
        </span>
      </button>

      {open && (
        <div className="layers-panel" role="group" aria-label="Map layers">
          {BASE_ROWS.map((row) => (
            <label className="layers-row" key={row.key}>
              <input
                type="checkbox"
                checked={value[row.key]}
                onChange={() => onChange({ ...value, [row.key]: !value[row.key] })}
              />
              <span className="layers-text">
                <span className="layers-label">{row.label}</span>
              </span>
            </label>
          ))}

          <label className="layers-row">
            <input
              type="checkbox"
              checked={allPoints}
              onChange={() => setPoints(!allPoints)}
              aria-controls="layers-points"
            />
            <span className="layers-text">
              <span className="layers-label">Places &amp; pins</span>
              <span className="layers-note mono">
                {allPoints ? "all" : `${pointsOn}/${POINT_ROWS.length}`}
              </span>
            </span>
          </label>

          <div id="layers-points" style={{ paddingLeft: 20 }}>
            {POINT_ROWS.map((row) => (
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

          <div className="layers-key">
            <span className="layers-key-title mono">On the ground</span>
            {PRACTICAL.map((n) => (
              <span className="layers-key-item" key={n}>
                <img src={kitSrc[n]} alt="" width={14} height={14} />
                {KIT_LABEL[n]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
