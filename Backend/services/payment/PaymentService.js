// Backend/services/payment/PaymentService.js
//
// Single entry point every checkout/refund code path must go through.
// Selects the underlying gateway from PAYMENT_PROVIDER so the real
// CyberSource integration can be enabled later purely through
// configuration, with zero changes to checkout.routes.js.
//
//   PaymentService
//       |
//       +-- MockCyberSourceProvider   (default; no external calls)
//       |
//       +-- CyberSourceProvider       (real gateway; requires
//                                      CYBERSOURCE_MERCHANT_ID / KEY_ID /
//                                      SHARED_SECRET)
//
// Callers never see provider-specific shapes — every provider resolves
// to { success, provider, transactionId, status, message?, rawResponse? }.
//
// Token-first contract (Phase 1.5): charge() takes a `paymentToken`, never
// raw card fields. Real card collection must happen client-side via
// CyberSource Flex Microform (or equivalent) before this is ever called —
// see Backend/services/payment/CyberSourceProvider.js's header note.
import MockCyberSourceProvider from "./MockCyberSourceProvider.js";
import CyberSourceProvider from "./CyberSourceProvider.js";

function resolveProvider() {
  const configured = String(process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase();
  if (configured === "cybersource") return new CyberSourceProvider();
  return new MockCyberSourceProvider();
}

export default class PaymentService {
  constructor(provider = resolveProvider()) {
    this.provider = provider;
  }

  // amount must always be a value the CALLER derived from the database
  // (order.grand_total) — PaymentService never accepts or trusts an
  // amount sourced from the client.
  async charge({ amount, currency, orderNumber, paymentToken, billTo }) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new Error("PaymentService.charge: amount must be a positive number derived from the order.");
    }
    if (!paymentToken || typeof paymentToken !== "string") {
      throw new Error("PaymentService.charge: paymentToken is required — raw card data must never reach this layer.");
    }

    const result = await this.provider.charge({ amount, currency, orderNumber, paymentToken, billTo });
    return {
      provider: this.provider.constructor.providerId,
      ...result,
    };
  }

  async refund({ providerTransactionId, amount }) {
    const result = await this.provider.refund({ providerTransactionId, amount });
    return {
      provider: this.provider.constructor.providerId,
      ...result,
    };
  }
}
