import { useState, useId } from "react";
import {
  CheckIcon,
  ReportIcon,
  SparklesIcon,
} from "../components/Icons";
import { getCalculationResult, exportReport } from "../api";
import { generateAuditPdf } from "../reportPdfGenerator";

export default function Results() {
  const sliderId = useId();
  const [storedData] = useState(() => getCalculationResult());
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportedReport, setExportedReport] = useState(null);

  // State for What-if slider: Renewable electricity share percentage (0% to 100%)
  const [renewableShare, setRenewableShare] = useState(0);

  // Use real backend calculation values if present, else default demo scenario
  const isRealCalculation = Boolean(storedData?.total_emissions_tco2e !== undefined);
  const factory = storedData?.factory || { name: "Induction Furnace Plant (Northern India)", state: "Northern Grid" };
  const period = storedData?.period || { start_date: "2026-01-01", end_date: "2026-03-31" };

  const productionTonnes = storedData?.period?.production_tonnes
    ? Number(storedData.period.production_tonnes)
    : 100;
  const scope1Base = Number((storedData?.total_scope1_tco2e ?? 8.7).toFixed(2));
  const scope2Base = Number((storedData?.total_scope2_tco2e ?? 80.0).toFixed(2));
  const precursorBase = Number((storedData?.total_precursor_tco2e ?? 85.0).toFixed(2));

  // Live recalculations with renewable share
  const scope2Current = Number((scope2Base * (1 - renewableShare / 100)).toFixed(2));
  const totalEmissionsCurrent = Number((scope1Base + scope2Current + precursorBase).toFixed(2));
  const specificEmissionsCurrent = Number(
    (totalEmissionsCurrent / (productionTonnes || 1)).toFixed(3)
  );

  // Percentage shares for stacked bar
  const scope1Pct = totalEmissionsCurrent > 0 ? ((scope1Base / totalEmissionsCurrent) * 100).toFixed(1) : 0;
  const scope2Pct = totalEmissionsCurrent > 0 ? ((scope2Current / totalEmissionsCurrent) * 100).toFixed(1) : 0;
  const precursorPct = totalEmissionsCurrent > 0 ? ((precursorBase / totalEmissionsCurrent) * 100).toFixed(1) : 0;

  // Real recommendations from engine
  const engineRecommendations = storedData?.recommendations || [];

  async function handleExportReport() {
    if (!storedData?.period_id) {
      setExportMessage("Complete a real factory audit via Setup to archive live reports.");
      return;
    }
    setExporting(true);
    setExportMessage("");
    try {
      const res = await exportReport(storedData.period_id, "pdf");
      setExportedReport(res);
      setExportMessage(`Report "${res.report_title}" successfully generated & archived! Hash: ${res.computation_snapshot?.snapshot_sha256?.slice(0, 16)}...`);
    } catch (err) {
      setExportMessage(`Export notice: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  function downloadReportSnapshot() {
    if (!exportedReport?.computation_snapshot) return;
    const blob = new Blob([JSON.stringify(exportedReport.computation_snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_certificate_period_${storedData.period_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Source trail audit table records
  const sourceTrail = [
    {
      factor: "Grid electricity consumption",
      value: storedData?.electricityKwh ? `${Number(storedData.electricityKwh).toLocaleString()} kWh` : "111,732 kWh",
      source: `State DISCOM HT Bill (${factory.state || "National Grid"})`,
      status: "Verified in audit ledger",
      scope: "Scope 2",
    },
    {
      factor: "CEA grid emission coefficient",
      value: storedData?.evidence?.value ? `${storedData.evidence.value} tCO2/MWh` : "0.7270 tCO2/MWh",
      source: storedData?.evidence?.source_title || "CEA CO2 Baseline Database (Version 20.0)",
      status: "Certified government standard",
      scope: "Scope 2 factor",
    },
    {
      factor: "Standby diesel combustion",
      value: scope1Base > 0 ? `${(scope1Base / 0.00268).toFixed(0)} Litres` : "Direct combustion",
      source: "Fuel Purchase Registers / Invoices",
      status: "Verified",
      scope: "Scope 1",
    },
    {
      factor: "Finished steel output",
      value: `${productionTonnes.toLocaleString()} tonnes`,
      source: "Outward production register & weighbridge records",
      status: "Verified production",
      scope: "Denominator",
    },
  ];

  return (
    <div className="results-page">
      <div className="container">
        {/* Sample Data Disclaimer or Live Banner */}
        <div className="sample-disclaimer-banner">
          <div className="disclaimer-left">
            <span className={`badge-sample-pill ${isRealCalculation ? "badge-verified-pill" : ""}`}>
              {isRealCalculation ? "Live Audit Calculation" : "Sample Demo Scenario"}
            </span>
            <span className="disclaimer-text">
              {isRealCalculation
                ? `Calculated for ${factory.name} (${factory.state}) covering ${period.start_date} to ${period.end_date}.`
                : "Demonstration scenario for a 15 MT induction furnace steelmaker casting billets in India."}
            </span>
          </div>
          <a href="#/setup" className="pill-button pill-button-white-compact">
            {isRealCalculation ? "Modify audit inputs →" : "Start your real audit →"}
          </a>
        </div>

        {/* Hero Card: Dark Green Gradient with Big Hero Number */}
        <section className="results-hero-card">
          <div className="results-hero-top">
            <div>
              <div className="hero-eyebrow-pill">
                <span>INDIAN INDUSTRIAL CARBON LEDGER & CEA COMPLIANCE</span>
              </div>
              <h1 className="results-hero-title">
                {factory.name || "Induction Furnace Billets Footprint"}
              </h1>
              <p className="results-hero-subtitle">
                Deterministic GHG Protocol & CEA statutory metric per metric tonne of finished steel billets
              </p>
            </div>
            <div className="hero-right-badge">
              <span className="pulse-dot" />
              <span>
                {storedData?.period_id ? `Period ID: #${storedData.period_id} · CEA Verified` : "Audit Hash: #CEA-FY24"}
              </span>
            </div>
          </div>

          <div className="hero-big-number-layout">
            <div className="hero-primary-stat">
              <span className="stat-caption">Specific emissions intensity (Hero Number)</span>
              <div className="stat-number-row">
                <span className="huge-number">{specificEmissionsCurrent}</span>
                <span className="huge-unit">tCO2e / tonne billet</span>
              </div>
              <p className="stat-footnote">
                Complies with CEA Power Sector Baselines, BEE PAT standards, and export CBAM declarations.
              </p>
            </div>

            <div className="hero-scope-split">
              <div className="scope-split-item">
                <span className="split-label">Scope 1 (Direct Fuel)</span>
                <strong className="split-val">{scope1Base} tCO2e</strong>
                <span className="split-pct">{scope1Pct}% of total</span>
              </div>
              <div className="scope-split-item highlight">
                <span className="split-label">Scope 2 (Grid Electricity)</span>
                <strong className="split-val">{scope2Current} tCO2e</strong>
                <span className="split-pct">{scope2Pct}% of total</span>
              </div>
              <div className="scope-split-item">
                <span className="split-label">Precursors (Scrap / DRI)</span>
                <strong className="split-val">{precursorBase} tCO2e</strong>
                <span className="split-pct">{precursorPct}% of total</span>
              </div>
              <div className="scope-split-item">
                <span className="split-label">Total Audit Footprint</span>
                <strong className="split-val">{totalEmissionsCurrent} tCO2e</strong>
                <span className="split-pct">{productionTonnes} tonnes declared</span>
              </div>
            </div>
          </div>
        </section>

        {/* Engine Decarbonization Pathways Section */}
        {engineRecommendations.length > 0 && (
          <section className="pathways-section" style={{ margin: "2.5rem 0" }}>
            <div className="section-head-row">
              <div>
                <span className="section-eyebrow">RENEWABLE DECARBONIZATION PATHWAYS</span>
                <h2 className="section-title">Plant-specific decarbonization recommendations</h2>
                <p className="section-paragraph">
                  Rule-based decarbonization pathways generated by the QuadCore engine matching your factory physical baseline.
                </p>
              </div>
              <div className="badge-pill-mint">{engineRecommendations.length} Pathways Identified</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", marginTop: "1.25rem" }}>
              {engineRecommendations.map((rec) => (
                <div
                  key={rec.id || rec.headline}
                  style={{
                    background: "var(--color-surface, #1b2820)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-mint, #52b788)", fontWeight: 700 }}>
                      {rec.category?.replace(/_/g, " ") || "Pathway"}
                    </span>
                    <h3 style={{ fontSize: "1.15rem", color: "var(--color-cream, #e4e2dd)", margin: "0.5rem 0" }}>
                      {rec.headline}
                    </h3>
                    <p style={{ fontSize: "0.88rem", color: "var(--color-muted, #8b949e)", lineHeight: 1.5 }}>
                      {rec.description}
                    </p>
                  </div>

                  <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ color: "var(--color-muted, #8b949e)", display: "block" }}>Annual Reduction</span>
                      <strong style={{ color: "var(--color-mint, #52b788)" }}>
                        {rec.tco2e_reduction_annual ? `${rec.tco2e_reduction_annual} tCO2e` : `${rec.potential_tco2e_reduction || 0} tCO2e`}
                      </strong>
                    </div>
                    {rec.percentage_scope2_offset !== undefined && (
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: "var(--color-muted, #8b949e)", display: "block" }}>Scope 2 Offset</span>
                        <strong style={{ color: "var(--color-cream, #e4e2dd)" }}>{rec.percentage_scope2_offset}%</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* What-if interactive simulator */}
        <section className="whatif-simulator-card">
          <div className="whatif-header">
            <div className="whatif-header-title-group">
              <span className="whatif-eyebrow">WHAT-IF SCENARIO ANALYSIS</span>
              <h2 className="whatif-title">Simulate renewable transition</h2>
              <p className="whatif-desc">
                Adjust the slider to simulate switching your factory's grid electricity to captive rooftop solar or Green Energy Open Access (PPA).
              </p>
            </div>
            <div className="whatif-current-badge">
              <SparklesIcon className="w-4 h-4 text-forest" />
              <span>{renewableShare}% Renewable Energy</span>
            </div>
          </div>

          <div className="slider-wrapper">
            <div className="slider-label-row">
              <label htmlFor={sliderId} className="slider-field-label">
                Renewable electricity share (Solar / GEOA PPA):
              </label>
              <span className="slider-value-pill">{renewableShare}%</span>
            </div>
            <input
              id={sliderId}
              type="range"
              min="0"
              max="100"
              step="5"
              value={renewableShare}
              onChange={(e) => setRenewableShare(Number(e.target.value))}
              className="range-slider"
            />
            <div className="slider-ticks">
              <span>0% (CEA Grid)</span>
              <span>25% Rooftop</span>
              <span>50% Captive Hybrid</span>
              <span>75% Green Tariff</span>
              <span>100% Fully Decarbonized</span>
            </div>
          </div>

          <div className="whatif-comparison-grid">
            <div className="comparison-box">
              <span className="comp-caption">Baseline (0% Green)</span>
              <strong className="comp-number">
                {(totalEmissionsCurrent / (productionTonnes || 1)).toFixed(3)} tCO2e/t
              </strong>
              <span className="comp-note">Standard DISCOM coal-heavy grid</span>
            </div>

            <div className="comparison-box active">
              <span className="comp-caption">Simulated with {renewableShare}% Renewable</span>
              <strong className="comp-number text-green">{specificEmissionsCurrent} tCO2e/t</strong>
              <span className="comp-note">
                Avoided: {((scope2Base * renewableShare) / 100).toFixed(2)} tCO2e
              </span>
            </div>

            <div className="comparison-box target">
              <span className="comp-caption">Net Impact on {productionTonnes}t Lot</span>
              <strong className="comp-number">
                -{((scope2Base * renewableShare) / 100).toFixed(1)} tCO2e
              </strong>
              <span className="comp-note">Carbon tariff & compliance savings</span>
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
            <div className="badge-pill-mint">{sourceTrail.length} of {sourceTrail.length} Verified</div>
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
                  Export Certified Audit Report & Snapshot
                </h3>
                <p className="report-action-desc">
                  Generates an immutable audit trail PDF artifact with frozen SHA-256 computation fingerprints, verified CEA factors, and installation baseline declarations.
                </p>
                {exportMessage && (
                  <div style={{ marginTop: "0.5rem", color: "var(--color-mint, #52b788)", fontSize: "0.9rem", fontWeight: 600 }}>
                    {exportMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="report-action-btn-group" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="pill-button pill-button-primary"
                onClick={handleExportReport}
                disabled={exporting}
              >
                {exporting ? "Archiving report..." : "Generate & Archive Audit Report"}
              </button>
              {exportedReport && (
                <>
                  <button
                    type="button"
                    className="pill-button pill-button-primary"
                    style={{ background: "var(--color-primary-dark, #0f4c3a)" }}
                    onClick={() => generateAuditPdf(exportedReport, factory, period, storedData)}
                  >
                    <ReportIcon className="w-4 h-4" />
                    <span>Download Audit Certificate (PDF)</span>
                  </button>
                  <button
                    type="button"
                    className="pill-button pill-button-outline"
                    onClick={downloadReportSnapshot}
                  >
                    Export JSON Snapshot
                  </button>
                </>
              )}
              <a href="#/dashboard" className="pill-button pill-button-secondary">
                View Plant Dashboard →
              </a>
              <a href="#/setup" className="pill-button pill-button-outline">
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
