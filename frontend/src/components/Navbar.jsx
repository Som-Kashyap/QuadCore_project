import { useState, useEffect } from "react";
import { LogoMark } from "./Icons";
import { isAuthenticated, logoutUser, getCurrentUser } from "../api";

export default function Navbar({ currentRoute }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const authed = isAuthenticated();

  useEffect(() => {
    let isMounted = true;
    if (authed) {
      getCurrentUser()
        .then((u) => {
          if (isMounted) setUser(u);
        })
        .catch(() => {
          if (isMounted) setUser(null);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [authed, currentRoute]);

  const displayUser = authed ? user : null;

  function handleLogout() {
    logoutUser();
    window.location.hash = "#/";
    window.location.reload();
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#/" className="brand-link" aria-label="QuadCore CarbonLedger Home">
          <span className="brand-icon-box">
            <LogoMark className="brand-svg" />
          </span>
          <span className="brand-text-group">
            <span className="brand-title">CarbonLedger</span>
            <span className="brand-badge">India Steel</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <nav className="nav-desktop" aria-label="Main navigation">
          <a
            href="#features"
            className="nav-link"
            onClick={() => {
              if (window.location.hash !== "#/" && window.location.hash !== "") {
                window.location.hash = "#features";
              }
            }}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="nav-link"
            onClick={() => {
              if (window.location.hash !== "#/" && window.location.hash !== "") {
                window.location.hash = "#how-it-works";
              }
            }}
          >
            How it works
          </a>
          <a
            href="#/results"
            className={`nav-link ${currentRoute === "#/results" ? "active" : ""}`}
          >
            Audit results
          </a>
        </nav>

        <div className="header-actions">
          {authed ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--forest-900)", fontWeight: 600 }}>
                {displayUser?.full_name || displayUser?.email || "Authenticated"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="pill-button pill-button-secondary"
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <a href="#/setup" className="pill-button pill-button-primary">
              Sign in / Start audit
            </a>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="mobile-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav className="nav-mobile" aria-label="Mobile navigation">
          <a
            href="#features"
            className="mobile-nav-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="mobile-nav-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            How it works
          </a>
          <a
            href="#/results"
            className={`mobile-nav-link ${currentRoute === "#/results" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Audit results
          </a>
          {authed ? (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="pill-button pill-button-secondary mobile-audit-btn"
            >
              Sign out
            </button>
          ) : (
            <a
              href="#/setup"
              className="pill-button pill-button-primary mobile-audit-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in / Start audit
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
