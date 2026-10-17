import { useState, useId } from "react";
import {
  InfoIcon,
  CheckIcon,
  ReportIcon,
  SparklesIcon,
} from "../components/Icons";

export default function Results() {
  const sliderId = useId();
  // State for What-if slider: Renewable electricity share percentage (0% to 100%)
  const [renewableShare, setRenewableShare] = useState(0);

  // Baseline sample values as requested
  const productionTonnes = 100;
  const scope1Base = 8.7; // Scope 1: Diesel and direct handling
  const scope2Base = 80.0; // Scope 2: Grid electricity
  const precursorBase = 85.0; // Precursors: DRI / sponge iron & scrap

  // Live recalculations with renewable share
  const scope2Current = Number((scope2Base * (1 - renewableShare / 100)).toFixed(2));
  const totalEmissionsCurrent = Number((scope1Base + scope2Current + precursorBase).toFixed(2));
  const specificEmissionsCurrent = Number((totalEmissionsCurrent / productionTonnes).toFixed(3));

  // Percentage shares for stacked bar
  const scope1Pct = ((scope1Base / totalEmissionsCurrent) * 100).toFixed(1);
  const scope2Pct = ((scope2Current / totalEmissionsCurrent) * 100).toFixed(1);
  const precursorPct = ((precursorBase / totalEmissionsCurrent) * 100).toFixed(1);

  // Source trail audit table records
  const sourceTrail = [
    {
      factor: "Grid electricity consumption",
      value: "111,732 kWh",
      source: "State DISCOM HT Bill #HT-09482910 (Oct 2024)",
      status: "Verified by auditor",
      scope: "Scope 2",
    },
    {
      factor: "Grid emission coefficient",
      value: "0.7160 kg CO2/kWh",
      source: "CEA CO2 Baseline Database v20 (Northern Grid)",
      status: "Certified standard",
      scope: "Scope 2 factor",
    },
    {
      factor: "Standby diesel combustion",
      value: "3,250 Litres",
      source: "IOCL Fuel Receipt #INV-492 / Logbook",
      status: "Verified by auditor",
      scope: "Scope 1",
    },
    {
      factor: "Diesel oxidation coefficient",
      value: "2.6800 kg CO2/L",
      source: "2006 IPCC Guidelines / CBAM Annex IV",
      status: "Certified standard",
      scope: "Scope 1 factor",
    },
    {
      factor: "Sponge Iron / DRI precursor",
      value: "75.40 tonnes",
      source: "Supplier CBAM Declaration Template",
      status: "Verified supplier",
      scope: "Precursor",
    },
    {
      factor: "Crude steel finished output",
      value: "100.00 tonnes",
      source: "Weighbridge outward log & heat register",
      status: "Verified production",
      scope: "Denominator",
    },
  ];

  return (
    <div className="results-page">
      <div className="container">
        {/* Sample Data Disclaimer Banner */}
        <div className="sample-disclaimer-banner">
          <div className="disclaimer-left">
            <span className="badge-sample-pill">Sample data, not your figures</span>
            <span className="disclaimer-text">
              Demonstration scenario for a 15 MT induction furnace steelmaker casting billets in Northern India.
            </span>
          </div>
          <a href="#/setup" className="pill-button pill-button-white-compact">
            Start your real audit →
          </a>
        </div>

        {/* Hero Card: Dark Green Gradient with Big Hero Number */}
        <section className="results-hero-card">
          <div className="results-hero-top">
            <div>
              <div className="hero-eyebrow-pill">
                <span>CBAM SPECIFIC EMBEDDED EMISSIONS</span>
              </div>
              <h1 className="results-hero-title">
                Induction Furnace Billets Footprint
              </h1>
              <p className="results-hero-subtitle">
                Official CBAM Regulation 2023/956 metric per metric tonne of finished crude steel
              </p>
            </div>
            <div className="hero-right-badge">
              <span className="pulse-dot" />
              <span>Audit Hash: #0828-CEA-2024</span>
            </div>
          </div>

          <div className="hero-big-number-layout">
            <div className="hero-primary-stat">
              <span className="stat-caption">Specific embedded emissions (Hero Number)</span>
              <div className="stat-number-row">
                <span className="huge-number">{specificEmissionsCurrent}</span>
                <span className="huge-unit">tCO2e / tonne</span>
              </div>
              <p className="stat-footnote">
                EU Importers declaration value for CN Code 7207 (Semi-finished products of iron or steel).
              </p>
            </div>

            <div className="hero-secondary-stats">
              <div className="secondary-stat-box">
                <span className="sec-label">Total Net Emissions</span>
                <strong className="sec-value">{totalEmissionsCurrent} <span className="sec-unit">tCO2e</span></strong>
                <span className="sec-note">For 100.0 tonnes production</span>
              </div>

              <div className="secondary-stat-box">
                <span className="sec-label">Scope 2 Grid Electricity</span>
                <strong className="sec-value">{scope2Current} <span className="sec-unit">tCO2e</span></strong>
                <span className="sec-note">
                  {renewableShare > 0
                    ? `${renewableShare}% green power offset`
                    : "100% CEA baseline grid"}
                </span>
              </div>

              <div className="secondary-stat-box">
                <span className="sec-label">Induction vs BF-BOF</span>
                <strong className="sec-value text-mint">-24.5%</strong>
                <span className="sec-note">Vs. Global BF-BOF average (2.30 tCO2e/t)</span>
              </div>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="results-chart-box">
            <div className="chart-bar-header">
              <h3 className="chart-title">Emissions Breakdown by Scope</h3>
              <span className="chart-total-tag">
                Total: {totalEmissionsCurrent} tCO2e ({productionTonnes} t production)
              </span>
            </div>

            <div className="results-stacked-bar" aria-label="Scope breakdown visualization">
              <div
                className="bar-seg seg-scope1"
                style={{ width: `${scope1Pct}%` }}
                title={`Scope 1: ${scope1Base} tCO2e (${scope1Pct}%)`}
              />
              <div
                className="bar-seg seg-scope2"
                style={{ width: `${scope2Pct}%` }}
                title={`Scope 2: ${scope2Current} tCO2e (${scope2Pct}%)`}
              />
              <div
                className="bar-seg seg-precursor"
                style={{ width: `${precursorPct}%` }}
                title={`Precursors: ${precursorBase} tCO2e (${precursorPct}%)`}
              />
            </div>

            <div className="results-chart-legend">
              <div className="legend-entry">
                <span className="legend-chip chip-scope1" />
                <span className="legend-name">Scope 1 (Direct Fuel & Handling)</span>
                <strong className="legend-val">{scope1Base} tCO2e ({scope1Pct}%)</strong>
              </div>
              <div className="legend-entry">
                <span className="legend-chip chip-scope2" />
                <span className="legend-name">Scope 2 (Indirect Electricity)</span>
                <strong className="legend-val">{scope2Current} tCO2e ({scope2Pct}%)</strong>
              </div>
              <div className="legend-entry">
                <span className="legend-chip chip-precursor" />
                <span className="legend-name">Precursors (Sponge Iron / Scrap)</span>
                <strong className="legend-val">{precursorBase} tCO2e ({precursorPct}%)</strong>
              </div>
            </div>
          </div>
        </section>

        {/* What-If Simulation Card */}
        <section className="whatif-card">
          <div className="whatif-header">
            <div className="whatif-icon-box">
              <SparklesIcon className="w-6 h-6 text-green" />
            </div>
            <div>
              <span className="whatif-eyebrow">WHAT-IF SCENARIO MODELER</span>
              <h2 className="whatif-title">Renewable share of electricity</h2>
              <p className="whatif-desc">
                Adjust captive solar, wind PPA, or green tariff procurement to observe
                immediate impact on Scope 2 emissions and your final CBAM number.
              </p>
            </div>
          </div>

          <div className="whatif-slider-container">
            <div className="slider-label-row">
              <label htmlFor={sliderId} className="slider-label">
                Renewable electricity share: <strong>{renewableShare}%</strong>
              </label>
              <span className="slider-badge-val">
                Scope 2 reduction: {((scope2Base - scope2Current)).toFixed(1)} tCO2e
              </span>
            </div>

            <input
              id={sliderId}
              type="range"
              min="0"
              max="100"
              step="5"
              value={renewableShare}
              onChange={(e) => setRenewableShare(Number(e.target.value))}
              className="styled-slider"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={renewableShare}
              aria-label="Renewable share percentage slider"
            />

            <div className="slider-ticks">
              <span>0% (Grid only)</span>
              <span>25% Open Access</span>
              <span>50% Captive Hybrid</span>
              <span>75% Green Tariff</span>
              <span>100% Fully Decarbonized</span>
            </div>
          </div>

          <div className="whatif-comparison-grid">
            <div className="comparison-box">
              <span className="comp-caption">Baseline (0% Green)</span>
              <strong className="comp-number">1.737 tCO2e/t</strong>
              <span className="comp-note">Standard DISCOM coal-heavy grid</span>
            </div>

            <div className="comparison-box active">
              <span className="comp-caption">Simulated with {renewableShare}% Renewable</span>
              <strong className="comp-number text-green">{specificEmissionsCurrent} tCO2e/t</strong>
              <span className="comp-note">
                Savings: {(1.737 - specificEmissionsCurrent).toFixed(3)} tCO2e/t
              </span>
            </div>

            <div className="comparison-box target">
              <span className="comp-caption">Net Impact on 100t Lot</span>
              <strong className="comp-number">
                -{(173.7 - totalEmissionsCurrent).toFixed(1)} tCO2e
              </strong>
              <span className="comp-note">Potential CBAM tariff savings</span>
            </div>
          </div>
        </section>

        {/* Source Trail Table */}
        <section className="source-trail-section">
          <div className="section-head-row">
            <div>
              <span className="section-eyebrow">RAW AUDIT TRACEABILITY</span>
              <h2 className="section-title">Source trail & evidence ledger</h2>
              <p className="section-paragraph">
                Every factor is anchored to third-party invoices, state DISCOM meters, or CEA statutory publications.
              </p>
            </div>
            <div className="badge-pill-mint">6 of 6 Verified</div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="source-table">
              <thead>
                <tr>
                  <th scope="col">Factor / Activity Data</th>
                  <th scope="col">Reported Value</th>
                  <th scope="col">Scope Allocation</th>
                  <th scope="col">Primary Source & Verification Ref</th>
                  <th scope="col">Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {sourceTrail.map((row) => (
                  <tr key={row.factor}>
                    <td className="font-semibold">{row.factor}</td>
                    <td className="font-mono text-dark">{row.value}</td>
                    <td>
                      <span className="scope-tag">{row.scope}</span>
                    </td>
                    <td className="text-muted">{row.source}</td>
                    <td>
                      <span className="status-cell-badge">
                        <CheckIcon className="w-3.5 h-3.5 inline mr-1 text-green" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Report Export Action Card */}
        <section className="report-action-panel">
          <div className="report-action-inner">
            <div className="report-action-info">
              <div className="report-action-icon">
                <ReportIcon className="w-8 h-8 text-forest" />
              </div>
              <div>
                <h3 className="report-action-title">
                  Download EU CBAM Communication Sheet
                </h3>
                <p className="report-action-desc">
                  Standard European Commission Excel XML template with installations,
                  processes, and precursor declarations.
                </p>
                <div className="disabled-notice" role="note">
                  <InfoIcon className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Available once report export is built (backend export endpoint is not implemented yet).
                  </span>
                </div>
              </div>
            </div>

            <div className="report-action-btn-group">
              <button
                type="button"
                className="pill-button pill-button-disabled"
                disabled
                aria-disabled="true"
              >
                Download draft report (XML / PDF)
              </button>
              <a href="#/setup" className="pill-button pill-button-secondary">
                Edit audit inputs
              </a>
            </div>
          </div>
        </section>

        {/* Back Link */}
        <div className="results-footer-nav">
          <a href="#/" className="inline-back-link">
            ← Return to CarbonLedger Overview
          </a>
        </div>
      </div>
    </div>
  );
}
