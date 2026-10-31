// Backend/modules/notifications.module.js
//
// Single source of truth for the app-validated vocabularies used by
// OUTBOUND_NOTIFICATIONS (see Database/schema/011_notifications.sql) —
// mirrors the same "don't hand-roll a vocabulary in a route file" pattern
// as modules/merchantPayments.module.js and orderStateMachine.module.js.
export const NOTIFICATION_CHANNELS = ["WHATSAPP"];

// Only NEW_ORDER is implemented in this stage — the others are the
// documented future direction (see CLAUDE.md), not built yet. Do not wire
// any of these up without a deliberate follow-up decision.
export const NOTIFICATION_TYPES = [
  "NEW_ORDER",
  // "PAYMENT_RECEIVED", "ORDER_CANCELLED", "LOW_STOCK", "DISPUTE_OPENED", "PAYOUT_PROCESSED"
];

// E.164: '+' followed by 7-15 digits, first digit 1-9. Used for
// MERCHANTS.WHATSAPP_PHONE validation — never assume a merchant's login/
// contact PHONE is already in this format.
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidE164(phone) {
  return E164_REGEX.test(String(phone || "").trim());
}

// Shared destination-masking for every WhatsApp log line (provider-level
// and NotificationService-level) — a phone number is the only piece of a
// notification attempt that's ever sensitive enough to mask; order
// numbers/amounts/item counts are safe to log in full (see
// NotificationService.js's own comment on why).
export function maskPhone(phone) {
  const s = String(phone || "");
  return s.length <= 4 ? s : `${"*".repeat(s.length - 4)}${s.slice(-4)}`;
}
