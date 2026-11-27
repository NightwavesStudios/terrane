import { NavLink } from "react-router-dom";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const items: NavItem[] = [
  { to: "/", label: "Explore", icon: "compass" },
  { to: "/atlas", label: "Atlas", icon: "peak" },
  { to: "/lists", label: "Lists", icon: "list" },
  { to: "/goals", label: "Goals", icon: "target" },
  { to: "/journal", label: "Journal", icon: "journal" },
];

function linkClass({ isActive }: { isActive: boolean }) {
  return `nav-link${isActive ? " nav-link--active" : ""}`;
}

export default function PrimaryNav() {
  return (
    <>
      <header className="primary-header">
        <NavLink to="/" end className="brand" aria-label="Terrane home">
          <Logo className="brand__mark" />
          <span className="brand__name">Terrane</span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/journal" className="header-journal" aria-label="Open your journal">
          <span className="header-journal__dot" aria-hidden="true" />
          <span>My journal</span>
        </NavLink>
      </header>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
