import Badge from "./Badge.jsx";

// One tone mapping shared by every status vocabulary in the marketplace (order,
// merchant order, payment, merchant, payout) — see Backend/modules/orderStateMachine.module.js
// for the authoritative list of values. Unknown values fall back to neutral rather
// than throwing, since this only renders whatever the backend already validated.
const TONE_BY_STATUS = {
  ACTIVE: "signal",
  PAID: "signal",
  DELIVERED: "signal",
  READY: "signal",
  PROCESSING: "gold",
  PENDING: "gold",
  PENDING_PAYMENT: "gold",
  SHIPPED: "gold",
  ELIGIBLE: "gold",
  HELD: "gold",
  AUTHORIZED: "gold",
  REFUND_PENDING: "gold",
  CANCELLED: "danger",
  FAILED: "danger",
  SUSPENDED: "danger",
  REJECTED: "danger",
  VOIDED: "danger",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "neutral",
};

function toLabel(status) {
  return String(status || "")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function StatusBadge({ status, className = "" }) {
  return (
    <Badge tone={TONE_BY_STATUS[status] || "neutral"} className={className}>
      {toLabel(status)}
    </Badge>
  );
}
