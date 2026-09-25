import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon } from "./Icon";

export function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title =
      pathname === "/operations"
        ? "Operations"
        : pathname === "/stats"
          ? "Complaint Statistics"
          : "Submit Complaint";
    document.title = `${title} | CivicPulse`;
    document.getElementById("main-content")?.focus();
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <NavLink className="brand" to="/" aria-label="CivicPulse home">
          <span className="brand-icon">
            <Icon name="shield" />
          </span>
          <span>
            <strong>CivicPulse</strong>
            <span className="brand-subtitle">Municipal operations</span>
          </span>
        </NavLink>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Submit Complaint
          </NavLink>
          <NavLink to="/operations">Operations</NavLink>
          <NavLink to="/stats">Stats</NavLink>
        </nav>
        <span className="demo-label">
          <span />
          Mock data
        </span>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <strong>
          CivicPulse <span>/</span> Intake &amp; operations
        </strong>
        <span>Frontend demonstration</span>
      </footer>
    </div>
  );
}
