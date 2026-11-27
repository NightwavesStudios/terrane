import { Outlet, useLocation } from "react-router-dom";
import PrimaryNav from "./PrimaryNav";

export default function AppShell() {
  const location = useLocation();
  const isExplore = location.pathname === "/";

  return (
    <div className={`app-shell${isExplore ? " app-shell--explore" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PrimaryNav />
      <main id="main" className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
