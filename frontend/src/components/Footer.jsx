import { LogoMark } from "./Icons";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand-col">
          <a href="#/" className="brand-link" aria-label="CarbonLedger Home">
            <span className="brand-icon-box">
              <LogoMark className="brand-svg" />
            </span>
            <span className="brand-title">CarbonLedger</span>
          </a>
          <p className="footer-tagline">
            Industrial carbon accounting engine built specifically for Indian steel
            (induction furnace) manufacturers preparing EU CBAM compliant embedded
            emissions declarations.
          </p>
          <div className="footer-standards">
            <span className="footer-badge">EU CBAM Regulation 2023/956</span>
            <span className="footer-badge">CEA Baseline v20</span>
            <span className="footer-badge">GHG Protocol Scope 1 & 2</span>
          </div>
        </div>

        <div className="footer-nav-col">
          <h4 className="footer-col-title">Platform</h4>
          <ul className="footer-links">
            <li><a href="#/">Overview</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#/setup">Start company audit</a></li>
            <li><a href="#/results">Interactive sample report</a></li>
          </ul>
        </div>

        <div className="footer-nav-col">
          <h4 className="footer-col-title">Reporting Modules</h4>
          <ul className="footer-links">
            <li><span>Induction furnace electricity</span></li>
            <li><span>Diesel generator & mobile Scope 1</span></li>
            <li><span>Sponge iron & scrap precursors</span></li>
            <li><span>CEA grid factor baseline sync</span></li>
          </ul>
        </div>

        <div className="footer-nav-col">
          <h4 className="footer-col-title">Compliance</h4>
          <ul className="footer-links">
            <li><span>Specific embedded emissions (tCO2e/t)</span></li>
            <li><span>Audit trail & human sign-off</span></li>
            <li><span>Frozen calculation snapshots</span></li>
            <li><span>Draft XML / PDF CBAM export</span></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p>© {new Date().getFullYear()} CarbonLedger Technologies. Designed for Indian secondary steelmakers.</p>
          <p className="footer-disclaimer">
            All calculations follow European Commission CBAM rules for iron and steel products (CN 7206–7229).
          </p>
        </div>
      </div>
    </footer>
  );
}
