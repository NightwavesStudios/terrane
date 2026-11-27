import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { NH48_PEAKS } from "../data/nh48";
import { formatElevation } from "../lib/format";
import type { Peak } from "../types/geography";

function matchingPeaks(term: string): Peak[] {
  const query = term.trim().toLowerCase();
  if (!query) return NH48_PEAKS.slice(0, 4);
  return NH48_PEAKS.filter((peak) =>
    [peak.name, peak.range, "new hampshire", "nh 48"]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query)),
  ).slice(0, 8);
}

export default function Discover() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = matchingPeaks(term);

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

  function goToPeak(peak: Peak) {
    navigate(`/peaks/${peak.slug}`);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) {
      goToPeak(results[0]);
      return;
    }
    setMessage(
      term.trim()
        ? `No NH 48 peak matches “${term.trim()}”. Try Washington, Lafayette or a range.`
        : "Search the 48 peaks by name or range.",
    );
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
        <span className="search-open-label">Discover</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <section className="discover" role="dialog" aria-label="Discover places">
          <div className="discover-head">
            <span className="discover-title mono">Discover</span>
            <span className="discover-scope mono">NH 48</span>
            <button
              type="button"
              className="discover-close"
              onClick={() => setOpen(false)}
              aria-label="Close Discover"
            >
              ×
            </button>
          </div>

          <form className="discover-search" onSubmit={submit}>
            <input
              ref={field}
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setMessage("");
              }}
              placeholder="Search peaks or ranges"
              aria-label="Search NH 48 peaks and ranges"
              spellCheck={false}
              autoComplete="off"
            />
          </form>

          <div className="discover-body" aria-live="polite">
            {message ? <p className="discover-empty mono">{message}</p> : null}
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
                        {peak.range} · {formatElevation(peak.elevationM, "imperial")}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <p className="discover-foot mono">
            48 peaks indexed · AMC edition
            <span>⌘K open · esc close</span>
          </p>
        </section>
      ) : null}
    </>
  );
}
