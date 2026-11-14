import { useEffect, useRef, useState } from "react";
import {
  createCollection,
  toggleIn,
  useCollections,
} from "../lib/saved";

export default function SaveButton({
  slug,
  compact = false,
}: {
  slug: string;
  compact?: boolean;
}) {
  const collections = useCollections();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const saved = collections.some((c) => c.slugs.includes(slug));
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className="save" ref={wrap}>
      <button
        className={`save-btn ${saved ? "is-saved" : ""} ${compact ? "save-btn--compact" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="save-icon" aria-hidden="true">
          {saved ? "★" : "☆"}
        </span>
        {compact ? "" : saved ? "Saved" : "Save"}
      </button>

      {open && (
        <div className="save-pop" role="dialog" aria-label="Save to collection">
          <p className="save-pop-title">Save to</p>
          <ul>
            {collections.map((c) => {
              const inside = c.slugs.includes(slug);
              return (
                <li key={c.id}>
                  <button
                    className={inside ? "inside" : ""}
                    onClick={() => toggleIn(c.id, slug)}
                  >
                    <span className="box">{inside ? "✓" : ""}</span>
                    <span className="name">{c.name}</span>
                    <span className="count">{c.slugs.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="save-new"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              const id = createCollection(draft);
              toggleIn(id, slug);
              setDraft("");
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New collection…"
              aria-label="New collection name"
            />
            <button type="submit" disabled={!draft.trim()}>
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
