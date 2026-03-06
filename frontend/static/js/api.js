/* =========================================
   API Client
   ========================================= */

const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem("pd_token");
}

function setToken(token) {
  localStorage.setItem("pd_token", token);
}

function setUsername(username) {
  localStorage.setItem("pd_username", username);
}

function getUsername() {
  return localStorage.getItem("pd_username") || "User";
}

function clearAuth() {
  localStorage.removeItem("pd_token");
  localStorage.removeItem("pd_username");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (resp.status === 401) {
    clearAuth();
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      detail = body.detail || JSON.stringify(body);
    } catch (_) {}
    throw new Error(detail);
  }

  if (resp.status === 204) return null;
  return resp.json();
}

// Form-encoded login (OAuth2 expects this)
async function apiLogin(username, password) {
  const body = new URLSearchParams({ username, password });
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    let detail = "Login failed";
    try {
      const data = await resp.json();
      detail = data.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return resp.json();
}

const api = {
  // Auth
  login: (username, password) => apiLogin(username, password),
  register: (data) => apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch("/api/auth/me"),

  // Portfolio
  getAssets: () => apiFetch("/api/portfolio/assets"),
  createAsset: (data) => apiFetch("/api/portfolio/assets", { method: "POST", body: JSON.stringify(data) }),
  updateAsset: (id, data) => apiFetch(`/api/portfolio/assets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAsset: (id) => apiFetch(`/api/portfolio/assets/${id}`, { method: "DELETE" }),

  // Prices
  getCryptoPrices: (ids) => apiFetch(`/api/prices/crypto?ids=${encodeURIComponent(ids)}`),
  getStockPrice: (symbol) => apiFetch(`/api/prices/stock?symbol=${encodeURIComponent(symbol)}`),
  getForexPrice: (from, to = "USD") => apiFetch(`/api/prices/forex?from_currency=${from}&to_currency=${to}`),
};
