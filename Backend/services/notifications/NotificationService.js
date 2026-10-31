// Backend/services/notifications/NotificationService.js
//
// The only entry point checkout code (or anything else) should call for
// merchant notifications — never call WhatsAppService/providers directly
// from a route file. Owns: eligibility (opt-in + valid number), the
// OUTBOUND_NOTIFICATIONS idempotency claim, building the message
// variables, and recording the delivery result. Never throws — every path
// returns a result object, so a caller can safely `await` this without
// risking the surrounding request.
//
// Call this AFTER the checkout transaction has committed, never before —
// see checkout.routes.js. A WhatsApp failure must never roll back or fail
// an otherwise-successful order.
import WhatsAppService, { getWhatsAppProviderId } from "./whatsapp/WhatsAppService.js";
import { isValidE164, maskPhone } from "../../modules/notifications.module.js";

const whatsAppService = new WhatsAppService();
const activeProviderId = getWhatsAppProviderId();

// No currency prefix — the approved `merchant_new_order` template's body
// text already reads "Total: BND {{3}}", so the variable is just the
// number (see WhatsAppService.sendNewOrderNotification's doc comment).
function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function sanitizeForStorage(message) {
  // LAST_ERROR must never carry a raw provider payload or anything that
  // could contain a secret — every provider already returns a short,
  // human-readable string (see WhatsAppCloudProvider.sanitizeError /
  // MockWhatsAppProvider), this just enforces the column's length cap.
  return String(message || "").slice(0, 500);
}

