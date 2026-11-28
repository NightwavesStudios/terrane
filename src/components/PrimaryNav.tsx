import { NavLink, useLocation } from "react-router-dom";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";
import UnitsToggle from "./UnitsToggle";
import { useRecord } from "../state/RecordContext";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const items: NavItem[] = [
  { to: "/", label: "Explore", icon: "compass" },
  { to: "/peaks", label: "Peaks", icon: "peak" },
  { to: "/lists", label: "Lists", icon: "list" },
  { to: "/progress", label: "Progress", icon: "progress" },
];

function linkClass({ isActive }: { isActive: boolean }) {
  return `nav-link${isActive ? " nav-link--active" : ""}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

export default function PrimaryNav() {
  const { profile } = useRecord();
  const { pathname } = useLocation();
  const accountHref = profile ? "/settings" : "/signin?mode=signin";
  const onSignIn = pathname === "/signin";
  const showLogCta = !/^\/(log|signin|lists\/|peaks\/)/.test(pathname);

  return (
    <>
      <header className="primary-header">
        <NavLink to="/" end className="brand" aria-label="Terrane home">
          <Logo className="brand__mark" />
          <span className="brand__name">Terrane</span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={linkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          {!onSignIn ? <UnitsToggle /> : null}
          {!onSignIn ? (
            <NavLink
              to={accountHref}
              className="account-chip"
              aria-label={profile ? `Open ${profile.displayName}'s record settings` : "Sign in or create a record"}
            >
              <span className={`account-chip__avatar${profile ? "" : " account-chip__avatar--guest"}`}>
                {profile ? initials(profile.displayName) : <Icon name="user" size={16} />}
              </span>
              <span className="account-chip__name">{profile?.displayName ?? "Sign in"}</span>
            </NavLink>
          ) : null}
          {showLogCta ? (
            <NavLink to="/log" className="nav-cta">
              <Icon name="plus" size={15} />
              Log a climb
            </NavLink>
          ) : null}
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Primary mobile">
        <NavLink to="/" end className={linkClass}>
          <Icon name="compass" size={20} />
          <span>Explore</span>
        </NavLink>
        <NavLink to="/peaks" className={linkClass}>
          <Icon name="peak" size={20} />
          <span>Peaks</span>
        </NavLink>
        <NavLink
          to="/log"
          className={({ isActive }) => `${linkClass({ isActive })} nav-link--log`}
        >
          <span className="mobile-log-mark">
            <Icon name="plus" size={18} />
          </span>
          <span>Log</span>
        </NavLink>
        <NavLink to="/lists" className={linkClass}>
          <Icon name="list" size={20} />
          <span>Lists</span>
        </NavLink>
        <NavLink to="/progress" className={linkClass}>
          <Icon name="progress" size={20} />
          <span>Progress</span>
        </NavLink>
      </nav>
    </>
  );
}
