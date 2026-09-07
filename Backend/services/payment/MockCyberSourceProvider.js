// Backend/services/payment/MockCyberSourceProvider.js
//
// Default payment provider until real CyberSource credentials are supplied.
//
// Token-first contract (Phase 1.5): this provider — and therefore
// checkout.routes.js — never receives raw card number/expiry/CVV. It
// receives an opaque `paymentToken`, mirroring the shape a real
// CyberSource Flex Microform integration would hand the backend after
// tokenizing a card entirely in the browser. Backend/routes/api/payment.routes.js
// exposes POST /api/payments/mock/tokenize purely to let a mock/dev
// checkout UI simulate "the card was tokenized client-side" without a
// real Microform instance — that endpoint must never be mistaken for
// the real tokenization step, and must not be reachable when
// PAYMENT_PROVIDER=cybersource (enforced in that route file).
import crypto from "crypto";

const DECLINE_MARKER = "DECLINE";

export function generateMockToken({ declined = false } = {}) {
  const suffix = crypto.randomBytes(6).toString("hex");
  return declined ? `MOCK_TOK_${DECLINE_MARKER}_${suffix}` : `MOCK_TOK_OK_${suffix}`;
}

export default class MockCyberSourceProvider {
  static providerId = "mock_cybersource";

  async charge({ amount, currency, orderNumber, paymentToken }) {
    // Simulate network latency so frontend loading states are exercised realistically.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!paymentToken || typeof paymentToken !== "string" || !paymentToken.startsWith("MOCK_TOK_")) {
      return {
        success: false,
        provider: MockCyberSourceProvider.providerId,
        status: "FAILED",
        message: "Invalid or missing payment token.",
        rawResponse: { reason: "invalid_token" },
      };
    }

    const transactionId = `MOCK_${crypto.randomBytes(8).toString("hex")}`;

    if (paymentToken.includes(DECLINE_MARKER)) {
      return {
        success: false,
        provider: MockCyberSourceProvider.providerId,
        transactionId,
        status: "FAILED",
        message: "The card was declined (simulated).",
        rawResponse: { simulated: true, reason: "test_decline_token" },
      };
    }

    return {
      success: true,
      provider: MockCyberSourceProvider.providerId,
      transactionId,
      status: "PAID",
      amount,
      currency,
      rawResponse: {
        simulated: true,
        orderNumber,
        submitTimeUtc: new Date().toISOString(),
      },
    };
  }

  async refund({ providerTransactionId, amount }) {
    await new Promise((resolve) => setTimeout(resolve, 200));

    return {
      success: true,
      provider: MockCyberSourceProvider.providerId,
      transactionId: `MOCK_REFUND_${crypto.randomBytes(8).toString("hex")}`,
      status: "REFUNDED",
      amount,
      rawResponse: { simulated: true, refundedTransactionId: providerTransactionId },
    };
  }
}
