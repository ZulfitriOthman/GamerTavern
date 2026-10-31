// src/features/shop/reviewsService.js — REST client for Backend/routes/api/
// reviews.routes.js (public read, authenticated write).
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

// GET /api/reviews?productId=X — public, returns { items, pagination } plus a
// top-level { count, average } summary the list endpoints don't otherwise carry.
export async function listProductReviews(productId, { page = 1, limit = 10 } = {}) {
  const query = new URLSearchParams({ productId, page, limit });
  let response;
  try {
    response = await fetch(`${API_BASE}/api/reviews?${query}`);
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  const parsed = await response.json().catch(() => null);
  if (!response.ok || parsed?.success === false) {
    throw new Error(parsed?.message || "Failed to load reviews.");
  }
  return { items: parsed.data.items, pagination: parsed.data.pagination, summary: parsed.summary };
}
