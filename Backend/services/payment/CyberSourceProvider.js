// Backend/services/payment/CyberSourceProvider.js
//
// Real CyberSource REST integration, extracted from the pre-existing
// Backend/routes/api/payment.routes.js implementation so it can sit behind
// the same PaymentService interface as MockCyberSourceProvider. Selected
// automatically once CYBERSOURCE_MERCHANT_ID / CYBERSOURCE_KEY_ID /
// CYBERSOURCE_SHARED_SECRET are all set and PAYMENT_PROVIDER=cybersource
// (see Backend/services/payment/PaymentService.js).
//
// PCI BOUNDARY (Phase 1.5): PaymentService.charge() now only ever passes
// a `paymentToken`, never raw card fields — see PaymentService.js and
// MockCyberSourceProvider.js. This provider does NOT yet implement the
// real counterpart (exchanging a CyberSource Flex Microform
// transient-token for a payment, via `tokenInformation` in the
// CreatePaymentRequest instead of `paymentInformation.card`). Rather than
// silently fall back to accepting raw PAN again, charge() below fails
// closed with a clear message. Enabling PAYMENT_PROVIDER=cybersource for
// real customer payments requires implementing that Flex Microform
// exchange first — do not bypass this by re-adding raw card handling.
import CyberSource from "cybersource-rest-client";

function readConfig() {
  return {
    authenticationType: "http_signature",
    runEnvironment: process.env.CYBERSOURCE_RUN_ENVIRONMENT || "apitest.cybersource.com",
    merchantID: process.env.CYBERSOURCE_MERCHANT_ID,
    merchantKeyId: process.env.CYBERSOURCE_KEY_ID,
    merchantsecretKey: process.env.CYBERSOURCE_SHARED_SECRET,
    logConfiguration: { enableLog: false },
  };
}

export function missingCyberSourceConfigKeys() {
  const config = readConfig();
  const missing = [];
  if (!config.merchantID) missing.push("CYBERSOURCE_MERCHANT_ID");
  if (!config.merchantKeyId) missing.push("CYBERSOURCE_KEY_ID");
  if (!config.merchantsecretKey) missing.push("CYBERSOURCE_SHARED_SECRET");
  return missing;
}

function buildBillTo(billTo = {}) {
  const fullName = String(billTo.fullName || "Guest Buyer").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ") || "Customer";

  return {
    firstName,
    lastName,
    address1: String(billTo.address1 || "N/A").trim(),
    locality: String(billTo.city || "Bandar Seri Begawan").trim(),
    administrativeArea: String(billTo.state || "Brunei-Muara").trim(),
    postalCode: String(billTo.postalCode || "BE0000").trim(),
    country: String(billTo.country || "BN").trim().toUpperCase(),
    email: String(billTo.email || "guest@example.com").trim(),
    phoneNumber: String(billTo.phone || "00000000").trim(),
  };
}

function createPaymentAsync(apiClient, requestBody) {
  return new Promise((resolve, reject) => {
    apiClient.createPayment(requestBody, (error, data, response) => {
      if (error) {
        reject({ error, response });
        return;
      }
      resolve({ data, response });
    });
  });
}

export default class CyberSourceProvider {
  static providerId = "cybersource";

  async charge({ amount, currency, orderNumber, paymentToken, billTo = {} }) {
    const missing = missingCyberSourceConfigKeys();
    if (missing.length > 0) {
      return {
        success: false,
        provider: CyberSourceProvider.providerId,
        status: "FAILED",
        message: `CyberSource is not configured (missing: ${missing.join(", ")})`,
      };
    }

    // See file header: real Flex Microform token exchange is not
    // implemented. This intentionally never falls back to raw card
    // fields — there is no code path in this file that accepts them.
    return {
      success: false,
      provider: CyberSourceProvider.providerId,
      status: "FAILED",
      message:
        "Real CyberSource tokenized checkout is not implemented yet (Flex Microform token exchange missing). " +
        "Set PAYMENT_PROVIDER=mock until this is built.",
      rawResponse: { orderNumber, tokenReceived: Boolean(paymentToken) },
    };
  }

  // Kept for reference only — this is the real createPayment call this
  // provider will need once it accepts a Flex Microform token instead of
  // raw card data (replace `paymentInformation.card` with the
  // token-based `paymentInformation.fluidData`/`tokenInformation` shape
  // CyberSource's docs specify for Flex Microform).
  async _legacyRawCardCharge({ amount, currency, orderNumber, card = {}, billTo = {} }) {
    const requestBody = {
      clientReferenceInformation: { code: orderNumber },
      processingInformation: { capture: true },
      paymentInformation: {
        card: {
          number: String(card.number || "").replace(/\s+/g, ""),
          expirationMonth: String(card.expirationMonth || "").padStart(2, "0"),
          expirationYear: String(card.expirationYear || ""),
          securityCode: String(card.securityCode || ""),
        },
      },
      orderInformation: {
        amountDetails: { totalAmount: Number(amount).toFixed(2), currency: currency || "BND" },
        billTo: buildBillTo(billTo),
      },
    };

    const paymentsApi = new CyberSource.PaymentsApi(readConfig());
    const { data } = await createPaymentAsync(paymentsApi, requestBody);
    const status = String(data?.status || "").toUpperCase();

    return {
      success: status === "AUTHORIZED" || status === "PENDING_CAPTURE_REVIEW",
      provider: CyberSourceProvider.providerId,
      transactionId: data?.id || null,
      status: status === "AUTHORIZED" ? "PAID" : "FAILED",
      amount,
      currency,
      rawResponse: {
        submitTimeUtc: data?.submitTimeUtc,
        reconciliationId: data?.reconciliationId,
        processorResponse: data?.processorInformation?.responseCode,
      },
    };
  }

  async refund() {
    // Not implemented: real CyberSource refunds require the original
    // transaction's capture context (RefundCaptureRequest) and have not
    // been wired up yet. Process refunds manually via the CyberSource
    // dashboard until this is implemented, and record them through the
    // refunds table (status stays PENDING until confirmed).
    return {
      success: false,
      provider: CyberSourceProvider.providerId,
      status: "FAILED",
      message: "Automated CyberSource refunds are not implemented yet. Process manually and record via the refunds table.",
    };
  }
}
