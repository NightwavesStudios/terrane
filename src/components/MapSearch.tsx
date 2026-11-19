import { useEffect, useMemo, useRef, useState } from "react";
import { categoryLabel, searchAll, type Pick } from "../data/features";

/**
 * Map-first search over every category.
 *
 * The atlas and the loaded Wikidata tail are searched by name; OSM pins join the
 * index as their cells arrive, so a camp you can see is a camp you can find. A
 * cell the map has not fetched cannot be searched, and the empty state says so
 * rather than pretending the world is only what is already in memory.
 */
export default function MapSearch({ onPick }: { onPick: (pick: Pick) => void }) {
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

  const results = useMemo(() => searchAll(term), [term]);

  function choose(pick: Pick) {
    onPick(pick);
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
              placeholder="Peak, park, camp, car park…"
              aria-label="Search places"
              spellCheck={false}
            />
            <ul className="search-results">
              {results.map((p, i) => (
                <li key={`${p.slug ?? p.cat}-${p.lat}-${p.lon}-${i}`}>
                  <button
                    className={i === cursor ? "is-active" : ""}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(p)}
                  >
                    <span className="search-name">{p.name}</span>
                    <span className="search-meta mono">
                      {categoryLabel(p.cat)}
                      {p.where ? ` · ${p.where}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {term.trim().length >= 2 && !results.length && (
                <li className="search-empty mono">
                  Nothing matches “{term.trim()}” in the loaded set
                </li>
              )}
              {term.trim().length < 2 && (
                <li className="search-empty mono">
                  Every category: destinations, camps, water, parking
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
