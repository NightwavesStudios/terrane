import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PLACES, useAtlas } from "../../data/places";
import { revealRowItem, useScrollRow } from "../../lib/useScrollRow";

/**
 * Search, a nearby-place filter and one scrollable row of chips.
 *
 * Experiences and Collections are two catalogues with the same question in front
 * of them, and they used to answer it with two near-identical copies of the same
 * markup — including a native `<datalist>` holding all 1,213 atlas rows, which
 * every browser renders and behaves differently. One component, one combobox.
 */

export type CatalogNear = { lat: number; lon: number; label: string };
export type CatalogChip = { id: string; label: string; title?: string };

export default function CatalogControls({
  searchLabel,
  searchPlaceholder,
  term,
  onTerm,
  nearPlaceholder,
  nearTerm,
  onNearTerm,
  near,
  onNear,
  chipsLabel,
  chips,
  activeChip,
  onChip,
  onReset,
}: {
  searchLabel: string;
  searchPlaceholder: string;
  term: string;
  onTerm: (value: string) => void;
  nearPlaceholder: string;
  nearTerm: string;
  onNearTerm: (value: string) => void;
  near: CatalogNear | null;
  onNear: (value: CatalogNear | null) => void;
  chipsLabel: string;
  chips: CatalogChip[];
  activeChip: string | null;
  onChip: (id: string | null) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  /* The atlas lands after the shell; its version re-runs the options memo. */
  const atlas = useAtlas();
  const listId = useId();
  const row = useScrollRow();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /* Two characters before searching: one letter matches half the atlas and the
     list would cover the field it belongs to. */
  const options = useMemo(() => {
    const q = nearTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    const bits = q.split(/\s+/);
    return PLACES.filter((place) => {
      const haystack =
        `${place.name} ${place.country} ${place.region ?? ""}`.toLowerCase();
      return bits.every((bit) => haystack.includes(bit));
    }).slice(0, 8);
  }, [nearTerm, atlas]);

  useEffect(() => {
    setCursor(0);
  }, [nearTerm]);

  useEffect(() => {
    if (!activeChip) return;
    revealRowItem(activeRef.current);
  }, [activeChip]);

  function choose(index: number) {
    const place = options[index];
    if (!place) return;
    onNearTerm(`${place.name} — ${place.country}`);
    onNear({ lat: place.lat, lon: place.lon, label: place.name });
    setOpen(false);
  }

  const filtered = Boolean(term.trim() || near || activeChip);

  return (
    <div className="catalog-controls">
      <div className="catalog-row">
        <div className="catalog-field">
          <input
            value={term}
            onChange={(event) => onTerm(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            spellCheck={false}
            autoComplete="off"
          />
          {term ? (
            <button
              className="catalog-clear mono"
              onClick={() => onTerm("")}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>

        <div
          className="catalog-field catalog-field--near"
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            setOpen(false);
          }}
        >
          <input
            value={nearTerm}
            onChange={(event) => {
              onNearTerm(event.target.value);
              onNear(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setCursor((current) => Math.min(options.length - 1, current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter" && open && options[cursor]) {
                event.preventDefault();
                choose(cursor);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={nearPlaceholder}
            aria-label="Filter by a nearby place"
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
          />
          {near ? (
            <button
              className="catalog-clear mono"
              onClick={() => {
                onNearTerm("");
                onNear(null);
              }}
              aria-label="Clear the nearby place"
            >
              ×
            </button>
          ) : null}

          {open && options.length > 0 ? (
            <ul className="catalog-near-list" id={listId} role="listbox">
              {options.map((place, index) => (
                <li key={place.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    className={`catalog-near-option${index === cursor ? " on" : ""}`}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => choose(index)}
                  >
                    <span className="catalog-near-name">{place.name}</span>
                    <span className="mono catalog-near-where">{place.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {filtered ? (
          <button className="catalog-reset mono" onClick={onReset}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div
        className="chip-row"
        data-start={row.edges.start ? "" : undefined}
        data-end={row.edges.end ? "" : undefined}
      >
        <div
          className="chips chips--light chip-row-track"
          ref={row.ref}
          {...row.handlers}
          role="group"
          aria-label={chipsLabel}
        >
          <button
            data-row-item
            className={`chip${activeChip ? "" : " on"}`}
            aria-pressed={!activeChip}
            onClick={() => onChip(null)}
          >
            All
          </button>
          {chips.map((chip) => (
            <button
              key={chip.id}
              data-row-item
              ref={activeChip === chip.id ? activeRef : undefined}
              className={`chip${activeChip === chip.id ? " on" : ""}`}
              aria-pressed={activeChip === chip.id}
              title={chip.title}
              onClick={() => onChip(activeChip === chip.id ? null : chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
