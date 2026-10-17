import { useState } from "react";
import { LogoMark } from "./Icons";

export default function Navbar({ currentRoute }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="#/" className="brand-link" aria-label="CarbonLedger Home">
          <span className="brand-icon-box">
            <LogoMark className="brand-svg" />
          </span>
          <span className="brand-text-group">
            <span className="brand-title">CarbonLedger</span>
            <span className="brand-badge">CBAM Steel</span>
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
            Sample result
          </a>
        </nav>

        <div className="header-actions">
          <a href="#/setup" className="pill-button pill-button-primary">
            Start your audit
          </a>

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
            Sample result
          </a>
          <a
            href="#/setup"
            className="pill-button pill-button-primary mobile-audit-btn"
            onClick={() => setMobileMenuOpen(false)}
          >
            Start your audit
          </a>
        </nav>
      )}
    </header>
  );
}
