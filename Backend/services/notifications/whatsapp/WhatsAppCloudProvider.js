// Backend/services/notifications/whatsapp/WhatsAppCloudProvider.js
//
// Real WhatsApp Business Cloud API (Meta Graph API) integration. Selected
// via WHATSAPP_PROVIDER=cloud (see WhatsAppService.js). Requires
// WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID; fails closed (never
// falls back to some other send path) if either is missing.
//
// NOT LIVE-TESTED against Meta's actual servers — no Meta Business/Cloud
// API credentials were available to verify this against. The request
// shape below matches Meta's documented Cloud API template-message format
// as of this writing; verify it against a real WhatsApp Business Account
// before relying on it for production sends. Mirrors the same honesty
// posture as Backend/services/payment/CyberSourceProvider.js.
//
// Business-initiated WhatsApp messages outside a customer-initiated 24h
// session window must use a pre-approved message template — this provider
// only ever sends `type: "template"`, never free-form text, and never
// invents template content itself (see WhatsAppService.js's variable-order
// contract).
const GRAPH_API_BASE = "https://graph.facebook.com";

function sanitizeError(data) {
  // Never surface the raw response body (which could in principle echo
  // request fields back) — only Meta's own error message/code, truncated.
  const msg = data?.error?.message || data?.error?.error_user_msg || "WhatsApp API request failed.";
  const code = data?.error?.code;
  return `${code != null ? `[${code}] ` : ""}${String(msg).slice(0, 400)}`;
}

export default class WhatsAppCloudProvider {
  static providerId = "cloud";

  async sendTemplateMessage({ to, templateName, languageCode, variables }) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

    if (!accessToken || !phoneNumberId) {
      return { success: false, error: "WhatsApp Cloud API is not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)." };
    }

    const url = `${GRAPH_API_BASE}/${apiVersion}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: (variables || []).map((v) => ({ type: "text", text: String(v) })),
          },
        ],
      },
    };

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return { success: false, error: "Network error contacting the WhatsApp Cloud API." };
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // no JSON body
    }

    if (!response.ok) {
      return { success: false, error: sanitizeError(data) };
    }

    const providerMessageId = data?.messages?.[0]?.id || null;
    return { success: true, providerMessageId };
  }
}
