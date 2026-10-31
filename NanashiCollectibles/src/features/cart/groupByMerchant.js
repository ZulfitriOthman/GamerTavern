// Groups cart/order-summary line items by seller — a standalone vendor
// (no merchant_id) still groups correctly under their own identity via
// vendor_id, matching product.controller.js's own merchant_id-nullable
// dual-scoping model (see NanashiCollectibles/CLAUDE.md §62).
export function groupItemsByMerchant(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.merchant_id ? `m-${item.merchant_id}` : `v-${item.vendor_id}`;
    const label = item.merchant_name || item.seller_name || "Nanashi Collectibles";
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}
