
import { useState } from "react";
import "./App.css";

function App() {
  const [form, setForm] = useState({
    companyName: "",
    sector: "",
    product: "",
    reportingYear: "2026",
    productionTonnes: "",
  });

  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

 
async function handleSubmit(event) {
  event.preventDefault();

  setIsSubmitting(true);
  setMessage("");

  try {
    console.log("Company details to send:", form);

    // Temporary pause to simulate a server request.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessage("Company details processed successfully!");
  } catch (error) {
    setMessage("Something went wrong. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
}


  return (
    <main className="app">
      <header className="topbar">
        <h2>CarbonLedger</h2>
        <span>Carbon intelligence for industry</span>
      </header>

      <section className="form-card">
        <p className="eyebrow">GET STARTED</p>
        <h1>Welcome to CarbonLedger</h1>
        <p>Let's make your emissions measurable.</p>
        <p className="subtitle">
          Tell us about your operations to start tracking
          product emissions.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            placeholder="e.g. ABC Manufacturing"
            required
          />

          <p className="char-count">
  {form.companyName.length} characters
</p>

          <label htmlFor="sector">Industry sector</label>
          <select
            id="sector"
            name="sector"
            value={form.sector}
            onChange={handleChange}
            required
          >
            <option value="">Select a sector</option>
            <option value="steel">Iron and steel</option>
            <option value="aluminium">Aluminium</option>
            <option value="cement">Cement</option>
            <option value="fertilisers">Fertilisers</option>
            <option value="other">Other</option>
          </select>

          <label htmlFor="product">Product being assessed</label>
          <input
            id="product"
            name="product"
            value={form.product}
            onChange={handleChange}
            placeholder="e.g. Steel sheets"
            required
          />

          <div className="field-row">
            <div>
              <label htmlFor="reportingYear">Reporting year</label>
              <select
                id="reportingYear"
                name="reportingYear"
                value={form.reportingYear}
                onChange={handleChange}
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>

            <div>
              <label htmlFor="productionTonnes">
                Annual production (tonnes)
              </label>
              <input
                id="productionTonnes"
                name="productionTonnes"
                type="number"
                min="0.01"
                step="any"
                value={form.productionTonnes}
                onChange={handleChange}
                placeholder="e.g. 1200"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save company details →"}
</button>
        </form>

        {message && (
  <p className="status-message" role="status">
    {message}
  </p>
)}

        <div className="company-preview">
  <p className="eyebrow">LIVE PREVIEW</p>

  <h2>
    {form.companyName || "Your company name"}
  </h2>

  <p>
    {form.product || "Your product"} · Reporting year{" "}
    {form.reportingYear}
  </p>

  <p>
    Industry: {form.sector || "Not selected"}
  </p>
</div>

      </section>
    </main>

  );

  
}



export default App;
