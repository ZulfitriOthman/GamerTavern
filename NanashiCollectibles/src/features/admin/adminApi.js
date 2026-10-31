// src/features/admin/adminApi.js
//
// REST client for /api/admin/* (Backend/routes/api/admin.routes.js). Admin is
// not a separate auth system — it's the same shared session as the rest of
// the site (see features/auth/AuthContext.js), just carrying role: "ADMIN".
// Every call here requires that token; the backend independently re-checks
// role on every request (requireAuth + requireAdmin) regardless of what the
// frontend shows.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class AdminApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "AdminApiError";
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
    throw new AdminApiError("Unable to reach the server. Please try again.", { status: 0 });
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new AdminApiError(parsed?.message || "Something went wrong. Please try again.", {
      status: response.status,
      code: parsed?.code,
    });
  }

  return parsed;
}

// GET /api/admin/merchants/stats — returns { total, pending, active, rejected, suspended, banned }
export function getMerchantStats(token) {
  return request("/api/admin/merchants/stats", { token });
}

// GET /api/admin/dashboard-stats — returns { merchants: {pending,active,suspended,banned}, ordersToday, registeredUsers }
export function getDashboardStats(token) {
  return request("/api/admin/dashboard-stats", { token });
}

// GET /api/admin/merchants — returns { items, pagination }
export function getMerchants(token, { status, search, page, limit } = {}) {
  return request("/api/admin/merchants", { token, query: { status, search, page, limit } });
}

// GET /api/admin/merchants/:id — returns { merchant, addresses, history, merchantUsers,
// productStats, orderStats, reviewStats, payoutStats }
export function getMerchant(token, id) {
  return request(`/api/admin/merchants/${id}`, { token });
}

// GET /api/admin/merchants/:id/analytics?range=7d|30d|90d|all — returns
// { range, kpis, orderBreakdown, salesTrend, topProducts, recentOrders,
// payout, refundsAvailable }. `range` defaults to "30d" server-side.
export function getMerchantAnalytics(token, id, { range } = {}) {
  return request(`/api/admin/merchants/${id}/analytics`, { token, query: { range } });
}

// GET /api/admin/merchants/:id/finance — Commission Receivable (merchant
// owes Nanashi) — returns { commissionReceivable, unbilledOrders, statements }
export function getMerchantFinance(token, id) {
  return request(`/api/admin/merchants/${id}/finance`, { token });
}

// POST /api/admin/merchants/:id/commission-statements — issue a statement
// for a period: { periodStart, periodEnd } (YYYY-MM-DD)
export function issueCommissionStatement(token, id, { periodStart, periodEnd } = {}) {
  return request(`/api/admin/merchants/${id}/commission-statements`, { method: "POST", token, body: { periodStart, periodEnd } });
}

// POST /api/admin/merchants/:id/commission-statements/:statementId/payments
// — record a (possibly partial) payment against a statement
export function recordCommissionPayment(token, id, statementId, { amount, paymentMethod, reference, notes, paidAt } = {}) {
  return request(`/api/admin/merchants/${id}/commission-statements/${statementId}/payments`, {
    method: "POST",
    token,
    body: { amount, paymentMethod, reference, notes, paidAt },
  });
}

// PATCH /api/admin/merchants/:id/status — body: { status, reason?, notes? } — reason is
// required by the backend for SUSPENDED/BANNED — returns { id, status, previousStatus }
export function updateMerchantStatus(token, id, { status, reason, notes } = {}) {
  return request(`/api/admin/merchants/${id}/status`, { method: "PATCH", token, body: { status, reason, notes } });
}

// GET /api/admin/audit-log — returns { items, pagination }
export function getAuditLog(token, { action, page, limit } = {}) {
  return request("/api/admin/audit-log", { token, query: { action, page, limit } });
}
