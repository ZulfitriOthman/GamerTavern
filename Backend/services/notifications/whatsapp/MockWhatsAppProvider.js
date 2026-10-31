// Backend/services/notifications/whatsapp/MockWhatsAppProvider.js
//
// Default provider (WHATSAPP_PROVIDER=mock, or unset). Never makes a
// network call — logs sanitized metadata only, so development/testing can
// never accidentally spam a real merchant's phone. Message variables are
// safe to log in full: by design (see WhatsAppService.js) they only ever
// contain order numbers, item counts, amount, and payment method/status —
// never bank details, payment tokens, or secrets. Only the destination
// phone number is masked.
import crypto from "crypto";
import { maskPhone } from "../../../modules/notifications.module.js";

export default class MockWhatsAppProvider {
  static providerId = "mock";

  async sendTemplateMessage({ to, templateName, languageCode, variables }) {
    const providerMessageId = `MOCK_WA_${crypto.randomBytes(8).toString("hex")}`;
    console.log(
      `[whatsapp:mock] template="${templateName}" lang=${languageCode} to=${maskPhone(to)} ` +
        `vars=${JSON.stringify(variables)} messageId=${providerMessageId}`
    );
    return { success: true, providerMessageId };
  }
}
