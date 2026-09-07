// Mirrors Backend/modules/orderStateMachine.module.js's MERCHANT_ORDER_TRANSITIONS —
// UX-only (which options a status dropdown should even offer). The backend remains
// the sole authority and rejects anything invalid regardless of what this shows; if
// the backend's table changes, update this one to match.
export const MERCHANT_ORDER_TRANSITIONS = {
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function nextStatusOptions(currentStatus) {
  return MERCHANT_ORDER_TRANSITIONS[currentStatus] || [];
}
