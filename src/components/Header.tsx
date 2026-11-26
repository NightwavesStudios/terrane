import Logo from "./Logo";
import TabBar from "./TabBar";
import { NAV, activeNav } from "./nav";
import { navigate, useRoute } from "../lib/router";
import { logStats, useLog } from "../lib/log";

/**
 * The app header.
 *
 * Its destinations come from `nav.ts`, the same table the bottom bar reads, so
 * the two cannot drift apart. The place count is the one piece of data chrome
 * that belongs above the globe; everything else is navigation.
 */
export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();
  const stats = logStats(useLog());
  const active = activeNav(route);

  return (
    <>
      <header className={`header header--${tone}`}>
        <button
          className="wordmark"
          onClick={() => navigate("/")}
          aria-label="Terrane home"
        >
          <Logo className="wordmark-mark" />
          Terrane
        </button>

        <nav className="header-nav" aria-label="Main">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "on" : ""}
              onClick={() => navigate(item.to)}
              aria-current={active === item.id ? "page" : undefined}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <button
            className="pill pill--ghost log-pill"
            onClick={() => navigate("/log")}
            title="Your bagged peaks and want-to-go list"
          >
            {stats.bagged
              ? `${stats.bagged.toLocaleString("en-US")} bagged`
              : "Your log"}
          </button>
        </div>
      </header>

      {/* Below 900 px the stylesheet hides the header nav and shows this instead. */}
      <TabBar />
    </>
  );
}
