// Backend/modules/merchantPayments.module.js
//
// Single source of truth for the app-validated vocabularies introduced by
// Merchant Payments Stage 1 — mirrors the philosophy of
// modules/orderStateMachine.module.js ("no route file should hand-roll its
// own transition/vocabulary table"). Plain VARCHAR + app validation, not
// SQL ENUM, matching every other status-like column in this schema (see
// Database/README.md "Supported engine").
//
// PROVIDER (merchant_payment_accounts.provider) is deliberately NOT a fixed
// list here — this project does not hardcode which gateway a merchant may
// use (e.g. "BAIDURI = ONLINE, BIBD = NEVER ONLINE" must never appear in
// low-level code). It is validated only as a safe identifier shape.

export const SUPPORTED_BANKS = ["BIBD", "BAIDURI", "TAIB", "OTHER"];

export function isSupportedBank(bankName) {
  return SUPPORTED_BANKS.includes(String(bankName || "").toUpperCase());
}

// PAY_ON_DELIVERY / PAY_ON_PICKUP are payment methods, not fulfilment methods —
// see Backend/modules/fulfilment.module.js for DELIVERY/PICKUP. Both are offline:
// no PaymentService.charge() call, no bank account required (see checkout.routes.js
// settleOfflineOrder()). Each is only ever offered at checkout when the customer's
// chosen fulfilment type matches (PAY_ON_DELIVERY only under Delivery, PAY_ON_PICKUP
// only under Pickup) — enforced server-side in checkout.routes.js, never trusted from
// the client.
export const PAYMENT_METHODS = ["BANK_TRANSFER", "ONLINE_PAYMENT", "PAY_ON_DELIVERY", "PAY_ON_PICKUP"];

// The subset that never calls PaymentService.charge() — no online gateway
// involvement, ever.
export const OFFLINE_PAYMENT_METHODS = ["BANK_TRANSFER", "PAY_ON_DELIVERY", "PAY_ON_PICKUP"];

export function isSupportedPaymentMethod(method) {
  return PAYMENT_METHODS.includes(String(method || "").toUpperCase());
}

export function isOfflinePaymentMethod(method) {
  return OFFLINE_PAYMENT_METHODS.includes(String(method || "").toUpperCase());
}

// merchant_payment_accounts.status. Application code may only ever write
// NOT_CONFIGURED / PENDING / DISABLED / ERROR today — ACTIVE is reserved
// for once real per-merchant charge routing exists and is verified against
// the actual gateway (see Backend/services/payment/PaymentService.js and
// CLAUDE.md §62 "Merchant Payments"). Never set ACTIVE to imply working
// online settlement prematurely.
export const PAYMENT_ACCOUNT_STATUSES = ["NOT_CONFIGURED", "PENDING", "ACTIVE", "DISABLED", "ERROR"];
export const WRITABLE_PAYMENT_ACCOUNT_STATUSES = ["NOT_CONFIGURED", "PENDING", "DISABLED", "ERROR"];

// A safe, generic identifier shape for a gateway provider slug — not a
// fixed enum of "supported" providers (see file header).
const PROVIDER_SLUG_REGEX = /^[A-Z][A-Z0-9_]{1,29}$/;

export function isValidProviderSlug(provider) {
  return PROVIDER_SLUG_REGEX.test(String(provider || "").toUpperCase());
}
