import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import StateNotice from "../components/StateNotice";
import { category } from "../data/features";
import { guideKind } from "../data/guide";
import { bySlug } from "../data/places";
import { setMeta } from "../lib/meta";
import { placeLine } from "../lib/present";
import { navigate } from "../lib/router";
import { toggleSaved, useSaved, type SavedPlace } from "../lib/saved";
import {
  toggleSavedGuide,
  useSavedGuides,
  type SavedGuide,
} from "../lib/savedGuides";

type Sort = "recent" | "name";
type KindFilter = "all" | "places" | "experiences";
type Undo = { label: string; restore: () => void };

const UNDO_MS = 7000;

/**
 * Everything saved in this browser, in one library.
 *
 * Places and Experiences are separate versioned keys with separate shapes, so
 * neither has to migrate the other. Collections are deliberately absent: they
 * are thematic groups, not personal destinations. There is still no account —
 * this is the whole of the "account" surface, and it says so — so the page does
 * the work an account page would: sort, narrow, select, remove, and undo.
 */
export default function Saved() {
  const places = useSaved();
  const experiences = useSavedGuides();
  const [sort, setSort] = useState<Sort>("recent");
  const [kind, setKind] = useState<KindFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Undo | null>(null);

  const total = places.length + experiences.length;

  useEffect(() => {
    setMeta({
      title: "Saved — Terrane",
      description: "The places and experiences you have saved in this browser.",
      path: "/saved",
    });
  }, []);

  /* One timer for the last removal. A second removal replaces the first, which
     is what the single toast claims. */
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [undo]);

  /* A save removed in another tab must not leave a checkbox ticked here. */
  useEffect(() => {
    setSelected((current) => {
      if (current.size === 0) return current;
      const live = new Set<string>([
        ...places.map((item) => `place:${item.slug}`),
        ...experiences.map((item) => `exp:${item.slug}`),
      ]);
      const next = new Set([...current].filter((key) => live.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [places, experiences]);

  const sortedPlaces = useMemo(() => {
    const list = [...places];
    list.sort(
      sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b.at - a.at,
    );
    return list;
  }, [places, sort]);

  const sortedExperiences = useMemo(() => {
    const list = [...experiences];
    list.sort(
      sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => b.at - a.at,
    );
    return list;
  }, [experiences, sort]);

  function removePlace(item: SavedPlace) {
    toggleSaved(item);
    setUndo({ label: `Removed ${item.name}`, restore: () => toggleSaved(item) });
  }

  function removeExperience(item: SavedGuide) {
    toggleSavedGuide(item);
    setUndo({
      label: `Removed ${item.name}`,
      restore: () => toggleSavedGuide(item),
    });
  }

  function toggleKey(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function removeSelected() {
    const chosenPlaces = sortedPlaces.filter((item) =>
      selected.has(`place:${item.slug}`),
    );
    const chosenExperiences = sortedExperiences.filter((item) =>
      selected.has(`exp:${item.slug}`),
    );
    const count = chosenPlaces.length + chosenExperiences.length;
    if (count === 0) return;
    chosenPlaces.forEach((item) => toggleSaved(item));
    chosenExperiences.forEach((item) => toggleSavedGuide(item));
    setSelected(new Set());
    setSelecting(false);
    setUndo({
      label: `Removed ${count} saved item${count === 1 ? "" : "s"}`,
      restore: () => {
        chosenPlaces.forEach((item) => toggleSaved(item));
        chosenExperiences.forEach((item) => toggleSavedGuide(item));
      },
    });
  }

  const visiblePlaces = kind === "experiences" ? [] : sortedPlaces;
  const visibleExperiences = kind === "places" ? [] : sortedExperiences;
  const selectedCount = selected.size;

  return (
    <div className="page">
      <Header tone="light" />

      <div className="page-head saved-head">
        <p className="eyebrow">Saved</p>
        <h1 className="page-title">
          {total
            ? [
                `${places.length} place${places.length === 1 ? "" : "s"}`,
                `${experiences.length} experience${experiences.length === 1 ? "" : "s"}`,
              ].join(" · ")
            : "Nothing saved yet"}
        </h1>
        <p className="page-sub">
          Saves live in this browser only. There is no account, and nothing is
          uploaded. Collections are thematic groups rather than personal
          destinations, so they are not part of this library.
        </p>
      </div>

      <div className="saved">
        {total > 0 ? (
          <div className="saved-toolbar">
            <div className="saved-toolbar-group" role="group" aria-label="Show">
              {(
                [
                  ["all", "All"],
                  ["places", "Places"],
                  ["experiences", "Experiences"],
                ] as [KindFilter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`chip chip--small${kind === id ? " on" : ""}`}
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="saved-toolbar-group" role="group" aria-label="Sort">
              {(
                [
                  ["recent", "Recent"],
                  ["name", "A–Z"],
                ] as [Sort, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`chip chip--small${sort === id ? " on" : ""}`}
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              className={`saved-select mono${selecting ? " on" : ""}`}
              aria-pressed={selecting}
              onClick={() => {
                setSelecting((current) => !current);
                setSelected(new Set());
              }}
            >
              {selecting ? "Done" : "Select"}
            </button>
          </div>
        ) : null}

        {selecting ? (
          <div className="saved-bulk" role="status">
            <span className="mono">
              {selectedCount} selected
            </span>
            <button
              className="btn btn-dark"
              onClick={removeSelected}
              disabled={selectedCount === 0}
            >
              Remove selected
            </button>
          </div>
        ) : null}

        {total === 0 ? (
          <div className="saved-empty">
            <StateNotice
              kind="empty"
              title="Nothing saved yet"
              body="Open a place or a curated Experience and press Save. It will appear here."
            />
            <div className="saved-empty-actions">
              <button className="btn btn-dark" onClick={() => navigate("/")}>
                Find a place →
              </button>
              <button
                className="btn btn-dark"
                onClick={() => navigate("/experiences")}
              >
                Browse Experiences →
              </button>
            </div>
          </div>
        ) : null}

        {visiblePlaces.length > 0 ? (
          <section className="saved-block" aria-label="Saved places">
            <h2 className="mono saved-block-title">
              Places <span className="saved-block-count">{visiblePlaces.length}</span>
            </h2>
            <ol className="saved-list">
              {visiblePlaces.map((item) => {
                const place = bySlug.get(item.slug);
                const where = place
                  ? placeLine(place.region, place.country)
                  : placeLine(item.region, item.country);
                const key = `place:${item.slug}`;
                return (
                  <li
                    key={item.slug}
                    className={`saved-row${selecting ? " saved-row--select" : ""}`}
                  >
                    {selecting ? (
                      <label className="saved-check">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleKey(key)}
                          aria-label={`Select ${item.name}`}
                        />
                      </label>
                    ) : null}
                    <button
                      className="saved-main"
                      onClick={() => navigate(`/place/${item.slug}`)}
                    >
                      <span className="saved-name">{item.name}</span>
                      <span className="mono saved-meta">
                        {category(item.cat).one}
                        {where ? ` · ${where}` : ""}
                      </span>
                    </button>
                    <span className="mono saved-date">
                      {new Date(item.at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <button
                      className="saved-globe mono"
                      onClick={() => navigate(`/?place=${item.slug}`)}
                    >
                      Globe
                    </button>
                    <button
                      className="saved-remove mono"
                      onClick={() => removePlace(item)}
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {visibleExperiences.length > 0 ? (
          <section className="saved-block" aria-label="Saved Experiences">
            <h2 className="mono saved-block-title">
              Experiences{" "}
              <span className="saved-block-count">{visibleExperiences.length}</span>
            </h2>
            <ol className="saved-list">
              {visibleExperiences.map((item) => {
                const key = `exp:${item.slug}`;
                return (
                  <li
                    key={item.slug}
                    className={`saved-row saved-row--exp${selecting ? " saved-row--select" : ""}`}
                  >
                    {selecting ? (
                      <label className="saved-check">
                        <input
                          type="checkbox"
                          checked={selected.has(key)}
                          onChange={() => toggleKey(key)}
                          aria-label={`Select ${item.name}`}
                        />
                      </label>
                    ) : null}
                    <button
                      className="saved-main"
                      onClick={() => navigate(`/experiences/${item.slug}`)}
                    >
                      <span className="saved-name">{item.name}</span>
                      <span className="mono saved-meta">
                        {[
                          guideKind(item.kind).one,
                          placeLine(item.region, item.country),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                    <span className="mono saved-date">
                      {new Date(item.at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <button
                      className="saved-remove mono"
                      onClick={() => removeExperience(item)}
                      aria-label={`Remove ${item.name}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>

      {undo ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>{undo.label}</span>
          <button
            className="undo-action mono"
            onClick={() => {
              undo.restore();
              setUndo(null);
            }}
          >
            Undo
          </button>
          <button
            className="undo-dismiss"
            onClick={() => setUndo(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">
          SAVES ARE LOCAL TO THIS BROWSER · MAP © OPENSTREETMAP · DATA: WIKIDATA
        </span>
      </footer>
    </div>
  );
}
