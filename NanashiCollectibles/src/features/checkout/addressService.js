// src/features/checkout/addressService.js — REST client for
// Backend/routes/api/addresses.routes.js. Deliberately minimal (list +
// create only, no edit/delete) — see that file's header comment for why.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class AddressError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = "AddressError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", token, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AddressError("Unable to reach the server. Please try again.", { status: 0 });
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new AddressError(parsed?.message || "Something went wrong. Please try again.", { status: response.status, data: parsed });
  }
  return parsed.data ?? parsed;
}

// GET /api/addresses — the current user's saved addresses.
export function getAddresses({ token }) {
  return request("/api/addresses", { token });
}

// POST /api/addresses — saves a new address (used by checkout's "enter a
// new address" flow; there is no separate address-book management page).
export function createAddress({ token, ...fields }) {
  return request("/api/addresses", { method: "POST", token, body: fields });
}
