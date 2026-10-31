// Mirrors Backend/modules/orderStateMachine.module.js's MERCHANT_TRANSITIONS —
// UX-only (which actions the review page even offers). The backend remains
// the sole authority and rejects anything invalid regardless of what this
// shows; if the backend's table changes, update this one to match.
export const MERCHANT_TRANSITIONS = {
  PENDING: ["ACTIVE", "REJECTED"],
  REJECTED: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "BANNED"],
  SUSPENDED: ["ACTIVE", "BANNED"],
  BANNED: ["ACTIVE"],
};

export function nextStatusOptions(currentStatus) {
  return MERCHANT_TRANSITIONS[currentStatus] || [];
}
