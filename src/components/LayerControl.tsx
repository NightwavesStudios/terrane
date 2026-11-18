import { useEffect, useMemo, useRef, useState } from "react";
import { KIT_ICONS, iconDataUrl, type KitIcon } from "../map/campIcon";
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
  caravan: "Caravan site",
  toilets: "Toilets",
  shower: "Shower",
  info: "Information",
  trailhead: "Trailhead",
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

/* The map's own furniture: terrain, lines and labels. Separate from the pins
   because turning off a road is not the same decision as turning off a campsite. */
const BASE_ROWS: { key: keyof LayerState; label: string; note: string }[] = [
  { key: "relief", label: "Relief", note: "Hillshade from the DEM" },
  { key: "contours", label: "Contours", note: "From zoom 10" },
  { key: "trails", label: "Footpaths", note: "Dashed lines and names, from zoom 12" },
  { key: "roads", label: "Roads", note: "Tracks and roads, from zoom 10" },
  { key: "borders", label: "Borders", note: "Country and state lines" },
  { key: "labels", label: "Map labels", note: "Countries, cities, water" },
];

/* Every point on the map, in one list, ordered by priority: what you would keep if
   you could only keep one thing, down to what you would drop first. They are
   sub-rows of one switch because they answer one question — "how much do I want to
   see out here" — and four separate checkboxes pretended they were unrelated. */
const POINT_ROWS: { key: keyof LayerState; label: string; note: string }[] = [
  {
    key: "places",
    label: "The named places",
    note: "Written-up and generated together, ranked by how major they are — two names per country first, the rest as you zoom",
  },
  {
    key: "reach",
    label: "The famous long tail",
    note: "Peaks, lakes, parks and coasts that have a Wikipedia entry, the most-covered first",
  },
  {
    key: "poi",
    label: "Everything mapped",
    /* The count is read from the harvest report, not typed: the switch says how
       much there is to find, and a stale number here would be a lie about the
       coverage on the map. */
    note: `${POI_STATS.total.toLocaleString("en-US")} camps, huts, shelters, water points, viewpoints, car parks and boards from ${POI_STATS.extracts} OpenStreetMap extracts — camps and water at regional zoom, car parks and toilets only when you are on the street`,
  },
  {
    key: "camp",
    label: "Camps around written-up places",
    note: "The nearest first, the rest as you zoom — lowest priority, kept last",
  },
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
                <span className="layers-note mono">{row.note}</span>
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
                {allPoints
                  ? "Everything below, highest priority first"
                  : pointsOn === 0
                    ? "Hidden — tick to show the map's pins again"
                    : `${pointsOn} of ${POINT_ROWS.length} priorities on`}
              </span>
            </span>
          </label>

          <div id="layers-points" style={{ paddingLeft: 22 }}>
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
