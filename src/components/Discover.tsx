import { useEffect, useRef, useState, type FormEvent } from "react";

/**
 * The old globe's one search surface, kept deliberately small.
 *
 * There is no peak index in this build, so Discover never fabricates a result:
 * it opens the same panel, takes the question, and says plainly that the index
 * has not arrived yet.
 */
export default function Discover() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const field = useRef<HTMLInputElement>(null);

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = term.trim();
    setMessage(
      query
        ? `“${query}” will be searchable when the peak index arrives.`
        : "Enter a peak, range or place when the index arrives.",
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
            <span className="discover-scope mono">Globe</span>
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
              placeholder="Search peaks, ranges, places"
              aria-label="Search peaks, ranges and places"
              spellCheck={false}
              autoComplete="off"
            />
          </form>

          <div className="discover-body">
            <p className="discover-empty mono">
              {message ||
                "The peak index is still being charted. The globe is live; search will connect when the index arrives."}
            </p>
          </div>

          <p className="discover-foot mono">
            Globe only · no peak data
            <span>⌘K open · esc close</span>
          </p>
        </section>
      ) : null}
    </>
  );
}
