/**
 * CarbonLedger Frontend API Client
 * Configured for ngrok tunnel and FastAPI backend.
 */

const rawBase =
  import.meta.env.VITE_API_BASE_URL ||
  "https://caucasian-bleak-recede.ngrok-free.dev";

// Ensure no trailing slash on base URL to avoid malformed duplicate slashes
export const API_BASE = rawBase.replace(/\/+$/, "");

// -----------------------------------------------------------------------------
// Token Management
// -----------------------------------------------------------------------------

export function saveTokens(data) {
  if (data?.access_token) {
    sessionStorage.setItem("access_token", data.access_token);
  }
  if (data?.refresh_token) {
    sessionStorage.setItem("refresh_token", data.refresh_token);
  }
}

export function clearTokens() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
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

// -----------------------------------------------------------------------------
// Core Request Handler
// -----------------------------------------------------------------------------

/**
 * Make an HTTP request to the CarbonLedger backend API.
 * Handles ngrok browser-warning bypass, token injection, error parsing, and network failures.
 */
export async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  // Bypass ngrok free tier browser warning interstitial page
  headers.set("ngrok-skip-browser-warning", "true");

  // Accept JSON responses
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json, text/plain, */*");
  }

  // Inject JWT Bearer token if available and not explicitly provided
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Automatically set Content-Type for JSON payloads (browser sets it for FormData)
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  // Normalize path ensuring a single leading slash and no duplicate /api
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // Friendly and safe error message for connection/network failures
    const errorMsg =
      `Network connection failed when requesting ${normalizedPath}. ` +
      `Check your network connection and ensure the backend at ${API_BASE} is reachable.`;
    const err = new Error(errorMsg);
    err.name = "NetworkError";
    err.isNetworkError = true;
    err.originalError = networkError;
    err.url = url;
    throw err;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;
  let text = "";

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    text = await response.text().catch(() => "");
  }

  if (!response.ok) {
    let message;

    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        // FastAPI validation errors: format field names and messages cleanly
        message = data.detail
          .map((e) => {
            if (typeof e === "object" && e !== null) {
              const field = e.loc ? e.loc[e.loc.length - 1] : null;
              return field && field !== "body" ? `${field}: ${e.msg}` : e.msg;
            }
            return String(e);
          })
          .join(", ");
      } else if (typeof data.detail === "string") {
        message = data.detail;
      } else {
        message = JSON.stringify(data.detail);
      }
    } else if (data?.message) {
      message = data.message;
    } else if (response.status === 502) {
      message =
        "Backend gateway error (502 Bad Gateway). The ngrok tunnel is online, but the upstream backend service at localhost:8000 is not responding.";
    } else if (response.status === 503) {
      message = "Backend service temporarily unavailable (503).";
    } else if (response.status === 404) {
      message = `Endpoint not found (404): ${normalizedPath}`;
    } else if (response.status === 401) {
      message = "Authentication required (401). Please sign in to continue.";
    } else if (response.status === 403) {
      message = "Access forbidden (403). You do not have permission for this action.";
    } else if (text && text.length < 200 && !text.includes("<html")) {
      message = `Error (${response.status}): ${text.trim()}`;
    } else {
      message = `Request failed (${response.status}: ${response.statusText || "Server error"})`;
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.url = url;
    throw error;
  }

  return data ?? (text ? { rawText: text } : null);
}

// -----------------------------------------------------------------------------
// Health Check Endpoint
// -----------------------------------------------------------------------------

export function checkHealth() {
  return apiRequest("/health");
}

// -----------------------------------------------------------------------------
// Authentication Endpoints (FastAPI /api/auth)
// -----------------------------------------------------------------------------

/**
 * Register a new user account.
 * Expected schema: { email: string, password: string (min 8 chars), full_name: string }
 */
export async function registerUser({ email, password, full_name }) {
  const data = await apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: email?.trim(),
      password,
      full_name: full_name?.trim(),
    }),
  });
  saveTokens(data);
  return data;
}

/**
 * Log in an existing user.
 * Expected schema: { email: string, password: string }
 */
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

/**
 * Refresh access token using the stored refresh token.
 */
export async function refreshUserTokens() {
  const token = getRefreshToken();
  if (!token) {
    throw new Error("No refresh token available");
  }
  const data = await apiRequest("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: token }),
  });
  saveTokens(data);
  return data;
}

/**
 * Fetch current authenticated user profile.
 */
export function getCurrentUser() {
  return apiRequest("/api/auth/me");
}

// -----------------------------------------------------------------------------
// Firm / Factory Endpoints (FastAPI /api/firms)
// -----------------------------------------------------------------------------

