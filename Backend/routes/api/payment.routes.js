// payment.routes.js
import { Router } from "express";
import CyberSource from "cybersource-rest-client";

function readCyberSourceConfig() {
  return {
    authenticationType: "http_signature",
    runEnvironment: process.env.CYBERSOURCE_RUN_ENVIRONMENT || "apitest.cybersource.com",
    merchantID: process.env.CYBERSOURCE_MERCHANT_ID,
    merchantKeyId: process.env.CYBERSOURCE_KEY_ID,
    merchantsecretKey: process.env.CYBERSOURCE_SHARED_SECRET,
    logConfiguration: {
      enableLog: false,
    },
  };
}

function missingConfigKeys(config) {
  const missing = [];
  if (!config.merchantID) missing.push("CYBERSOURCE_MERCHANT_ID");
  if (!config.merchantKeyId) missing.push("CYBERSOURCE_KEY_ID");
  if (!config.merchantsecretKey) missing.push("CYBERSOURCE_SHARED_SECRET");
  return missing;
}

function parseAmount(rawAmount) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2);
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

function createPaymentRequestBody({ amount, currency, card, billTo, orderCode }) {
  return {
    clientReferenceInformation: {
      code: orderCode,
    },
    processingInformation: {
      capture: true,
    },
    paymentInformation: {
      card: {
        number: String(card.number || "").replace(/\s+/g, ""),
        expirationMonth: String(card.expirationMonth || "").padStart(2, "0"),
        expirationYear: String(card.expirationYear || ""),
        securityCode: String(card.securityCode || ""),
      },
    },
    orderInformation: {
      amountDetails: {
        totalAmount: amount,
        currency: currency || "USD",
      },
      billTo,
    },
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

export default function createPaymentRoutes() {
  const router = Router();

  router.post("/checkout", async (req, res) => {
    try {
      const config = readCyberSourceConfig();
      const missing = missingConfigKeys(config);
      if (missing.length > 0) {
        return res.status(500).json({
          message: "CyberSource is not configured",
          missing,
        });
      }

      const { amount, currency = "USD", card = {}, billTo = {}, cartItems = [] } = req.body || {};

      const normalizedAmount = parseAmount(amount);
      if (!normalizedAmount) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (!card.number || !card.expirationMonth || !card.expirationYear || !card.securityCode) {
        return res.status(400).json({
          message: "Card details are required (number, expirationMonth, expirationYear, securityCode)",
        });
      }

      const orderCode = `NC-${Date.now()}`;
      const requestBody = createPaymentRequestBody({
        amount: normalizedAmount,
        currency,
        card,
        billTo: buildBillTo(billTo),
        orderCode,
      });

      const paymentsApi = new CyberSource.PaymentsApi(config);
      const { data } = await createPaymentAsync(paymentsApi, requestBody);

      const status = String(data?.status || "").toUpperCase();
      const transactionId = data?.id || null;

      return res.status(200).json({
        ok: true,
        orderCode,
        status,
        transactionId,
        amount: normalizedAmount,
        currency,
        submittedItems: Array.isArray(cartItems) ? cartItems.length : 0,
        gateway: "cybersource",
        raw: {
          submitTimeUtc: data?.submitTimeUtc,
          reconciliationId: data?.reconciliationId,
          processorResponse: data?.processorInformation?.responseCode,
        },
      });
    } catch (err) {
      const details = err?.response?.text || err?.error?.message || err?.message || "Payment failed";
      console.error("[payments/checkout] error:", details);

      return res.status(502).json({
        ok: false,
        message: "Payment authorization failed",
        details,
      });
    }
  });

  return router;
}
