const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "https://quadcore-project.onrender.com"
).replace(/\/+$/, "");

// -----------------------------------------------------------------------------
// Session & Token Storage
// -----------------------------------------------------------------------------

export function saveTokens(data) {
  if (data?.access_token) {
    sessionStorage.setItem("access_token", data.access_token);
  }
  if (data?.refresh_token) {
    sessionStorage.setItem("refresh_token", data.refresh_token);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function clearSession() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("calculation_result");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

function saveSession(data) {
  if (!data?.access_token) {
    throw new Error("The auth response did not include an access_token.");
  }
  sessionStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem("refresh_token", data.refresh_token);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-changed"));
  }
}

export function getAccessToken() {
  return sessionStorage.getItem("access_token");
}

export function getRefreshToken() {
  return sessionStorage.getItem("refresh_token");
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function saveCalculationResult(result) {
  sessionStorage.setItem("calculation_result", JSON.stringify(result));
}

export function getCalculationResult() {
  const data = sessionStorage.getItem("calculation_result");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Core Request Handler
// -----------------------------------------------------------------------------

export async function apiRequest(path, options = {}, isRetry = false) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Let browser set boundary automatically for FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle expired sessions with silent token refresh once
  if (
    response.status === 401 &&
    !isRetry &&
    !path.startsWith("/api/auth/login") &&
    !path.startsWith("/api/auth/register") &&
    !path.startsWith("/api/auth/refresh") &&
    getRefreshToken()
  ) {
    try {
      await refreshUserTokens();
      return apiRequest(path, options, true);
    } catch {
      clearSession();
    }
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg || e.message || JSON.stringify(e)).join(", ")
      : typeof detail === "string"
        ? detail
        : response.status === 404
          ? `Server endpoint not found (404) at ${API_BASE}. Please verify backend configuration.`
          : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

// -----------------------------------------------------------------------------
// Health Check Endpoint
// -----------------------------------------------------------------------------

export function checkHealth() {
  return apiRequest("/health");
}

// -----------------------------------------------------------------------------
// Authentication Endpoints (/api/auth)
// -----------------------------------------------------------------------------

export async function registerUser({ email, password, full_name }) {
  const data = await apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: email?.trim(),
      password,
      full_name: full_name?.trim(),
    }),
  });
  saveSession(data);
  return data;
}

export async function loginUser({ email, password }) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: email?.trim(),
      password,
    }),
  });
  saveTokens(data);
  return data;
}

export async function refreshUserTokens() {
  const token = getRefreshToken();
  if (!token) {
    throw new Error("No refresh token available");
  }
  const data = await apiRequest("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: token }),
  });
  saveSession(data);
  return data;
}

export function getCurrentUser() {
  return apiRequest("/api/auth/me");
}

export function logoutUser() {
  clearSession();
}

// -----------------------------------------------------------------------------
// Factory / Firm Endpoints (/api/firms)
// -----------------------------------------------------------------------------

export function createFactory(factory) {
  return apiRequest("/api/firms/", {
    method: "POST",
    body: JSON.stringify({
      name: factory.name?.trim(),
      state: factory.state?.trim(),
      segment: factory.segment || "induction_furnace",
      roof_area_sqm:
        factory.roof_area_sqm && Number(factory.roof_area_sqm) > 0
          ? Number(factory.roof_area_sqm)
          : null,
      contracted_demand_mva:
        factory.contracted_demand_mva && Number(factory.contracted_demand_mva) > 0
          ? Number(factory.contracted_demand_mva)
          : null,
      tariff_category: factory.tariff_category?.trim() || null,
      registration_identifier: factory.registration_identifier?.trim() || null,
    }),
  });
}

export function getFactories() {
  return apiRequest("/api/firms/");
}

export function getFactoryById(firmId) {
  return apiRequest(`/api/firms/${firmId}`);
}

