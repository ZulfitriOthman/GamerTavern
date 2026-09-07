// src/features/merchant/merchantProductSocketService.js
//
// Wraps the Socket.IO ack-based contract in Backend/controllers/product.controller.js.
// Product CREATE/UPDATE/ARCHIVE/DELETE/inventory-adjust and image upload live here,
// not in merchantApi.js — this is the existing, already-secure architecture (identity
// comes from the verified socket handshake, never the payload), extended in Phase 1.5
// to also resolve merchant_id server-side. See NanashiCollectibles/CLAUDE.md §62.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

// product:list — public. { data: { items, pagination } }.
export function listProducts(socket, filters = {}) {
  return emitWithAck(socket, "product:list", filters);
}

// Convenience wrapper for the "edit product" screen — see the Phase 2A audit note in
// Backend/controllers/product.controller.js: there was no single-product read before
// this, so product:list gained an `id` filter rather than a new duplicate endpoint.
export async function getProductById(socket, id) {
  const { items } = await listProducts(socket, { id, status: "all" });
  return items?.[0] || null;
}

export function listProductCategories(socket) {
  return emitWithAck(socket, "product_categories:list", {});
}

export function createProduct(socket, fields) {
  return emitWithAck(socket, "product:create", fields);
}

export function updateProduct(socket, { id, ...fields }) {
  return emitWithAck(socket, "product:update", { id, ...fields });
}

export function archiveProduct(socket, id) {
  return emitWithAck(socket, "product:archive", { id });
}

export function adjustInventory(socket, { productId, delta, reason }) {
  return emitWithAck(socket, "inventory:adjust", { productId, delta, reason });
}

// base64 upload — matches Backend/controllers/product.controller.js's image:upload
// event exactly (fileName + base64 data URI payload, 5MB limit enforced server-side).
export function uploadProductImage(socket, { fileName, base64 }) {
  return emitWithAck(socket, "image:upload", { fileName, base64 });
}
