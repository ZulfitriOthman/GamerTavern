// src/features/shop/shopService.js
//
// Thin wrapper around the same public Socket.IO contract the merchant portal uses
// (Backend/controllers/product.controller.js — product:list / product_categories:list
// are public, no auth required). See NanashiCollectibles/CLAUDE.md §62 and the note
// in features/merchant/merchantProductSocketService.js: product reads deliberately
// stayed on Socket.IO rather than becoming a second REST stack.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

// product:list — public. filters: { categoryId, search, sort, page, limit, minPrice,
// maxPrice, inStock, featured }. Resolves { items, pagination }.
export function listShopProducts(socket, filters = {}) {
  return emitWithAck(socket, "product:list", filters);
}

export function listShopCategories(socket) {
  return emitWithAck(socket, "product_categories:list", {});
}

// product_types:list — public. Every active row (id, category_id, name, slug,
// sort_order) across every category; callers filter by category_id
// client-side, same pattern as listShopCategories/listTcgGames. Shared by
// the Shop's Product Type filter and the merchant ProductForm.
export function listProductTypes(socket) {
  return emitWithAck(socket, "product_types:list", {});
}

// product:list filtered to one product by slug (product.controller.js now
// supports this filter, added alongside this page) — resolves the single
// row directly rather than making the caller unwrap { items: [product] }.
export async function getProductBySlug(socket, slug) {
  const data = await listShopProducts(socket, { slug, limit: 1 });
  return data?.items?.[0] || null;
}
