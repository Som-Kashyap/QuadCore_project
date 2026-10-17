const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function getAccessToken() {
  return sessionStorage.getItem("access_token");
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

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData) &&
      typeof options.body === "string") {
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
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(", ")
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
  saveSession(data);
  return data;
}

export async function loginUser({ email, password }) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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

export function createFactory(factory) {
  const payload = {
    name: factory.name.trim(),
    state: factory.state.trim(),
    segment: "induction_furnace",
  };

  if (factory.roof_area_sqm !== "" && factory.roof_area_sqm != null) {
    payload.roof_area_sqm = Number(factory.roof_area_sqm);
  }
  if (factory.contracted_demand_mva !== "" && factory.contracted_demand_mva != null) {
    payload.contracted_demand_mva = Number(factory.contracted_demand_mva);
  }
  if (factory.tariff_category?.trim()) {
    payload.tariff_category = factory.tariff_category.trim();
  }

  return apiRequest("/api/firms/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getFactories() {
  return apiRequest("/api/firms/");
}
