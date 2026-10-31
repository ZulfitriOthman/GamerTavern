// src/features/checkout/checkoutService.js — REST client for
// Backend/routes/api/shipping.routes.js, payment.routes.js (mock
// tokenize only), and checkout.routes.js. Mirrors cartService.js's
// request() shape; `code` is surfaced on the thrown error so callers can
// branch on specific failures (INSUFFICIENT_STOCK, PRODUCT_UNAVAILABLE,
// PAYMENT_FAILED, ...) rather than string-matching messages.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

export class CheckoutError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(path, { method = "GET", token, headers, body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CheckoutError("Unable to reach the server. Please try again.", { status: 0 });
  }

  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok || parsed?.success === false) {
    throw new CheckoutError(parsed?.message || "Something went wrong. Please try again.", {
      status: response.status,
      code: parsed?.code,
      data: parsed,
    });
  }
  return parsed.data ?? parsed;
}

// GET /api/shipping/methods — public, active methods only, NOT filtered to
// the current cart's merchants. Kept for any non-checkout consumer; checkout
// itself uses getFulfilmentMethods() below instead.
export function getShippingMethods() {
  return request("/api/shipping/methods");
}

// GET /api/checkout/fulfilment-methods — every active shipping method, each
// flagged `available` for the current cart (every merchant represented must
// enable that method's fulfilment type — see Backend/modules/fulfilment.module.js).
// Render only the available ones; never hardcode which methods exist.
export function getFulfilmentMethods({ token }) {
  return request("/api/checkout/fulfilment-methods", { token });
}

// POST /api/payments/mock/tokenize — dev/mock-only card tokenization.
// Real production checkout would tokenize via CyberSource Flex Microform
// in the browser instead — see Backend/routes/api/payment.routes.js.
export function tokenizeMockCard({ number, expirationMonth, expirationYear, securityCode }) {
  return request("/api/payments/mock/tokenize", {
    method: "POST",
    body: { card: { number, expirationMonth, expirationYear, securityCode } },
  });
}

// POST /api/upload/delivery-reference — a photo of where to leave the
// order (front gate, reception, ...), never a product photo. Requires auth.
// Returns { imageUrl, fileType } — pass imageUrl straight through as
// deliveryReferenceImageUrl to the submit*Checkout functions below.
export async function uploadDeliveryReferencePhoto({ token, file }) {
  const formData = new FormData();
  formData.append("image", file);
  let response;
  try {
    response = await fetch(`${API_BASE}/api/upload/delivery-reference`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
  } catch {
    throw new CheckoutError("Unable to reach the server. Please try again.", { status: 0 });
  }
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    // no JSON body
  }
  if (!response.ok || parsed?.success === false) {
    throw new CheckoutError(parsed?.message || "Couldn't upload that photo. Please try again.", { status: response.status, data: parsed });
  }
  return parsed;
}

// POST /api/checkout — requires Idempotency-Key so a duplicate click/retry
// replays the original result instead of creating a second order.
export function submitCheckout({
  token,
  idempotencyKey,
  shippingMethodId,
  shippingAddressId,
  billingAddressId,
  couponCode,
  paymentToken,
  deliveryInstructions,
  deliveryReferenceImageUrl,
}) {
  return request("/api/checkout", {
    method: "POST",
    token,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { shippingMethodId, shippingAddressId, billingAddressId, couponCode, paymentToken, deliveryInstructions, deliveryReferenceImageUrl },
  });
}

// GET /api/checkout/eligibility — server-computed available payment methods
// for the current cart (Merchant Payments Stage 2). `shippingMethodId` is
// optional but required for payOnDelivery/payOnPickup to ever come back
// available — without it, neither is offered (there's no fulfilment choice
// yet to gate on).
export function getPaymentEligibility({ token, shippingMethodId }) {
  const query = shippingMethodId ? `?shippingMethodId=${encodeURIComponent(shippingMethodId)}` : "";
  return request(`/api/checkout/eligibility${query}`, { token });
}

// POST /api/checkout/bank-transfer — additive payment path alongside
// submitCheckout(); does not take a paymentToken. Same idempotency contract.
export function submitBankTransferCheckout({
  token,
  idempotencyKey,
  shippingMethodId,
  shippingAddressId,
  billingAddressId,
  couponCode,
  deliveryInstructions,
  deliveryReferenceImageUrl,
}) {
  return request("/api/checkout/bank-transfer", {
    method: "POST",
    token,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { shippingMethodId, shippingAddressId, billingAddressId, couponCode, deliveryInstructions, deliveryReferenceImageUrl },
  });
}

// POST /api/checkout/pay-on-delivery and /pay-on-pickup — offline payment
// methods gated by fulfilment type; the backend rejects a mismatched
// shippingMethodId (e.g. Pay on Pickup under a delivery method) even if the
// frontend never offers that combination. Same idempotency contract as
// submitBankTransferCheckout.
export function submitPayOnDeliveryCheckout({
  token,
  idempotencyKey,
  shippingMethodId,
  shippingAddressId,
  billingAddressId,
  couponCode,
  deliveryInstructions,
  deliveryReferenceImageUrl,
}) {
  return request("/api/checkout/pay-on-delivery", {
    method: "POST",
    token,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { shippingMethodId, shippingAddressId, billingAddressId, couponCode, deliveryInstructions, deliveryReferenceImageUrl },
  });
}

export function submitPayOnPickupCheckout({ token, idempotencyKey, shippingMethodId, shippingAddressId, billingAddressId, couponCode }) {
  return request("/api/checkout/pay-on-pickup", {
    method: "POST",
    token,
    headers: { "Idempotency-Key": idempotencyKey },
    body: { shippingMethodId, shippingAddressId, billingAddressId, couponCode },
  });
}
