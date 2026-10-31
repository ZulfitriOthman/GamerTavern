// src/features/shop/wishlistService.js — REST client for Backend/routes/api/
// wishlist.routes.js (authenticated-only, one wishlist per user). Same
// request/error shape as features/auth/authService.js.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

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
  return parsed;
}

// GET /api/wishlist — returns [{ id, product_id, name, slug, price, stock_quantity, status, image_url, created_at }]
export function getWishlist(token) {
  return request("/api/wishlist", { token }).then((res) => res.data || []);
}

export function addToWishlist(token, productId) {
  return request("/api/wishlist/items", { method: "POST", token, body: { productId } });
}

export function removeFromWishlist(token, productId) {
  return request(`/api/wishlist/items/${productId}`, { method: "DELETE", token });
}
