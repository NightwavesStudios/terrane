import { NAV, activeNav, type NavId } from "./nav";
import { navigate, useRoute } from "../lib/router";
import { useSaved } from "../lib/saved";
import { useSavedGuides } from "../lib/savedGuides";

/**
 * The app bar for phones and tablets.
 *
 * The four destinations are exactly the header's four, from the same table, but
 * a thumb reaches the bottom of a phone and never the top-right corner, so under
 * 900 px the nav moves down here and the header keeps only the wordmark.
 *
 * Under 620 px the map's filter strip sits directly on top of this bar with the
 * same edge-to-edge shape: one shelf at the bottom, not two floating glass
 * pills at different widths. The stylesheet owns that geometry.
 */
export default function TabBar() {
  const route = useRoute();
  const places = useSaved();
  const guides = useSavedGuides();
  const savedCount = places.length + guides.length;
  const active = activeNav(route);

  return (
    <nav className="tabbar" aria-label="Main">
      {NAV.map((tab) => (
        <button
          key={tab.id}
          className={`tabbar-item${active === tab.id ? " on" : ""}`}
          onClick={() => navigate(tab.to)}
          aria-current={active === tab.id ? "page" : undefined}
          title={tab.hint}
        >
          <TabIcon id={tab.id} />
          <span className="tabbar-label">{tab.label}</span>
          {tab.id === "saved" && savedCount > 0 ? (
            <span className="tabbar-count mono">{savedCount}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function TabIcon({ id }: { id: NavId }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (id === "discover") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
      </svg>
    );
  }

  if (id === "experiences") {
    return (
      <svg {...common}>
        <path d="M3 19h18" />
        <path d="M5 19 10.2 7.5 13.4 14l1.9-3.4L20 19" />
      </svg>
    );
  }

  if (id === "collections") {
    return (
      <svg {...common}>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3.6 12.8 8.4 4.7 8.4-4.7" />
        <path d="m3.6 16.8 8.4 4.7 8.4-4.7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