/**
 * Create a new factory firm entity.
 * Required fields: name, state
 * Optional: roof_area_sqm (gt 0), contracted_demand_mva (gt 0), tariff_category, registration_identifier
 */
export function createFactory(factory) {
  const payload = {
    name: factory.name?.trim() || "",
    state: factory.state?.trim() || "",
    segment: factory.segment?.trim() || "induction_furnace",
  };

  if (factory.registration_identifier?.trim()) {
    payload.registration_identifier = factory.registration_identifier.trim();
  }

  const roofArea = Number(factory.roof_area_sqm);
  if (!isNaN(roofArea) && roofArea > 0) {
    payload.roof_area_sqm = roofArea;
  }

  const demand = Number(factory.contracted_demand_mva);
  if (!isNaN(demand) && demand > 0) {
    payload.contracted_demand_mva = demand;
  }

  if (factory.tariff_category?.trim()) {
    payload.tariff_category = factory.tariff_category.trim();
  }

  return apiRequest("/api/firms/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * List all firms owned by the authenticated user.
 */
export function getFactories() {
  return apiRequest("/api/firms/");
}

/**
 * Get details for a specific firm by UUID.
 */
export function getFactoryById(firmId) {
  return apiRequest(`/api/firms/${firmId}`);
}

/**
 * Partially update a firm baseline.
 */
export function updateFactory(firmId, updateData) {
  return apiRequest(`/api/firms/${firmId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
}

/**
 * Delete a firm.
 */
export function deleteFactory(firmId) {
  return apiRequest(`/api/firms/${firmId}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------------
// Reporting Period Endpoints (FastAPI /api/reporting-periods)
// -----------------------------------------------------------------------------

/**
 * Create a reporting period.
 * Schema: { firm_id: UUID, start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', production_tonnes?: number }
 */
export function createReportingPeriod({
  firm_id,
  start_date,
  end_date,
  production_tonnes,
}) {
  const payload = {
    firm_id,
    start_date,
    end_date,
  };

  const tonnes = Number(production_tonnes);
  if (!isNaN(tonnes) && tonnes > 0) {
    payload.production_tonnes = tonnes;
  }

  return apiRequest("/api/reporting-periods/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReportingPeriod(periodId) {
  return apiRequest(`/api/reporting-periods/${periodId}`);
}

export function updateReportingPeriod(periodId, updateData) {
  return apiRequest(`/api/reporting-periods/${periodId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
}

export function deleteReportingPeriod(periodId) {
  return apiRequest(`/api/reporting-periods/${periodId}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------------
// Document Endpoints (FastAPI /api/documents)
// -----------------------------------------------------------------------------

/**
 * Upload an evidence document.
 * Multipart form: file, reporting_period_id, category
 */
export function uploadDocument({
  file,
  reporting_period_id,
  category = "electricity_bill",
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reporting_period_id", reporting_period_id);
  formData.append("category", category);

  return apiRequest("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export function deleteDocument(documentId) {
  return apiRequest(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------------
// Activity Verification Endpoints (FastAPI /api/activity)
// -----------------------------------------------------------------------------

export function verifyElectricityRecord(recordId, updateData) {
  return apiRequest(`/api/activity/electricity/${recordId}/verify`, {
    method: "PUT",
    body: JSON.stringify(updateData),
  });
}

export function verifyFuelRecord(recordId, updateData) {
  return apiRequest(`/api/activity/fuel/${recordId}/verify`, {
    method: "PUT",
    body: JSON.stringify(updateData),
  });
}

export function verifyMaterialRecord(recordId, updateData) {
  return apiRequest(`/api/activity/material/${recordId}/verify`, {
    method: "PUT",
    body: JSON.stringify(updateData),
  });
}

// -----------------------------------------------------------------------------
// Evidence Sync Endpoints (FastAPI /api/evidence)
// -----------------------------------------------------------------------------

export function syncEvidence(state) {
  const encodedState = encodeURIComponent(state?.trim() || "");
  return apiRequest(`/api/evidence/sync?state=${encodedState}`, {
    method: "POST",
  });
}

// -----------------------------------------------------------------------------
// Calculation Engine & Reports Endpoints (FastAPI /api/reports)
// -----------------------------------------------------------------------------

export function calculateEmissions(periodId) {
  return apiRequest(`/api/reports/calculate/${periodId}`, {
    method: "POST",
  });
}

export function exportReport(periodId, format = "pdf") {
  const encodedFormat = encodeURIComponent(format);
  return apiRequest(`/api/reports/export/${periodId}?format=${encodedFormat}`, {
    method: "POST",
  });
}

export function downloadReport(reportId) {
  return apiRequest(`/api/reports/download/${reportId}`);
}