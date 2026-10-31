// Backend/modules/fulfilment.module.js
//
// Fulfilment (how the order physically reaches the customer) is a
// deliberately separate concept from payment (how the customer pays) — see
// the "Payment method vs fulfilment method" distinction in CLAUDE.md §62.
// "Delivery" is never treated as a payment method; PAY_ON_DELIVERY/
// PAY_ON_PICKUP (merchantPayments.module.js) are payment methods that are
// only offered under a matching fulfilment type.
//
// SHIPPING_METHODS.CODE (Database/schema/005_orders_checkout.sql) already
// distinguishes 'pickup' from everything else ('local_delivery' | 'courier'
// | 'international'). This module is the single place that maps a shipping
// method's CODE to the coarser FULFILMENT_TYPE checkout eligibility and
// merchant configuration reason about — mirrors the "no route file hand-
// rolls its own vocabulary" philosophy of orderStateMachine.module.js.

export const FULFILMENT_TYPES = ["DELIVERY", "PICKUP"];

export function isSupportedFulfilmentType(type) {
  return FULFILMENT_TYPES.includes(String(type || "").toUpperCase());
}

// Per-merchant enable/disable vocabulary (MERCHANT_FULFILMENT_METHODS.METHOD)
// — same two values as FULFILMENT_TYPES, kept as a distinct export so a
// caller validating a MERCHANT_FULFILMENT_METHODS row reads as validating a
// fulfilment *method*, not re-deriving it from a shipping code.
export const FULFILMENT_METHODS = FULFILMENT_TYPES;
export const isSupportedFulfilmentMethod = isSupportedFulfilmentType;

export function fulfilmentTypeForShippingCode(code) {
  return String(code || "").toLowerCase() === "pickup" ? "PICKUP" : "DELIVERY";
}
