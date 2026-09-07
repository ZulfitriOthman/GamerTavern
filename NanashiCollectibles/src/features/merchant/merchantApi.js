// src/features/merchant/merchantApi.js
//
// Centralized REST client for every /api/merchant/* endpoint (Backend/routes/api/merchant.routes.js).
// Product CREATE/UPDATE/ARCHIVE/DELETE/inventory adjustment are intentionally NOT
// here — those stay on Socket.IO (see merchantProductSocketService.js), matching the
// backend's existing architecture (documented in NanashiCollectibles/CLAUDE.md §62).
//
// Every authenticated method takes `token` explicitly as its first argument, mirroring
// features/auth/authService.js's existing convention (me(token)) rather than reading
// from context here — this file has no React dependency.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class MerchantApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "MerchantApiError";
    this.status = status;
    this.code = code;
  }
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  }
  const str = query.toString();
  return str ? `?${str}` : "";
}

async function request(path, { method = "GET", token, body, query } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}${toQuery(query)}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new MerchantApiError("Unable to reach the server. Please try again.", { status: 0 });
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new MerchantApiError(parsed?.message || "Something went wrong. Please try again.", {
      status: response.status,
      code: parsed?.code,
    });
  }

  return parsed;
}

// ---- Auth ----
// POST /api/merchant/register — returns { user, token, merchant }
export function register(fields) {
  return request("/api/merchant/register", { method: "POST", body: fields });
}

// POST /api/merchant/auth/login — returns { user, token, merchants: [...] }
export function login(credentials) {
  return request("/api/merchant/auth/login", { method: "POST", body: credentials });
}

// GET /api/merchant/auth/me — returns { user, merchants: [...] }
export function getMe(token) {
  return request("/api/merchant/auth/me", { token });
}

// ---- Dashboard ----
export function getDashboard(token, { merchantId } = {}) {
  return request("/api/merchant/dashboard", { token, query: { merchantId } });
}

// ---- Products (read-only here — mutations are Socket.IO, see merchantProductSocketService.js) ----
export function getProducts(token, { page, limit, search, status, merchantId } = {}) {
  return request("/api/merchant/products", { token, query: { page, limit, search, status, merchantId } });
}

// ---- Orders ----
export function getOrders(token, { page, limit, status, merchantId } = {}) {
  return request("/api/merchant/orders", { token, query: { page, limit, status, merchantId } });
}

export function getOrder(token, id, { merchantId } = {}) {
  return request(`/api/merchant/orders/${id}`, { token, query: { merchantId } });
}

export function updateOrderStatus(token, id, { status, trackingNumber, carrier }, { merchantId } = {}) {
  return request(`/api/merchant/orders/${id}/status`, {
    method: "PATCH",
    token,
    body: { status, trackingNumber, carrier },
    query: { merchantId },
  });
}

// ---- Staff ----
export function getStaff(token, { merchantId } = {}) {
  return request("/api/merchant/staff", { token, query: { merchantId } });
}

export function addStaff(token, { email, role }, { merchantId } = {}) {
  return request("/api/merchant/staff", { method: "POST", token, body: { email, role }, query: { merchantId } });
}

// ---- Payouts ----
export function getPayouts(token, { merchantId } = {}) {
  return request("/api/merchant/payouts", { token, query: { merchantId } });
}

// ---- Settings ----
export function getSettings(token, { merchantId } = {}) {
  return request("/api/merchant/settings", { token, query: { merchantId } });
}

export function updateSettings(token, fields, { merchantId } = {}) {
  return request("/api/merchant/settings", { method: "PATCH", token, body: fields, query: { merchantId } });
}

export function saveBankDetails(token, fields, { merchantId } = {}) {
  return request("/api/merchant/settings/bank-details", { method: "POST", token, body: fields, query: { merchantId } });
}
