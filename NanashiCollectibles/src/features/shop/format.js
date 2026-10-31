// Currency is always BND — see Database/schema/005_orders_checkout.sql
// (orders.currency default) — never assumed from user locale. Mirrors features/merchant/format.js's
// formatMoney exactly; kept as its own copy since that file lives in a
// merchant-portal-only feature folder (same precedent as features/tournament/format.js).
export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "BND" }).format(n);
}
