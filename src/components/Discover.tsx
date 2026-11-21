import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { CATEGORIES, category, type Category, type Pick } from "../data/features";
import { iconDataUrl, type KitIcon } from "../map/campIcon";
import {
  startCatalog,
  syncCatalog,
  useCatalog,
  type AreaRow,
} from "../lib/catalog";
import { search, rowWhy } from "../lib/search";
import {
  hiddenGems,
  nearby,
  notable,
  radiusForZoom,
  type RankedRow,
} from "../lib/discover";
import { formatKm, pickContext, pickTitle } from "../lib/present";

/**
 * Discover: the primary way into the map's places.
 *
 * One panel, one input. With an empty query it answers the only three questions
 * the camera can ask — what is nearby, what is this area known for, and what is
 * here that the famous lists miss. A query replaces those sections with ranked
 * results over the whole destination catalog. There are no mode tabs: the
 * question in front of the reader decides what is shown.
 *
 * It replaces the old modal search. Two search surfaces meant two rankers and
 * two sets of keyboard rules; one surface is also one place to say how much of
 * the world is actually indexed.
 */

export interface DiscoverView {
  lon: number;
  lat: number;
  zoom: number;
}

export interface DiscoverArea {
  lon: number;
  lat: number;
  zoom: number;
}

type Action =
  | { kind: "place"; pick: Pick; why: string; km?: number; key: string }
  | { kind: "area"; area: AreaRow; key: string }
  | { kind: "point"; lat: number; lon: number; label: string; key: string };

const CATS: Category[] = CATEGORIES.filter((cat) => cat.family !== "route");
const ICONS = new Map<string, string>();

function iconFor(cat: Category): string | null {
  if (!cat.icon) return null;
  const cached = ICONS.get(cat.icon);
  if (cached) return cached;
  const url = iconDataUrl(cat.icon as KitIcon, 32);
  ICONS.set(cat.icon, url);
  return url;
}

