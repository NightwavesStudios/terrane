import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import { CATEGORIES, FAMILIES, type Family } from "../data/features";
import { GUIDE_KINDS } from "../data/guide";
import { useGuideCatalog } from "../lib/guide";
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
  /** How many times the real elevation the mesh is drawn at. */
  exaggeration: number;
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
  /** Routes are their own layer, not a category of pin. */
  experience: boolean;
  expCats: Record<string, boolean>;
}

export const DEFAULT_LAYERS: LayerState = {
  relief: true,
  terrain: true,
  exaggeration: 1.4,
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
  experience: true,
  expCats: Object.fromEntries(GUIDE_KINDS.map((c) => [c.id, true])),
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
  onOpen,
}: {
  value: LayerState;
  onChange: (next: LayerState) => void;
  /** Called when the panel opens, so a place card does not sit behind it. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const manifest = useManifest();
  const experience = useGuideCatalog();
  const expCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of experience.rows) {
      counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    }
    return counts;
  }, [experience.rows]);
  const rawCount = (id: string) =>
    Number((manifest.byCategory as Record<string, number>)[id] ?? 0);
  const count = (id: string) => compact.format(rawCount(id));
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    /* `pointerdown`, not `mousedown`: a finger tap has to dismiss the panel the
       same way a click does, and on touch `mousedown` only arrives after the
       browser has finished synthesising it. */
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* The list is capped by the space between the toggle and the filter bar, which
     differs at 390 px, 360 px and landscape — and the bar's own height changes
     when the chips wrap. Measuring the open panel beats a media-query guess: it
     is right on every screen and after a rotation, and the list scrolls. */
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const el = panel.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const bar = document.querySelector(".globe-filters");
      const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      /* No lower floor beyond a usable sliver: a landscape phone has ~130 px
         between the toggle and the bar, and a 180 px floor would push the list
         through the bar. */
      el.style.maxHeight = `${Math.max(88, Math.round(bottom - top - 12))}px`;
    };
    fit();
    /* The bar re-wraps after a resize (chips move, a row is added), which moves
       the bottom this list is measured against, so watch it while open. */
    const ro = new ResizeObserver(fit);
    const bar = document.querySelector(".globe-filters");
    if (bar) ro.observe(bar);
    const later = window.setTimeout(fit, 400);
    const settled = window.setTimeout(fit, 1000);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.clearTimeout(later);
      window.clearTimeout(settled);
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
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
  const active = baseOn + activeCats + (value.experience ? 1 : 0);
  const total = BASE_ROWS.length + CATEGORIES.length + 1;
  const activeExp = GUIDE_KINDS.filter((c) => value.expCats[c.id]).length;

  function setExpCat(id: string, on: boolean) {
    onChange({ ...value, expCats: { ...value.expCats, [id]: on } });
  }

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
        onClick={() => {
          const next = !open;
          if (next) onOpen?.();
          setOpen(next);
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Layers
        <span className="layers-count">
          {active}/{total}
        </span>
      </button>

      {open && (
        <div className="layers-panel" role="group" aria-label="Map layers" ref={panel}>
          {/* Routes first and on their own: an experience is not a pin, and the
              panel says so before the lists of peaks and campsites. */}
          <div className="layers-group layers-group--experiences">
            <label className="layers-row layers-row--group layers-row--experience">
              <input
                type="checkbox"
                checked={value.experience}
                onChange={() => onChange({ ...value, experience: !value.experience })}
              />
              <span className="layers-text">
                <span className="layers-label">Experiences</span>
                <span className="layers-note mono">
                  {experience.rows.length
                    ? `${experience.rows.length.toLocaleString("en-US")} curated · ${activeExp}/${GUIDE_KINDS.length} on`
                    : "loading experiences…"}
                </span>
              </span>
            </label>
            {GUIDE_KINDS.map((cat) => (
              <label className="layers-row layers-row--cat" key={cat.id}>
                <input
                  type="checkbox"
                  checked={value.experience && value.expCats[cat.id]}
                  onChange={() => setExpCat(cat.id, !value.expCats[cat.id])}
                />
                <span className="layers-text">
                  <span className="layers-label layers-label--cat">
                    <i className="cat-dot cat-dot--experience" style={{ background: cat.colour }} />
                    {cat.label}
                  </span>
                  <span className="layers-note mono">
                    {compact.format(expCounts[cat.id] ?? 0)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {BASE_ROWS.map((row) => (
            <Fragment key={row.key}>
              <label className="layers-row">
                <input
                  type="checkbox"
                  checked={Boolean(value[row.key])}
                  onChange={() => onChange({ ...value, [row.key]: !value[row.key] })}
                />
                <span className="layers-text">
                  <span className="layers-label">{row.label}</span>
                  {row.key === "terrain" ? (
                    <span className="layers-note mono">
                      {value.terrain ? `${value.exaggeration.toFixed(1)}× height` : "flat"}
                    </span>
                  ) : null}
                </span>
              </label>
              {row.key === "terrain" && value.terrain ? (
                <label className="layers-row layers-row--slider">
                  <span className="layers-text">
                    <span className="layers-label layers-label--cat">Exaggeration</span>
                    <span className="layers-note mono">{value.exaggeration.toFixed(1)}×</span>
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={value.exaggeration}
                    aria-label="Terrain exaggeration"
                    onChange={(e) => onChange({ ...value, exaggeration: Number(e.target.value) })}
                  />
                </label>
              ) : null}
            </Fragment>
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
