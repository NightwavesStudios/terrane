import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { LISTS, PEAKS, peakListLabel } from "../data/lists";
import { formatElevation } from "../lib/format";
import type { Peak } from "../types/geography";
import Icon from "./Icon";

function matchingPeaks(term: string): Peak[] {
  const query = term.trim().toLowerCase();
  if (!query) return [];
  return PEAKS.filter((peak) =>
    [
      peak.name,
      peak.range,
      peakListLabel(peak),
      "new hampshire",
      "colorado",
      "scotland",
      "munros",
      "adirondack",
      "catskills",
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query)),
  ).slice(0, 8);
}

const featured = LISTS.map((list) => list.peaks[0]).filter(Boolean);

export default function Discover() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = matchingPeaks(term);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    field.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
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
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setOpen(false);
    setMessage("");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function goToPeak(peak: Peak) {
    setOpen(false);
    navigate(`/peaks/${peak.slug}`);
  }

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) {
      goToPeak(results[0]);
      return;
    }
    setMessage(
      term.trim()
        ? `No peak matches “${term.trim()}”. Try a name, range or list.`
        : "Search by peak, range or list.",
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="search-open discover-open"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close Discover" : "Open Discover"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="search" size={16} />
        <span className="search-open-label">Discover</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <div
          className="discover-layer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialogRef}
            className="discover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-title"
            onKeyDown={trapFocus}
          >
            <div className="discover-head">
              <span className="discover-title" id="discover-title">
                Discover
              </span>
              <button
                type="button"
                className="discover-close"
                onClick={close}
                aria-label="Close Discover"
              >
                ×
              </button>
            </div>

            <form className="discover-search" onSubmit={submit} role="search">
              <div className="discover-search__field">
                <Icon name="search" size={18} />
                <input
                  ref={field}
                  value={term}
                  onChange={(event) => {
                    setTerm(event.target.value);
                    setMessage("");
                  }}
                  placeholder="Search a peak, range or list"
                  aria-label="Search peaks, ranges and lists"
                  spellCheck={false}
                  autoComplete="off"
                />
                {term ? (
                  <button
                    type="button"
                    className="discover-clear"
                    onClick={() => {
                      setTerm("");
                      setMessage("");
                      field.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </form>

            <div className="discover-body" aria-live="polite">
              {message ? <p className="discover-empty">{message}</p> : null}

              {!term.trim() ? (
                <>
                  <p className="discover-kicker">Go straight to a list</p>
                  <div className="discover-lists">
                    {LISTS.map((list) => (
                      <Link
                        key={list.id}
                        to={`/lists/${list.slug}`}
                        className="discover-list"
                        onClick={() => setOpen(false)}
                      >
                        <span>{list.title}</span>
                        <small>{list.peaks.length} peaks</small>
                        <Icon name="arrow" size={15} />
                      </Link>
                    ))}
                  </div>
                  <p className="discover-kicker">A few high places</p>
                </>
              ) : null}

              {term.trim() && !results.length && !message ? (
                <p className="discover-empty">No indexed peak matches that search.</p>
              ) : null}

              {results.length ? (
                <div className="discover-results">
                  {results.map((peak) => (
                    <button
                      type="button"
                      key={peak.slug}
                      className="discover-result"
                      onClick={() => goToPeak(peak)}
                    >
                      <span>
                        <strong>{peak.name}</strong>
                        <small>
                          {peakListLabel(peak)} · {peak.range} ·{" "}
                          {formatElevation(peak.elevationM, "imperial", peak.elevationFt)}
                        </small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
                </div>
              ) : !term.trim() ? (
                <div className="discover-results">
                  {featured.map((peak) => (
                    <button
                      type="button"
                      key={peak.slug}
                      className="discover-result"
                      onClick={() => goToPeak(peak)}
                    >
                      <span>
                        <strong>{peak.name}</strong>
                        <small>
                          {peakListLabel(peak)} ·{" "}
                          {formatElevation(peak.elevationM, "imperial", peak.elevationFt)}
                        </small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="discover-foot">
              <span>
                {PEAKS.length} peaks · {LISTS.length} lists
              </span>
              <span className="discover-keys">
                <kbd>esc</kbd> close
              </span>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
