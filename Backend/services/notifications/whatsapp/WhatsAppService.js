// Backend/services/notifications/whatsapp/WhatsAppService.js
//
// Single entry point every call site must go through — mirrors
// Backend/services/payment/PaymentService.js's provider-selection
// pattern. Callers never see provider-specific shapes; every provider
// resolves to { success, providerMessageId?, error? }.
//
//   WhatsAppService
//       |
//       +-- MockWhatsAppProvider    (default; no external calls)
//       |
//       +-- WhatsAppCloudProvider   (real Meta Cloud API; requires
//                                    WHATSAPP_ACCESS_TOKEN and
//                                    WHATSAPP_PHONE_NUMBER_ID — the sender
//                                    is Nanashi's own onboarded number, set
//                                    once here, never per-merchant.
//                                    WHATSAPP_BUSINESS_ACCOUNT_ID is not
//                                    required to send a message — it's
//                                    declared for future template-management
//                                    API calls, not used by sendTemplateMessage)
//
// WHATSAPP_PROVIDER=disabled is a third state — no provider at all, every
// send is skipped without even constructing a mock. Useful for CI/tests
// that want zero notification side effects, including log lines.
// WHATSAPP_PROVIDER=cloud must not be turned on before Meta onboarding
// (business verification, number registration, and merchant_new_order
// template approval) is actually complete — see CLAUDE.md "WhatsApp
// Merchant Notifications" for the onboarding checklist.
import MockWhatsAppProvider from "./MockWhatsAppProvider.js";
import WhatsAppCloudProvider from "./WhatsAppCloudProvider.js";

const VALID_PROVIDER_IDS = ["mock", "cloud", "disabled"];

export function getWhatsAppProviderId() {
  const configured = String(process.env.WHATSAPP_PROVIDER || "mock").trim().toLowerCase();
  return VALID_PROVIDER_IDS.includes(configured) ? configured : "mock";
}

function resolveProvider() {
  const id = getWhatsAppProviderId();
  if (id === "cloud") return new WhatsAppCloudProvider();
  if (id === "disabled") return null;
  return new MockWhatsAppProvider();
}

export default class WhatsAppService {
  constructor(provider = resolveProvider()) {
    this.provider = provider;
  }

  get isDisabled() {
    return this.provider === null;
  }

  // `variables` must be supplied in the exact order the registered Meta
  // template expects them positionally ({{1}}, {{2}}, ...). For the
  // approved `merchant_new_order` Utility template (see
  // NotificationService.js) — body text:
  //   "New order received. You have a new order on NanashiCollectibles.
  //    Order: {{1}} / Items: {{2}} / Total: BND {{3}} / View the order: {{4}}"
  // — the contract is: [order_number, item_count, amount, order_url].
  // amount is a plain number (no "BND" prefix — that's static template
  // text); order_url points at the authenticated Merchant Portal and
  // carries no auth bypass of its own. No merchant name, payment method,
  // or customer PII is ever included. Never throws — callers
  // (NotificationService) always get a result object back.
  async sendNewOrderNotification({ to, variables }) {
    if (this.isDisabled) {
      return { success: false, skipped: true, reason: "WHATSAPP_PROVIDER=disabled" };
    }
    const templateName = process.env.WHATSAPP_TEMPLATE_NEW_ORDER || "merchant_new_order";
    const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
    try {
      return await this.provider.sendTemplateMessage({ to, templateName, languageCode, variables });
    } catch (err) {
      return { success: false, error: err?.message || "WhatsApp send failed." };
    }
  }
}
