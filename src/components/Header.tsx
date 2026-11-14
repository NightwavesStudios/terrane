import { PLACES } from "../data/places";
import { useCollections } from "../lib/saved";
import { navigate, useRoute } from "../lib/router";

export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();
  const collections = useCollections();
  const savedCount = new Set(collections.flatMap((c) => c.slugs)).size;

  const link = (name: string, to: string, active: boolean) => (
    <button className={active ? "on" : ""} onClick={() => navigate(to)}>
      {name}
    </button>
  );

  return (
    <header className={`header header--${tone}`}>
      <button className="wordmark" onClick={() => navigate("/")} aria-label="Terrane home">
        <i />
        Terrane
      </button>

      <nav className="header-nav">
        {link("Globe", "/", route.name === "home")}
        {link("Explore", "/explore", route.name === "explore")}
        <button
          className={route.name === "saved" ? "on" : ""}
          onClick={() => navigate("/saved")}
        >
          Saved
          {savedCount > 0 && <span className="nav-count">{savedCount}</span>}
        </button>
        {link("About", "/about", route.name === "about")}
      </nav>

      <div className="header-right">
        <span className="pill pill--ghost">{PLACES.length.toLocaleString()} places</span>
      </div>
    </header>
  );
}
