import {
  FactoryIcon,
  DocumentIcon,
  VerifyCheckIcon,
  SyncIcon,
  CalculatorIcon,
  ReportIcon,
  ArrowRightIcon,
  CheckIcon,
  InfoIcon,
} from "../components/Icons";

export default function Landing() {
  const flowSteps = [
    { title: "Firm profile", desc: "Plant specs & capacity", icon: FactoryIcon },
    { title: "Documents", desc: "Energy & fuel bills", icon: DocumentIcon },
    { title: "Verify", desc: "AI extraction review", icon: VerifyCheckIcon },
    { title: "Evidence", desc: "CEA grid factor sync", icon: SyncIcon },
    { title: "Calculate", desc: "tCO2e/t allocation", icon: CalculatorIcon },
    { title: "Report", desc: "CBAM ready format", icon: ReportIcon },
  ];

  const fourSteps = [
    {
      num: "01",
      title: "Upload bills and CSVs",
      desc: "Drop in state DISCOM high-tension electricity bills, diesel fuel invoices, and heat-wise production logs without manual re-keying.",
      tag: "Automated OCR & parser",
    },
    {
      num: "02",
      title: "Check the AI's extraction side by side",
      desc: "Every reading, meter multiplier, and consumption figure is presented side by side with the original source document for human sign-off.",
      tag: "Zero unverified assumptions",
    },
    {
      num: "03",
      title: "Sync the grid factor and other outside data",
      desc: "One-click connection to the official CEA CO2 Baseline Database and published regional emission coefficients for transparent traceability.",
      tag: "Official CEA database v20",
    },
    {
      num: "04",
      title: "Get tCO2e per tonne and download the draft report",
      desc: "Generate the exact specific embedded emissions required by EU buyers under CBAM Regulation 2023/956 with complete audit trail.",
      tag: "CBAM Annex IV methodology",
    },
  ];

  const glossaryTerms = [
    {
      term: "Specific embedded emissions",
      highlight: true,
      def: "Tonnes of CO2 equivalent per metric tonne of steel produced (tCO2e/t). The hero metric demanded by EU CBAM importers.",
    },
    {
      term: "tCO2e",
      def: "Metric tonnes of carbon dioxide equivalent, aggregating CO2, CH4, and N2O greenhouse gases into a single climate metric.",
    },
    {
      term: "CBAM",
      def: "Carbon Border Adjustment Mechanism. EU regulation placing a carbon tariff on imported carbon-intensive goods including iron and steel.",
    },
    {
      term: "Grid emission factor",
      def: "Official kg CO2 per kWh supplied by the regional Indian electricity grid, sourced from CEA baseline database.",
    },
    {
      term: "Embedded emissions",
      def: "Direct emissions from production processes plus indirect emissions from electricity and precursor goods (scrap, DRI, alloys).",
    },
    {
      term: "Emission factor",
      def: "Standardised coefficient quantifying greenhouse gas released per unit of activity (e.g. diesel combustion or kWh consumed).",
    },
  ];

  return (
    <div className="landing-page">
      {/* Hero Outer Wrapper */}
      <section className="hero-wrap">
        <div className="hero-panel">
          <div className="hero-content">
            <div className="hero-pill-badge">
              <span className="hero-badge-dot" />
              <span>EU CBAM Transition Period — Regulation 2023/956</span>
            </div>

            <h1 className="hero-headline">
              FROM ELECTRICITY BILLS TO A CBAM-READY NUMBER.
            </h1>

            <p className="hero-subtext">
              Upload bills and invoices, check what the AI read, and get
              emissions per tonne of steel that your EU buyer can trace to its
              source.
            </p>

            <div className="hero-actions">
              <a href="#/setup" className="pill-button pill-button-white">
                Start your audit
              </a>
              <a href="#/results" className="pill-button pill-button-translucent">
                See a sample result
              </a>
            </div>
          </div>

          {/* Product Mock Dashboard overlapping hero */}
          <div className="mock-window-container">
            <div className="mock-window">
              <div className="mock-window-header">
                <div className="mock-window-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-yellow" />
                  <span className="dot dot-green" />
                </div>
                <div className="mock-window-title">
                  CarbonLedger Engine · Induction Furnace Unit #3
                </div>
                <div className="sample-badge">Sample data</div>
              </div>

              <div className="mock-window-body">
                {/* Metric Summary Cards */}
                <div className="mock-metrics-row">
                  <div className="mock-metric-card highlight">
                    <span className="metric-label">Specific Embedded Emissions</span>
                    <div className="metric-hero-val">
                      <span className="val-number">1.737</span>
                      <span className="val-unit">tCO2e / t steel</span>
                    </div>
                    <span className="metric-sub">
                      Induction Furnace · Crude Steel Billets
                    </span>
                  </div>

                  <div className="mock-metric-card">
                    <span className="metric-label">Total Period Emissions</span>
                    <div className="metric-val">
                      <span className="val-number">173.7</span>
                      <span className="val-unit">tCO2e</span>
                    </div>
                    <span className="metric-sub">
                      100 tonnes declared finished output
                    </span>
                  </div>

                  <div className="mock-metric-card">
                    <span className="metric-label">Electricity Grid Intensity</span>
                    <div className="metric-val">
                      <span className="val-number">0.716</span>
                      <span className="val-unit">kg CO2/kWh</span>
                    </div>
                    <span className="metric-sub">CEA Baseline v20 (Northern Grid)</span>
                  </div>
                </div>

                {/* Split layout: Chart + Verification list */}
                <div className="mock-split-grid">
                  <div className="mock-chart-card">
                    <div className="chart-header">
                      <div>
                        <h4>Emissions Breakdown by Scope</h4>
                        <p className="chart-subtitle">
                          CBAM Direct vs. Indirect allocation
                        </p>
                      </div>
                      <span className="badge-pill-mint">100% Accounted</span>
                    </div>

                    {/* Stacked Bar */}
                    <div className="stacked-bar-container">
                      <div className="stacked-bar" aria-label="Emissions breakdown bar chart">
                        <div
                          className="bar-seg seg-scope1"
                          style={{ width: "5%" }}
                          title="Scope 1: 8.7 tCO2e (5.0%)"
                        />
                        <div
                          className="bar-seg seg-scope2"
                          style={{ width: "46%" }}
                          title="Scope 2: 80.0 tCO2e (46.1%)"
                        />
                        <div
                          className="bar-seg seg-precursor"
                          style={{ width: "49%" }}
                          title="Precursors: 85.0 tCO2e (48.9%)"
                        />
                      </div>
                      <div className="bar-legend">
                        <div className="legend-item">
                          <span className="legend-chip chip-scope1" />
                          <span>Scope 1 (Diesel/Direct): <strong>8.7 tCO2e (5%)</strong></span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-chip chip-scope2" />
                          <span>Scope 2 (Grid Electricity): <strong>80.0 tCO2e (46%)</strong></span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-chip chip-precursor" />
                          <span>Precursors (Scrap/DRI): <strong>85.0 tCO2e (49%)</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mock-verify-card">
                    <div className="verify-header">
                      <h4>Documents to Verify</h4>
                      <span className="counter-pill">3 items</span>
                    </div>

                    <div className="mock-doc-list">
                      <div className="mock-doc-item status-verified">
                        <div className="doc-item-icon">
                          <CheckIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="doc-item-info">
                          <div className="doc-item-name">DHBVN_HT_Bill_Oct2024.pdf</div>
                          <div className="doc-item-meta">111,732 kWh · Meter Multiplier 80</div>
                        </div>
                        <span className="doc-badge-verified">Verified</span>
                      </div>

                      <div className="mock-doc-item status-verified">
                        <div className="doc-item-icon">
                          <CheckIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="doc-item-info">
                          <div className="doc-item-name">IOCL_Diesel_Invoice_492.pdf</div>
                          <div className="doc-item-meta">3,250 Litres · DG Set standby</div>
                        </div>
                        <span className="doc-badge-verified">Verified</span>
                      </div>

                      <div className="mock-doc-item status-pending">
                        <div className="doc-item-icon pending">·</div>
                        <div className="doc-item-info">
                          <div className="doc-item-name">DRI_SpongeIron_Delivery.csv</div>
                          <div className="doc-item-meta">75.4 t · Awaiting supplier factor</div>
                        </div>
                        <span className="doc-badge-pending">Pending</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Flow diagram */}
      <section className="section-flow" id="how-it-works">
        <div className="container">
          <div className="section-header-center">
            <h2 className="section-title">
              Preparing an EU emissions report shouldn't mean five spreadsheets
            </h2>
            <p className="section-paragraph">
              Indian induction furnace steelmakers face complex CBAM declarations:
              reconciling state electricity bills, scrap charges, ferro-alloy
              additions, and captive generator diesel logs into certified tonnes
              of CO2 per tonne of steel. CarbonLedger streamlines the entire pipeline.
            </p>
          </div>

          <div className="flow-track">
            {flowSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flow-step-wrapper">
                  <div className="flow-step-card">
                    <div className="flow-icon-tile">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flow-step-text">
                      <h3 className="flow-step-title">{step.title}</h3>
                      <p className="flow-step-desc">{step.desc}</p>
                    </div>
                  </div>

                  {idx < flowSteps.length - 1 && (
                    <div className="flow-arrow-indicator" aria-hidden="true">
                      <ArrowRightIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3: Four steps */}
      <section className="section-steps">
        <div className="container">
          <div className="steps-header">
            <span className="section-eyebrow">A CLEAR AUDIT TRAIL</span>
            <h2 className="section-title">From bills to buyer report in four steps</h2>
            <p className="section-paragraph">
              Every kilowatt-hour and litre of fuel links directly to raw evidence.
              No black boxes, no opaque AI estimates.
            </p>
          </div>

          <div className="steps-grid">
            {fourSteps.map((s) => (
              <div key={s.num} className="step-card">
                <div className="step-card-top">
                  <span className="step-num-pill">{s.num}</span>
                  <span className="step-tag-pill">{s.tag}</span>
                </div>
                <h3 className="step-card-title">{s.title}</h3>
                <p className="step-card-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Dark Green Feature Panel */}
      <section className="section-feature-panel" id="features">
        <div className="container">
          <div className="dark-feature-card">
            <div className="dark-feature-grid">
              <div className="dark-feature-content">
                <span className="feature-eyebrow">PURPOSE-BUILT METHODOLOGY</span>
                <h2 className="dark-feature-heading">
                  Built for how Indian steel plants actually report
                </h2>
                <p className="dark-feature-sub">
                  Generic Western carbon software assumes natural gas blast furnaces.
                  CarbonLedger was designed from the ground up for Indian induction
                  furnaces (IF-EAF route) and rolling mills.
                </p>

                <div className="feature-bullets-grid">
                  <div className="feature-bullet-item">
                    <div className="bullet-check-box">
                      <CheckIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="bullet-title">Indian grid emission factor (CEA)</h4>
                      <p className="bullet-desc">
                        Direct synchronization with Central Electricity Authority CO2
                        Baseline Database v20. Correct regional weighted average factors.
                      </p>
                    </div>
                  </div>

                  <div className="feature-bullet-item">
                    <div className="bullet-check-box">
                      <CheckIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="bullet-title">Scrap, DRI and ferro-alloy inputs</h4>
                      <p className="bullet-desc">
                        Handles precursor allocation rules under CBAM Annex IV for
                        induction furnace feed mixtures (sponge iron / scrap ratios).
                      </p>
                    </div>
                  </div>

                  <div className="feature-bullet-item">
                    <div className="bullet-check-box">
                      <CheckIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="bullet-title">A person checks every record before it counts</h4>
                      <p className="bullet-desc">
                        AI reads DISCOM bills and weighbridge CSVs, but nothing enters
                        the official calculation without human confirmation.
                      </p>
                    </div>
                  </div>

                  <div className="feature-bullet-item">
                    <div className="bullet-check-box">
                      <CheckIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="bullet-title">Every report keeps a frozen calculation snapshot</h4>
                      <p className="bullet-desc">
                        Lock timestamps, emission factors, document hash IDs and
                        formulas so past declarations survive third-party CBAM audits.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="feature-action-bar">
                  <a href="#/setup" className="pill-button pill-button-white">
                    Start plant onboarding
                  </a>
                  <a href="#/results" className="pill-button pill-button-translucent">
                    Explore sample calculation
                  </a>
                </div>
              </div>

              {/* Result Mock inside feature panel */}
              <div className="dark-feature-mock">
                <div className="result-preview-card">
                  <div className="result-preview-badge">
                    <span className="dot dot-green" />
                    <span>EU CBAM Calculation Sheet</span>
                  </div>

                  <div className="result-hero-box">
                    <span className="result-hero-label">Specific Embedded Emissions</span>
                    <div className="result-hero-number">1.737</div>
                    <span className="result-hero-sub">tCO2e per tonne crude steel</span>
                  </div>

                  <div className="result-details-list">
                    <div className="result-detail-row">
                      <span>Installation</span>
                      <strong>Induction Furnace #3 (15 MT)</strong>
                    </div>
                    <div className="result-detail-row">
                      <span>Production volume</span>
                      <strong>100.0 Metric Tonnes</strong>
                    </div>
                    <div className="result-detail-row">
                      <span>CEA Grid Factor</span>
                      <strong>0.716 tCO2e/MWh</strong>
                    </div>
                    <div className="result-detail-row">
                      <span>Scope 1 direct fuel</span>
                      <strong>8.7 tCO2e</strong>
                    </div>
                    <div className="result-detail-row">
                      <span>Scope 2 grid electricity</span>
                      <strong>80.0 tCO2e</strong>
                    </div>
                    <div className="result-detail-row">
                      <span>Precursor embedded</span>
                      <strong>85.0 tCO2e</strong>
                    </div>
                  </div>

                  <div className="result-stamp">
                    <InfoIcon className="w-4 h-4" />
                    <span>Frozen snapshot ID: CL-2024-Q3-IND-0914</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Glossary strip */}
      <section className="section-glossary">
        <div className="container">
          <div className="glossary-header">
            <span className="section-eyebrow">KNOWLEDGE BASE</span>
            <h2 className="section-title">CBAM & carbon accounting glossary</h2>
            <p className="section-paragraph">
              Key terms every plant manager and export head needs to know when
              communicating with European buyers.
            </p>
          </div>

          <div className="glossary-grid">
            {glossaryTerms.map((g) => (
              <div
                key={g.term}
                className={`glossary-card ${g.highlight ? "highlight" : ""}`}
              >
                <h4 className="glossary-term">{g.term}</h4>
                <p className="glossary-def">{g.def}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
