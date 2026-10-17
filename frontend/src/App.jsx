
import { useState } from "react";
import "./App.css";
import AuthPanel from "./AuthPanel";
import {
  getAccessToken,
  getCurrentUser,
  clearSession,
  createFactory,
} from "./api";

function getHashRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/setup")) return "#/setup";
  if (hash.startsWith("#/results")) return "#/results";
  return "#/";
}

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
    if (!period.start_date || !period.end_date ||
        !period.production_tonnes || Number(period.production_tonnes) <= 0) {
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

  const steps = [
    { number: 1, title: "Factory profile" },
    { number: 2, title: "Reporting period" },
    { number: 3, title: "Electricity evidence" },
    { number: 4, title: "Results & report" },
  ];

  return (
    <div className="app-container">
      <Navbar currentRoute={route} />
      <main id="main-content" className="app-main">
        {route === "#/setup" && <Setup />}
        {route === "#/results" && <Results />}
        {route === "#/" && <Landing />}
      </main>
      <Footer />
    </div>
  );
}

export default App;
