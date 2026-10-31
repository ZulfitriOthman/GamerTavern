// Backend/modules/merchantFinance.module.js
//
// Single source of truth for the "which direction does money move"
// rule between Nanashi and a merchant — the thing every commission/
// payout query must agree on, never re-derive independently per route.
//
//   NANASHI → MERCHANT (payout, unchanged from Merchant Payments Stage 1/2)
//     Customer pays Nanashi directly (Online Payment). Nanashi already
//     holds the money; commission is retained/netted at payout time.
//     Nanashi owes the merchant MERCHANT_ORDERS.merchant_net_amount.
//
//   MERCHANT → NANASHI (commission receivable, new)
//     Customer pays the MERCHANT directly (Bank Transfer / Pay on
//     Delivery / Pay on Pickup — i.e. a MERCHANT_ORDER_PAYMENTS row
//     exists and is PAID). Nanashi never touched that money, so the
//     merchant owes Nanashi MERCHANT_ORDERS.commission_amount.
//
// A merchant order can only ever be in exactly one of these two
// buckets — MERCHANT_ORDER_PAYMENTS.merchant_order_id is unique (at
// most one payment row per order), and ONLINE_PAYMENT orders never get
// a row there at all (checkout.routes.js). Every query below joins on
// that same signal so the two directions can never double-count or
// double-charge the same order.

// SQL fragment: true iff this merchant order was paid DIRECTLY to the
// merchant (requires the caller's query to alias MERCHANT_ORDER_PAYMENTS
// as `mop`, LEFT JOINed on `mop.merchant_order_id = mo.id`).
const DIRECT_PAYMENT_PAID_SQL = `(mop.id IS NOT NULL AND mop.status = 'PAID')`;

// SQL fragment: true iff this merchant order was paid to NANASHI
// directly (Online Payment — no MERCHANT_ORDER_PAYMENTS row at all, so
// confirmation lives on ORDERS.payment_status instead; requires the
// caller's query to alias ORDERS as `o`, joined `o.id = mo.order_id`).
const PLATFORM_HELD_PAID_SQL = `(mop.id IS NULL AND o.payment_status = 'PAID')`;

async function getCommissionDueDays(db) {
  const [rows] = await db.query(`SELECT setting_value FROM PLATFORM_SETTINGS WHERE setting_key = 'commission_due_days' LIMIT 1`);
  const days = Number(rows?.[0]?.setting_value);
  return Number.isFinite(days) && days > 0 ? days : 30;
}

export { DIRECT_PAYMENT_PAID_SQL, PLATFORM_HELD_PAID_SQL, getCommissionDueDays };
