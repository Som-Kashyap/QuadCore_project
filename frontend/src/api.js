const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function saveTokens(data) {
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("refresh_token", data.refresh_token);
}

export function clearSession() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
}

function saveSession(data) {
  if (!data?.access_token) {
    throw new Error("The auth response did not include an access_token.");
  }
  sessionStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem("refresh_token", data.refresh_token);
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

// -----------------------------------------------------------------------------
// Core Request Handler
// -----------------------------------------------------------------------------

/**
 * Make an HTTP request to the CarbonLedger backend API.
 * Handles ngrok browser-warning bypass, token injection, error parsing, and network failures.
 */
export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("access_token");
  const headers = new Headers(options.headers || {});
  const accessToken = getAccessToken();

  const finalToken = accessToken || token;


  if (finalToken) {
    headers.set("Authorization", `Bearer ${finalToken}`);
  }

  // Let the browser set Content-Type automatically for FormData.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg).join(", ")
      : typeof detail === "string"
        ? detail
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
  saveSession(data);
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
  saveSession(data);
  return data;
}

/**
 * Fetch current authenticated user profile.
 */
export function getCurrentUser() {
  return apiRequest("/api/auth/me");
}

export function logoutUser() {
  clearSession();
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
  return apiRequest("/api/firms/", {
    method: "POST",
    body: JSON.stringify({
      name: factory.name.trim(),
      state: factory.state.trim(),
      segment: "induction_furnace",
      roof_area_sqm: factory.roof_area_sqm
        ? Number(factory.roof_area_sqm)
        : null,
      contracted_demand_mva: factory.contracted_demand_mva
        ? Number(factory.contracted_demand_mva)
        : null,
      tariff_category: factory.tariff_category.trim() || null,
    }),
  });
}

export function getFactories() {
  return apiRequest("/api/firms/");
}