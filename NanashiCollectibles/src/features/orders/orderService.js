// src/features/orders/orderService.js — REST client for
// Backend/routes/api/orders.routes.js (customer order history/detail).
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class OrderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "OrderError";
    this.status = status;
  }
}

async function request(path, { token } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new OrderError("Unable to reach the server. Please try again.", 0);
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new OrderError(parsed?.message || "Something went wrong. Please try again.", response.status);
  }
  return parsed.data;
}

// GET /api/orders/:id — order + items (grouped by merchant order) + status history + shipments.
export function getOrder({ token, orderId }) {
  return request(`/api/orders/${orderId}`, { token });
}

// GET /api/orders?page= — { items, pagination: { page, limit, total, pages } }.
export function listOrders({ token, page = 1 }) {
  return request(`/api/orders?page=${page}`, { token });
}
