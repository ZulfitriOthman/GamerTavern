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

function canTransition(table, from, to) {
  if (from === to) return false;
  return (table[from] || []).includes(to);
}

export const canTransitionOrder = (from, to) => canTransition(ORDER_TRANSITIONS, from, to);
export const canTransitionMerchantOrder = (from, to) => canTransition(MERCHANT_ORDER_TRANSITIONS, from, to);
export const canTransitionPayment = (from, to) => canTransition(PAYMENT_TRANSITIONS, from, to);

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
