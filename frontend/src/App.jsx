import { useState, useEffect } from "react";
import "./App.css";

import {
  createFactory,
  createReportingPeriod,
  syncEvidence,
  calculateEmissions,
  exportReport,
  loginUser,
  registerUser,
  getCurrentUser,
  clearTokens,
  getAccessToken,
} from "./api";

const initialFactory = {
  name: "",
  state: "",
  roof_area_sqm: "",
  contracted_demand_mva: "",
  tariff_category: "",
};

const initialPeriod = {
  start_date: "",
  end_date: "",
  production_tonnes: "",
};

function App() {
  const [factory, setFactory] = useState(initialFactory);
  const [period, setPeriod] = useState(initialPeriod);
  const [electricityBill, setElectricityBill] = useState(null);

  const [documentFields, setDocumentFields] = useState({
    supplier: "",
    billingPeriod: "",
    electricityKwh: "",
    invoiceNumber: "",
  });

  const [documentStatus, setDocumentStatus] = useState("empty");
  const [message, setMessage] = useState("");
  const [activeStep, setActiveStep] = useState(1);

  const [factorStatus, setFactorStatus] = useState("not_synced");
  const [calculationStatus, setCalculationStatus] = useState("not_calculated");

  // Authentication State
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    full_name: "",
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Check existing authentication on load
  useEffect(() => {
    async function loadCurrentUser() {
      if (getAccessToken()) {
        try {
          const profile = await getCurrentUser();
          setUser(profile);
        } catch {
          // Token invalid or expired
          clearTokens();
          setUser(null);
        }
      }
    }
    loadCurrentUser();
  }, []);

  function handleAuthFormChange(e) {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "login") {
        await loginUser({
          email: authForm.email,
          password: authForm.password,
        });
      } else {
        await registerUser({
          email: authForm.email,
          password: authForm.password,
          full_name: authForm.full_name,
        });
      }

      const profile = await getCurrentUser();
      setUser(profile);
      setShowAuthModal(false);
      setAuthForm({ email: "", password: "", full_name: "" });
      setMessage(
        `Welcome, ${profile.full_name || profile.email}! Signed in successfully.`
      );
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleSignOut() {
    clearTokens();
    setUser(null);
    setMessage("Signed out successfully.");
  }

  function updateFactory(event) {
    const { name, value } = event.target;
    setFactory((prev) => ({ ...prev, [name]: value }));
  }

  function updatePeriod(event) {
    const { name, value } = event.target;
    setPeriod((prev) => ({ ...prev, [name]: value }));
  }

  function updateDocument(event) {
    const { name, value } = event.target;

    setDocumentFields((prev) => ({ ...prev, [name]: value }));
    setDocumentStatus("pending");
    setCalculationStatus("not_calculated");
  }

  async function handleFactorySubmit(event) {
    event.preventDefault();
    setMessage("Saving factory profile...");

    try {
      const savedFactory = await createFactory(factory);

      // Retain the server-generated UUID for later API calls.
      sessionStorage.setItem("factory_id", savedFactory.id);

      setMessage(`Factory "${savedFactory.name}" saved successfully.`);
      setActiveStep(2);
    } catch (error) {
      if (error.status === 401) {
        setMessage(
          "Authentication required (401). Please sign in using the button above to continue."
        );
        setShowAuthModal(true);
      } else {
        setMessage(`Could not save factory: ${error.message}`);
      }
    }
  }

  async function handlePeriodSubmit(event) {
    event.preventDefault();

    if (period.end_date < period.start_date) {
      setMessage("The end date must be on or after the start date.");
      return;
    }

    const factoryId = sessionStorage.getItem("factory_id");
    if (factoryId) {
      try {
        setMessage("Saving reporting period to backend...");
        const savedPeriod = await createReportingPeriod({
          firm_id: factoryId,
          start_date: period.start_date,
          end_date: period.end_date,
          production_tonnes: period.production_tonnes,
        });

        if (savedPeriod?.id) {
          sessionStorage.setItem("period_id", savedPeriod.id);
        }
        setMessage("Reporting period saved successfully.");
        setActiveStep(3);
        return;
      } catch (err) {
        setMessage(
          `Reporting period validated locally (${err.message}). Proceeding to evidence.`
        );
        setActiveStep(3);
        return;
      }
    }

    setMessage(
      "Reporting period validated locally. Save a factory profile first for backend linking."
    );
    setActiveStep(3);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;

    setElectricityBill(file);
    setDocumentStatus(file ? "pending" : "empty");
    setDocumentFields({
      supplier: "",
      billingPeriod: "",
      electricityKwh: "",
      invoiceNumber: "",
    });
    setCalculationStatus("not_calculated");

    if (file) {
      setMessage(
        `${file.name} selected. Review and confirm activity data below.`
      );
    }
  }

  function handleDocumentDecision(status) {
    if (status === "confirmed") {
      if (
        !documentFields.electricityKwh ||
        Number(documentFields.electricityKwh) <= 0
      ) {
        setMessage("Enter a valid electricity consumption before confirming.");
        return;
      }

      if (!electricityBill) {
        setMessage("Upload an electricity bill before confirming its details.");
        return;
      }
    }

    setDocumentStatus(status);
    setCalculationStatus("not_calculated");

    setMessage(
      status === "confirmed"
        ? "Details marked as confirmed locally. Ready for emissions calculation."
        : status === "flagged"
          ? "Document flagged locally for review."
          : "Document discarded from this screen."
    );

    if (status === "discarded") {
      setElectricityBill(null);
      setDocumentFields({
        supplier: "",
        billingPeriod: "",
        electricityKwh: "",
        invoiceNumber: "",
      });
    }
  }

  async function handleSync() {
    if (!factory.state) {
      setMessage("Please enter a factory state in Step 1 first.");
      return;
    }

    setMessage(`Connecting to evidence service for ${factory.state}...`);
    try {
      const res = await syncEvidence(factory.state);
      setFactorStatus("synced");
      setMessage(
        `Evidence synced for ${factory.state}. ${res?.items_synced || 0} items retrieved.`
      );
    } catch (err) {
      setFactorStatus("not_synced");
      setMessage(
        `Live evidence sync note: ${err.message}`
      );
    }
  }

  async function handleCalculate() {
    if (
      !period.start_date ||
      !period.end_date ||
      !period.production_tonnes ||
      Number(period.production_tonnes) <= 0
    ) {
      setMessage("Complete the reporting period and production details first.");
      return;
    }

    if (documentStatus !== "confirmed") {
      setMessage("Review and confirm the electricity bill details first.");
      return;
    }

    const periodId = sessionStorage.getItem("period_id");
    if (periodId) {
      setMessage("Calculating emissions via calculation engine...");
      try {
        const result = await calculateEmissions(periodId);
        setCalculationStatus("calculated");
        setMessage(
          `Calculation complete! Total: ${result.total_emissions_tco2e} tCO2e (Scope 2: ${result.total_scope2_tco2e} tCO2e).`
        );
        return;
      } catch (err) {
        setMessage(`Calculation engine note: ${err.message}`);
        return;
      }
    }

    setCalculationStatus("not_calculated");
    setMessage(
      "Calculation requires a backend-persisted reporting period. Complete steps 1-3 to link records."
    );
  }

  async function handleExport() {
    const periodId = sessionStorage.getItem("period_id");
    if (periodId) {
      setMessage("Preparing report archive...");
      try {
        await exportReport(periodId, "pdf");
        setMessage("Report export complete.");
        return;
      } catch (err) {
        setMessage(`Report export note: ${err.message}`);
        return;
      }
    }

    setMessage(
      "Report export will be available once the reporting period has been calculated."
    );
  }

  const steps = [
    { number: 1, title: "Factory profile" },
    { number: 2, title: "Reporting period" },
    { number: 3, title: "Electricity evidence" },
    { number: 4, title: "Results & report" },
  ];

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">C</span>
          <span>CarbonLedger</span>
        </a>
        <div className="topbar-right">
          <span className="topbar-caption">
            Carbon intelligence for industry
          </span>
          {user ? (
            <div className="user-profile">
              <span className="user-badge" title={user.email}>
                👤 {user.full_name || user.email}
              </span>
              <button
                type="button"
                className="text-button signout-btn"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="secondary-button auth-trigger-btn"
              onClick={() => {
                setAuthError("");
                setShowAuthModal(true);
              }}
            >
              Sign in / Register
            </button>
          )}
        </div>
      </header>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAuthModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {authMode === "login"
                  ? "Sign in to CarbonLedger"
                  : "Create an account"}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAuthModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === "register" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Register
              </button>
            </div>

            {authError && <div className="auth-error">{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <div className="field">
                  <label htmlFor="auth_full_name">Full name *</label>
                  <input
                    id="auth_full_name"
                    name="full_name"
                    value={authForm.full_name}
                    onChange={handleAuthFormChange}
                    placeholder="Jane Doe"
                    required
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="auth_email">Email address *</label>
                <input
                  id="auth_email"
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthFormChange}
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="auth_password">Password * (min 8 chars)</label>
                <input
                  id="auth_password"
                  name="password"
                  type="password"
                  minLength={8}
                  value={authForm.password}
                  onChange={handleAuthFormChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                className="primary-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? "Processing..."
                  : authMode === "login"
                    ? "Sign In →"
                    : "Create Account →"}
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="workspace" id="top">
        <div className="intro">
          <p className="eyebrow">INDUSTRIAL CARBON ACCOUNTING</p>
          <h1>Make your emissions measurable.</h1>
          <p className="subtitle">
            Set up your factory, review your energy data and prepare an
            emissions report.
          </p>
        </div>

        <nav className="stepper" aria-label="Workflow steps">
          {steps.map((step) => (
            <button
              type="button"
              key={step.number}
              className={`step ${activeStep === step.number ? "active" : ""}`}
              onClick={() => setActiveStep(step.number)}
            >
              <span className="step-number">{step.number}</span>
              <span>{step.title}</span>
            </button>
          ))}
        </nav>

        {message && (
          <div className="status-message" role="status">
            {message}
          </div>
        )}

        <div className="main-grid">
          <div className="main-column">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">01 / FACTORY</p>
                  <h2>Factory profile</h2>
                  <p className="panel-description">
                    Tell us where the factory operates and provide its basic
                    electrical and physical specifications.
                  </p>
                </div>
                <span className="section-icon">⌂</span>
              </div>

              <form onSubmit={handleFactorySubmit}>
                <div className="field">
                  <label htmlFor="name">Factory / company name *</label>
                  <input
                    id="name"
                    name="name"
                    value={factory.name}
                    onChange={updateFactory}
                    placeholder="e.g. ABC Steel Works"
                    maxLength={255}
                    required
                  />
                  <span className="helper">
                    {factory.name.length}/255 characters
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="state">Factory state *</label>
                  <input
                    id="state"
                    name="state"
                    value={factory.state}
                    onChange={updateFactory}
                    placeholder="e.g. Haryana"
                    required
                  />
                  <span className="helper">
                    Used to identify relevant electricity-grid evidence.
                  </span>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="roof_area_sqm">Roof area (m²)</label>
                    <input
                      id="roof_area_sqm"
                      name="roof_area_sqm"
                      type="number"
                      min="0.01"
                      step="any"
                      value={factory.roof_area_sqm}
                      onChange={updateFactory}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="contracted_demand_mva">
                      Contracted demand (MVA)
                    </label>
                    <input
                      id="contracted_demand_mva"
                      name="contracted_demand_mva"
                      type="number"
                      min="0.01"
                      step="any"
                      value={factory.contracted_demand_mva}
                      onChange={updateFactory}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="tariff_category">
                    Electricity tariff category
                  </label>
                  <input
                    id="tariff_category"
                    name="tariff_category"
                    value={factory.tariff_category}
                    onChange={updateFactory}
                    placeholder="e.g. Industrial / HT"
                  />
                </div>

                <button className="primary-button" type="submit">
                  Save profile & continue →
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">02 / REPORTING</p>
                  <h2>Reporting period</h2>
                  <p className="panel-description">
                    Define the period covered by this emissions assessment.
                  </p>
                </div>
                <span className="section-icon">◷</span>
              </div>

              <form onSubmit={handlePeriodSubmit}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="start_date">Start date *</label>
                    <input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={period.start_date}
                      onChange={updatePeriod}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="end_date">End date *</label>
                    <input
                      id="end_date"
                      name="end_date"
                      type="date"
                      min={period.start_date || undefined}
                      value={period.end_date}
                      onChange={updatePeriod}
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="production_tonnes">
                    Production during this period (tonnes) *
                  </label>
                  <input
                    id="production_tonnes"
                    name="production_tonnes"
                    type="number"
                    min="0.01"
                    step="any"
                    value={period.production_tonnes}
                    onChange={updatePeriod}
                    placeholder="e.g. 250"
                    required
                  />
                  <span className="helper">
                    Used to calculate emissions per tonne, when supported by the
                    calculation engine.
                  </span>
                </div>

                <button className="primary-button" type="submit">
                  Save reporting period →
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">03 / SOURCE DOCUMENT</p>
                  <h2>Electricity bill</h2>
                  <p className="panel-description">
                    Upload a bill, then review its extracted activity data before
                    confirming it.
                  </p>
                </div>
                <span className="section-icon">↥</span>
              </div>

              <label className="upload-zone" htmlFor="electricityBill">
                <span className="upload-icon">↑</span>
                <strong>
                  {electricityBill
                    ? electricityBill.name
                    : "Choose an electricity bill"}
                </strong>
                <span>PDF, PNG or JPEG · Select a file from your device</span>
                {electricityBill && (
                  <span>
                    {(electricityBill.size / 1024).toFixed(1)} KB
                  </span>
                )}
                <input
                  id="electricityBill"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />
              </label>

              <p className="helper upload-helper">
                The file is currently selected locally; uploading and AI
                extraction are not connected yet.
              </p>

              <div className="verification-card">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">HUMAN VERIFICATION</p>
                    <h3>Review bill details</h3>
                  </div>
                  <span className={`review-status ${documentStatus}`}>
                    {documentStatus === "confirmed"
                      ? "Confirmed locally"
                      : documentStatus === "flagged"
                        ? "Flagged"
                        : documentStatus === "pending"
                          ? "Review required"
                          : "Awaiting document"}
                  </span>
                </div>

                <p className="helper">
                  Values below are entered manually, not AI-extracted.
                </p>

                <div className="field">
                  <label htmlFor="supplier">Electricity supplier</label>
                  <input
                    id="supplier"
                    name="supplier"
                    value={documentFields.supplier}
                    onChange={updateDocument}
                    placeholder="Supplier name"
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="billingPeriod">Billing month</label>
                    <input
                      id="billingPeriod"
                      name="billingPeriod"
                      type="month"
                      value={documentFields.billingPeriod}
                      onChange={updateDocument}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="invoiceNumber">Bill number</label>
                    <input
                      id="invoiceNumber"
                      name="invoiceNumber"
                      value={documentFields.invoiceNumber}
                      onChange={updateDocument}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="electricityKwh">
                    Electricity consumed (kWh) *
                  </label>
                  <input
                    id="electricityKwh"
                    name="electricityKwh"
                    type="number"
                    min="0.01"
                    step="any"
                    value={documentFields.electricityKwh}
                    onChange={updateDocument}
                    placeholder="e.g. 12500"
                  />
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!electricityBill}
                    onClick={() => handleDocumentDecision("confirmed")}
                  >
                    Confirm details
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!electricityBill}
                    onClick={() => handleDocumentDecision("flagged")}
                  >
                    Flag
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!electricityBill}
                    onClick={() => handleDocumentDecision("discarded")}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">04 / CALCULATION</p>
                  <h2>Emissions assessment</h2>
                  <p className="panel-description">
                    Retrieve evidence before calculating the electricity
                    footprint.
                  </p>
                </div>
                <span className="section-icon">ϟ</span>
              </div>

              <div className="action-card">
                <div>
                  <strong>Grid emission factor</strong>
                  <p>
                    Retrieve the applicable factor and its source through the
                    backend evidence service.
                  </p>
                </div>
                <span className="review-status">
                  {factorStatus === "synced" ? "Synced" : "Not connected"}
                </span>
              </div>

              <button
                type="button"
                className="secondary-button full-button"
                onClick={handleSync}
              >
                Sync live evidence
              </button>

              <div className="results-placeholder">
                <span className="results-symbol">↗</span>
                <h3>
                  {calculationStatus === "calculated"
                    ? "Calculation complete"
                    : "Your results will appear here"}
                </h3>
                <p>
                  No emissions estimate is shown until the backend returns a
                  calculation based on validated activity data and an applicable
                  emission factor.
                </p>
              </div>

              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCalculate}
                >
                  Calculate emissions
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleExport}
                >
                  Export report
                </button>
              </div>
            </section>
          </div>

          <aside className="side-column">
            <section className="panel preview-panel">
              <p className="eyebrow">LIVE PREVIEW</p>
              <h2>{factory.name || "Your factory"}</h2>
              <p className="preview-location">
                {factory.state || "Factory location not provided"}
              </p>

              <div className="preview-divider" />

              <div className="preview-item">
                <span>Reporting period</span>
                <strong>
                  {period.start_date && period.end_date
                    ? `${period.start_date} — ${period.end_date}`
                    : "Not set"}
                </strong>
              </div>

              <div className="preview-item">
                <span>Production</span>
                <strong>
                  {period.production_tonnes
                    ? `${period.production_tonnes} tonnes`
                    : "Not provided"}
                </strong>
              </div>

              <div className="preview-item">
                <span>Electricity usage</span>
                <strong>
                  {documentFields.electricityKwh
                    ? `${documentFields.electricityKwh} kWh`
                    : "Awaiting data"}
                </strong>
              </div>

              <div className="preview-item">
                <span>Document review</span>
                <strong>
                  {documentStatus === "confirmed"
                    ? "Confirmed locally"
                    : "Pending"}
                </strong>
              </div>

              <div className="preview-divider" />

              <p className="helper">
                Preview only. These values have not been saved to the backend.
              </p>
            </section>

            <section className="panel checklist-panel">
              <p className="eyebrow">WORKFLOW CHECKLIST</p>
              <h3>Before calculating</h3>
              {[
                ["Factory details", Boolean(factory.name && factory.state)],
                [
                  "Reporting period",
                  Boolean(
                    period.start_date &&
                      period.end_date &&
                      period.end_date >= period.start_date &&
                      Number(period.production_tonnes) > 0
                  ),
                ],
                ["Bill selected", Boolean(electricityBill)],
                ["Bill confirmed", documentStatus === "confirmed"],
              ].map(([label, complete]) => (
                <div className="check-item" key={label}>
                  <span className={complete ? "check done" : "check"}>
                    {complete ? "✓" : "·"}
                  </span>
                  <span>{label}</span>
                </div>
              ))}
              <p className="helper checklist-note">
                Completing these items does not mean the backend has saved or
                calculated anything.
              </p>
            </section>
          </aside>
        </div>

        <footer className="footer">
          <span>CarbonLedger</span>
          <span>Industrial emissions reporting · MVP</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
