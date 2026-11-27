import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ADVENTURES,
  KIND_META,
  KINDS,
  kindCounts,
  searchAdventures,
  type AdventureKind,
} from "../data/atlas";
import { formatElevation } from "../lib/format";
import { useJournal } from "../lib/journal";
import Icon from "./Icon";

interface Props {
  onSelect: (id: string) => void;
  kindFilter: AdventureKind | "all";
  onKindChange: (kind: AdventureKind | "all") => void;
}

export default function Discover({ onSelect, kindFilter, onKindChange }: Props) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const { entries } = useJournal();
  const counts = useMemo(() => kindCounts(), []);

  const visited = useMemo(
    () => new Set(entries.map((entry) => entry.adventureId)),
    [entries],
  );

  const results = useMemo(
    () => searchAdventures(term, { kind: kindFilter }),
    [term, kindFilter],
  );

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        /^(input|textarea|select)$/i.test(event.target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  function submitFirst(event: FormEvent) {
    event.preventDefault();
    if (results.length) choose(results[0].id);
  }

  function drift() {
    if (!results.length) return;
    choose(results[Math.floor(Math.random() * results.length)].id);
  }

  return (
    <>
      <button
        type="button"
        className="search-open discover-open mono"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close Discover" : "Open Discover"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="search" size={15} />
        <span className="search-open-label">Discover</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <section className="discover" role="dialog" aria-label="Discover places">
          <div className="discover-head">
            <span className="discover-title mono">Discover</span>
            <span className="discover-scope mono">{results.length} places</span>
            <button
              type="button"
              className="discover-close icon-button"
              onClick={() => setOpen(false)}
              aria-label="Close Discover"
            >
              ×
            </button>
          </div>

          <form className="discover-search" onSubmit={submitFirst}>
            <input
              ref={field}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search peaks, ranges, countries"
              aria-label="Search the atlas"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className="discover-drift"
              title="Go somewhere unexpected"
              onClick={drift}
            >
              Drift
              <Icon name="compass" size={14} />
            </button>
          </form>

          <div className="discover-kinds" role="group" aria-label="Filter by kind">
            <button
              type="button"
              className={`discover-kind${kindFilter === "all" ? " discover-kind--active" : ""}`}
              aria-pressed={kindFilter === "all"}
              onClick={() => onKindChange("all")}
            >
              Everything <span>{counts.all}</span>
            </button>
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`discover-kind${kindFilter === kind ? " discover-kind--active" : ""}`}
                aria-pressed={kindFilter === kind}
                onClick={() => onKindChange(kind)}
              >
                <span className="kind-dot" style={{ background: KIND_META[kind].color }} />
                {KIND_META[kind].label} <span>{counts[kind]}</span>
              </button>
            ))}
          </div>

          <div className="discover-body">
            {results.length ? (
              <ul className="discover-results">
                {results.map((adventure) => {
                  const meta = KIND_META[adventure.kind];
                  const bagged = visited.has(adventure.id);
                  return (
                    <li key={adventure.id}>
                      <button
                        type="button"
                        className={`discover-result${bagged ? " discover-result--visited" : ""}`}
                        onClick={() => choose(adventure.id)}
                      >
                        <span
                          className="discover-result__icon"
                          style={{ color: meta.color }}
                        >
                          <Icon name={meta.icon} size={17} />
                        </span>
                        <span className="discover-result__text">
                          <strong>{adventure.name}</strong>
                          <span>
                            {adventure.region} · {adventure.country}
                          </span>
                        </span>
                        <span className="discover-result__meta">
                          <em>{formatElevation(adventure.elevationM)}</em>
                          {bagged ? (
                            <span className="discover-result__bag">
                              <Icon name="check" size={12} /> bagged
                            </span>
                          ) : (
                            <span>{meta.singular}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="discover-empty">
                <p className="mono">No place matches “{term}”.</p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setTerm("");
                    onKindChange("all");
                  }}
                >
                  Clear search <Icon name="arrow" size={15} />
                </button>
              </div>
            )}
          </div>

          <p className="discover-foot mono">
            {ADVENTURES.length} places · every continent
            <Link to="/atlas">Open the atlas →</Link>
            <span>⌘K open · / search · esc close</span>
          </p>
        </section>
      ) : null}
    </>
  );
}