export function updateFactory(firmId, data) {
  return apiRequest(`/api/firms/${firmId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteFactory(firmId) {
  return apiRequest(`/api/firms/${firmId}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------------
// Reporting Period Endpoints (/api/reporting-periods)
// -----------------------------------------------------------------------------

export function createReportingPeriod(periodData) {
  return apiRequest("/api/reporting-periods/", {
    method: "POST",
    body: JSON.stringify({
      firm_id: periodData.firm_id,
      start_date: periodData.start_date,
      end_date: periodData.end_date,
      production_tonnes:
        periodData.production_tonnes && Number(periodData.production_tonnes) > 0
          ? Number(periodData.production_tonnes)
          : null,
    }),
  });
}

export function getReportingPeriods(firmId = null) {
  const query = firmId ? `?firm_id=${firmId}` : "";
  return apiRequest(`/api/reporting-periods/${query}`);
}

export function getReportingPeriodById(periodId) {
  return apiRequest(`/api/reporting-periods/${periodId}`);
}

export function updateReportingPeriod(periodId, data) {
  return apiRequest(`/api/reporting-periods/${periodId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteReportingPeriod(periodId) {
  return apiRequest(`/api/reporting-periods/${periodId}`, {
    method: "DELETE",
  });
}

export function getPeriodReports(periodId) {
  return apiRequest(`/api/reporting-periods/${periodId}/reports`);
}

// -----------------------------------------------------------------------------
// Document Evidence Endpoints (/api/documents)
// -----------------------------------------------------------------------------

export function uploadDocument(file, reportingPeriodId, category = "electricity_bill") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reporting_period_id", String(reportingPeriodId));
  formData.append("category", category);
  return apiRequest("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export function listDocumentsForPeriod(periodId) {
  return apiRequest(`/api/documents/period/${periodId}`);
}

export function getDocumentById(documentId) {
  return apiRequest(`/api/documents/${documentId}`);
}

export function deleteDocument(documentId) {
  return apiRequest(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
}

export function getDocumentDownloadUrl(documentId) {
  return `${API_BASE}/api/documents/${documentId}/download`;
}

// -----------------------------------------------------------------------------
// Activity Records Endpoints (/api/activity)
// -----------------------------------------------------------------------------

export function createElectricityRecord(data) {
  return apiRequest("/api/activity/electricity/", {
    method: "POST",
    body: JSON.stringify({
      reporting_period_id: Number(data.reporting_period_id),
      consumed_kwh: Number(data.consumed_kwh),
      source_document_id: data.source_document_id || null,
      peak_demand_kva:
        data.peak_demand_kva && Number(data.peak_demand_kva) > 0
          ? Number(data.peak_demand_kva)
          : null,
      power_factor:
        data.power_factor !== undefined && data.power_factor !== null
          ? Number(data.power_factor)
          : null,
      total_billed_inr:
        data.total_billed_inr !== undefined && data.total_billed_inr !== null
          ? Number(data.total_billed_inr)
          : null,
    }),
  });
}

export function createFuelRecord(data) {
  return apiRequest("/api/activity/fuel/", {
    method: "POST",
    body: JSON.stringify({
      reporting_period_id: Number(data.reporting_period_id),
      fuel_type: data.fuel_type || "diesel",
      quantity_liters: Number(data.quantity_liters),
      total_cost_inr:
        data.total_cost_inr !== undefined && data.total_cost_inr !== null
          ? Number(data.total_cost_inr)
          : null,
      source_document_id: data.source_document_id || null,
    }),
  });
}

export function createMaterialRecord(data) {
  return apiRequest("/api/activity/material/", {
    method: "POST",
    body: JSON.stringify({
      reporting_period_id: Number(data.reporting_period_id),
      material_type: data.material_type || "steel_scrap",
      quantity_tonnes: Number(data.quantity_tonnes),
      supplier_name: data.supplier_name?.trim() || null,
      supplier_stated_emission_factor:
        data.supplier_stated_emission_factor && Number(data.supplier_stated_emission_factor) >= 0
          ? Number(data.supplier_stated_emission_factor)
          : null,
      source_document_id: data.source_document_id || null,
    }),
  });
}

export function getPeriodActivity(periodId) {
  return apiRequest(`/api/activity/period/${periodId}`);
}

export function verifyActivity(type, recordId, status = "confirmed") {
  return apiRequest(`/api/activity/${type}/${recordId}/verify`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function deleteActivityRecord(type, recordId) {
  return apiRequest(`/api/activity/${type}/${recordId}`, {
    method: "DELETE",
  });
}

export function ingestDocumentToActivity(documentId) {
  return apiRequest(`/api/activity/ingest/${documentId}`, {
    method: "POST",
  });
}

// -----------------------------------------------------------------------------
// Calculation Engine & Reports (/api/reports)
// -----------------------------------------------------------------------------

export function calculateFootprint(periodId) {
  return apiRequest(`/api/reports/calculate/${periodId}`, {
    method: "POST",
  });
}

export function exportReport(periodId, format = "pdf") {
  return apiRequest(`/api/reports/export/${periodId}?format=${format}`, {
    method: "POST",
  });
}

// -----------------------------------------------------------------------------
// Evidence & TinyFish Sync Endpoints (/api/evidence)
// -----------------------------------------------------------------------------

export function syncEvidence(category = "grid_emission_factor") {
  return apiRequest(`/api/evidence/sync?category=${category}`, {
    method: "POST",
  });
}

export function getEvidenceItems() {
  return apiRequest("/api/evidence/");
}

export function getEvidenceByCategory(category = "grid_emission_factor") {
  return apiRequest(`/api/evidence/${category}`);
}