import { PLACES } from "../data/places";
import Logo from "./Logo";
import { navigate, useRoute } from "../lib/router";

export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();

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
      </nav>

      <div className="header-right">
        <span className="pill pill--ghost">{PLACES.length.toLocaleString()} places</span>
      </div>
    </header>
  );
}
