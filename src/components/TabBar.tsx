import { NAV, activeNav, type NavId } from "./nav";
import { navigate, useRoute } from "../lib/router";
import { logStats, useLog } from "../lib/log";

/** The three app surfaces, at thumb height. */
export default function TabBar() {
  const route = useRoute();
  const stats = logStats(useLog());
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
          {tab.id === "log" && stats.bagged > 0 ? (
            <span className="tabbar-count mono">{stats.bagged}</span>
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

  if (id === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
      </svg>
    );
  }

  if (id === "lists") {
    return (
      <svg {...common}>
        <path d="M3 20 9.4 7l4.1 7.6 2.4-4.1L21 20Z" />
        <path d="M9.4 7V3.4" />
        <path d="M9.4 3.4h4.2l-1.1 1.6 1.1 1.6H9.4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </svg>
  );
}
