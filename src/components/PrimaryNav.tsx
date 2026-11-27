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
  { to: "/peaks", label: "Peaks", icon: "peak" },
  { to: "/lists", label: "Lists", icon: "list" },
  { to: "/progress", label: "Progress", icon: "progress" },
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
          <NavLink to="/settings" className="nav-utility">
            Record
          </NavLink>
          <NavLink to="/log" className="nav-cta">
            <Icon name="plus" size={15} />
            Log a climb
          </NavLink>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={linkClass}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <NavLink to="/log" className="mobile-log">
        <Icon name="plus" size={17} />
        <span>Log</span>
      </NavLink>
    </>
  );
}
