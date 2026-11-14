import { useEffect, useMemo, useRef, useState } from "react";
import { PLACES, TYPE_LABEL, type Place } from "../data/places";

/**
 * Map-first search. Opens from the globe (or with ⌘K / "/"), fuzzy-ish matches on
 * name, region and country, and flies the camera to whatever you pick — the card
 * opens without leaving the globe.
 *
 * It searches the places we actually hold. Mountain ranges and trails are their
 * own records in the planned geographic database and are not searchable yet.
 */
function rank(p: Place, term: string) {
  const name = p.name.toLowerCase();
  if (name === term) return 0;
  if (name.startsWith(term)) return 1;
  if (p.curated) return 2;
  if (name.includes(term)) return 3;
  return 4;
}

export default function MapSearch({
  onPick,
}: {
  onPick: (place: Place) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [cursor, setCursor] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        /^(input|textarea|select)$/i.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      field.current?.focus();
      setCursor(0);
    } else {
      setTerm("");
    }
  }, [open]);

  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    return PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.region ?? "").toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q),
    )
      .sort((a, b) => rank(a, q) - rank(b, q) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [term]);

  function choose(place: Place) {
    onPick(place);
    setOpen(false);
  }

  return (
    <>
      <button
        className="search-open mono"
        onClick={() => setOpen(true)}
        aria-label="Search the map"
      >
        <span className="search-open-label">Search</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="search-veil"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="search-box" role="dialog" aria-label="Search places">
            <input
              ref={field}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(results.length - 1, c + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(0, c - 1));
                } else if (e.key === "Enter" && results[cursor]) {
                  e.preventDefault();
                  choose(results[cursor]);
                }
              }}
              placeholder="Peak, park, range or country…"
              aria-label="Search places"
              spellCheck={false}
            />
            <ul className="search-results">
              {results.map((p, i) => (
                <li key={p.slug}>
                  <button
                    className={i === cursor ? "is-active" : ""}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(p)}
                  >
                    <span className="search-name">{p.name}</span>
                    <span className="search-meta mono">
                      {TYPE_LABEL[p.type]} · {p.region ?? p.country}
                    </span>
                  </button>
                </li>
              ))}
              {term.trim().length >= 2 && !results.length && (
                <li className="search-empty mono">Nothing matches “{term.trim()}”</li>
              )}
              {term.trim().length < 2 && (
                <li className="search-empty mono">
                  Type two letters — peaks, parks, landmarks
                </li>
              )}
            </ul>
            <p className="search-foot mono">
              ↑↓ to move · ↵ to fly there · esc to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
