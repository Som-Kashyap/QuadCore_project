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
  getFactories,
  createReportingPeriod,
  getReportingPeriods,
  getPeriodReports,
  uploadDocument,
  createElectricityRecord,
  createFuelRecord,
  createMaterialRecord,
  getPeriodActivity,
  verifyActivity,
  deleteActivityRecord,
  ingestDocumentToActivity,
  syncEvidence,
  getEvidenceItems,
  calculateFootprint,
  exportReport,
  saveCalculationResult,
  isAuthenticated,
} from "../api";
import AuthPanel from "../AuthPanel";
import { generateAuditPdf } from "../reportPdfGenerator";

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
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // "info" | "error" | "success"

  // Step 1: Factory State
  const [factory, setFactory] = useState(initialFactory);
  const [existingFactories, setExistingFactories] = useState([]);
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [createdFirmId, setCreatedFirmId] = useState(null);

  // Step 2: Reporting Period State
  const [period, setPeriod] = useState(initialPeriod);
  const [existingPeriods, setExistingPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [createdPeriodId, setCreatedPeriodId] = useState(null);

  // Step 3: Activity & Evidence State
  const [activityCategory, setActivityCategory] = useState("electricity"); // "electricity" | "fuel" | "material"
  const [uploadedDocId, setUploadedDocId] = useState(null);
  const [uploadedDocFile, setUploadedDocFile] = useState(null);
  const [extractionInfo, setExtractionInfo] = useState(null);

  // Electricity Fields
  const [electricityFields, setElectricityFields] = useState({
    consumedKwh: "",
    peakDemandKva: "",
    powerFactor: "0.95",
    totalBilledInr: "",
    utilityProvider: "",
    billingPeriod: "",
    consumerNumber: "",
  });

  // Fuel Fields
  const [fuelFields, setFuelFields] = useState({
    fuelType: "diesel",
    quantityLiters: "",
    totalCostInr: "",
    supplierName: "",
    invoiceNumber: "",
  });

  // Material Fields (Scope 3 Precursors)
  const [materialFields, setMaterialFields] = useState({
    materialType: "steel_scrap",
    quantityTonnes: "",
    supplierName: "",
    supplierEmissionFactor: "",
  });

  // Consolidated Period Activity Ledger
  const [periodActivity, setPeriodActivity] = useState({
    electricity_records: [],
    fuel_records: [],
    material_records: [],
  });

  // Step 4: Evidence Sync, Calculation & Reports
  const [syncedFactor, setSyncedFactor] = useState(null);
  const [allEvidenceItems, setAllEvidenceItems] = useState([]);
  const [factorStatus, setFactorStatus] = useState("not_synced");
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculationStatus, setCalculationStatus] = useState("not_calculated");
  const [archivedReports, setArchivedReports] = useState([]);
  const [generatedReport, setGeneratedReport] = useState(null);

  function setFeedback(msg, type = "info") {
    setMessage(msg);
    setMessageType(type);
  }

  // Load existing factories when authenticated
  useEffect(() => {
    if (!authed) return;
    loadFactories();
    loadEvidence();
  }, [authed]);

  // Load periods when firm selected
  useEffect(() => {
    if (!createdFirmId) return;
    loadPeriods(createdFirmId);
  }, [createdFirmId]);

  // Load activity ledger when period selected
  useEffect(() => {
    if (!createdPeriodId) return;
    loadActivityLedger(createdPeriodId);
    loadArchivedReports(createdPeriodId);
  }, [createdPeriodId]);

  async function loadFactories() {
    try {
      const firms = await getFactories();
      if (Array.isArray(firms)) {
        setExistingFactories(firms);
      }
    } catch {
      // Ignored for new users
    }
  }

  async function loadPeriods(firmId) {
    try {
      const periods = await getReportingPeriods(firmId);
      if (Array.isArray(periods)) {
        setExistingPeriods(periods);
      }
    } catch {
      // Ignored
    }
  }

  async function loadActivityLedger(periodId) {
    try {
      const data = await getPeriodActivity(periodId);
      if (data) {
        setPeriodActivity({
          electricity_records: data.electricity_records || [],
          fuel_records: data.fuel_records || [],
          material_records: data.material_records || [],
        });
      }
    } catch {
      // Ignored
    }
  }

  async function loadEvidence() {
    try {
      const items = await getEvidenceItems();
      if (Array.isArray(items)) {
        setAllEvidenceItems(items);
        const gridFactor = items.find((i) => i.category === "grid_emission_factor");
        if (gridFactor) {
          setSyncedFactor(gridFactor);
          setFactorStatus("synced");
        }
      }
    } catch {
      // Ignored
    }
  }

  async function loadArchivedReports(periodId) {
    try {
      const reports = await getPeriodReports(periodId);
      if (Array.isArray(reports)) {
        setArchivedReports(reports);
      }
    } catch {
      // Ignored
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Factory Profile
  // ---------------------------------------------------------------------------
  function handleSelectExistingFirm(e) {
    const firmId = e.target.value;
    setSelectedFirmId(firmId);
    if (!firmId) return;

    const matched = existingFactories.find((f) => f.id === firmId);
    if (matched) {
      setFactory({
        name: matched.name || "",
        state: matched.state || "",
        roof_area_sqm: matched.roof_area_sqm ? String(matched.roof_area_sqm) : "",
        contracted_demand_mva: matched.contracted_demand_mva ? String(matched.contracted_demand_mva) : "",
        tariff_category: matched.tariff_category || "",
      });
      setCreatedFirmId(matched.id);
      setFeedback(`Selected existing factory "${matched.name}". Proceed to Step 2.`, "success");
    }
  }

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
      setSelectedFirmId(res.id);
      await loadFactories();
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
  function handleSelectExistingPeriod(e) {
    const pId = e.target.value;
    setSelectedPeriodId(pId);
    if (!pId) return;

    const matched = existingPeriods.find((p) => String(p.id) === String(pId));
    if (matched) {
      setPeriod({
        start_date: matched.start_date || "",
        end_date: matched.end_date || "",
        production_tonnes: matched.production_tonnes ? String(matched.production_tonnes) : "",
      });
      setCreatedPeriodId(matched.id);
      setFeedback(`Selected reporting period (${matched.start_date} to ${matched.end_date}). Proceed to Step 3.`, "success");
    }
  }

  async function handlePeriodSubmit(event) {
    event.preventDefault();
    if (!createdFirmId) {
      setFeedback("Please register or select your factory profile in Step 1 first.", "error");
      setActiveStep(1);
      return;
    }
    if (period.end_date < period.start_date) {
      setFeedback("The end date must be on or after the start date.", "error");
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
      setSelectedPeriodId(String(res.id));
      await loadPeriods(createdFirmId);
      setFeedback(`Reporting period ${res.start_date} to ${res.end_date} established. Proceed to Step 3 to add activity evidence.`, "success");
      setActiveStep(3);
    } catch (err) {
      setFeedback(`Failed to save reporting period: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Multi-Category Evidence Upload & Activity Record Creation
  // ---------------------------------------------------------------------------
  async function handleDocumentUpload(event, category) {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!createdPeriodId) {
      setFeedback("Please establish your reporting period in Step 2 before uploading evidence.", "error");
      setActiveStep(2);
      return;
    }

    setUploadedDocFile(file);
    setLoading(true);
    setFeedback(`Uploading "${file.name}" and parsing metrics via Groq LLM Extraction...`, "info");

    try {
      const docRes = await uploadDocument(file, createdPeriodId, category);
      setUploadedDocId(docRes.id);

      // Inspect extraction payload
      const rawPayload = docRes.extraction_raw_json;
      const status = rawPayload?.status;
      const extracted = rawPayload?.extracted_fields || rawPayload || {};

      setExtractionInfo({
        status: status || "completed",
        model: rawPayload?.model || "Groq Llama-3.3 Vision/Text",
        message: rawPayload?.message || rawPayload?.error || null,
        confidence: extracted.confidence_score,
      });

      // Map extracted fields according to category
      if (category === "electricity_bill") {
        const kwh =
          extracted.kwh_consumed ??
          extracted.consumed_kwh ??
          extracted.units_kwh ??
          "";
        const supplier =
          extracted.utility_provider ??
          extracted.supplier_name ??
          extracted.utility_name ??
          "";
        const start = extracted.billing_period_start || "";
        const end = extracted.billing_period_end || "";
        const billingPeriodStr =
          start && end ? `${start} to ${end}` : extracted.billing_period || "";
        const consumerNum =
          extracted.consumer_number ??
          extracted.invoice_number ??
          extracted.bill_number ??
          "";
        const billedInr =
          extracted.total_amount_inr ??
          extracted.total_billed_inr ??
          "";
        const peakKva =
          extracted.contracted_demand_mva
            ? Number(extracted.contracted_demand_mva) * 1000
            : extracted.peak_demand_kva ?? "";

        setElectricityFields((prev) => ({
          ...prev,
          consumedKwh: kwh ? String(kwh) : prev.consumedKwh,
          utilityProvider: supplier || prev.utilityProvider,
          billingPeriod: billingPeriodStr || prev.billingPeriod,
          consumerNumber: consumerNum || prev.consumerNumber,
          totalBilledInr: billedInr ? String(billedInr) : prev.totalBilledInr,
          peakDemandKva: peakKva ? String(peakKva) : prev.peakDemandKva,
        }));

        if (status === "unconfigured") {
          setFeedback(`"${file.name}" uploaded. Note: Server GROQ_API_KEY is not configured on backend. Please verify numbers manually.`, "info");
        } else if (status === "failed") {
          setFeedback(`"${file.name}" uploaded. Text extraction notice: ${rawPayload.error || "Scanned image or unreadable text"}. Please enter values manually.`, "info");
        } else if (kwh) {
          setFeedback(`"${file.name}" processed! Extracted ${Number(kwh).toLocaleString()} kWh. Verify and confirm below.`, "success");
        } else {
          setFeedback(`"${file.name}" uploaded to audit vault. Please review and save the entry.`, "success");
        }
      } else if (category === "fuel_invoice") {
        const qty =
          extracted.quantity ??
          extracted.quantity_liters ??
          extracted.volume_litres ??
          "";
        const fuelType = (extracted.fuel_type || "diesel").toLowerCase();
        const cost =
          extracted.total_amount_inr ??
          extracted.total_cost_inr ??
          "";
        const supplier = extracted.supplier_name || "";
        const invNum = extracted.invoice_number || "";

        setFuelFields((prev) => ({
          ...prev,
          fuelType: ["diesel", "furnace_oil", "lpg"].includes(fuelType) ? fuelType : "diesel",
          quantityLiters: qty ? String(qty) : prev.quantityLiters,
          totalCostInr: cost ? String(cost) : prev.totalCostInr,
          supplierName: supplier || prev.supplierName,
          invoiceNumber: invNum || prev.invoiceNumber,
        }));

        setFeedback(`"${file.name}" processed! Extracted fuel data. Verify and save below.`, "success");
      } else if (category === "purchase_register") {
        const tonnes =
          extracted.total_weight_tonnes ??
          extracted.quantity_tonnes ??
          extracted.weight_mt ??
          "";
        const vendor = extracted.vendor_name || extracted.supplier_name || "";

        setMaterialFields((prev) => ({
          ...prev,
          quantityTonnes: tonnes ? String(tonnes) : prev.quantityTonnes,
          supplierName: vendor || prev.supplierName,
        }));

        setFeedback(`"${file.name}" processed! Extracted material data. Verify and save below.`, "success");
      }
    } catch (err) {
      setFeedback(`Upload error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-Ingest Document directly via backend
  async function handleAutoIngest() {
    if (!uploadedDocId) {
      setFeedback("Please upload a document first.", "error");
      return;
    }
    setLoading(true);
    setFeedback("Triggering backend auto-ingestion for document...", "info");
    try {
      const res = await ingestDocumentToActivity(uploadedDocId);
      await loadActivityLedger(createdPeriodId);
      setFeedback(
        `Auto-ingest complete: created ${res.electricity_records_created} electricity, ${res.fuel_records_created} fuel, and ${res.material_records_created} material records.`,
        "success"
      );
    } catch (err) {
      setFeedback(`Ingest error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Create Electricity Record
  async function handleSaveElectricity() {
    if (!electricityFields.consumedKwh || Number(electricityFields.consumedKwh) <= 0) {
      setFeedback("Please enter a valid electricity consumption (kWh) > 0.", "error");
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
        consumed_kwh: Number(electricityFields.consumedKwh),
        peak_demand_kva: electricityFields.peakDemandKva ? Number(electricityFields.peakDemandKva) : null,
        power_factor: electricityFields.powerFactor ? Number(electricityFields.powerFactor) : 0.95,
        total_billed_inr: electricityFields.totalBilledInr ? Number(electricityFields.totalBilledInr) : null,
      });

      await loadActivityLedger(createdPeriodId);
      setFeedback("Electricity record saved to audit ledger!", "success");
      setCalculationStatus("not_calculated");
    } catch (err) {
      setFeedback(`Failed to save electricity record: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Create Fuel Record
  async function handleSaveFuel() {
    if (!fuelFields.quantityLiters || Number(fuelFields.quantityLiters) <= 0) {
      setFeedback("Please enter a valid fuel volume in litres > 0.", "error");
      return;
    }
    if (!createdPeriodId) {
      setFeedback("Reporting period is missing. Complete Step 2 first.", "error");
      setActiveStep(2);
      return;
    }

    setLoading(true);
    setFeedback("Recording Scope 1 fuel consumption into audit ledger...", "info");
    try {
      await createFuelRecord({
        reporting_period_id: createdPeriodId,
        source_document_id: uploadedDocId || null,
        fuel_type: fuelFields.fuelType,
        quantity_liters: Number(fuelFields.quantityLiters),
        total_cost_inr: fuelFields.totalCostInr ? Number(fuelFields.totalCostInr) : null,
      });

      await loadActivityLedger(createdPeriodId);
      setFeedback(`Fuel record (${fuelFields.quantityLiters} L ${fuelFields.fuelType}) saved!`, "success");
      setFuelFields({
        fuelType: "diesel",
        quantityLiters: "",
        totalCostInr: "",
        supplierName: "",
        invoiceNumber: "",
      });
      setCalculationStatus("not_calculated");
    } catch (err) {
      setFeedback(`Failed to save fuel record: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Create Material Record
  async function handleSaveMaterial() {
    if (!materialFields.quantityTonnes || Number(materialFields.quantityTonnes) <= 0) {
      setFeedback("Please enter a valid material quantity in tonnes > 0.", "error");
      return;
    }
    if (!createdPeriodId) {
      setFeedback("Reporting period is missing. Complete Step 2 first.", "error");
      setActiveStep(2);
      return;
    }

    setLoading(true);
    setFeedback("Recording Scope 3 material procurement into audit ledger...", "info");
    try {
      await createMaterialRecord({
        reporting_period_id: createdPeriodId,
        source_document_id: uploadedDocId || null,
        material_type: materialFields.materialType,
        quantity_tonnes: Number(materialFields.quantityTonnes),
        supplier_name: materialFields.supplierName || null,
        supplier_stated_emission_factor: materialFields.supplierEmissionFactor
          ? Number(materialFields.supplierEmissionFactor)
          : null,
      });

      await loadActivityLedger(createdPeriodId);
      setFeedback(`Material record (${materialFields.quantityTonnes} t ${materialFields.materialType}) saved!`, "success");
      setMaterialFields({
        materialType: "steel_scrap",
        quantityTonnes: "",
        supplierName: "",
        supplierEmissionFactor: "",
      });
      setCalculationStatus("not_calculated");
    } catch (err) {
      setFeedback(`Failed to save material record: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // Verify or Delete activity records
  async function handleVerifyRecord(type, recordId, status) {
    setLoading(true);
    try {
      await verifyActivity(type, recordId, status);
      await loadActivityLedger(createdPeriodId);
      setFeedback(`Record ${status === "confirmed" ? "verified and confirmed" : "flagged for review"}.`, "info");
      setCalculationStatus("not_calculated");
    } catch (err) {
      setFeedback(`Failed to update record: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRecord(type, recordId) {
    if (!window.confirm("Are you sure you want to delete this activity record?")) return;
    setLoading(true);
    try {
      await deleteActivityRecord(type, recordId);
      await loadActivityLedger(createdPeriodId);
      setFeedback("Activity record removed.", "info");
      setCalculationStatus("not_calculated");
    } catch (err) {
      setFeedback(`Failed to delete record: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Live Evidence Sync & Engine Calculation & Report Generation
  // ---------------------------------------------------------------------------
  async function handleSync() {
    setLoading(true);
    setFeedback("Querying TinyFish agent for latest CEA Indian Power Sector CO2 baseline...", "info");
    try {
      const res = await syncEvidence("grid_emission_factor");
      setFactorStatus("synced");
      setSyncedFactor(res);
      await loadEvidence();
      setFeedback(
        `Synced: ${res.value} ${res.unit} (${res.source_title}) certified by TinyFish agent and saved to audit evidence table.`,
        "success"
      );
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
    const hasAnyActivity =
      periodActivity.electricity_records.length > 0 ||
      periodActivity.fuel_records.length > 0 ||
      periodActivity.material_records.length > 0;

    if (!hasAnyActivity && !electricityFields.consumedKwh) {
      setFeedback("Please record at least one electricity, fuel, or material activity entry in Step 3.", "error");
      setActiveStep(3);
      return;
    }

    setLoading(true);
    setFeedback("Running deterministic GHG Protocol calculation engine and decarbonization pathways...", "info");
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
        electricityKwh: electricityFields.consumedKwh || (periodActivity.electricity_records[0]?.consumed_kwh ?? 0),
      });

      setFeedback(
        `Calculation complete! Total emissions: ${calcRes.total_emissions_tco2e} tCO2e (${calcRes.specific_emissions_tco2e_per_tonne ?? "N/A"} tCO2e/t finished steel). Ready to export report.`,
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
      setFeedback("Run calculation first before generating report.", "error");
      return;
    }
    setLoading(true);
    setFeedback("Generating and archiving frozen audit report with TinyFish regulatory evidence...", "info");
    try {
      const res = await exportReport(createdPeriodId, "pdf");
      setGeneratedReport(res);
      await loadArchivedReports(createdPeriodId);
      setFeedback(
        `Report "${res.report_title}" successfully generated & archived with immutable SHA-256 snapshot!`,
        "success"
      );
    } catch (err) {
      setFeedback(`Export error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  function downloadSnapshotJson() {
    if (!generatedReport?.computation_snapshot) return;
    const blob = new Blob([JSON.stringify(generatedReport.computation_snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_certificate_period_${createdPeriodId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPdfReport() {
    generateAuditPdf({
      report: generatedReport,
      calculationResult,
      factory,
      period,
      syncedFactor: syncedFactor || { value: 0.727, unit: "tCO2/MWh" },
      activityLedger: periodActivity,
    });
    setFeedback("Downloaded official Decarbonization Audit Report (PDF)!", "success");
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
      desc: "Plant specs, location & electrical demand",
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
      title: "Activity evidence",
      desc: "Electricity, fuel & raw materials",
      icon: DocumentIcon,
    },
    {
      num: 4,
      title: "Results & report",
      desc: "TinyFish CEA sync & audit report export",
      icon: CalculatorIcon,
    },
  ];

  // Calculate live activity totals
  const totalKwhRecorded = periodActivity.electricity_records.reduce((sum, r) => sum + (r.consumed_kwh || 0), 0);
  const totalFuelLitres = periodActivity.fuel_records.reduce((sum, r) => sum + (r.quantity_liters || 0), 0);
  const totalMaterialsTonnes = periodActivity.material_records.reduce((sum, r) => sum + (r.quantity_tonnes || 0), 0);

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
                        {isCompleted ? <CheckIcon className="w-4 h-4" /> : <span>{step.num}</span>}
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
                  <span>{s.title}</span>
                </button>
              ))}
            </nav>

            {/* Live Mint Preview Pill */}
            <div className="mint-preview-card" role="region" aria-label="Audit summary preview">
              <div className="mint-preview-header">
                <span className="mint-preview-title">Live Audit Ledger Summary</span>
                <span className="mint-badge">
                  {createdPeriodId ? `Period #${createdPeriodId} Active` : "Awaiting Period"}
                </span>
              </div>

              <div className="mint-preview-body">
                <div className="mint-metric-item">
                  <span className="metric-tag">Plant Baseline</span>
                  <strong className="metric-val">
                    {factory.name ? `${factory.name} (${factory.state || "India"})` : "Not registered"}
                  </strong>
                </div>

                <div className="mint-metric-item">
                  <span className="metric-tag">Finished Steel Output</span>
                  <strong className="metric-val">
                    {period.production_tonnes ? `${Number(period.production_tonnes).toLocaleString()} MT` : "Not declared"}
                  </strong>
                </div>

                <div className="mint-metric-item">
                  <span className="metric-tag">Electricity (Scope 2)</span>
                  <strong className="metric-val">
                    {totalKwhRecorded > 0
                      ? `${totalKwhRecorded.toLocaleString()} kWh`
                      : electricityFields.consumedKwh
                        ? `${Number(electricityFields.consumedKwh).toLocaleString()} kWh`
                        : "0 kWh"}
                  </strong>
                </div>

                <div className="mint-metric-item">
                  <span className="metric-tag">Fuel & Materials</span>
                  <strong className="metric-val">
                    {totalFuelLitres > 0 ? `${totalFuelLitres.toLocaleString()} L Fuel · ` : ""}
                    {totalMaterialsTonnes > 0 ? `${totalMaterialsTonnes.toLocaleString()} t Materials` : "0 Scopes 1 & 3"}
                  </strong>
                </div>
              </div>

              <p className="mint-preview-footnote">
                {createdFirmId
                  ? `Firm ID: ${createdFirmId.slice(0, 8)}... · Period: ${createdPeriodId || "Pending"} · TinyFish Factor: ${syncedFactor ? `${syncedFactor.value} tCO2/MWh` : "0.7270 tCO2/MWh (Default)"}`
                  : "Draft mode. Complete Step 1 to save to backend database."}
              </p>
            </div>

            {/* STEP 1: Factory Profile */}
            {activeStep === 1 && (
              <section className="form-card" aria-labelledby="heading-step-1">
                <div className="form-card-header">
                  <span className="step-eyebrow">STEP 01</span>
                  <h2 id="heading-step-1" className="form-card-title">
                    Company & factory profile
                  </h2>
                  <p className="form-card-subtitle">
                    Enter the legal entity details and electrical capacity. This maps your factory to regional DISCOM tariffs and CEA emission baselines.
                  </p>
                </div>

                {existingFactories.length > 0 && (
                  <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--canvas)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    <label htmlFor="select-firm" className="pill-label" style={{ marginBottom: "0.5rem", display: "block" }}>
                      Select existing registered factory:
                    </label>
                    <select
                      id="select-firm"
                      className="pill-input"
                      value={selectedFirmId}
                      onChange={handleSelectExistingFirm}
                    >
                      <option value="">-- Or enter a new factory profile below --</option>
                      {existingFactories.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.state}) - Demand: {f.contracted_demand_mva ? `${f.contracted_demand_mva} MVA` : "N/A"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                      onChange={(e) => setFactory((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Mahavir Induction Steel Ltd."
                      maxLength={255}
                      required
                    />
                    <span className="field-hint">Legal registered firm name</span>
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
                      onChange={(e) => setFactory((prev) => ({ ...prev, state: e.target.value }))}
                      placeholder="e.g. Chhattisgarh, Punjab, Odisha, Gujarat"
                      required
                    />
                    <span className="field-hint">Used for regional CEA emission factor mapping & state open-access solar policies</span>
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
                        onChange={(e) => setFactory((prev) => ({ ...prev, roof_area_sqm: e.target.value }))}
                        placeholder="e.g. 15000 (Rooftop solar potential)"
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
                        onChange={(e) => setFactory((prev) => ({ ...prev, contracted_demand_mva: e.target.value }))}
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
                      onChange={(e) => setFactory((prev) => ({ ...prev, tariff_category: e.target.value }))}
                      placeholder="e.g. HT Industrial / EHT 33kV"
                    />
                  </div>

                  <div className="form-actions-row">
                    <button type="submit" className="pill-button pill-button-primary" disabled={loading}>
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
                  <span className="step-eyebrow">STEP 02</span>
                  <h2 id="heading-step-2" className="form-card-title">
                    Audit reporting period & production output
                  </h2>
                  <p className="form-card-subtitle">
                    Specify the monthly or quarterly boundary and total finished steel production tonnage.
                  </p>
                </div>

                {existingPeriods.length > 0 && (
                  <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--canvas)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    <label htmlFor="select-period" className="pill-label" style={{ marginBottom: "0.5rem", display: "block" }}>
                      Select existing reporting period for this factory:
                    </label>
                    <select
                      id="select-period"
                      className="pill-input"
                      value={selectedPeriodId}
                      onChange={handleSelectExistingPeriod}
                    >
                      <option value="">-- Or define a new reporting period below --</option>
                      {existingPeriods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.start_date} to {p.end_date} - Output: {p.production_tonnes ? `${p.production_tonnes} MT` : "Not set"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                        onChange={(e) => setPeriod((prev) => ({ ...prev, start_date: e.target.value }))}
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
                        onChange={(e) => setPeriod((prev) => ({ ...prev, end_date: e.target.value }))}
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
                      onChange={(e) => setPeriod((prev) => ({ ...prev, production_tonnes: e.target.value }))}
                      placeholder="e.g. 5000"
                      required
                    />
                    <span className="field-hint">
                      Net good cast steel tonnage used as the denominator for specific emissions intensity (tCO2e / t)
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
                    <button type="submit" className="pill-button pill-button-primary" disabled={loading}>
                      {loading ? "Saving period..." : "Save period & proceed →"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* STEP 3: Multi-Category Evidence Upload & Activity Record Creation */}
            {activeStep === 3 && (
              <section className="form-card" aria-labelledby="heading-step-3">
                <div className="form-card-header">
                  <span className="step-eyebrow">STEP 03</span>
                  <h2 id="heading-step-3" className="form-card-title">
                    Activity evidence & consumption ledger
                  </h2>
                  <p className="form-card-subtitle">
                    Record electricity, diesel/fuel combustion, and raw materials (scrap, DRI, alloys). Upload invoices for AI extraction or enter numbers directly.
                  </p>
                </div>

                {/* Subtabs for Activity Category */}
                <div className="scope-subtabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityCategory === "electricity"}
                    className={`scope-subtab-btn ${activityCategory === "electricity" ? "active" : ""}`}
                    onClick={() => {
                      setActivityCategory("electricity");
                      setExtractionInfo(null);
                    }}
                  >
                    ⚡ Electricity (Scope 2)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityCategory === "fuel"}
                    className={`scope-subtab-btn ${activityCategory === "fuel" ? "active" : ""}`}
                    onClick={() => {
                      setActivityCategory("fuel");
                      setExtractionInfo(null);
                    }}
                  >
                    🔥 Fuel Usage (Scope 1)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activityCategory === "material"}
                    className={`scope-subtab-btn ${activityCategory === "material" ? "active" : ""}`}
                    onClick={() => {
                      setActivityCategory("material");
                      setExtractionInfo(null);
                    }}
                  >
                    🏗️ Raw Materials (Scope 3)
                  </button>
                </div>

                {/* AI Extraction Status Banner */}
                {extractionInfo && (
                  <div
                    className={`ai-status-card ${
                      extractionInfo.status === "success"
                        ? "success"
                        : extractionInfo.status === "unconfigured"
                          ? "warning"
                          : "info"
                    }`}
                  >
                    <InfoIcon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <strong>
                        {extractionInfo.status === "success"
                          ? `AI Extraction Succeeded (${extractionInfo.model})`
                          : extractionInfo.status === "unconfigured"
                            ? "Manual Input Mode (Server AI key unconfigured)"
                            : "Extraction Status"}
                      </strong>
                      <p style={{ fontSize: "0.85rem", marginTop: "2px" }}>
                        {extractionInfo.message ||
                          (extractionInfo.confidence !== undefined
                            ? `Extracted structured metrics with confidence score: ${(extractionInfo.confidence * 100).toFixed(0)}%. Review fields below.`
                            : "Document parsed. Please review and verify the extracted quantities below.")}
                      </p>
                    </div>
                  </div>
                )}

                {/* CATEGORY 1: ELECTRICITY */}
                {activityCategory === "electricity" && (
                  <div>
                    {/* Document Dropzone */}
                    <div className="dropzone-container">
                      <label htmlFor="elec-file-upload" className="pill-dropzone">
                        <div className="dropzone-content">
                          <UploadIcon className="w-8 h-8 dropzone-icon" />
                          <strong className="dropzone-text">
                            {uploadedDocFile && uploadedDocId
                              ? `Uploaded: ${uploadedDocFile.name}`
                              : "Drop DISCOM Electricity Bill here (.pdf, .docx, .png, .jpg), or browse"}
                          </strong>
                          <span className="dropzone-spec">
                            Automated field extraction powered by Groq Llama-3.3 Vision
                          </span>
                        </div>
                        <input
                          id="elec-file-upload"
                          type="file"
                          accept=".pdf,.docx,.png,.jpg,.jpeg"
                          onChange={(e) => handleDocumentUpload(e, "electricity_bill")}
                          className="visually-hidden"
                        />
                      </label>
                    </div>

                    <div className="verification-box">
                      <div className="verification-box-header">
                        <div>
                          <h4 className="verification-box-title">Electricity consumption details</h4>
                          <p className="verification-box-sub">
                            Active energy recorded on primary HT metering equipment
                          </p>
                        </div>
                        <span className="scope-badge scope-badge-scope2">Scope 2</span>
                      </div>

                      <div className="verification-fields">
                        <div className="form-row-2">
                          <div className="form-group">
                            <label htmlFor="utilityProvider" className="pill-label">
                              Electricity supplier / DISCOM
                            </label>
                            <input
                              id="utilityProvider"
                              className="pill-input"
                              value={electricityFields.utilityProvider}
                              onChange={(e) =>
                                setElectricityFields((prev) => ({ ...prev, utilityProvider: e.target.value }))
                              }
                              placeholder="e.g. CSPDCL / Tata Power / PSPCL"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="consumerNumber" className="pill-label">
                              Consumer / HT account number
                            </label>
                            <input
                              id="consumerNumber"
                              className="pill-input"
                              value={electricityFields.consumerNumber}
                              onChange={(e) =>
                                setElectricityFields((prev) => ({ ...prev, consumerNumber: e.target.value }))
                              }
                              placeholder="e.g. HT-09482910"
                            />
                          </div>
                        </div>

                        <div className="form-row-3">
                          <div className="form-group">
                            <label htmlFor="consumedKwh" className="pill-label">
                              Consumed electricity (kWh) <span className="req">*</span>
                            </label>
                            <input
                              id="consumedKwh"
                              type="number"
                              min="0.01"
                              step="any"
                              className="pill-input highlight"
                              value={electricityFields.consumedKwh}
                              onChange={(e) =>
                                setElectricityFields((prev) => ({ ...prev, consumedKwh: e.target.value }))
                              }
                              placeholder="e.g. 1500000"
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="peakDemandKva" className="pill-label">
                              Recorded peak demand (kVA)
                            </label>
                            <input
                              id="peakDemandKva"
                              type="number"
                              min="0"
                              step="any"
                              className="pill-input"
                              value={electricityFields.peakDemandKva}
                              onChange={(e) =>
                                setElectricityFields((prev) => ({ ...prev, peakDemandKva: e.target.value }))
                              }
                              placeholder="e.g. 3500"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="totalBilledInr" className="pill-label">
                              Total bill amount (INR)
                            </label>
                            <input
                              id="totalBilledInr"
                              type="number"
                              min="0"
                              step="any"
                              className="pill-input"
                              value={electricityFields.totalBilledInr}
                              onChange={(e) =>
                                setElectricityFields((prev) => ({ ...prev, totalBilledInr: e.target.value }))
                              }
                              placeholder="e.g. 12500000"
                            />
                          </div>
                        </div>

                        <div className="verification-actions">
                          <button
                            type="button"
                            className="pill-button pill-button-primary"
                            disabled={loading || !electricityFields.consumedKwh}
                            onClick={handleSaveElectricity}
                          >
                            {loading ? "Saving to ledger..." : "Confirm & Save Electricity Record"}
                          </button>
                          {uploadedDocId && (
                            <button
                              type="button"
                              className="pill-button pill-button-secondary"
                              disabled={loading}
                              onClick={handleAutoIngest}
                            >
                              Auto-Ingest via Backend Engine
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CATEGORY 2: FUEL (Scope 1) */}
                {activityCategory === "fuel" && (
                  <div>
                    {/* Fuel Invoice Dropzone */}
                    <div className="dropzone-container">
                      <label htmlFor="fuel-file-upload" className="pill-dropzone">
                        <div className="dropzone-content">
                          <UploadIcon className="w-8 h-8 dropzone-icon" />
                          <strong className="dropzone-text">
                            {uploadedDocFile && uploadedDocId
                              ? `Uploaded: ${uploadedDocFile.name}`
                              : "Drop Fuel Purchase Invoice here (.pdf, .docx, images), or browse"}
                          </strong>
                          <span className="dropzone-spec">
                            Extracts fuel delivery litres, type (diesel, furnace oil, LPG), and cost
                          </span>
                        </div>
                        <input
                          id="fuel-file-upload"
                          type="file"
                          accept=".pdf,.docx,.png,.jpg,.jpeg"
                          onChange={(e) => handleDocumentUpload(e, "fuel_invoice")}
                          className="visually-hidden"
                        />
                      </label>
                    </div>

                    <div className="verification-box">
                      <div className="verification-box-header">
                        <div>
                          <h4 className="verification-box-title">Direct fuel combustion details</h4>
                          <p className="verification-box-sub">
                            Stationary combustion from backup DG sets, reheat furnaces, or ladles
                          </p>
                        </div>
                        <span className="scope-badge scope-badge-scope1">Scope 1</span>
                      </div>

                      <div className="verification-fields">
                        <div className="form-row-3">
                          <div className="form-group">
                            <label htmlFor="fuelType" className="pill-label">
                              Fuel type <span className="req">*</span>
                            </label>
                            <select
                              id="fuelType"
                              className="pill-input"
                              value={fuelFields.fuelType}
                              onChange={(e) =>
                                setFuelFields((prev) => ({ ...prev, fuelType: e.target.value }))
                              }
                            >
                              <option value="diesel">Diesel (HSD for DG sets)</option>
                              <option value="furnace_oil">Furnace Oil (Heavy Fuel Oil)</option>
                              <option value="lpg">LPG (Liquefied Petroleum Gas)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label htmlFor="quantityLiters" className="pill-label">
                              Consumed volume (Litres) <span className="req">*</span>
                            </label>
                            <input
                              id="quantityLiters"
                              type="number"
                              min="0.1"
                              step="any"
                              className="pill-input highlight"
                              value={fuelFields.quantityLiters}
                              onChange={(e) =>
                                setFuelFields((prev) => ({ ...prev, quantityLiters: e.target.value }))
                              }
                              placeholder="e.g. 5000"
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="totalCostInr" className="pill-label">
                              Total invoice cost (INR)
                            </label>
                            <input
                              id="totalCostInr"
                              type="number"
                              min="0"
                              step="any"
                              className="pill-input"
                              value={fuelFields.totalCostInr}
                              onChange={(e) =>
                                setFuelFields((prev) => ({ ...prev, totalCostInr: e.target.value }))
                              }
                              placeholder="e.g. 450000"
                            />
                          </div>
                        </div>

                        <div className="form-row-2">
                          <div className="form-group">
                            <label htmlFor="fuelSupplier" className="pill-label">
                              Fuel vendor / supplier name
                            </label>
                            <input
                              id="fuelSupplier"
                              className="pill-input"
                              value={fuelFields.supplierName}
                              onChange={(e) =>
                                setFuelFields((prev) => ({ ...prev, supplierName: e.target.value }))
                              }
                              placeholder="e.g. Indian Oil Corporation Ltd."
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="fuelInvNum" className="pill-label">
                              Invoice / challan number
                            </label>
                            <input
                              id="fuelInvNum"
                              className="pill-input"
                              value={fuelFields.invoiceNumber}
                              onChange={(e) =>
                                setFuelFields((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                              }
                              placeholder="e.g. IOCL-INV-2026-99"
                            />
                          </div>
                        </div>

                        <div className="verification-actions">
                          <button
                            type="button"
                            className="pill-button pill-button-primary"
                            disabled={loading || !fuelFields.quantityLiters}
                            onClick={handleSaveFuel}
                          >
                            {loading ? "Saving to ledger..." : "Save Scope 1 Fuel Record"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CATEGORY 3: RAW MATERIALS (Scope 3) */}
                {activityCategory === "material" && (
                  <div>
                    {/* Material Register Dropzone */}
                    <div className="dropzone-container">
                      <label htmlFor="mat-file-upload" className="pill-dropzone">
                        <div className="dropzone-content">
                          <UploadIcon className="w-8 h-8 dropzone-icon" />
                          <strong className="dropzone-text">
                            {uploadedDocFile && uploadedDocId
                              ? `Uploaded: ${uploadedDocFile.name}`
                              : "Drop Material Purchase Register here (.pdf, .docx, images), or browse"}
                          </strong>
                          <span className="dropzone-spec">
                            Extracts steel scrap, DRI sponge iron, and ferroalloys delivery tonnages
                          </span>
                        </div>
                        <input
                          id="mat-file-upload"
                          type="file"
                          accept=".pdf,.docx,.png,.jpg,.jpeg"
                          onChange={(e) => handleDocumentUpload(e, "purchase_register")}
                          className="visually-hidden"
                        />
                      </label>
                    </div>

                    <div className="verification-box">
                      <div className="verification-box-header">
                        <div>
                          <h4 className="verification-box-title">Purchased raw materials & precursor inputs</h4>
                          <p className="verification-box-sub">
                            Upstream embedded emissions from scrap, sponge iron (DRI), and ferroalloys
                          </p>
                        </div>
                        <span className="scope-badge scope-badge-scope3">Scope 3 / Precursor</span>
                      </div>

                      <div className="verification-fields">
                        <div className="form-row-3">
                          <div className="form-group">
                            <label htmlFor="materialType" className="pill-label">
                              Material type <span className="req">*</span>
                            </label>
                            <select
                              id="materialType"
                              className="pill-input"
                              value={materialFields.materialType}
                              onChange={(e) =>
                                setMaterialFields((prev) => ({ ...prev, materialType: e.target.value }))
                              }
                            >
                              <option value="steel_scrap">Steel Scrap (Melting Scrap)</option>
                              <option value="sponge_iron_dri_coal">Sponge Iron / DRI (Coal-based)</option>
                              <option value="sponge_iron_dri_gas">Sponge Iron / DRI (Gas-based)</option>
                              <option value="ferro_manganese">Ferro Manganese (FeMn)</option>
                              <option value="ferro_silicon">Ferro Silicon (FeSi)</option>
                              <option value="carbon_additive">Carbon Additive / CPC</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label htmlFor="quantityTonnes" className="pill-label">
                              Quantity procured (Tonnes) <span className="req">*</span>
                            </label>
                            <input
                              id="quantityTonnes"
                              type="number"
                              min="0.01"
                              step="any"
                              className="pill-input highlight"
                              value={materialFields.quantityTonnes}
                              onChange={(e) =>
                                setMaterialFields((prev) => ({ ...prev, quantityTonnes: e.target.value }))
                              }
                              placeholder="e.g. 1200"
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="matSupplier" className="pill-label">
                              Supplier / vendor name
                            </label>
                            <input
                              id="matSupplier"
                              className="pill-input"
                              value={materialFields.supplierName}
                              onChange={(e) =>
                                setMaterialFields((prev) => ({ ...prev, supplierName: e.target.value }))
                              }
                              placeholder="e.g. Jindal Steel / Local Scrap Vendor"
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label htmlFor="supplierEmissionFactor" className="pill-label">
                            Supplier-declared emission factor (tCO2e / t) (optional)
                          </label>
                          <input
                            id="supplierEmissionFactor"
                            type="number"
                            min="0"
                            step="any"
                            className="pill-input"
                            value={materialFields.supplierEmissionFactor}
                            onChange={(e) =>
                              setMaterialFields((prev) => ({ ...prev, supplierEmissionFactor: e.target.value }))
                            }
                            placeholder="Leave empty to use GHG Protocol standard defaults"
                          />
                          <span className="field-hint">
                            If omitted, the engine uses statutory default factors (e.g. 0.15 for scrap, 2.6 for coal DRI).
                          </span>
                        </div>

                        <div className="verification-actions">
                          <button
                            type="button"
                            className="pill-button pill-button-primary"
                            disabled={loading || !materialFields.quantityTonnes}
                            onClick={handleSaveMaterial}
                          >
                            {loading ? "Saving to ledger..." : "Save Scope 3 Material Record"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONSOLIDATED ACTIVITY LEDGER TABLE */}
                <div style={{ marginTop: "2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ fontSize: "1.15rem", color: "var(--ink)" }}>
                      Audit Activity Ledger ({periodActivity.electricity_records.length + periodActivity.fuel_records.length + periodActivity.material_records.length} items recorded)
                    </h3>
                    <span style={{ fontSize: "0.85rem", color: "var(--forest-700)", fontWeight: 600 }}>
                      Total Recorded: {totalKwhRecorded.toLocaleString()} kWh · {totalFuelLitres.toLocaleString()} L fuel · {totalMaterialsTonnes.toLocaleString()} t materials
                    </span>
                  </div>

                  {periodActivity.electricity_records.length === 0 &&
                  periodActivity.fuel_records.length === 0 &&
                  periodActivity.material_records.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", background: "var(--canvas)", borderRadius: "12px", border: "1px dashed var(--line)", color: "var(--muted)" }}>
                      No activity records recorded yet for this period. Upload a bill or enter data above.
                    </div>
                  ) : (
                    <div className="activity-table-wrapper">
                      <table className="activity-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Item Details</th>
                            <th>Quantity</th>
                            <th>Cost / Provider</th>
                            <th>Audit Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Electricity Records */}
                          {periodActivity.electricity_records.map((rec) => (
                            <tr key={`elec-${rec.id}`}>
                              <td>
                                <span className="scope-badge scope-badge-scope2">Scope 2</span>
                              </td>
                              <td>Grid Electricity</td>
                              <td>
                                <strong>{rec.consumed_kwh.toLocaleString()} kWh</strong>
                              </td>
                              <td>{rec.total_billed_inr ? `₹${Number(rec.total_billed_inr).toLocaleString()}` : "DISCOM Metered"}</td>
                              <td>
                                <span className={`status-pill ${rec.status}`}>{rec.status}</span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  {rec.status !== "confirmed" && (
                                    <button
                                      type="button"
                                      className="table-action-btn btn-verify"
                                      onClick={() => handleVerifyRecord("electricity", rec.id, "confirmed")}
                                    >
                                      Verify
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="table-action-btn btn-delete"
                                    onClick={() => handleDeleteRecord("electricity", rec.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Fuel Records */}
                          {periodActivity.fuel_records.map((rec) => (
                            <tr key={`fuel-${rec.id}`}>
                              <td>
                                <span className="scope-badge scope-badge-scope1">Scope 1</span>
                              </td>
                              <td>Fuel: {rec.fuel_type?.replace(/_/g, " ").toUpperCase()}</td>
                              <td>
                                <strong>{rec.quantity_liters.toLocaleString()} Litres</strong>
                              </td>
                              <td>{rec.total_cost_inr ? `₹${Number(rec.total_cost_inr).toLocaleString()}` : "Direct Purchase"}</td>
                              <td>
                                <span className={`status-pill ${rec.status}`}>{rec.status}</span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  {rec.status !== "confirmed" && (
                                    <button
                                      type="button"
                                      className="table-action-btn btn-verify"
                                      onClick={() => handleVerifyRecord("fuel", rec.id, "confirmed")}
                                    >
                                      Verify
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="table-action-btn btn-delete"
                                    onClick={() => handleDeleteRecord("fuel", rec.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                          {/* Material Records */}
                          {periodActivity.material_records.map((rec) => (
                            <tr key={`mat-${rec.id}`}>
                              <td>
                                <span className="scope-badge scope-badge-scope3">Scope 3</span>
                              </td>
                              <td>{rec.material_type?.replace(/_/g, " ").toUpperCase()}</td>
                              <td>
                                <strong>{rec.quantity_tonnes.toLocaleString()} Tonnes</strong>
                              </td>
                              <td>{rec.supplier_name || "Commercial Vendor"}</td>
                              <td>
                                <span className={`status-pill ${rec.status}`}>{rec.status}</span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  {rec.status !== "confirmed" && (
                                    <button
                                      type="button"
                                      className="table-action-btn btn-verify"
                                      onClick={() => handleVerifyRecord("material", rec.id, "confirmed")}
                                    >
                                      Verify
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="table-action-btn btn-delete"
                                    onClick={() => handleDeleteRecord("material", rec.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                    Proceed to calculation & reports →
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: Results & Report Generation */}
            {activeStep === 4 && (
              <section className="form-card" aria-labelledby="heading-step-4">
                <div className="form-card-header">
                  <span className="step-eyebrow">STEP 04</span>
                  <h2 id="heading-step-4" className="form-card-title">
                    Emissions calculation & CEA audit sync
                  </h2>
                  <p className="form-card-subtitle">
                    Sync live regulatory factors from CEA via TinyFish, compute GHG Protocol footprint, and archive immutable audit reports.
                  </p>
                </div>

                {/* Evidence sync card */}
                <div className="sync-box">
                  <div className="sync-box-info">
                    <div className="sync-icon-circle">
                      <SyncIcon className="w-5 h-5 text-forest" />
                    </div>
                    <div>
                      <h4 className="sync-title">CEA Grid Emission Baseline (TinyFish Agent)</h4>
                      <p className="sync-desc">
                        Fetch certified Indian National Grid baseline factor from Central Electricity Authority (CO2 Database v20.0).
                        {syncedFactor && (
                          <span style={{ display: "block", color: "var(--forest-900)", fontWeight: 700, marginTop: "0.35rem" }}>
                            Current Synced Baseline: {syncedFactor.value} {syncedFactor.unit} · {syncedFactor.source_title}
                          </span>
                        )}
                      </p>
                      {syncedFactor && (
                        <div style={{ marginTop: "6px" }}>
                          <a
                            href={
                              syncedFactor.source_url && syncedFactor.source_url.startsWith("http")
                                ? syncedFactor.source_url
                                : "https://cea.nic.in"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--green-500)",
                              textDecoration: "underline",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>Official CEA Registry (cea.nic.in)</span>
                            <span>↗</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sync-box-action">
                    <span className={`status-pill ${factorStatus}`}>
                      {factorStatus === "synced" ? "Synced with CEA Registry" : "Ready to sync"}
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

                {/* List of Regulatory Sources Table */}
                <div style={{ marginBottom: "24px" }}>
                  <h4 style={{ fontSize: "1rem", color: "var(--forest-900)", marginBottom: "8px" }}>
                    Verified Regulatory Sources & Standards ({allEvidenceItems.length || 3}):
                  </h4>
                  <div className="activity-table-wrapper">
                    <table className="activity-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Certified Factor</th>
                          <th>Regulatory Standard</th>
                          <th>Verification Status</th>
                          <th>Official Registry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(allEvidenceItems.length > 0 ? allEvidenceItems : [
                          {
                            category: "grid_emission_factor",
                            value: 0.727,
                            unit: "tCO2/MWh",
                            source_title: "CEA CO2 Baseline Database (Version 20.0)",
                            source_url: "https://cea.nic.in",
                          },
                          {
                            category: "fuel_diesel",
                            value: 0.00268,
                            unit: "tCO2e/L",
                            source_title: "IPCC 2006 Guidelines for Stationary Combustion",
                            source_url: "https://www.ipcc-nggip.iges.or.jp",
                          },
                          {
                            category: "material_scrap",
                            value: 0.15,
                            unit: "tCO2e/t",
                            source_title: "GHG Protocol Scope 3 Category 1 Technical Guidance",
                            source_url: "https://ghgprotocol.org",
                          },
                        ]).map((ev, idx) => (
                          <tr key={ev.identifier || idx}>
                            <td><strong>{ev.category?.replace(/_/g, " ").toUpperCase()}</strong></td>
                            <td style={{ color: "var(--green-500)", fontWeight: 700 }}>{ev.value} {ev.unit}</td>
                            <td>{ev.source_title}</td>
                            <td><span className="status-pill confirmed">Verified</span></td>
                            <td>
                              <a
                                href={ev.source_url && ev.source_url.startsWith("http") ? ev.source_url : "https://cea.nic.in"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--green-500)", textDecoration: "underline", fontSize: "0.85rem" }}
                              >
                                View Portal ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation placeholder box */}
                <div className="calc-placeholder-box">
                  <div className="calc-icon-large">
                    <CalculatorIcon className="w-10 h-10 text-green" />
                  </div>
                  <h3 className="calc-title">
                    {calculationStatus === "calculated"
                      ? "Emissions Footprint Computed!"
                      : "Ready to run deterministic emission engine"}
                  </h3>
                  <p className="calc-desc">
                    Combines your verified activity ledger ({totalKwhRecorded || electricityFields.consumedKwh || 0} kWh, {totalFuelLitres} L fuel, {totalMaterialsTonnes} t materials) with the official CEA grid emission baseline ({syncedFactor ? syncedFactor.value : "0.7270"} tCO2/MWh) to generate Scope 1, Scope 2, Scope 3, and decarbonization pathways.
                  </p>

                  <div className="calc-actions-row">
                    <button
                      type="button"
                      className="pill-button pill-button-primary"
                      disabled={loading || calculationStatus === "calculated"}
                      onClick={handleCalculate}
                    >
                      {loading
                        ? "Calculating footprint..."
                        : calculationStatus === "calculated"
                          ? "✓ Footprint Calculated"
                          : "Calculate GHG Footprint"}
                    </button>
                    {calculationStatus === "calculated" && (
                      <button
                        type="button"
                        className="pill-button pill-button-outline"
                        disabled={loading}
                        onClick={handleCalculate}
                        style={{ fontSize: "0.85rem" }}
                      >
                        Recalculate
                      </button>
                    )}
                    <button
                      type="button"
                      className="pill-button pill-button-secondary"
                      disabled={loading}
                      onClick={handleExport}
                    >
                      {loading ? "Archiving report..." : "Generate & Archive Audit Report"}
                    </button>
                    <a
                      href="#/dashboard"
                      className="pill-button pill-button-outline"
                      style={{ fontWeight: 600 }}
                    >
                      View in Executive Dashboard →
                    </a>
                  </div>
                </div>

                {/* Generated Report Card & Snapshot Preview */}
                {generatedReport && (
                  <div className="generated-report-card">
                    <div className="report-header-badge">
                      <CheckIcon className="w-4 h-4" />
                      <span>Certified Audit Report Generated</span>
                    </div>

                    <h3 style={{ fontSize: "1.25rem", color: "var(--forest-900)", marginBottom: "0.25rem" }}>
                      {generatedReport.report_title}
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
                      Report Archive ID: {generatedReport.id} · Format: {generatedReport.export_format?.toUpperCase()} · Generated: {new Date(generatedReport.generated_at).toLocaleString()}
                    </p>

                    <div className="report-metrics-grid">
                      <div className="report-metric-box primary">
                        <div className="report-metric-label">Specific Emissions</div>
                        <div className="report-metric-value">
                          {generatedReport.computation_snapshot?.emission_results?.tco2e_per_tonne ?? calculationResult?.specific_emissions_tco2e_per_tonne ?? "N/A"}{" "}
                          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>tCO2e/t</span>
                        </div>
                      </div>

                      <div className="report-metric-box">
                        <div className="report-metric-label">Scope 1 (Direct Fuel)</div>
                        <div className="report-metric-value">
                          {generatedReport.computation_snapshot?.emission_results?.scope1_tco2e ?? calculationResult?.total_scope1_tco2e ?? 0}{" "}
                          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>tCO2e</span>
                        </div>
                      </div>

                      <div className="report-metric-box">
                        <div className="report-metric-label">Scope 2 (Electricity)</div>
                        <div className="report-metric-value">
                          {generatedReport.computation_snapshot?.emission_results?.scope2_tco2e ?? calculationResult?.total_scope2_tco2e ?? 0}{" "}
                          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>tCO2e</span>
                        </div>
                      </div>

                      <div className="report-metric-box">
                        <div className="report-metric-label">Scope 3 (Materials)</div>
                        <div className="report-metric-value">
                          {generatedReport.computation_snapshot?.emission_results?.precursor_tco2e ?? calculationResult?.total_precursor_tco2e ?? 0}{" "}
                          <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>tCO2e</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--canvas)", borderRadius: "10px", fontSize: "0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <strong>Cryptographic Computation Snapshot:</strong>
                        <span className="report-hash-tag">
                          SHA-256: {generatedReport.computation_snapshot?.snapshot_sha256}
                        </span>
                      </div>
                      <p style={{ color: "var(--muted)", margin: 0 }}>
                        TinyFish Certified Evidence Baseline: {syncedFactor?.value ?? "0.7270"} {syncedFactor?.unit ?? "tCO2/MWh"} ({syncedFactor?.source_title ?? "CEA Central Electricity Authority v20"})
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "1.25rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="pill-button pill-button-primary"
                        onClick={handleDownloadPdfReport}
                      >
                        <ReportIcon className="w-4 h-4" />
                        <span>Download Official Audit Report (PDF)</span>
                      </button>
                      <button
                        type="button"
                        className="pill-button pill-button-outline"
                        onClick={downloadSnapshotJson}
                      >
                        Download JSON Snapshot
                      </button>
                      <a
                        href="#/dashboard"
                        className="pill-button pill-button-secondary"
                        style={{ fontWeight: 600 }}
                      >
                        Open Executive Dashboard →
                      </a>
                    </div>
                  </div>
                )}

                {/* Previously Archived Reports for this Period */}
                {archivedReports.length > 0 && (
                  <div style={{ marginTop: "2rem", borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
                    <h4 style={{ fontSize: "1rem", color: "var(--ink)", marginBottom: "0.75rem" }}>
                      Archived Reports for this Period ({archivedReports.length})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {archivedReports.map((rep) => (
                        <div
                          key={rep.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            background: "var(--canvas)",
                            borderRadius: "8px",
                            fontSize: "0.875rem",
                          }}
                        >
                          <div>
                            <strong>{rep.report_title}</strong>
                            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>
                              Format: {rep.export_format?.toUpperCase()} · {new Date(rep.generated_at).toLocaleString()}
                            </span>
                          </div>
                          <span className="status-pill confirmed">Archived</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-actions-row">
                  <button
                    type="button"
                    className="pill-button pill-button-outline"
                    onClick={() => setActiveStep(3)}
                  >
                    ← Back to activity evidence
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
