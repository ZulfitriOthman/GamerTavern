// src/features/cart/cartService.js — REST client for Backend/routes/api/
// cart.routes.js. Guest carts are supported via an opaque `x-guest-cart-token`
// header (see that file's own header comment) — this is the first frontend
// consumer of that contract; nothing here changes the backend's behavior.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

async function request(path, { method = "GET", token, guestToken, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (guestToken) headers["x-guest-cart-token"] = guestToken;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new Error(parsed?.message || "Something went wrong. Please try again.");
  }
  return parsed.data;
}

// Every call returns { cartId, items, subtotal, guestToken? } — guestToken is
// only present the first time a guest cart is created, so the caller can
// persist it (see CartProvider.jsx).
export function getCart({ token, guestToken }) {
  return request("/api/cart", { token, guestToken });
}

export function addCartItem({ token, guestToken, productId, variantId, quantity }) {
  return request("/api/cart/items", { method: "POST", token, guestToken, body: { productId, variantId, quantity } });
}

export function updateCartItem({ token, guestToken, itemId, quantity }) {
  return request(`/api/cart/items/${itemId}`, { method: "PATCH", token, guestToken, body: { quantity } });
}

export function removeCartItem({ token, guestToken, itemId }) {
  return request(`/api/cart/items/${itemId}`, { method: "DELETE", token, guestToken });
}

export function mergeGuestCart({ token, guestToken }) {
  return request("/api/cart/merge", { method: "POST", token, guestToken });
}

export function clearCart({ token, guestToken }) {
  return request("/api/cart", { method: "DELETE", token, guestToken });
}
