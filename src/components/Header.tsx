import Logo from "./Logo";
import TabBar from "./TabBar";
import { NAV, activeNav } from "./nav";
import { navigate, useRoute } from "../lib/router";
import { useManifest } from "../lib/live";
import { useSaved } from "../lib/saved";
import { useSavedGuides } from "../lib/savedGuides";

/**
 * The app header.
 *
 * Its destinations come from `nav.ts`, the same table the bottom bar reads, so
 * the two cannot drift apart. The place count is the one piece of data chrome
 * that belongs above the globe; everything else is navigation.
 */
export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();
  const manifest = useManifest();
  const saved = useSaved();
  const savedGuides = useSavedGuides();
  const savedCount = saved.length + savedGuides.length;
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
              {item.id === "saved" && savedCount > 0 ? (
                <span className="nav-count mono">{savedCount}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <span className="pill pill--ghost">
            {manifest.totals.all.toLocaleString("en-US")} places
          </span>
        </div>
      </header>

      {/* Below 900 px the stylesheet hides the header nav and shows this instead. */}
      <TabBar />
    </>
  );
}
