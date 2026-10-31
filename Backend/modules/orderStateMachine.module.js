// Backend/modules/orderStateMachine.module.js
//
// Single source of truth for every allowed status transition in the
// marketplace. No route file should hand-roll its own transition table —
// import from here so a change to the rules can never happen in only
// one of several call sites.
export const ORDER_STATUSES = [
  "PENDING_PAYMENT", "PAID", "PROCESSING", "READY", "SHIPPED", "DELIVERED",
  "CANCELLED", "REFUND_PENDING", "REFUNDED",
];

export const ORDER_TRANSITIONS = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "REFUND_PENDING", "REFUNDED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
};

export const MERCHANT_ORDER_STATUSES = ["PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"];

export const MERCHANT_ORDER_TRANSITIONS = {
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Merchant business-status transitions (approval + moderation workflow —
// see routes/api/admin.routes.js). BANNED is permanent-by-default: it has
// an outgoing transition back to ACTIVE only because an explicit, audited
// unban action is a deliberate admin decision, never a side effect of some
// other flow. SUSPENDED can escalate straight to BANNED without passing
// back through ACTIVE. ACTIVE has no transition back to PENDING — no
// business reason yet to let an admin re-queue an already-approved merchant
// for review through this endpoint.
export const MERCHANT_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "BANNED", "REJECTED"];

export const MERCHANT_TRANSITIONS = {
  PENDING: ["ACTIVE", "REJECTED"],
  REJECTED: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "BANNED"],
  SUSPENDED: ["ACTIVE", "BANNED"],
  BANNED: ["ACTIVE"],
};

export const PAYMENT_STATUSES = [
  "PENDING", "AUTHORIZED", "PAID", "FAILED", "CANCELLED", "VOIDED",
  "REFUNDED", "PARTIALLY_REFUNDED",
];

export const PAYMENT_TRANSITIONS = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED"],
  AUTHORIZED: ["PAID", "VOIDED"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  VOIDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  REFUNDED: [],
};

// merchant_order_payments.status — see Database/schema/010_merchant_payments.sql
// and CLAUDE.md §62 "Merchant Payments". BANK_TRANSFER moves PENDING ->
// AWAITING_TRANSFER -> PAID (an explicit "instructions given, awaiting the
// transfer" step). PAY_ON_DELIVERY/PAY_ON_PICKUP have no equivalent
// intermediate state — the order is created straight into PENDING and the
// merchant confirms directly from there once cash/payment is actually
// collected at delivery/pickup — hence PENDING -> PAID being a direct,
// valid transition below, not just PENDING -> AWAITING_TRANSFER.
export const MERCHANT_ORDER_PAYMENT_STATUSES = [
  "PENDING", "AWAITING_TRANSFER", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED",
];

export const MERCHANT_ORDER_PAYMENT_TRANSITIONS = {
  PENDING: ["AWAITING_TRANSFER", "PROCESSING", "PAID", "CANCELLED"],
  AWAITING_TRANSFER: ["PAID", "CANCELLED"],
  PROCESSING: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

function canTransition(table, from, to) {
  if (from === to) return false;
  return (table[from] || []).includes(to);
}

export const canTransitionOrder = (from, to) => canTransition(ORDER_TRANSITIONS, from, to);
export const canTransitionMerchantOrder = (from, to) => canTransition(MERCHANT_ORDER_TRANSITIONS, from, to);
export const canTransitionPayment = (from, to) => canTransition(PAYMENT_TRANSITIONS, from, to);
export const canTransitionMerchant = (from, to) => canTransition(MERCHANT_TRANSITIONS, from, to);
export const canTransitionMerchantOrderPayment = (from, to) => canTransition(MERCHANT_ORDER_PAYMENT_TRANSITIONS, from, to);

export class InvalidTransitionError extends Error {
  constructor(entity, from, to) {
    super(`Cannot move ${entity} from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
    this.code = "INVALID_TRANSITION";
  }
}

export function assertOrderTransition(from, to) {
  if (!canTransitionOrder(from, to)) throw new InvalidTransitionError("order", from, to);
}
export function assertMerchantOrderTransition(from, to) {
  if (!canTransitionMerchantOrder(from, to)) throw new InvalidTransitionError("merchant order", from, to);
}
export function assertPaymentTransition(from, to) {
  if (!canTransitionPayment(from, to)) throw new InvalidTransitionError("payment", from, to);
}
export function assertMerchantTransition(from, to) {
  if (!canTransitionMerchant(from, to)) throw new InvalidTransitionError("merchant", from, to);
}
export function assertMerchantOrderPaymentTransition(from, to) {
  if (!canTransitionMerchantOrderPayment(from, to)) throw new InvalidTransitionError("merchant order payment", from, to);
}
