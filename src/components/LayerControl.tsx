import { useEffect, useMemo, useRef, useState } from "react";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import { CATEGORIES, FAMILIES, type Family } from "../data/features";
import { useManifest } from "../lib/live";

/**
 * Every switch on the map, grouped by what a person is looking for rather than by
 * which harvest a pin came from. There is no "named", "famous", "mapped" or
 * "nearby" row: those were four names for one thing.
 *
 * The base map is not a category, and a destination owns its own labels. A group
 * master turns a whole family on or off; a row turns one category on or off.
 */
export interface LayerState {
  relief: boolean;
  /** The 3D mesh; `relief` still owns the hillshade and the snow. */
  terrain: boolean;
  hillshade: boolean;
  snow: boolean;
  contours: boolean;
  contourLabels: boolean;
  trails: boolean;
  roads: boolean;
  roadLabels: boolean;
  parks: boolean;
  borders: boolean;
  labels: boolean;
  /** Master switch for every point on the map. */
  features: boolean;
  cats: Record<string, boolean>;
}

export const DEFAULT_LAYERS: LayerState = {
  relief: true,
  /* Off by default, measured: on a 1280×800 M4 viewport the mesh cuts the 0.4-zoom
     gesture from 55.8 to 10.6 fps at z11 and from 60.2 to 20.4 fps at z14
     (medians of nine runs; docs/performance.md). Worth a switch, not a default. */
  terrain: false,
  hillshade: true,
  snow: true,
  contours: false,
  contourLabels: true,
  trails: true,
  roads: true,
  roadLabels: true,
  parks: true,
  borders: true,
  labels: true,
  features: true,
  cats: Object.fromEntries(CATEGORIES.map((c) => [c.id, true])),
};

const BASE_ROWS: { key: keyof LayerState; label: string }[] = [
  { key: "relief", label: "Relief" },
  { key: "terrain", label: "3D terrain" },
  { key: "hillshade", label: "Hillshade" },
  { key: "snow", label: "Elevation snow" },
  { key: "contours", label: "Contours" },
  { key: "contourLabels", label: "Contour labels" },
  { key: "trails", label: "Paths" },
  { key: "roads", label: "Roads" },
  { key: "roadLabels", label: "Road names" },
  { key: "parks", label: "Park areas" },
  { key: "borders", label: "Borders" },
  { key: "labels", label: "Labels" },
];

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 0,
});

export default function LayerControl({
  value,
  onChange,
}: {
  value: LayerState;
  onChange: (next: LayerState) => void;
}) {
  const [open, setOpen] = useState(false);
  const manifest = useManifest();
  const rawCount = (id: string) =>
    Number((manifest.byCategory as Record<string, number>)[id] ?? 0);
  const count = (id: string) => compact.format(rawCount(id));
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

  /* Pictograms are drawn once, when the panel first opens. */
  const icons = useMemo(
    () =>
      (open
        ? Object.fromEntries(
            CATEGORIES.filter((c) => c.icon).map((c) => [
              c.id,
              iconDataUrl(c.icon as KitIcon, 32),
            ]),
          )
        : {}) as Record<string, string>,
    [open],
  );

  const activeCats = CATEGORIES.filter((c) => value.features && value.cats[c.id]).length;
  const baseOn = BASE_ROWS.filter((r) => value[r.key]).length;
  const active = baseOn + activeCats;
  const total = BASE_ROWS.length + CATEGORIES.length;

  function setCats(ids: string[], on: boolean) {
    const cats = { ...value.cats };
    for (const id of ids) cats[id] = on;
    onChange({ ...value, cats });
  }

  function group(id: Family) {
    const cats = CATEGORIES.filter((c) => c.family === id);
    const on = cats.filter((c) => value.cats[c.id]).length;
    const all = on === cats.length;
    return (
      <div className="layers-group" key={id}>
        <label className="layers-row layers-row--group">
          <input
            type="checkbox"
            checked={value.features && all}
            onChange={() => setCats(cats.map((c) => c.id), !all)}
          />
          <span className="layers-text">
            <span className="layers-label">
              {FAMILIES.find((f) => f.id === id)?.label}
            </span>
            <span className="layers-note mono">
              {on}/{cats.length}
            </span>
          </span>
        </label>
        {cats.map((cat) => (
          <label className="layers-row layers-row--cat" key={cat.id}>
            <input
              type="checkbox"
              checked={value.features && value.cats[cat.id]}
              onChange={() => setCats([cat.id], !value.cats[cat.id])}
            />
            <span className="layers-text">
              <span className="layers-label layers-label--cat">
                {cat.icon ? (
                  <img src={icons[cat.id]} alt="" width={13} height={13} />
                ) : (
                  <i className="cat-dot" style={{ background: cat.colour }} />
                )}
                {cat.label}
              </span>
              <span className="layers-note mono">
                {rawCount(cat.id) < 100 ? (
                  <em className="layers-sparse" title="Few records: this category is a selection, not a census">
                    sparse ·{" "}
                  </em>
                ) : null}
                {count(cat.id)}
              </span>
            </span>
          </label>
        ))}
      </div>
    );
  }

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
                checked={Boolean(value[row.key])}
                onChange={() => onChange({ ...value, [row.key]: !value[row.key] })}
              />
              <span className="layers-text">
                <span className="layers-label">{row.label}</span>
              </span>
            </label>
          ))}

          <label className="layers-row layers-row--group">
            <input
              type="checkbox"
              checked={value.features}
              onChange={() => onChange({ ...value, features: !value.features })}
            />
            <span className="layers-text">
              <span className="layers-label">Places &amp; pins</span>
              <span className="layers-note mono">
                {value.features ? `${activeCats} on` : "off"}
              </span>
            </span>
          </label>

          {FAMILIES.map((f) => group(f.id))}
        </div>
      )}
    </div>
  );
}
