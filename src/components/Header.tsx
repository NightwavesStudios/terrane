import Logo from "./Logo";
import { navigate, useRoute } from "../lib/router";
import { useManifest } from "../lib/live";
import { useSaved } from "../lib/saved";
import { useSavedGuides } from "../lib/savedGuides";

export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();
  const manifest = useManifest();
  const saved = useSaved();
  const savedGuides = useSavedGuides();
  const savedCount = saved.length + savedGuides.length;

  return (
    <header className={`header header--${tone}`}>
      <button className="wordmark" onClick={() => navigate("/")} aria-label="Terrane home">
        <Logo className="wordmark-mark" />
        Terrane
      </button>

      <nav className="header-nav">
        <button
          className={route.name === "home" ? "on" : ""}
          onClick={() => navigate("/")}
        >
          Globe
        </button>
        <button
          className={
            route.name === "experiences" || route.name === "experience" ? "on" : ""
          }
          onClick={() => navigate("/experiences")}
        >
          Experiences
        </button>
        <button
          className={
            route.name === "collections" || route.name === "collection" ? "on" : ""
          }
          onClick={() => navigate("/collections")}
        >
          Collections
        </button>
        <button
          className={route.name === "saved" ? "on" : ""}
          onClick={() => navigate("/saved")}
        >
          Saved
          {savedCount > 0 ? (
            <span className="nav-count mono">{savedCount}</span>
          ) : null}
        </button>
      </nav>

      <div className="header-right">
        <span className="pill pill--ghost">
          {manifest.totals.all.toLocaleString("en-US")} places
        </span>
      </div>
    </header>
  );
}
