import { useState } from "react";
import {
  FactoryIcon,
  DocumentIcon,
  VerifyCheckIcon,
  CalculatorIcon,
  CheckIcon,
  UploadIcon,
  SyncIcon,
  InfoIcon,
} from "../components/Icons";


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

export default function Setup() {
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

  function handleFactorySubmit(event) {
    event.preventDefault();
    setMessage(
      "Factory details validated locally. Backend saving is not connected yet."
    );
    setActiveStep(2);
  }

  function handlePeriodSubmit(event) {
    event.preventDefault();
    if (period.end_date < period.start_date) {
      setMessage("The end date must be on or after the start date.");
      return;
    }
    setMessage(
      "Reporting period validated locally. Backend saving is not connected yet."
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
        `${file.name} selected. Actual upload and extraction require the backend API.`
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
        ? "Details marked as confirmed locally. Backend verification is not connected yet."
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

  function handleSync() {
    setFactorStatus("not_synced");
    setMessage(
      "Live evidence sync is not connected yet. No live emission factor has been retrieved."
    );
  }

  function handleCalculate() {
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

    setCalculationStatus("not_calculated");
    setMessage(
      "Calculation requires the backend API and a validated emission factor. No emissions result has been generated."
    );
  }

  function handleExport() {
    setMessage(
      "Report export will be available once the backend report API is connected."
    );
  }

  const stepsList = [
    {
      num: 1,
      title: "Factory profile",
      desc: "Plant specifications, location and demand",
      icon: FactoryIcon,
    },
    {
      num: 2,
      title: "Reporting period",
      desc: "Audit timeframe & finished steel volume",
      icon: VerifyCheckIcon,
    },
    {
      num: 3,
      title: "Electricity evidence",
      desc: "DISCOM bill upload & verification",
      icon: DocumentIcon,
    },
    {
      num: 4,
      title: "Results & report",
      desc: "CEA grid sync & draft CBAM generation",
      icon: CalculatorIcon,
    },
  ];

  return (
    <div className="setup-page">
      <div className="container">
        {/* Status Toast / Alert */}
        {message && (
          <div className="status-alert" role="status">
            <InfoIcon className="w-5 h-5 flex-shrink-0" />
            <span className="status-text">{message}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <div className="setup-layout-grid">
          {/* Left Column: Dark green panel showing "What happens next" */}
          <aside className="setup-aside-panel">
            <div className="setup-aside-card">
              <div className="aside-header">
                <span className="aside-tag">Onboarding Workflow</span>
                <h2 className="aside-title">What happens next</h2>
                <p className="aside-desc">
                  To compute your CBAM specific embedded emissions, follow these four
                  stages. Each stage keeps your raw data auditable.
                </p>
              </div>

              <div className="aside-steps-list">
                {stepsList.map((step) => {
                  const Icon = step.icon;
                  const isActive = activeStep === step.num;
                  const isCompleted = activeStep > step.num;

                  return (
                    <button
                      key={step.num}
                      type="button"
                      className={`aside-step-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                      onClick={() => setActiveStep(step.num)}
                    >
                      <div className="step-item-marker">
                        {isCompleted ? (
                          <CheckIcon className="w-4 h-4" />
                        ) : (
                          <span>{step.num}</span>
                        )}
                      </div>
                      <div className="step-item-content">
                        <div className="step-item-title-row">
                          <span className="step-item-title">{step.title}</span>
                          <Icon className="w-4 h-4 step-item-icon" />
                        </div>
                        <span className="step-item-sub">{step.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Progress summary inside left panel */}
              <div className="aside-progress-box">
                <div className="progress-label-row">
                  <span>Audit completion</span>
                  <strong>{Math.round(((activeStep - 1) / 4) * 100)}%</strong>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.max(5, ((activeStep - 1) / 4) * 100)}%` }}
                  />
                </div>
                <p className="aside-note">
                  All company details and document extracts stay strictly confidential
                  on your infrastructure.
                </p>
              </div>
            </div>
          </aside>

          {/* Right Column: Forms + Live preview mint card */}
          <main className="setup-main-content">
            {/* Step navigation tabs */}
            <nav className="setup-stepper-tabs" aria-label="Step selector">
              {stepsList.map((s) => (
                <button
                  type="button"
                  key={s.num}
                  className={`stepper-tab-pill ${activeStep === s.num ? "active" : ""}`}
                  onClick={() => setActiveStep(s.num)}
                >
                  <span className="tab-pill-num">{s.num}</span>
                  <span className="tab-pill-text">{s.title}</span>
                </button>
              ))}
            </nav>

            {/* Live Preview as a Mint Card */}
            <div className="mint-preview-card">
              <div className="mint-preview-header">
                <div>
                  <span className="mint-badge">Live Company Preview</span>
                  <h3 className="mint-company-name">
                    {factory.name || "Your Factory Name"}
                  </h3>
                  <p className="mint-company-meta">
                    {factory.state ? `State: ${factory.state}` : "Location not provided"}
                    {factory.contracted_demand_mva
                      ? ` · ${factory.contracted_demand_mva} MVA`
                      : ""}
                    {factory.tariff_category ? ` · ${factory.tariff_category}` : ""}
                  </p>
                </div>
                <div className="mint-verification-status">
                  <span className={`status-pill ${documentStatus}`}>
                    {documentStatus === "confirmed"
                      ? "Bill Confirmed"
                      : documentStatus === "flagged"
                        ? "Bill Flagged"
                        : documentStatus === "pending"
                          ? "Review Pending"
                          : "Awaiting Bill"}
                  </span>
                </div>
              </div>

              <div className="mint-preview-metrics">
                <div className="mint-metric-item">
                  <span className="metric-tag">Reporting Period</span>
                  <strong className="metric-val">
                    {period.start_date && period.end_date
                      ? `${period.start_date} → ${period.end_date}`
                      : "Not set"}
                  </strong>
                </div>

                <div className="mint-metric-item">
                  <span className="metric-tag">Declared Production</span>
                  <strong className="metric-val">
                    {period.production_tonnes
                      ? `${period.production_tonnes} tonnes`
                      : "Not entered"}
                  </strong>
                </div>

                <div className="mint-metric-item">
                  <span className="metric-tag">Electricity Consumption</span>
                  <strong className="metric-val">
                    {documentFields.electricityKwh
                      ? `${Number(documentFields.electricityKwh).toLocaleString()} kWh`
                      : "Awaiting bill data"}
                  </strong>
                </div>
              </div>

              <p className="mint-preview-footnote">
                Local draft preview. Data will be saved to your CarbonLedger account upon API connection.
              </p>
            </div>

            {/* STEP 1: Factory Profile */}
            {activeStep === 1 && (
              <section className="form-card" aria-labelledby="heading-step-1">
                <div className="form-card-header">
                  <div>
                    <span className="step-eyebrow">STEP 01</span>
                    <h2 id="heading-step-1" className="form-card-title">
                      Company & factory profile
                    </h2>
                    <p className="form-card-subtitle">
                      Enter the legal entity details and plant electrical capacity.
                      This links your production to the correct regional DISCOM and grid.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleFactorySubmit} className="pill-form">
                  <div className="form-group">
                    <label htmlFor="name" className="pill-label">
                      Factory / company name <span className="req">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      className="pill-input"
                      value={factory.name}
                      onChange={updateFactory}
                      placeholder="e.g. Mahavir Induction Steel Ltd."
                      maxLength={255}
                      required
                    />
                    <span className="field-hint">
                      {factory.name.length}/255 characters · Legal name as registered with GST
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="state" className="pill-label">
                      Factory state <span className="req">*</span>
                    </label>
                    <input
                      id="state"
                      name="state"
                      className="pill-input"
                      value={factory.state}
                      onChange={updateFactory}
                      placeholder="e.g. Chhattisgarh, Punjab, Odisha"
                      required
                    />
                    <span className="field-hint">
                      Required to map your plant to the corresponding CEA regional grid factor
                    </span>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="roof_area_sqm" className="pill-label">
                        Roof area (m²)
                      </label>
                      <input
                        id="roof_area_sqm"
                        name="roof_area_sqm"
                        type="number"
                        min="0"
                        step="any"
                        className="pill-input"
                        value={factory.roof_area_sqm}
                        onChange={updateFactory}
                        placeholder="e.g. 15000 (Optional for solar potential)"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="contracted_demand_mva" className="pill-label">
                        Contracted demand (MVA)
                      </label>
                      <input
                        id="contracted_demand_mva"
                        name="contracted_demand_mva"
                        type="number"
                        min="0"
                        step="any"
                        className="pill-input"
                        value={factory.contracted_demand_mva}
                        onChange={updateFactory}
                        placeholder="e.g. 10.5 (Optional)"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="tariff_category" className="pill-label">
                      Electricity tariff category
                    </label>
                    <input
                      id="tariff_category"
                      name="tariff_category"
                      className="pill-input"
                      value={factory.tariff_category}
                      onChange={updateFactory}
                      placeholder="e.g. HT-Industrial / Heavy Arc Furnace"
                    />
                  </div>

                  <div className="form-actions-row">
                    <button type="submit" className="pill-button pill-button-primary">
                      Save company details
                    </button>
                    <button
                      type="button"
                      className="pill-button pill-button-secondary"
                      onClick={() => setActiveStep(2)}
                    >
                      Next: Reporting period →
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* STEP 2: Reporting Period */}
            {activeStep === 2 && (
              <section className="form-card" aria-labelledby="heading-step-2">
                <div className="form-card-header">
                  <div>
                    <span className="step-eyebrow">STEP 02</span>
                    <h2 id="heading-step-2" className="form-card-title">
                      Reporting period & production volume
                    </h2>
                    <p className="form-card-subtitle">
                      Specify the accounting window and total finished steel billets
                      cast during this timeframe.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePeriodSubmit} className="pill-form">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="start_date" className="pill-label">
                        Start date <span className="req">*</span>
                      </label>
                      <input
                        id="start_date"
                        name="start_date"
                        type="date"
                        className="pill-input"
                        value={period.start_date}
                        onChange={updatePeriod}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="end_date" className="pill-label">
                        End date <span className="req">*</span>
                      </label>
                      <input
                        id="end_date"
                        name="end_date"
                        type="date"
                        min={period.start_date || undefined}
                        className="pill-input"
                        value={period.end_date}
                        onChange={updatePeriod}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="production_tonnes" className="pill-label">
                      Production during this period (tonnes) <span className="req">*</span>
                    </label>
                    <input
                      id="production_tonnes"
                      name="production_tonnes"
                      type="number"
                      min="0.01"
                      step="any"
                      className="pill-input"
                      value={period.production_tonnes}
                      onChange={updatePeriod}
                      placeholder="e.g. 100"
                      required
                    />
                    <span className="field-hint">
                      Crucial denominator: Used to calculate the hero number{" "}
                      <strong>specific embedded emissions (tCO2e per tonne)</strong>.
                    </span>
                  </div>

                  <div className="form-actions-row">
                    <button
                      type="button"
                      className="pill-button pill-button-outline"
                      onClick={() => setActiveStep(1)}
                    >
                      ← Back
                    </button>
                    <button type="submit" className="pill-button pill-button-primary">
                      Save reporting period →
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* STEP 3: Electricity Evidence & Bill Extraction */}
            {activeStep === 3 && (
              <section className="form-card" aria-labelledby="heading-step-3">
                <div className="form-card-header">
                  <div>
                    <span className="step-eyebrow">STEP 03</span>
                    <h2 id="heading-step-3" className="form-card-title">
                      Electricity bill & AI verification
                    </h2>
                    <p className="form-card-subtitle">
                      Upload your DISCOM high-tension power invoice. Review and confirm
                      the extracted kWh reading side by side.
                    </p>
                  </div>
                </div>

                {/* Drag and Drop style file field */}
                <div className="upload-container">
                  <label className="pill-upload-dropzone" htmlFor="electricityBill">
                    <div className="dropzone-icon-box">
                      <UploadIcon className="w-8 h-8 text-forest" />
                    </div>
                    <div className="dropzone-text">
                      <strong className="dropzone-filename">
                        {electricityBill
                          ? electricityBill.name
                          : "Drop electricity bill here, or browse files"}
                      </strong>
                      <span className="dropzone-spec">
                        Supported: PDF, PNG, JPG (State DISCOM invoices, e.g. CSPDCL, PSPCL, DHBVN)
                      </span>
                      {electricityBill && (
                        <span className="dropzone-filesize">
                          Size: {(electricityBill.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                    <input
                      id="electricityBill"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="visually-hidden"
                    />
                  </label>
                  <p className="field-hint text-center">
                    The file is selected in your browser; backend AI parsing activates upon network upload.
                  </p>
                </div>

                {/* Verification Card */}
                <div className="verification-box">
                  <div className="verification-box-header">
                    <div>
                      <h4 className="verification-box-title">
                        Side-by-side human verification
                      </h4>
                      <p className="verification-box-sub">
                        Verify key billing data before it counts toward your carbon ledger
                      </p>
                    </div>
                    <span className={`status-pill ${documentStatus}`}>
                      {documentStatus === "confirmed"
                        ? "Confirmed locally"
                        : documentStatus === "flagged"
                          ? "Flagged for review"
                          : documentStatus === "pending"
                            ? "Review required"
                            : "Awaiting document"}
                    </span>
                  </div>

                  <div className="verification-fields">
                    <div className="form-group">
                      <label htmlFor="supplier" className="pill-label">
                        Electricity supplier / DISCOM
                      </label>
                      <input
                        id="supplier"
                        name="supplier"
                        className="pill-input"
                        value={documentFields.supplier}
                        onChange={updateDocument}
                        placeholder="e.g. CSPDCL / Tata Power / PSPCL"
                      />
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor="billingPeriod" className="pill-label">
                          Billing month
                        </label>
                        <input
                          id="billingPeriod"
                          name="billingPeriod"
                          type="month"
                          className="pill-input"
                          value={documentFields.billingPeriod}
                          onChange={updateDocument}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="invoiceNumber" className="pill-label">
                          Bill / consumer number
                        </label>
                        <input
                          id="invoiceNumber"
                          name="invoiceNumber"
                          className="pill-input"
                          value={documentFields.invoiceNumber}
                          onChange={updateDocument}
                          placeholder="e.g. HT-09482910"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="electricityKwh" className="pill-label">
                        Electricity consumed (kWh) <span className="req">*</span>
                      </label>
                      <input
                        id="electricityKwh"
                        name="electricityKwh"
                        type="number"
                        min="0.01"
                        step="any"
                        className="pill-input highlight"
                        value={documentFields.electricityKwh}
                        onChange={updateDocument}
                        placeholder="e.g. 111732"
                      />
                      <span className="field-hint">
                        Total active import energy (kWh) recorded on your primary meter
                      </span>
                    </div>

                    <div className="verification-actions">
                      <button
                        type="button"
                        className="pill-button pill-button-primary"
                        disabled={!electricityBill}
                        onClick={() => handleDocumentDecision("confirmed")}
                      >
                        Confirm details
                      </button>
                      <button
                        type="button"
                        className="pill-button pill-button-secondary"
                        disabled={!electricityBill}
                        onClick={() => handleDocumentDecision("flagged")}
                      >
                        Flag discrepancy
                      </button>
                      <button
                        type="button"
                        className="pill-button pill-button-outline"
                        disabled={!electricityBill}
                        onClick={() => handleDocumentDecision("discarded")}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-actions-row">
                  <button
                    type="button"
                    className="pill-button pill-button-outline"
                    onClick={() => setActiveStep(2)}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="pill-button pill-button-primary"
                    onClick={() => setActiveStep(4)}
                  >
                    Proceed to calculation →
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: Results & Report Generation */}
            {activeStep === 4 && (
              <section className="form-card" aria-labelledby="heading-step-4">
                <div className="form-card-header">
                  <div>
                    <span className="step-eyebrow">STEP 04</span>
                    <h2 id="heading-step-4" className="form-card-title">
                      Emissions assessment & CBAM draft
                    </h2>
                    <p className="form-card-subtitle">
                      Sync external emission factors from CEA and calculate specific
                      embedded emissions.
                    </p>
                  </div>
                </div>

                {/* Evidence sync card */}
                <div className="sync-box">
                  <div className="sync-box-info">
                    <div className="sync-icon-circle">
                      <SyncIcon className="w-5 h-5 text-forest" />
                    </div>
                    <div>
                      <h4 className="sync-title">CEA Grid Emission Factor</h4>
                      <p className="sync-desc">
                        Fetch certified regional grid baseline for {factory.state || "your state"}{" "}
                        (Central Electricity Authority CO2 Database v20).
                      </p>
                    </div>
                  </div>
                  <div className="sync-box-action">
                    <span className={`status-pill ${factorStatus}`}>
                      {factorStatus === "synced" ? "Synced" : "Not connected"}
                    </span>
                    <button
                      type="button"
                      className="pill-button pill-button-secondary"
                      onClick={handleSync}
                    >
                      Sync live factor
                    </button>
                  </div>
                </div>

                {/* Calculation placeholder box */}
                <div className="calc-placeholder-box">
                  <div className="calc-icon-large">
                    <CalculatorIcon className="w-10 h-10 text-green" />
                  </div>
                  <h3 className="calc-title">
                    {calculationStatus === "calculated"
                      ? "Calculation complete"
                      : "Engine ready for calculation"}
                  </h3>
                  <p className="calc-desc">
                    Emissions are calculated by combining verified kWh with the CEA grid
                    emission coefficient and allocating over production tonnage.
                  </p>

                  <div className="calc-actions-row">
                    <button
                      type="button"
                      className="pill-button pill-button-primary"
                      onClick={handleCalculate}
                    >
                      Calculate emissions
                    </button>
                    <button
                      type="button"
                      className="pill-button pill-button-outline"
                      onClick={handleExport}
                    >
                      Export draft report
                    </button>
                    <a
                      href="#/results"
                      className="pill-button pill-button-translucent-dark"
                    >
                      View live sample report →
                    </a>
                  </div>
                </div>

                <div className="form-actions-row">
                  <button
                    type="button"
                    className="pill-button pill-button-outline"
                    onClick={() => setActiveStep(3)}
                  >
                    ← Back to documents
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
