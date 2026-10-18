import { useState, useEffect } from "react";
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
import {
  createFactory,
  createReportingPeriod,
  uploadDocument,
  createElectricityRecord,
  syncEvidence,
  calculateFootprint,
  exportReport,
  saveCalculationResult,
  isAuthenticated,
} from "../api";
import AuthPanel from "../AuthPanel";

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
  const [authed, setAuthed] = useState(isAuthenticated());
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
  const [messageType, setMessageType] = useState("info"); // "info" | "error" | "success"
  const [activeStep, setActiveStep] = useState(1);

  const [createdFirmId, setCreatedFirmId] = useState(null);
  const [createdPeriodId, setCreatedPeriodId] = useState(null);
  const [uploadedDocId, setUploadedDocId] = useState(null);
  const [syncedFactor, setSyncedFactor] = useState(null);
  const [calculationResult, setCalculationResult] = useState(null);

  const [factorStatus, setFactorStatus] = useState("not_synced");
  const [calculationStatus, setCalculationStatus] = useState("not_calculated");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  function setFeedback(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
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

  // ---------------------------------------------------------------------------
  // STEP 1: Factory Profile
  // ---------------------------------------------------------------------------
  async function handleFactorySubmit(event) {
    event.preventDefault();
    if (!factory.name.trim() || !factory.state.trim()) {
      setFeedback("Factory name and state are required.", "error");
      return;
    }

    setLoading(true);
    setFeedback("Registering factory profile in database...", "info");
    try {
      const res = await createFactory(factory);
      setCreatedFirmId(res.id);
      setFeedback(`Factory "${res.name}" successfully registered. Proceed to Step 2.`, "success");
      setActiveStep(2);
    } catch (err) {
      setFeedback(`Failed to save factory profile: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Reporting Period
  // ---------------------------------------------------------------------------
  async function handlePeriodSubmit(event) {
    event.preventDefault();
    if (period.end_date < period.start_date) {
      setFeedback("The end date must be on or after the start date.", "error");
      return;
    }

    if (!createdFirmId) {
      setFeedback("Please register and save your factory profile in Step 1 first.", "error");
      setActiveStep(1);
      return;
    }

    setLoading(true);
    setFeedback("Creating reporting period boundary...", "info");
    try {
      const res = await createReportingPeriod({
        firm_id: createdFirmId,
        start_date: period.start_date,
        end_date: period.end_date,
        production_tonnes: period.production_tonnes ? Number(period.production_tonnes) : null,
      });
      setCreatedPeriodId(res.id);
      setFeedback(`Reporting period ${res.start_date} to ${res.end_date} established. Proceed to upload evidence.`, "success");
      setActiveStep(3);
    } catch (err) {
      setFeedback(`Failed to create reporting period: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Evidence Upload & Activity Record Verification
  // ---------------------------------------------------------------------------
  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setElectricityBill(file);
    if (!file) return;

    if (!createdPeriodId) {
      setFeedback("Please establish your reporting period in Step 2 before uploading bills.", "error");
      setActiveStep(2);
      return;
    }

    setLoading(true);
    setFeedback(`Uploading "${file.name}" and parsing metrics via Groq LLM Vision...`, "info");
    try {
      const docRes = await uploadDocument(file, createdPeriodId, "electricity_bill");
      setUploadedDocId(docRes.id);
      setDocumentStatus("pending");

      // Auto-populate extracted fields if returned by extractor
      const raw = docRes.extraction_raw_json?.extracted_fields || docRes.extraction_raw_json;
      if (raw && typeof raw === "object") {
        setDocumentFields({
          supplier: raw.supplier_name || raw.utility_name || "State Electricity Board",
          billingPeriod: raw.billing_period || `${period.start_date} - ${period.end_date}`,
          electricityKwh: String(raw.consumed_kwh || raw.units_kwh || ""),
          invoiceNumber: raw.invoice_number || raw.bill_number || "",
        });
      }
      setFeedback(`"${file.name}" uploaded. Review and confirm the extracted consumption below.`, "success");
    } catch (err) {
      setFeedback(`Upload error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDocumentDecision(status) {
    if (status === "confirmed") {
      if (!documentFields.electricityKwh || Number(documentFields.electricityKwh) <= 0) {
        setFeedback("Please enter a valid electricity consumption (kWh) > 0 before confirming.", "error");
        return;
      }
      if (!createdPeriodId) {
        setFeedback("Reporting period is missing. Please complete Step 2.", "error");
        setActiveStep(2);
        return;
      }

      setLoading(true);
      setFeedback("Recording verified electricity consumption to audit ledger...", "info");
      try {
        await createElectricityRecord({
          reporting_period_id: createdPeriodId,
          source_document_id: uploadedDocId || null,
          consumed_kwh: Number(documentFields.electricityKwh),
          peak_demand_kva: factory.contracted_demand_mva ? Number(factory.contracted_demand_mva) * 1000 : null,
          power_factor: 0.95,
          status: "confirmed",
        });

        setDocumentStatus("confirmed");
        setFeedback("Electricity evidence confirmed and recorded into audit ledger. Ready for calculation.", "success");
        setActiveStep(4);
      } catch (err) {
        setFeedback(`Failed to save activity record: ${err.message}`, "error");
      } finally {
        setLoading(false);
      }
    } else {
      setDocumentStatus(status);
      setFeedback(status === "flagged" ? "Document flagged for audit discrepancy." : "Document discarded.", "info");
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
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Live Evidence Sync & Engine Calculation
  // ---------------------------------------------------------------------------
  async function handleSync() {
    setLoading(true);
    setFeedback("Querying TinyFish agent for latest CEA CO2 Baseline Database factor...", "info");
    try {
      const res = await syncEvidence("grid_emission_factor");
      setFactorStatus("synced");
      setSyncedFactor(res);
      setFeedback(`Synced: ${res.value} ${res.unit} (${res.source_title}) verified by TinyFish.`, "success");
    } catch (err) {
      setFeedback(`Sync notification: ${err.message}`, "info");
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    if (!createdPeriodId) {
      setFeedback("Reporting period is missing. Complete prior steps first.", "error");
      return;
    }
    if (documentStatus !== "confirmed") {
      setFeedback("Please confirm electricity consumption details in Step 3 first.", "error");
      setActiveStep(3);
      return;
    }

    setLoading(true);
    setFeedback("Running deterministic GHG Protocol calculation engine and renewable pathways...", "info");
    try {
      const calcRes = await calculateFootprint(createdPeriodId);
      setCalculationStatus("calculated");
      setCalculationResult(calcRes);

      // Save complete dataset for Results page
      saveCalculationResult({
        ...calcRes,
        period_id: createdPeriodId,
        factory: factory,
        period: period,
        evidence: syncedFactor,
        electricityKwh: documentFields.electricityKwh,
      });

      setFeedback(
        `Calculation complete! Total emissions: ${calcRes.total_emissions_tco2e} tCO2e (${calcRes.specific_emissions_tco2e_per_tonne || "N/A"} tCO2e/t).`,
        "success"
      );
    } catch (err) {
      setFeedback(`Calculation error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!createdPeriodId) {
      setFeedback("Run calculation first before exporting report.", "error");
      return;
    }
    setLoading(true);
    setFeedback("Generating and archiving frozen audit report artifact...", "info");
    try {
      const res = await exportReport(createdPeriodId, "pdf");
      setFeedback(`Report archived successfully! Title: "${res.report_title}"`, "success");
    } catch (err) {
      setFeedback(`Export error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // AUTH GUARD
  // ---------------------------------------------------------------------------
  if (!authed) {
    return (
      <div className="setup-page">
        <div className="container" style={{ maxWidth: "600px", margin: "2rem auto" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <span className="aside-tag">Authentication Required</span>
            <h2 style={{ color: "var(--color-cream, #e4e2dd)", marginTop: "0.5rem" }}>
              Sign in to start your factory audit
            </h2>
            <p style={{ color: "var(--color-muted, #8b949e)", fontSize: "0.95rem" }}>
              QuadCore enforces tenant data isolation. Create an account or sign in to save your factory baseline, activity records, and audit reports.
            </p>
          </div>
          <AuthPanel onAuthenticated={() => setAuthed(true)} />
        </div>
      </div>
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
      desc: "CEA grid sync & emissions assessment",
      icon: CalculatorIcon,
    },
  ];

  return (
    <div className="setup-page">
      <div className="container">
        {/* Status Toast / Alert */}
        {message && (
          <div className={`status-alert ${messageType === "error" ? "status-alert-error" : ""}`} role="status">
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
                  To compute your factory's specific emissions and decarbonization pathways, follow these four stages under CEA and national standards.
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
                  All company details and document extracts stay strictly confidential and tenant-isolated in PostgreSQL.
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
                      ? `${Number(period.production_tonnes).toLocaleString()} tonnes`
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
                {createdFirmId
                  ? `Connected to database (Firm ID: ${createdFirmId.slice(0, 8)}... · Period: ${createdPeriodId || "Pending"})`
                  : "Draft mode. Complete Step 1 to save to backend."}
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
                      This links your production to the regional DISCOM and CEA emission benchmark.
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
                      placeholder="e.g. Chhattisgarh, Punjab, Odisha, Gujarat"
                      required
                    />
                    <span className="field-hint">
                      Required to map your plant to regional CEA grid factors & open access policy
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
                        placeholder="e.g. 15000 (For rooftop solar potential)"
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
                        placeholder="e.g. 3.5 (≥0.1 MVA qualifies for Green Open Access)"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="tariff_category" className="pill-label">
                      Tariff category (DISCOM)
                    </label>
                    <input
                      id="tariff_category"
                      name="tariff_category"
                      className="pill-input"
                      value={factory.tariff_category}
                      onChange={updateFactory}
                      placeholder="e.g. HT Industrial / EHT 33kV"
                    />
                  </div>

                  <div className="form-actions-row">
                    <button
                      type="submit"
                      className="pill-button pill-button-primary"
                      disabled={loading}
                    >
                      {loading ? "Saving to database..." : "Save factory & proceed →"}
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
                      Audit reporting period & output
                    </h2>
                    <p className="form-card-subtitle">
                      Specify the monthly or quarterly boundary and total finished steel production tonnage.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePeriodSubmit} className="pill-form">
                  <div className="form-row-2">
                    <div className="form-group">
                      <label htmlFor="start_date" className="pill-label">
                        Period start date <span className="req">*</span>
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
                        Period end date <span className="req">*</span>
                      </label>
                      <input
                        id="end_date"
                        name="end_date"
                        type="date"
                        className="pill-input"
                        value={period.end_date}
                        onChange={updatePeriod}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="production_tonnes" className="pill-label">
                      Finished steel billets produced (tonnes) <span className="req">*</span>
                    </label>
                    <input
                      id="production_tonnes"
                      name="production_tonnes"
                      type="number"
                      min="0.1"
                      step="any"
                      className="pill-input"
                      value={period.production_tonnes}
                      onChange={updatePeriod}
                      placeholder="e.g. 5000"
                      required
                    />
                    <span className="field-hint">
                      The net good production tonnage used as denominator for specific emissions intensity (tCO2e/t)
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
                    <button
                      type="submit"
                      className="pill-button pill-button-primary"
                      disabled={loading}
                    >
                      {loading ? "Saving period..." : "Save period & proceed →"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* STEP 3: Electricity Evidence & Bill Upload */}
            {activeStep === 3 && (
              <section className="form-card" aria-labelledby="heading-step-3">
                <div className="form-card-header">
                  <div>
                    <span className="step-eyebrow">STEP 03</span>
                    <h2 id="heading-step-3" className="form-card-title">
                      Electricity bill evidence upload
                    </h2>
                    <p className="form-card-subtitle">
                      Upload your DISCOM utility invoice. The backend extracts consumption and attaches it to the audit ledger.
                    </p>
                  </div>
                </div>

                <div className="dropzone-container">
                  <label htmlFor="electricityBill" className="pill-dropzone">
                    <div className="dropzone-content">
                      <UploadIcon className="w-10 h-10 text-forest dropzone-icon" />
                      <strong className="dropzone-text">
                        {electricityBill
                          ? electricityBill.name
                          : "Drop electricity bill here (.pdf, .docx, .png, .jpg), or browse"}
                      </strong>
                      <span className="dropzone-spec">
                        Automated Vision extraction via Groq Llama-3.3 Vision
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
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="visually-hidden"
                    />
                  </label>
                </div>

                {/* Verification Card */}
                <div className="verification-box">
                  <div className="verification-box-header">
                    <div>
                      <h4 className="verification-box-title">
                        Side-by-side verification
                      </h4>
                      <p className="verification-box-sub">
                        Verify key billing data before it counts toward your carbon ledger
                      </p>
                    </div>
                    <span className={`status-pill ${documentStatus}`}>
                      {documentStatus === "confirmed"
                        ? "Confirmed in Database"
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
                          className="pill-input"
                          value={documentFields.billingPeriod}
                          onChange={updateDocument}
                          placeholder="e.g. Jan 2026"
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
                        placeholder="e.g. 1500000"
                        required
                      />
                      <span className="field-hint">
                        Total active import energy (kWh) recorded on your primary HT meter
                      </span>
                    </div>

                    <div className="verification-actions">
                      <button
                        type="button"
                        className="pill-button pill-button-primary"
                        disabled={loading || !documentFields.electricityKwh}
                        onClick={() => handleDocumentDecision("confirmed")}
                      >
                        {loading ? "Saving to database..." : "Confirm & Save into Audit Trail"}
                      </button>
                      <button
                        type="button"
                        className="pill-button pill-button-secondary"
                        disabled={loading}
                        onClick={() => handleDocumentDecision("flagged")}
                      >
                        Flag discrepancy
                      </button>
                      <button
                        type="button"
                        className="pill-button pill-button-outline"
                        disabled={loading}
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
                      Emissions calculation & CEA audit sync
                    </h2>
                    <p className="form-card-subtitle">
                      Sync live regulatory factors from CEA via TinyFish and execute deterministic emission calculations.
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
                      <h4 className="sync-title">CEA Grid Emission Factor (TinyFish Agent)</h4>
                      <p className="sync-desc">
                        Fetch certified Indian National Grid baseline factor from Central Electricity Authority (CO2 Database v20).
                        {syncedFactor && (
                          <span style={{ display: "block", color: "var(--color-green, #1b4d3e)", fontWeight: 600, marginTop: "0.25rem" }}>
                            Current: {syncedFactor.value} {syncedFactor.unit} · {syncedFactor.source_title}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="sync-box-action">
                    <span className={`status-pill ${factorStatus}`}>
                      {factorStatus === "synced" ? "Synced with CEA" : "Ready to sync"}
                    </span>
                    <button
                      type="button"
                      className="pill-button pill-button-secondary"
                      disabled={loading}
                      onClick={handleSync}
                    >
                      {loading ? "Agent running..." : "Sync live CEA factor"}
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
                      ? "Calculation complete!"
                      : "Ready to run emission engine"}
                  </h3>
                  <p className="calc-desc">
                    Combines your verified {documentFields.electricityKwh ? Number(documentFields.electricityKwh).toLocaleString() : 0} kWh with the official CEA grid emission coefficient ({syncedFactor ? syncedFactor.value : "0.727"} tCO2/MWh) to generate Scope 2 totals and decarbonization pathways.
                  </p>

                  <div className="calc-actions-row">
                    <button
                      type="button"
                      className="pill-button pill-button-primary"
                      disabled={loading}
                      onClick={handleCalculate}
                    >
                      {loading ? "Calculating..." : "Calculate emissions"}
                    </button>
                    <button
                      type="button"
                      className="pill-button pill-button-outline"
                      disabled={loading || !calculationResult}
                      onClick={handleExport}
                    >
                      {loading ? "Archiving..." : "Archive & Export report"}
                    </button>
                    <a
                      href="#/results"
                      className="pill-button pill-button-translucent-dark"
                      style={{ fontWeight: 600 }}
                    >
                      {calculationStatus === "calculated" ? "View full audit report & pathways →" : "View sample results →"}
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
