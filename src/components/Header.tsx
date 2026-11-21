import Logo from "./Logo";
import { navigate, useRoute } from "../lib/router";
import { useManifest } from "../lib/live";
import { useSaved } from "../lib/saved";
import { useSavedExperiences } from "../lib/savedExperiences";

export default function Header({ tone }: { tone: "dark" | "light" }) {
  const route = useRoute();
  const manifest = useManifest();
  const saved = useSaved();
  const savedExperiences = useSavedExperiences();
  const savedCount = saved.length + savedExperiences.length;

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
          className={route.name === "saved" ? "on" : ""}
          onClick={() => navigate("/saved")}
        >
          Saved
          {savedCount > 0 ? (
            <span className="nav-count mono">{savedCount}</span>
          ) : null}
        </button>
        <button
          className={route.name === "coverage" ? "on" : ""}
          onClick={() => navigate("/coverage")}
        >
          Data
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