/** A stable DOM id for one option, so the field can point at the active row. */
function optionId(action: Action): string {
  return `discover-opt-${action.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function rankedAction(item: RankedRow): Action {
  return {
    kind: "place",
    pick: item.row.pick,
    why: rowWhy(item.row),
    km: item.km,
    key: item.row.key,
  };
}

function ActionRow({
  action,
  active,
  onChoose,
  onHover,
  optionId,
}: {
  action: Action;
  active: boolean;
  onChoose: () => void;
  onHover: () => void;
  optionId: string;
}) {
  if (action.kind === "area") {
    return (
      <button
        className={`discover-row${active ? " is-active" : ""}`}
        onClick={onChoose}
        onMouseEnter={onHover}
        role="option"
        aria-selected={active}
        id={optionId}
      >
        <span className="discover-row-icon discover-row-icon--area" aria-hidden="true">
          ◎
        </span>
        <span className="discover-row-text">
          <span className="discover-row-name">{action.area.label}</span>
          <span className="discover-row-meta mono">
            {action.area.count.toLocaleString()} places · fly to {action.area.kind}
          </span>
        </span>
      </button>
    );
  }

  if (action.kind === "point") {
    return (
      <button
        className={`discover-row${active ? " is-active" : ""}`}
        onClick={onChoose}
        onMouseEnter={onHover}
        role="option"
        aria-selected={active}
        id={optionId}
      >
        <span className="discover-row-icon discover-row-icon--area" aria-hidden="true">
          ✛
        </span>
        <span className="discover-row-text">
          <span className="discover-row-name">{action.label}</span>
          <span className="discover-row-meta mono">Coordinates · fly there</span>
        </span>
      </button>
    );
  }

  const cat = category(action.pick.cat);
  const icon = iconFor(cat);
  return (
    <button
      className={`discover-row${active ? " is-active" : ""}`}
      onClick={onChoose}
      onMouseEnter={onHover}
      role="option"
      aria-selected={active}
      id={optionId}
    >
      <span className="discover-row-icon" aria-hidden="true">
        {icon ? (
          <img src={icon} alt="" width={18} height={18} />
        ) : (
          <i className="cat-dot" style={{ background: cat.colour }} />
        )}
      </span>
      <span className="discover-row-text">
        <span className="discover-row-name">
          {pickTitle(action.pick, cat.one)}
          {action.km != null ? (
            <span className="discover-km mono"> · {formatKm(action.km)}</span>
          ) : null}
        </span>
        <span className="discover-row-meta mono">
          {action.why || pickContext(action.pick)}
        </span>
      </span>
    </button>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="discover-section" role="group" aria-label={title}>
      <div className="discover-section-head">
        <h2 className="mono">{title}</h2>
        {note ? <span className="discover-section-note mono">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function Discover({
  view,
  pick,
  onSelect,
  onArea,
  onOpen,
  onOpenChange,
}: {
  view: DiscoverView;
  pick?: Pick | null;
  onSelect: (pick: Pick) => void;
  onArea: (area: DiscoverArea) => void;
  /** Opening closes whatever card is beside the panel. */
  onOpen?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const catalog = useCatalog();

  const center = useMemo(() => ({ lat: view.lat, lon: view.lon }), [view.lat, view.lon]);
  const cats = useMemo(
    () => (activeCat ? new Set([activeCat]) : null),
    [activeCat],
  );

  const openPanel = useCallback(() => {
    onOpen?.();
    setOpen(true);
  }, [onOpen]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) startCatalog();
  }, [open]);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  /* An external pick — a click on the map — closes the panel so the card and
     the list never sit on top of each other. */
  useEffect(() => {
    if (pick) setOpen(false);
  }, [pick]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        /^(input|textarea|select)$/i.test(event.target.tagName);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openPanel();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        openPanel();
      } else if (event.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openPanel]);

  /* 150 ms is long enough to swallow a word typed normally and short enough
     that the first result is there before the eye reaches the list. */
  useEffect(() => {
    const id = window.setTimeout(() => {
      startTransition(() => setQuery(term));
    }, 150);
    return () => window.clearTimeout(id);
  }, [term]);

  /* Reopening a panel that still remembers its query should not remember the
     row the keyboard was on: the first Enter must act on the first result. */
  useEffect(() => {
    setCursor(0);
  }, [open, query, activeCat]);

  /* Cells arrive as the camera settles; rebuild the index only while open. */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => syncCatalog(), 350);
    return () => window.clearTimeout(id);
  }, [open, view.lat, view.lon, catalog.rows.length]);

  const searching = term.trim().length >= 2;
  const settled = query === term;
  const practicalCat = activeCat ? category(activeCat).family === "practical" : false;

  const result = useMemo(() => {
    if (!open || !searching || !settled || query.trim().length < 2) return null;
    return search({
      rows: catalog.rows,
      areas: catalog.areas,
      query,
      cats: cats ?? undefined,
      center,
      limit: 12,
    });
  }, [open, searching, settled, query, catalog.rows, catalog.areas, cats, center]);

  const searchActions: Action[] = useMemo(() => {
    if (!result) return [];
    return result.hits.map((hit) => {
      if (hit.kind === "place") {
        return {
          kind: "place",
          pick: hit.row.pick,
          why: hit.why,
          key: hit.row.key,
        } satisfies Action;
      }
      if (hit.kind === "area") {
        return {
          kind: "area",
          area: hit.area,
          key: `area:${hit.area.kind}:${hit.area.name}`,
        } satisfies Action;
      }
      return {
        kind: "point",
        lat: hit.lat,
        lon: hit.lon,
        label: hit.label,
        key: `point:${hit.lat}:${hit.lon}`,
      } satisfies Action;
    });
  }, [result]);

  const sections = useMemo(() => {
    if (!open || searching) return null;
    const radius = radiusForZoom(view.zoom);
    /* One place, one row: a famous summit inside the nearby radius is not also
       "worth the detour", and a local gem is not also a nearby row. */
    const near = nearby(catalog.rows, center, radius, cats, 4);
    const nearKeys = new Set(near.map((item) => item.row.key));
    const detour = notable(catalog.rows, center, radius * 1.5, cats, 4, nearKeys);
    const taken = new Set([...nearKeys, ...detour.map((item) => item.row.key)]);
    return {
      radius,
      nearby: near,
      notable: detour,
      gems: hiddenGems(catalog.rows, center, radius * 2, cats, 4, taken),
    };
  }, [open, searching, catalog.rows, center, view.zoom, cats]);

  const actions: Action[] = useMemo(() => {
    if (!open) return [];
    if (searching) return settled ? searchActions : [];
    if (!sections) return [];
    return [
      ...sections.nearby.map(rankedAction),
      ...sections.notable.map(rankedAction),
      ...sections.gems.map(rankedAction),
    ];
  }, [open, searching, settled, searchActions, sections]);

  const active = Math.min(cursor, Math.max(0, actions.length - 1));

  function choose(action: Action) {
    if (action.kind === "place") {
      onSelect(action.pick);
      setOpen(false);
      return;
    }
    if (action.kind === "area") {
      onArea({ lon: action.area.lon, lat: action.area.lat, zoom: action.area.zoom });
      setOpen(false);
      return;
    }
    onArea({ lon: action.lon, lat: action.lat, zoom: 10 });
    setOpen(false);
  }

  function onFieldKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => Math.min(actions.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && actions[active]) {
      event.preventDefault();
      choose(actions[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const note =
    catalog.status === "loading"
      ? "Loading the full place index…"
      : catalog.status === "error"
        ? "Atlas only — the long tail could not be loaded"
        : `${catalog.rows.length.toLocaleString()} named places indexed · unnamed map pins are browsed by zoom, not searched`;

  const offsetNearby = 0;
  const offsetNotable = sections ? sections.nearby.length : 0;
  const offsetGems = sections
    ? sections.nearby.length + sections.notable.length
    : 0;

  return (
    <>
      <button
        className="search-open discover-open mono"
        onClick={() => {
          if (open) setOpen(false);
          else openPanel();
        }}
        aria-label="Search places"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="search-open-label">Search places</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <section className="discover" role="dialog" aria-label="Discover places">
          <div className="discover-head">
            <span className="discover-title mono">Discover</span>
            <span className="discover-scope mono">
              {activeCat ? category(activeCat).label : "All categories"}
            </span>
            <button
              className="discover-close"
              onClick={() => setOpen(false)}
              aria-label="Close Discover"
            >
              ×
            </button>
          </div>

          <div className="discover-search">
            <input
              ref={field}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={onFieldKey}
              placeholder="Peak, lake, camp, country, 46.5, 8.0…"
              aria-label="Search places by name, category or country"
              role="combobox"
              aria-expanded
              aria-controls="discover-results"
              aria-autocomplete="list"
              aria-activedescendant={
                actions[active] ? optionId(actions[active]) : undefined
              }
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="discover-cats" role="group" aria-label="Filter by category">
            <button
              className={`discover-cat${activeCat ? "" : " on"}`}
              aria-pressed={!activeCat}
              onClick={() => setActiveCat(null)}
            >
              All
            </button>
            {CATS.map((cat) => (
              <button
                key={cat.id}
                className={`discover-cat${activeCat === cat.id ? " on" : ""}`}
                aria-pressed={activeCat === cat.id}
                onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
              >
                {cat.icon ? (
                  <img src={iconFor(cat) ?? ""} alt="" width={13} height={13} />
                ) : (
                  <i className="cat-dot" style={{ background: cat.colour }} />
                )}
                {cat.label}
              </button>
            ))}
          </div>

          <div
            className="discover-body"
            id="discover-results"
            role="listbox"
            aria-label="Places and areas"
          >
            {searching ? (
              <>
                {result && result.hits.length > 0 ? (
                  <div className="discover-list">
                    {searchActions.map((action, index) => (
                      <ActionRow
                        key={action.key}
                        action={action}
                        active={index === active}
                        optionId={optionId(action)}
                        onChoose={() => choose(action)}
                        onHover={() => setCursor(index)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="discover-empty mono">
                    {result
                      ? `Nothing matches “${query.trim()}” in ${catalog.rows.length.toLocaleString()} places. Unnamed map pins are found by zooming in, not by name.`
                      : "Searching…"}
                  </p>
                )}
                {result && result.total > result.hits.length ? (
                  <p className="discover-more mono">
                    {result.total.toLocaleString()} matches · showing the closest and
                    best known
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {sections ? (
                  <>
                    <Section
                      title="Nearby"
                      note={`within ${formatKm(sections.radius)}`}
                    >
                      {sections.nearby.length > 0 ? (
                        <div className="discover-list">
                          {sections.nearby.map((item, index) => {
                            const action = rankedAction(item);
                            return (
                              <ActionRow
                                key={action.key}
                                action={action}
                                active={offsetNearby + index === active}
                                optionId={optionId(action)}
                                onChoose={() => choose(action)}
                                onHover={() => setCursor(offsetNearby + index)}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className="discover-empty mono">
                          {practicalCat
                            ? "These pins come from OpenStreetMap cells; zoom in to load them here."
                            : `Nothing within ${formatKm(sections.radius)} — drag the map onto land, or widen the view.`}
                        </p>
                      )}
                    </Section>

                    <Section title="Worth the detour">
                      {sections.notable.length > 0 ? (
                        <div className="discover-list">
                          {sections.notable.map((item, index) => {
                            const action = rankedAction(item);
                            return (
                              <ActionRow
                                key={action.key}
                                action={action}
                                active={offsetNotable + index === active}
                                optionId={optionId(action)}
                                onChoose={() => choose(action)}
                                onHover={() => setCursor(offsetNotable + index)}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className="discover-empty mono">
                          No destinations in this area.
                        </p>
                      )}
                    </Section>

                    <Section title="Lesser known">
                      {sections.gems.length > 0 ? (
                        <div className="discover-list">
                          {sections.gems.map((item, index) => {
                            const action = rankedAction(item);
                            return (
                              <ActionRow
                                key={action.key}
                                action={action}
                                active={offsetGems + index === active}
                                optionId={optionId(action)}
                                onChoose={() => choose(action)}
                                onHover={() => setCursor(offsetGems + index)}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <p className="discover-empty mono">
                          The local rows start here at deeper zoom.
                        </p>
                      )}
                    </Section>
                  </>
                ) : (
                  <p className="discover-empty mono">Loading places…</p>
                )}
              </>
            )}
          </div>

          <p className="discover-foot mono">
            {note}
            <span> · ↑↓ move · ↵ fly · esc close</span>
          </p>
        </section>
      )}
    </>
  );
}