// Sends (or records why it skipped) the NEW_ORDER WhatsApp notification for
// one MERCHANT_ORDER. Safe to call multiple times for the same
// merchant_order — the second call always hits the idempotency claim and
// no-ops.
export async function notifyNewOrder(db, merchantOrderId) {
  try {
    const [rows] = await db.query(
      `SELECT mo.id AS merchant_order_id, mo.subtotal AS merchant_order_subtotal,
              o.order_number,
              m.id AS merchant_id,
              m.whatsapp_phone, m.whatsapp_notifications_enabled,
              (SELECT COUNT(*) FROM ORDER_ITEMS oi WHERE oi.merchant_order_id = mo.id) AS item_count,
              mop.payment_method, mop.amount AS bank_transfer_amount
         FROM MERCHANT_ORDERS mo
         JOIN ORDERS o ON o.id = mo.order_id
         JOIN MERCHANTS m ON m.id = mo.merchant_id
         LEFT JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
        WHERE mo.id = ?
        LIMIT 1`,
      [merchantOrderId]
    );
    const row = rows[0];
    if (!row) return { sent: false, skipped: true, reason: "merchant_order not found" };

    if (!row.whatsapp_notifications_enabled || !isValidE164(row.whatsapp_phone)) {
      // Merchant opted out, or hasn't configured a number — order creation
      // already succeeded independently of this; nothing to record. Still
      // logged (distinctly from a real send attempt) so "why didn't this
      // merchant get notified" is answerable from logs alone.
      console.log(
        `[whatsapp] NEW_ORDER merchantOrder=${merchantOrderId} status=skipped ` +
          `reason=${row.whatsapp_notifications_enabled ? "invalid_or_missing_number" : "not_opted_in"}`
      );
      return { sent: false, skipped: true, reason: "merchant has not opted in to WhatsApp notifications, or has no valid number configured" };
    }

    const destination = row.whatsapp_phone;

    // Claim the idempotency slot BEFORE ever calling the provider — a
    // duplicate-key error here means a notification for this exact
    // (merchant_order, channel, type) was already queued/sent, so this
    // call skips sending entirely rather than risk a second WhatsApp
    // message for a retried checkout.
    let notificationId;
    try {
      const [insertResult] = await db.execute(
        `INSERT INTO OUTBOUND_NOTIFICATIONS (merchant_id, merchant_order_id, channel, type, destination, status, attempts)
         VALUES (?, ?, 'WHATSAPP', 'NEW_ORDER', ?, 'PENDING', 1)`,
        [row.merchant_id, row.merchant_order_id, destination]
      );
      notificationId = insertResult.insertId;
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        console.log(`[whatsapp] NEW_ORDER merchantOrder=${merchantOrderId} status=skipped reason=already_queued_or_sent`);
        return { sent: false, skipped: true, reason: "notification already queued for this merchant order" };
      }
      throw err;
    }

    // Bank-transfer orders have a MERCHANT_ORDER_PAYMENTS row (joined above
    // via mop) whose amount is authoritative for that merchant's portion;
    // online orders don't (Stage 2 only creates that table for bank
    // transfer), so MERCHANT_ORDERS.SUBTOTAL is used instead — see the
    // Merchant Payments Stage 2 report for why SUBTOTAL, not
    // MERCHANT_NET_AMOUNT, is the customer-facing/merchant-facing amount.
    const isBankTransfer = row.payment_method === "BANK_TRANSFER";
    const amount = isBankTransfer ? row.bank_transfer_amount : row.merchant_order_subtotal;
    const orderUrl = `${String(process.env.CLIENT_URL || "").replace(/\/$/, "")}/merchant/orders/${row.merchant_order_id}`;

    // Order matters — must match WhatsAppService.sendNewOrderNotification's
    // documented contract for the `merchant_new_order` template:
    // Order: {{1}} / Items: {{2}} / Total: BND {{3}} / View the order: {{4}}
    // No merchant name, payment method, or payment status — the approved
    // template doesn't carry them, and no customer PII is included at all.
    const variables = [row.order_number, String(row.item_count), formatAmount(amount), orderUrl];

    const result = await whatsAppService.sendNewOrderNotification({ to: destination, variables });

    // Structured, safe log line for every real attempt — the ONLY thing
    // masked is the recipient number; provider/status/messageId/error are
    // all already-sanitized by this point (never a raw provider payload,
    // never a credential — see WhatsAppCloudProvider.sanitizeError and
    // MockWhatsAppProvider's own log line for the same posture). This is
    // what should be grepped for when a merchant reports a missing
    // WhatsApp message — it says definitively whether a send was even
    // attempted, which provider handled it, and what the outcome was.
    if (result.success) {
      console.log(
        `[whatsapp] NEW_ORDER merchantOrder=${merchantOrderId} recipient=${maskPhone(destination)} ` +
          `provider=${activeProviderId} status=accepted messageId=${result.providerMessageId || "(none)"}`
      );
      await db.execute(
        `UPDATE OUTBOUND_NOTIFICATIONS SET status = 'SENT', provider_message_id = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [result.providerMessageId || null, notificationId]
      );
      return { sent: true, notificationId };
    }

    console.log(
      `[whatsapp] NEW_ORDER merchantOrder=${merchantOrderId} recipient=${maskPhone(destination)} ` +
        `provider=${activeProviderId} status=failed providerError=${sanitizeForStorage(result.error || result.reason)}`
    );
    await db.execute(
      `UPDATE OUTBOUND_NOTIFICATIONS SET status = 'FAILED', last_error = ?, updated_at = NOW() WHERE id = ?`,
      [sanitizeForStorage(result.error || result.reason), notificationId]
    );
    return { sent: false, notificationId, error: result.error || result.reason };
  } catch (err) {
    console.error("[notifications] notifyNewOrder error:", err?.message || err);
    return { sent: false, error: "internal error" };
  }
}

// Fans out to every merchant on a customer order — one WhatsApp
// notification per MERCHANT_ORDER, each strictly scoped to that merchant's
// own items/amount (never another merchant's). Call once per successful
// checkout (online or bank-transfer), after commit.
export async function notifyNewOrderForOrder(db, orderId) {
  try {
    const [merchantOrders] = await db.query(`SELECT id FROM MERCHANT_ORDERS WHERE order_id = ?`, [orderId]);
    const results = [];
    for (const mo of merchantOrders) {
      results.push(await notifyNewOrder(db, mo.id));
    }
    return results;
  } catch (err) {
    console.error("[notifications] notifyNewOrderForOrder error:", err?.message || err);
    return [];
  }
}
