const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function saveTokens(data) {
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("refresh_token", data.refresh_token);
}

export function clearTokens() {
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
}

export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem("access_token");
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

export async function registerUser({ email, password, full_name }) {
  const data = await apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });
  saveTokens(data);
  return data;
}

export async function loginUser({ email, password }) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveTokens(data);
  return data;
}

export function getCurrentUser() {
  return apiRequest("/api/auth/me");
}

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