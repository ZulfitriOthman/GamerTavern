// Backend/routes/api/checkout.routes.js
//
// The only place a customer's cart turns into a real order.
//
// ---- Idempotency (Phase 1.5) ----
// Every request must carry an `Idempotency-Key` header (or `idempotencyKey`
// in the body). The (user_id, idempotency_key) pair is claimed with a
// single INSERT against the UNIQUE constraint on checkout_idempotency —
// whichever concurrent request wins that race proceeds; every other
// request (a genuine double-click, a client retry after a dropped
// response, or true concurrent duplicates) is answered from the stored
// result instead of re-running checkout. Reusing a key with a materially
// different request body is rejected outright (409) rather than silently
// processed. This is DB-backed, not in-memory, so it survives a server
// restart between the original attempt and a retry.
//
// ---- Transaction design ----
// TXN 1 "reserve": lock every cart line's product/variant row
// (SELECT ... FOR UPDATE), recompute every price from the database
// (never from the cart/client), recheck stock inside the lock, split into
// per-merchant merchant_orders with a commission snapshot, deduct
// inventory, write order_items — all committed as PENDING_PAYMENT/PENDING
// before any gateway call, so a slow/failed payment call never holds a
// row lock.
//
// PaymentService.charge(...) — outside any open transaction, using a
// `paymentToken` (never raw card data — see PaymentService.js).
//
// TXN 2 "settle": record the payment_transactions row and either mark the
// order PAID/PROCESSING (success, validated through the order state
// machine), or CANCELLED and *restore* the inventory TXN 1 deducted
// (failure). A crash between TXN 1 and TXN 2 leaves a real, inspectable
// PENDING_PAYMENT order — recovered later by
// Backend/services/payment/PaymentReconciliationService.js
// (see /api/admin/reconciliation), not silently lost.
import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../../modules/restAuth.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";
import { assertOrderTransition } from "../../modules/orderStateMachine.module.js";
import { encryptField, decryptField } from "../../modules/encryption.module.js";
import { fulfilmentTypeForShippingCode } from "../../modules/fulfilment.module.js";
import PaymentService from "../../services/payment/PaymentService.js";
import { notifyNewOrderForOrder } from "../../services/notifications/NotificationService.js";

const IDEMPOTENCY_TTL_HOURS = 24;

async function getPlatformCommissionPercent(db) {
  const [rows] = await db.query(`SELECT setting_value FROM PLATFORM_SETTINGS WHERE setting_key = 'platform_commission_percent' LIMIT 1`);
  return Number(rows?.[0]?.setting_value ?? 10);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function hashRequest(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const EXTENSION_TO_MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

// Derives the stored FILE_TYPE from the upload URL's own extension — never
// from a client-supplied "type" field. The extension itself came from our
// own /api/upload/delivery-reference endpoint's filename, which already
// passed multer's fileFilter at upload time.
function fileTypeForUploadUrl(url) {
  const match = /\.[a-zA-Z0-9]+$/.exec(url || "");
  return EXTENSION_TO_MIME[(match?.[0] || "").toLowerCase()] || "application/octet-stream";
}

export default function createCheckoutRoutes({ db }) {
  const router = Router();
  const paymentService = new PaymentService();

  // Runs the reserve phase only. Returns either a successful reservation
  // or a terminal { httpStatus, body } to persist and return as-is —
  // never calls res.* directly, so the outer handler can record the
  // outcome against the idempotency key regardless of which path is hit.
  async function reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl }) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [cartRows] = await conn.execute(`SELECT id FROM CARTS WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]);
      const cart = cartRows[0];
      if (!cart) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, code: "CART_EMPTY", message: "Your cart is empty." } };
      }

      const [cartItems] = await conn.execute(`SELECT id, product_id, variant_id, quantity FROM CART_ITEMS WHERE cart_id = ?`, [cart.id]);
      if (!cartItems.length) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, code: "CART_EMPTY", message: "Your cart is empty." } };
      }

      if (shippingAddressId) {
        const [addrRows] = await conn.execute(`SELECT id FROM CUSTOMER_ADDRESSES WHERE id = ? AND user_id = ? LIMIT 1`, [shippingAddressId, userId]);
        if (!addrRows[0]) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, message: "shippingAddressId does not belong to this account." } };
        }
      }
      if (billingAddressId) {
        const [addrRows] = await conn.execute(`SELECT id FROM CUSTOMER_ADDRESSES WHERE id = ? AND user_id = ? LIMIT 1`, [billingAddressId, userId]);
        if (!addrRows[0]) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, message: "billingAddressId does not belong to this account." } };
        }
      }

      const [methodRows] = await conn.execute(`SELECT id, code, base_fee FROM SHIPPING_METHODS WHERE id = ? AND status = 'active' LIMIT 1`, [shippingMethodId]);
      const shippingMethod = methodRows[0];
      if (!shippingMethod) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, message: "Invalid shipping method." } };
      }

      // Fulfilment is now a real, backend-enforced part of checkout — never
      // trust the frontend to only ever submit a valid combination. Delivery
      // requires a real saved address (which itself always carries a
      // recipient name and phone — see CUSTOMER_ADDRESSES); Pickup has no
      // address requirement (see fulfilmentTypeForShippingCode()).
      const fulfilmentType = fulfilmentTypeForShippingCode(shippingMethod.code);
      if (fulfilmentType === "DELIVERY" && !shippingAddressId) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, code: "DELIVERY_ADDRESS_REQUIRED", message: "A delivery address is required for this fulfilment method." } };
      }

      // Delivery-only fields — never stored for a Pickup order even if the
      // client sends them (defensive; the frontend also hides these fields
      // for Pickup, but this is the authoritative check).
      let sanitizedInstructions = null;
      let sanitizedAttachmentUrl = null;
      if (fulfilmentType === "DELIVERY") {
        const instructions = String(deliveryInstructions || "").trim();
        if (instructions.length > 500) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, message: "Delivery instructions must be 500 characters or fewer." } };
        }
        sanitizedInstructions = instructions || null;

        if (deliveryReferenceImageUrl) {
          // Must be a path our own upload endpoint produced — never an
          // arbitrary client-supplied URL (see /api/upload/delivery-reference
          // in server.js). Rejecting anything else closes off both SSRF-via-
          // stored-URL and "point this at someone else's image" mistakes.
          if (!/^\/public\/uploads\/delivery-references\/[a-zA-Z0-9._-]+$/.test(deliveryReferenceImageUrl)) {
            await conn.rollback();
            return { ok: false, httpStatus: 400, body: { success: false, message: "Invalid delivery reference photo." } };
          }
          sanitizedAttachmentUrl = deliveryReferenceImageUrl;
        }
      }

      // Lock every referenced product/variant row and recompute everything
      // from current database state — stock is rechecked here, inside the
      // lock, regardless of what the cart said a moment ago.
      const lines = [];
      let subtotal = 0;

      for (const item of cartItems) {
        const [productRows] = await conn.execute(
          `SELECT p.id, p.name, p.code, p.price, p.stock_quantity, p.status, p.merchant_id, m.status AS merchant_status
             FROM PRODUCTS p LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
            WHERE p.id = ? LIMIT 1 FOR UPDATE`,
          [item.product_id]
        );
        const product = productRows[0];
        if (!product || product.status === "archived") {
          await conn.rollback();
          return { ok: false, httpStatus: 409, body: { success: false, code: "PRODUCT_UNAVAILABLE", message: "A product in your cart is no longer available." } };
        }
        if (!product.merchant_id) {
          await conn.rollback();
          return {
            ok: false,
            httpStatus: 409,
            body: { success: false, code: "PRODUCT_NOT_SELLABLE", message: `"${product.name}" is not currently available for purchase (no merchant configured).` },
          };
        }
        // Re-checked here even though cart-add already blocks this — a merchant
        // can be suspended/banned in the time between adding to cart and
        // checking out, and the row lock above means this can't race an admin
        // action landing mid-checkout either.
        if (product.merchant_status !== "ACTIVE") {
          await conn.rollback();
          return {
            ok: false,
            httpStatus: 409,
            body: { success: false, code: "MERCHANT_NOT_ACTIVE", message: `"${product.name}" is not currently available for purchase.` },
          };
        }

        let variant = null;
        if (item.variant_id) {
          const [variantRows] = await conn.execute(
            `SELECT id, sku, price_override, stock_quantity, status FROM PRODUCT_VARIANTS WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE`,
            [item.variant_id, item.product_id]
          );
          variant = variantRows[0];
          if (!variant || variant.status !== "active") {
            await conn.rollback();
            return { ok: false, httpStatus: 409, body: { success: false, code: "PRODUCT_UNAVAILABLE", message: "A product variant in your cart is no longer available." } };
          }
        }

        const availableStock = variant ? variant.stock_quantity : product.stock_quantity;
        if (availableStock < item.quantity) {
          await conn.rollback();
          return {
            ok: false,
            httpStatus: 409,
            body: { success: false, code: "INSUFFICIENT_STOCK", message: `Requested quantity for "${product.name}" is no longer available (only ${availableStock} left).` },
          };
        }

        const unitPrice = Number(variant?.price_override ?? product.price);
        const lineTotal = round2(unitPrice * item.quantity);
        subtotal += lineTotal;

        lines.push({
          productId: product.id,
          variantId: variant?.id || null,
          merchantId: product.merchant_id,
          nameSnapshot: product.name,
          skuSnapshot: variant?.sku || product.code,
          unitPrice,
          quantity: item.quantity,
          lineTotal,
        });
      }
      subtotal = round2(subtotal);

      let couponId = null;
      let discountTotal = 0;
      if (couponCode) {
        const [couponRows] = await conn.execute(
          `SELECT id, code, description, discount_type, discount_value, min_subtotal, max_uses, max_uses_per_user,
                  starts_at, ends_at, status, created_at, updated_at
             FROM COUPONS WHERE code = ? AND status = 'active'
             AND (starts_at IS NULL OR starts_at <= NOW())
             AND (ends_at IS NULL OR ends_at >= NOW())
           LIMIT 1 FOR UPDATE`,
          [couponCode]
        );
        const coupon = couponRows[0];
        if (!coupon) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, code: "INVALID_COUPON", message: "This coupon code is not valid." } };
        }
        if (coupon.min_subtotal != null && subtotal < Number(coupon.min_subtotal)) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, code: "COUPON_MIN_SUBTOTAL", message: `This coupon requires a minimum order of ${coupon.min_subtotal}.` } };
        }
        if (coupon.max_uses != null) {
          const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM COUPON_USAGE WHERE coupon_id = ?`, [coupon.id]);
          if (count >= coupon.max_uses) {
            await conn.rollback();
            return { ok: false, httpStatus: 400, body: { success: false, code: "COUPON_EXHAUSTED", message: "This coupon has reached its usage limit." } };
          }
        }
        if (coupon.max_uses_per_user != null) {
          const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM COUPON_USAGE WHERE coupon_id = ? AND user_id = ?`, [coupon.id, userId]);
          if (count >= coupon.max_uses_per_user) {
            await conn.rollback();
            return { ok: false, httpStatus: 400, body: { success: false, code: "COUPON_ALREADY_USED", message: "You have already used this coupon." } };
          }
        }

        couponId = coupon.id;
        discountTotal = coupon.discount_type === "percent" ? round2(subtotal * (Number(coupon.discount_value) / 100)) : round2(Number(coupon.discount_value));
        discountTotal = Math.min(discountTotal, subtotal);
      }

      const shippingTotal = round2(Number(shippingMethod.base_fee));
      const grand = round2(subtotal - discountTotal + shippingTotal);

      const tempOrderNumber = `TMP-${crypto.randomUUID()}`;
      const [orderResult] = await conn.execute(
        `INSERT INTO ORDERS
           (order_number, user_id, shipping_address_id, billing_address_id, shipping_method_id, coupon_id, delivery_instructions,
            subtotal, discount_total, shipping_total, grand_total, currency, payment_status, status, placed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BND', 'PENDING', 'PENDING_PAYMENT', NOW())`,
        [
          tempOrderNumber,
          userId,
          shippingAddressId || null,
          billingAddressId || shippingAddressId || null,
          shippingMethodId,
          couponId,
          sanitizedInstructions,
          subtotal,
          discountTotal,
          shippingTotal,
          grand,
        ]
      );
      const orderId = orderResult.insertId;
      const orderNumber = `NC${String(orderId).padStart(5, "0")}`;
      await conn.execute(`UPDATE ORDERS SET order_number = ? WHERE id = ?`, [orderNumber, orderId]);

      if (sanitizedAttachmentUrl) {
        await conn.execute(`INSERT INTO ORDER_DELIVERY_ATTACHMENTS (order_id, file_url, file_type) VALUES (?, ?, ?)`, [
          orderId,
          sanitizedAttachmentUrl,
          fileTypeForUploadUrl(sanitizedAttachmentUrl),
        ]);
      }

      const platformCommissionPercent = await getPlatformCommissionPercent(db);
      const byMerchant = new Map();
      for (const line of lines) {
        if (!byMerchant.has(line.merchantId)) byMerchant.set(line.merchantId, []);
        byMerchant.get(line.merchantId).push(line);
      }

      for (const [merchantId, merchantLines] of byMerchant.entries()) {
        const [[merchantRow]] = await conn.query(`SELECT commission_percent FROM MERCHANTS WHERE id = ? FOR UPDATE`, [merchantId]);
        const commissionPercent = Number(merchantRow?.commission_percent ?? platformCommissionPercent);
        const merchantSubtotal = round2(merchantLines.reduce((sum, l) => sum + l.lineTotal, 0));
        const commissionAmount = round2(merchantSubtotal * (commissionPercent / 100));
        const merchantNetAmount = round2(merchantSubtotal - commissionAmount);

        const tempMerchantOrderNumber = `TMP-${crypto.randomUUID()}`;
        const [moResult] = await conn.execute(
          `INSERT INTO MERCHANT_ORDERS
             (merchant_order_number, order_id, merchant_id, subtotal, commission_percent, commission_amount, merchant_net_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSING')`,
          [tempMerchantOrderNumber, orderId, merchantId, merchantSubtotal, commissionPercent, commissionAmount, merchantNetAmount]
        );
        const merchantOrderId = moResult.insertId;
        const merchantOrderNumber = `MO${String(merchantOrderId).padStart(6, "0")}`;
        await conn.execute(`UPDATE MERCHANT_ORDERS SET merchant_order_number = ? WHERE id = ?`, [merchantOrderNumber, merchantOrderId]);

        for (const line of merchantLines) {
          await conn.execute(
            `INSERT INTO ORDER_ITEMS
               (order_id, merchant_order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, merchantOrderId, line.productId, line.variantId, line.nameSnapshot, line.skuSnapshot, line.unitPrice, line.quantity, line.lineTotal]
          );

          if (line.variantId) {
            await conn.execute(`UPDATE PRODUCT_VARIANTS SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?`, [line.quantity, line.variantId]);
            await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, variant_id, delta, reason) VALUES (?, ?, ?, 'sale')`, [line.productId, line.variantId, -line.quantity]);
          } else {
            await conn.execute(`UPDATE PRODUCTS SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?`, [line.quantity, line.productId]);
            await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, delta, reason) VALUES (?, ?, 'sale')`, [line.productId, -line.quantity]);
          }
        }
      }

      if (couponId) {
        await conn.execute(`INSERT INTO COUPON_USAGE (coupon_id, user_id, order_id) VALUES (?, ?, ?)`, [couponId, userId, orderId]);
      }

      await conn.execute(
        `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, note)
         VALUES (?, NULL, 'PENDING_PAYMENT', 'system', 'Order created, inventory reserved, awaiting payment.')`,
        [orderId]
      );

      await conn.commit();
      return { ok: true, orderId, orderNumber, grandTotal: grand, cartId: cart.id };
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[checkout] reserve phase error:", err);
      return { ok: false, httpStatus: 500, body: { success: false, message: "Failed to create order." } };
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  }

  async function settleOrder({ orderId, orderNumber, cartId, grandTotal, paymentResult }) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO PAYMENT_TRANSACTIONS (order_id, provider, provider_transaction_id, amount, currency, status, raw_response)
         VALUES (?, ?, ?, ?, 'BND', ?, ?)`,
        [orderId, paymentResult.provider, paymentResult.transactionId || null, grandTotal, paymentResult.status || "FAILED", JSON.stringify(paymentResult.rawResponse || {})]
      );

      if (paymentResult.success) {
        assertOrderTransition("PENDING_PAYMENT", "PAID");
        await conn.execute(`UPDATE ORDERS SET payment_status = 'PAID', status = 'PROCESSING', updated_at = NOW() WHERE id = ?`, [orderId]);
        await conn.execute(`UPDATE CARTS SET status = 'converted', updated_at = NOW() WHERE id = ?`, [cartId]);
        // Purchased items already live in ORDER_ITEMS (copied during the
        // reserve phase above) — clear CART_ITEMS so a later reactivation
        // of this same CARTS row (UQ_CARTS_USER allows only one per
        // registered user, ever — see cart.routes.js's resolveCart) starts
        // empty instead of re-showing already-purchased items.
        await conn.execute(`DELETE FROM CART_ITEMS WHERE cart_id = ?`, [cartId]);
        await conn.execute(
          `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, note)
           VALUES (?, 'PENDING_PAYMENT', 'PROCESSING', 'system', 'Payment captured.')`,
          [orderId]
        );
      } else {
        assertOrderTransition("PENDING_PAYMENT", "CANCELLED");
        await conn.execute(`UPDATE ORDERS SET payment_status = 'FAILED', status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [orderId]);
        await conn.execute(`UPDATE MERCHANT_ORDERS SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`, [orderId]);
        await conn.execute(
          `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, note)
           VALUES (?, 'PENDING_PAYMENT', 'CANCELLED', 'system', ?)`,
          [orderId, `Payment failed: ${paymentResult.message || paymentResult.status}. Inventory restored.`]
        );

        const [items] = await conn.execute(`SELECT product_id, variant_id, quantity FROM ORDER_ITEMS WHERE order_id = ?`, [orderId]);
        for (const item of items) {
          if (item.variant_id) {
            await conn.execute(`UPDATE PRODUCT_VARIANTS SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.variant_id]);
            await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, variant_id, delta, reason) VALUES (?, ?, ?, 'cancelled_order')`, [item.product_id, item.variant_id, item.quantity]);
          } else {
            await conn.execute(`UPDATE PRODUCTS SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.product_id]);
            await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, delta, reason) VALUES (?, ?, 'cancelled_order')`, [item.product_id, item.quantity]);
          }
        }
        // Cart is intentionally left 'active' so the customer can retry checkout (with a NEW idempotency key) without re-adding items.
      }

      await conn.commit();
      return { ok: true };
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[checkout] settle phase error:", err);
      return {
        ok: false,
        httpStatus: 500,
        body: { success: false, code: "SETTLE_FAILED", message: "Payment was attempted but recording the result failed. This order needs manual review.", orderNumber },
      };
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  }

  // Bank Transfer checkout (Merchant Payments Stage 2) — additive path, does
  // NOT call PaymentService.charge() and never touches PAYMENT_TRANSACTIONS
  // (that table's PROVIDER vocabulary is 'mock_cybersource'/'cybersource'
  // only — bank transfer is tracked entirely through MERCHANT_ORDER_PAYMENTS
  // instead). Runs after reserveOrder() has already committed, in its own
  // transaction — re-verifies BANK_TRANSFER eligibility for every merchant
  // under a fresh lock (closing the TOCTOU window since the frontend's own
  // eligibility check), and on failure cancels the just-created order and
  // restores inventory, mirroring settleOrder()'s PAYMENT_FAILED branch.
  //
  // AMOUNT clarification (see the Merchant Payments Stage 2 report): each
  // merchant's bank-transfer amount is that merchant's SUBTOTAL (what the
  // customer owes for their items), never MERCHANT_NET_AMOUNT (which already
  // subtracts platform commission — commission is a platform/merchant
  // settlement concern, not something that reduces what the customer pays).
  // ORDERS.DISCOUNT_TOTAL is allocated proportionally across merchants by
  // subtotal share, with the last merchant absorbing the rounding remainder,
  // so sum(amounts) == ORDERS.subtotal - ORDERS.discount_total exactly.
  // ORDERS.SHIPPING_TOTAL is NOT attributed to any merchant's bank-transfer
  // amount — shipping fee collection for bank-transfer orders is a known,
  // documented open item (see the Stage 2 report), not silently mishandled.
  // Shared by every "this order turned out to be ineligible after
  // reservation" path (bank-transfer eligibility, online-payment
  // eligibility): cancels the order/merchant-orders and restores the
  // inventory reserveOrder() deducted. Caller owns the transaction (conn)
  // and must still commit/rollback/release it.
  async function cancelReservedOrder(conn, orderId, note) {
    await conn.execute(`UPDATE ORDERS SET status = 'CANCELLED', payment_status = 'FAILED', updated_at = NOW() WHERE id = ?`, [orderId]);
    await conn.execute(`UPDATE MERCHANT_ORDERS SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`, [orderId]);
    await conn.execute(
      `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, note)
       VALUES (?, 'PENDING_PAYMENT', 'CANCELLED', 'system', ?)`,
      [orderId, note]
    );
    const [items] = await conn.execute(`SELECT product_id, variant_id, quantity FROM ORDER_ITEMS WHERE order_id = ?`, [orderId]);
    for (const item of items) {
      if (item.variant_id) {
        await conn.execute(`UPDATE PRODUCT_VARIANTS SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.variant_id]);
        await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, variant_id, delta, reason) VALUES (?, ?, ?, 'cancelled_order')`, [item.product_id, item.variant_id, item.quantity]);
      } else {
        await conn.execute(`UPDATE PRODUCTS SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.product_id]);
        await conn.execute(`INSERT INTO INVENTORY_MOVEMENTS (product_id, delta, reason) VALUES (?, ?, 'cancelled_order')`, [item.product_id, item.quantity]);
      }
    }
  }

  // Settles any OFFLINE payment method (BANK_TRANSFER, PAY_ON_DELIVERY,
  // PAY_ON_PICKUP) — none of these call PaymentService.charge() or touch
  // PAYMENT_TRANSACTIONS (that table's PROVIDER vocabulary is
  // 'mock_cybersource'/'cybersource' only). Runs after reserveOrder() has
  // already committed, in its own transaction — re-verifies eligibility for
  // every merchant under a fresh lock (closing the TOCTOU window since the
  // frontend's own eligibility check), and on failure cancels the
  // just-created order and restores inventory, mirroring settleOrder()'s
  // PAYMENT_FAILED branch.
  //
  // AMOUNT clarification (see the Merchant Payments Stage 2 report): each
  // merchant's amount is that merchant's SUBTOTAL (what the customer owes
  // for their items), never MERCHANT_NET_AMOUNT (which already subtracts
  // platform commission — commission is a platform/merchant settlement
  // concern, not something that reduces what the customer pays).
  // ORDERS.DISCOUNT_TOTAL is allocated proportionally across merchants by
  // subtotal share, with the last merchant absorbing the rounding
  // remainder, so sum(amounts) == ORDERS.subtotal - ORDERS.discount_total
  // exactly. ORDERS.SHIPPING_TOTAL is NOT attributed to any merchant's
  // amount — shipping fee collection is a known, documented open item, not
  // silently mishandled.
  async function settleOfflineOrder({ orderId, orderNumber, cartId, paymentMethod }) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [merchantOrders] = await conn.query(
        `SELECT id, merchant_id, subtotal FROM MERCHANT_ORDERS WHERE order_id = ? ORDER BY id ASC FOR UPDATE`,
        [orderId]
      );
      const [[orderRow]] = await conn.query(`SELECT subtotal, discount_total FROM ORDERS WHERE id = ?`, [orderId]);
      const orderSubtotal = Number(orderRow.subtotal);
      const discountTotal = Number(orderRow.discount_total);

      // Re-verify eligibility for every merchant under lock. Any failure
      // cancels the whole order — never a partial offline-payment setup.
      // BANK_TRANSFER additionally requires a bank account on file;
      // PAY_ON_DELIVERY/PAY_ON_PICKUP need only the method itself enabled —
      // no bank account, card, or gateway credential involved.
      const bankByMerchant = new Map();
      for (const mo of merchantOrders) {
        const [[method]] = await conn.query(
          `SELECT enabled FROM MERCHANT_PAYMENT_METHODS WHERE merchant_id = ? AND method = ?`,
          [mo.merchant_id, paymentMethod]
        );
        if (!method?.enabled) {
          await cancelReservedOrder(conn, orderId, `${paymentMethod} unavailable: merchant ${mo.merchant_id} no longer supports it. Inventory restored.`);
          await conn.commit();
          return { ok: false, code: "MERCHANT_NOT_PAYMENT_ELIGIBLE" };
        }

        if (paymentMethod === "BANK_TRANSFER") {
          const [bankRows] = await conn.query(
            `SELECT id, bank_name, bank_other_label, display_name, account_name,
                    account_number_ciphertext, account_number_iv, account_number_auth_tag, account_number_last4
               FROM MERCHANT_BANK_DETAILS WHERE merchant_id = ? ORDER BY is_default DESC, created_at ASC LIMIT 1`,
            [mo.merchant_id]
          );
          const bank = bankRows[0];
          if (!bank) {
            await cancelReservedOrder(conn, orderId, `Bank transfer unavailable: merchant ${mo.merchant_id} has no bank account on file. Inventory restored.`);
            await conn.commit();
            return { ok: false, code: "MERCHANT_NOT_BANK_TRANSFER_ELIGIBLE" };
          }
          bankByMerchant.set(mo.id, bank);
        }
      }

      // Proportional discount allocation, last merchant absorbs the remainder.
      let allocatedDiscount = 0;
      for (let i = 0; i < merchantOrders.length; i++) {
        const mo = merchantOrders[i];
        const isLast = i === merchantOrders.length - 1;
        const discountShare = isLast
          ? round2(discountTotal - allocatedDiscount)
          : orderSubtotal > 0
          ? round2(discountTotal * (Number(mo.subtotal) / orderSubtotal))
          : 0;
        if (!isLast) allocatedDiscount = round2(allocatedDiscount + discountShare);
        const amount = round2(Number(mo.subtotal) - discountShare);
        const reference = `${orderNumber}-M${String(i + 1).padStart(2, "0")}`;

        if (paymentMethod === "BANK_TRANSFER") {
          const bank = bankByMerchant.get(mo.id);
          const plaintextAccountNumber = decryptField({
            ciphertext: bank.account_number_ciphertext,
            iv: bank.account_number_iv,
            authTag: bank.account_number_auth_tag,
          });
          // Re-encrypted with a FRESH IV/auth tag for the snapshot — never
          // copy the source row's ciphertext/IV pair directly (see the
          // Stage 2 report's snapshot-design section).
          const snapshot = encryptField(plaintextAccountNumber);

          await conn.execute(
            `INSERT INTO MERCHANT_ORDER_PAYMENTS
               (merchant_order_id, payment_method, status, amount, currency, bank_detail_id,
                snapshot_bank_name, snapshot_bank_other_label, snapshot_display_name, snapshot_account_name,
                snapshot_account_number_ciphertext, snapshot_account_number_iv, snapshot_account_number_auth_tag, snapshot_account_number_last4,
                reference)
             VALUES (?, 'BANK_TRANSFER', 'AWAITING_TRANSFER', ?, 'BND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              mo.id,
              amount,
              bank.id,
              bank.bank_name,
              bank.bank_other_label,
              bank.display_name,
              bank.account_name,
              snapshot.ciphertext,
              snapshot.iv,
              snapshot.authTag,
              bank.account_number_last4,
              reference,
            ]
          );
        } else {
          // PAY_ON_DELIVERY / PAY_ON_PICKUP — no bank snapshot, created
          // straight into PENDING (see MERCHANT_ORDER_PAYMENT_TRANSITIONS:
          // PENDING -> PAID is a direct, valid transition for these two).
          await conn.execute(
            `INSERT INTO MERCHANT_ORDER_PAYMENTS (merchant_order_id, payment_method, status, amount, currency, reference)
             VALUES (?, ?, 'PENDING', ?, 'BND', ?)`,
            [mo.id, paymentMethod, amount, reference]
          );
        }
      }

      await conn.execute(
        `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, note)
         VALUES (?, 'PENDING_PAYMENT', 'PENDING_PAYMENT', 'system', ?)`,
        [orderId, `${paymentMethod} selected — awaiting confirmation for ${merchantOrders.length} merchant order(s).`]
      );

      // Same as settleOrder()'s success branch: the cart converted into this
      // order, so its items must not still appear as an active cart —
      // otherwise the customer could re-checkout the same items again.
      await conn.execute(`UPDATE CARTS SET status = 'converted', updated_at = NOW() WHERE id = ?`, [cartId]);
      await conn.execute(`DELETE FROM CART_ITEMS WHERE cart_id = ?`, [cartId]);

      await conn.commit();
      return { ok: true };
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[checkout] offline settle error:", err);
      return { ok: false, httpStatus: 500, code: "SETTLE_FAILED" };
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  }

  // Re-verifies, under a fresh row lock, that every merchant on this order
  // still has ONLINE_PAYMENT enabled — closes the same TOCTOU window the
  // bank-transfer path already closes. On failure cancels the order and
  // restores inventory, and the caller must NOT call PaymentService.charge()
  // (never charge a card for an order that's being cancelled). Reminder:
  // ONLINE_PAYMENT enabled only ever means "this merchant permits the
  // existing platform-level online checkout" — it is not merchant-specific
  // gateway routing (see CLAUDE.md §62 "Merchant Payments").
  async function verifyOnlinePaymentEligible({ orderId }) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [merchantOrders] = await conn.query(`SELECT id, merchant_id FROM MERCHANT_ORDERS WHERE order_id = ? FOR UPDATE`, [orderId]);
      for (const mo of merchantOrders) {
        const [[method]] = await conn.query(
          `SELECT enabled FROM MERCHANT_PAYMENT_METHODS WHERE merchant_id = ? AND method = 'ONLINE_PAYMENT'`,
          [mo.merchant_id]
        );
        if (!method?.enabled) {
          await cancelReservedOrder(conn, orderId, `Online payment unavailable: merchant ${mo.merchant_id} does not accept it. Inventory restored.`);
          await conn.commit();
          return { ok: false, code: "MERCHANT_NOT_ONLINE_PAYMENT_ELIGIBLE" };
        }
      }

      await conn.commit();
      return { ok: true };
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[checkout] online-payment eligibility error:", err);
      return { ok: false, httpStatus: 500, code: "SETTLE_FAILED" };
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  }

  // Resolves the cart's distinct merchant IDs, or null if the cart is empty
  // / has nothing sellable. Shared by /eligibility and /fulfilment-methods so
  // both compute the intersection over exactly the same merchant set.
  async function resolveCartMerchantIds(userId) {
    const [cartRows] = await db.query(`SELECT id FROM CARTS WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]);
    const cart = cartRows[0];
    if (!cart) return null;
    const [merchantRows] = await db.query(
      `SELECT DISTINCT p.merchant_id FROM CART_ITEMS ci JOIN PRODUCTS p ON p.id = ci.product_id WHERE ci.cart_id = ? AND p.merchant_id IS NOT NULL`,
      [cart.id]
    );
    const merchantIds = merchantRows.map((r) => r.merchant_id);
    return merchantIds.length ? merchantIds : null;
  }

  // Server-side fulfilment-method eligibility for the current cart — same
  // "every merchant must enable it" intersection rule as payment eligibility
  // below, applied to MERCHANT_FULFILMENT_METHODS instead. A fulfilment type
  // (Delivery/Pickup) is offered only if every merchant in the cart supports
  // it; Nanashi is multi-merchant, so one merchant not offering delivery
  // must not silently disappear behind another merchant's availability.
  router.get("/fulfilment-methods", requireAuth, async (req, res) => {
    try {
      const merchantIds = await resolveCartMerchantIds(req.user.sub);

      const [shippingRows] = await db.query(`SELECT id, name, code, description, base_fee FROM SHIPPING_METHODS WHERE status = 'active' ORDER BY base_fee ASC`);

      if (!merchantIds) {
        return res.json({
          success: true,
          data: { methods: shippingRows.map((m) => ({ ...toShippingMethodView(m), available: false, reason: "Your cart is empty." })) },
        });
      }

      const [fulfilmentRows] = await db.query(
        `SELECT merchant_id, method, enabled FROM MERCHANT_FULFILMENT_METHODS WHERE merchant_id IN (${merchantIds.map(() => "?").join(",")})`,
        merchantIds
      );
      const enabledByMerchantMethod = new Map(fulfilmentRows.map((r) => [`${r.merchant_id}:${r.method}`, Boolean(r.enabled)]));
      const typeAvailable = (type) => merchantIds.every((id) => enabledByMerchantMethod.get(`${id}:${type}`));

      const availableByType = { DELIVERY: typeAvailable("DELIVERY"), PICKUP: typeAvailable("PICKUP") };
      const reason = "One or more merchants in your cart do not offer this fulfilment method.";

      const methods = shippingRows.map((m) => {
        const type = fulfilmentTypeForShippingCode(m.code);
        return { ...toShippingMethodView(m), fulfilmentType: type, available: Boolean(availableByType[type]), reason: availableByType[type] ? undefined : reason };
      });

      const data = { methods };
      if (!methods.some((m) => m.available)) {
        data.message =
          merchantIds.length > 1
            ? "The merchants in your cart do not share a common fulfilment method. Please check out these items separately."
            : "This merchant currently has no fulfilment method available. Please contact support.";
      }

      return res.json({ success: true, data });
    } catch (err) {
      console.error("[checkout/fulfilment-methods] error:", err);
      return res.status(500).json({ success: false, message: "Failed to determine fulfilment method eligibility." });
    }
  });

  // snake_case base_fee to match the existing GET /api/shipping/methods
  // contract (CheckoutPage.jsx already reads m.base_fee) — the rest of this
  // endpoint's payload is new, so there's no existing consumer to match for
  // those fields.
  function toShippingMethodView(row) {
    return { id: row.id, name: row.name, code: row.code, description: row.description, base_fee: row.base_fee };
  }

  // Server-side payment-method eligibility for the current cart (point 9).
  // The rule, for every method: available only if every merchant
  // represented in the cart explicitly enables it (missing
  // MERCHANT_PAYMENT_METHODS row = disabled, fail closed — never a default-
  // enabled fallback). Bank Transfer additionally requires at least one
  // bank account on file. PAY_ON_DELIVERY/PAY_ON_PICKUP are additionally
  // gated by fulfilment type — passing `shippingMethodId` resolves which of
  // the two even applies; without it, neither is offered (there's no
  // fulfilment choice yet to gate on). Checkout offers only the
  // intersection; if nothing clears every merchant, checkout is blocked
  // with a clear message rather than silently falling back to any method.
  router.get("/eligibility", requireAuth, async (req, res) => {
    const unavailableAll = (reason) =>
      res.json({
        success: true,
        data: {
          paymentMethods: {
            bankTransfer: { available: false, reason },
            onlinePayment: { available: false, reason },
            payOnDelivery: { available: false, reason },
            payOnPickup: { available: false, reason },
          },
          message: reason,
        },
      });

    try {
      const userId = req.user.sub;
      const merchantIds = await resolveCartMerchantIds(userId);
      if (!merchantIds) return unavailableAll("Your cart is empty or has no items available for purchase.");

      let fulfilmentType = null;
      const shippingMethodId = req.query.shippingMethodId ? Number(req.query.shippingMethodId) : null;
      if (shippingMethodId) {
        const [[shippingMethod]] = await db.query(`SELECT code FROM SHIPPING_METHODS WHERE id = ? AND status = 'active' LIMIT 1`, [shippingMethodId]);
        if (shippingMethod) fulfilmentType = fulfilmentTypeForShippingCode(shippingMethod.code);
      }

      const [rows] = await db.query(
        `SELECT m.id AS merchant_id,
                COALESCE(bt.enabled, 0) AS bank_transfer_enabled,
                COALESCE(op.enabled, 0) AS online_payment_enabled,
                COALESCE(pod.enabled, 0) AS pay_on_delivery_enabled,
                COALESCE(pop.enabled, 0) AS pay_on_pickup_enabled,
                (SELECT COUNT(*) FROM MERCHANT_BANK_DETAILS b WHERE b.merchant_id = m.id) AS bank_account_count
           FROM MERCHANTS m
           LEFT JOIN MERCHANT_PAYMENT_METHODS bt ON bt.merchant_id = m.id AND bt.method = 'BANK_TRANSFER'
           LEFT JOIN MERCHANT_PAYMENT_METHODS op ON op.merchant_id = m.id AND op.method = 'ONLINE_PAYMENT'
           LEFT JOIN MERCHANT_PAYMENT_METHODS pod ON pod.merchant_id = m.id AND pod.method = 'PAY_ON_DELIVERY'
           LEFT JOIN MERCHANT_PAYMENT_METHODS pop ON pop.merchant_id = m.id AND pop.method = 'PAY_ON_PICKUP'
          WHERE m.id IN (${merchantIds.map(() => "?").join(",")})`,
        merchantIds
      );

      const bankTransferAvailable = rows.every((r) => Boolean(r.bank_transfer_enabled) && Number(r.bank_account_count) > 0);
      const onlinePaymentAvailable = rows.every((r) => Boolean(r.online_payment_enabled));
      const payOnDeliveryAvailable = fulfilmentType === "DELIVERY" && rows.every((r) => Boolean(r.pay_on_delivery_enabled));
      const payOnPickupAvailable = fulfilmentType === "PICKUP" && rows.every((r) => Boolean(r.pay_on_pickup_enabled));

      const data = {
        paymentMethods: {
          bankTransfer: bankTransferAvailable
            ? { available: true }
            : { available: false, reason: "One or more merchants in your cart do not accept bank transfer, or have not configured a bank account." },
          onlinePayment: onlinePaymentAvailable
            ? { available: true }
            : { available: false, reason: "One or more merchants in your cart do not accept online payment." },
          payOnDelivery: payOnDeliveryAvailable
            ? { available: true }
            : {
                available: false,
                reason: fulfilmentType !== "DELIVERY" ? "Only available when Delivery is selected." : "One or more merchants in your cart do not accept Pay on Delivery.",
              },
          payOnPickup: payOnPickupAvailable
            ? { available: true }
            : {
                available: false,
                reason: fulfilmentType !== "PICKUP" ? "Only available when Pickup is selected." : "One or more merchants in your cart do not accept Pay on Pickup.",
              },
        },
      };

      if (!bankTransferAvailable && !onlinePaymentAvailable && !payOnDeliveryAvailable && !payOnPickupAvailable) {
        data.message =
          merchantIds.length > 1
            ? "The merchants in your cart do not share a common payment method. Please check out these items separately."
            : "This merchant currently has no payment method available. Please contact support.";
      }

      return res.json({ success: true, data });
    } catch (err) {
      console.error("[checkout/eligibility] error:", err);
      return res.status(500).json({ success: false, message: "Failed to determine payment method eligibility." });
    }
  });

  router.post("/bank-transfer", requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const { shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl } = req.body || {};

    const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "An Idempotency-Key header (or idempotencyKey field) is required for checkout." });
    }
    if (!shippingMethodId) {
      return res.status(400).json({ success: false, message: "shippingMethodId is required." });
    }

    const requestHash = hashRequest({
      method: "bank_transfer",
      shippingAddressId,
      billingAddressId,
      shippingMethodId,
      couponCode,
      deliveryInstructions,
      deliveryReferenceImageUrl,
    });

    let claimed = false;
    try {
      await db.execute(
        `INSERT INTO CHECKOUT_IDEMPOTENCY (user_id, idempotency_key, request_hash, status, expires_at)
         VALUES (?, ?, ?, 'PROCESSING', DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [userId, idempotencyKey, requestHash, IDEMPOTENCY_TTL_HOURS]
      );
      claimed = true;
    } catch (err) {
      if (err?.code !== "ER_DUP_ENTRY") {
        console.error("[checkout/bank-transfer] idempotency claim error:", err);
        return res.status(500).json({ success: false, message: "Checkout failed to start." });
      }
    }

    if (!claimed) {
      const [rows] = await db.query(
        `SELECT id, user_id, idempotency_key, request_hash, status, order_id, response_json, created_at, expires_at
           FROM CHECKOUT_IDEMPOTENCY WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
        [userId, idempotencyKey]
      );
      const existing = rows[0];
      if (!existing) {
        return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "Please retry shortly." });
      }
      if (existing.request_hash !== requestHash) {
        return res.status(409).json({ success: false, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different request." });
      }
      if (existing.status === "PROCESSING") {
        return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "A checkout with this idempotency key is already being processed. Please retry shortly." });
      }
      const replay = JSON.parse(existing.response_json || "{}");
      return res.status(replay.httpStatus || 500).json(replay.body || { success: false, message: "Stored checkout result was unreadable." });
    }

    async function finish(httpStatus, body, status) {
      try {
        await db.execute(
          `UPDATE CHECKOUT_IDEMPOTENCY SET status = ?, order_id = ?, response_json = ? WHERE user_id = ? AND idempotency_key = ?`,
          [status, body?.data?.orderId || null, JSON.stringify({ httpStatus, body }), userId, idempotencyKey]
        );
      } catch (err) {
        console.error("[checkout/bank-transfer] failed to persist idempotency result:", err);
      }
      return res.status(httpStatus).json(body);
    }

    const reservation = await reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl });
    if (!reservation.ok) {
      return finish(reservation.httpStatus, reservation.body, "FAILED");
    }

    const { orderId, orderNumber, cartId } = reservation;
    await writeAuditLog(db, { actorUserId: userId, action: "ORDER_CREATED", entityType: "order", entityId: orderId, metadata: { orderNumber, method: "bank_transfer" } });

    const settled = await settleOfflineOrder({ orderId, orderNumber, cartId, paymentMethod: "BANK_TRANSFER" });
    if (!settled.ok) {
      await writeAuditLog(db, { actorUserId: userId, action: "BANK_TRANSFER_INELIGIBLE", entityType: "order", entityId: orderId, metadata: { orderNumber } });
      if (settled.httpStatus === 500) {
        return finish(500, { success: false, code: "SETTLE_FAILED", message: "Bank transfer setup failed. This order needs manual review.", orderNumber }, "FAILED");
      }
      return finish(
        409,
        { success: false, code: settled.code, message: "One or more merchants in your cart no longer support bank transfer. Your order was cancelled — please review your cart.", orderNumber },
        "FAILED"
      );
    }

    await writeAuditLog(db, { actorUserId: userId, action: "BANK_TRANSFER_AWAITING_PAYMENT", entityType: "order", entityId: orderId, metadata: { orderNumber } });

    // After commit only — a WhatsApp failure must never affect this
    // already-successful order. notifyNewOrderForOrder() never throws.
    await notifyNewOrderForOrder(db, orderId);

    return finish(
      201,
      { success: true, data: { orderId, orderNumber, paymentStatus: "PENDING", status: "PENDING_PAYMENT", paymentMethod: "BANK_TRANSFER" } },
      "COMPLETED"
    );
  });

  // Pay on Delivery / Pay on Pickup (offline payment methods, gated by
  // fulfilment type — see Backend/modules/fulfilment.module.js). Structurally
  // identical to /bank-transfer above (idempotency, reserve, settle) — the
  // one addition is validating that the chosen shippingMethodId's fulfilment
  // type actually matches this route before reserving anything, closing the
  // "Pay on Pickup selected under a Delivery shipping method" mistake at the
  // server, never trusting the client to only ever send valid combinations.
  function createOfflineFulfilmentGatedRoute(path, paymentMethod, requiredFulfilmentType, auditPrefix) {
    router.post(path, requireAuth, async (req, res) => {
      const userId = req.user.sub;
      const { shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl } = req.body || {};

      const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
      if (!idempotencyKey || typeof idempotencyKey !== "string") {
        return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "An Idempotency-Key header (or idempotencyKey field) is required for checkout." });
      }
      if (!shippingMethodId) {
        return res.status(400).json({ success: false, message: "shippingMethodId is required." });
      }

      const [[shippingMethod]] = await db.query(`SELECT code FROM SHIPPING_METHODS WHERE id = ? AND status = 'active' LIMIT 1`, [shippingMethodId]);
      if (!shippingMethod) {
        return res.status(400).json({ success: false, message: "Invalid shipping method." });
      }
      if (fulfilmentTypeForShippingCode(shippingMethod.code) !== requiredFulfilmentType) {
        return res.status(400).json({
          success: false,
          code: "FULFILMENT_PAYMENT_MISMATCH",
          message: `${paymentMethod === "PAY_ON_DELIVERY" ? "Pay on Delivery" : "Pay on Pickup"} is only available with ${requiredFulfilmentType === "DELIVERY" ? "a delivery" : "a pickup"} fulfilment method.`,
        });
      }

      const requestHash = hashRequest({
        method: paymentMethod,
        shippingAddressId,
        billingAddressId,
        shippingMethodId,
        couponCode,
        deliveryInstructions,
        deliveryReferenceImageUrl,
      });

      let claimed = false;
      try {
        await db.execute(
          `INSERT INTO CHECKOUT_IDEMPOTENCY (user_id, idempotency_key, request_hash, status, expires_at)
           VALUES (?, ?, ?, 'PROCESSING', DATE_ADD(NOW(), INTERVAL ? HOUR))`,
          [userId, idempotencyKey, requestHash, IDEMPOTENCY_TTL_HOURS]
        );
        claimed = true;
      } catch (err) {
        if (err?.code !== "ER_DUP_ENTRY") {
          console.error(`[checkout${path}] idempotency claim error:`, err);
          return res.status(500).json({ success: false, message: "Checkout failed to start." });
        }
      }

      if (!claimed) {
        const [rows] = await db.query(
          `SELECT id, user_id, idempotency_key, request_hash, status, order_id, response_json, created_at, expires_at
             FROM CHECKOUT_IDEMPOTENCY WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
          [userId, idempotencyKey]
        );
        const existing = rows[0];
        if (!existing) {
          return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "Please retry shortly." });
        }
        if (existing.request_hash !== requestHash) {
          return res.status(409).json({ success: false, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different request." });
        }
        if (existing.status === "PROCESSING") {
          return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "A checkout with this idempotency key is already being processed. Please retry shortly." });
        }
        const replay = JSON.parse(existing.response_json || "{}");
        return res.status(replay.httpStatus || 500).json(replay.body || { success: false, message: "Stored checkout result was unreadable." });
      }

      async function finish(httpStatus, body, status) {
        try {
          await db.execute(
            `UPDATE CHECKOUT_IDEMPOTENCY SET status = ?, order_id = ?, response_json = ? WHERE user_id = ? AND idempotency_key = ?`,
            [status, body?.data?.orderId || null, JSON.stringify({ httpStatus, body }), userId, idempotencyKey]
          );
        } catch (err) {
          console.error(`[checkout${path}] failed to persist idempotency result:`, err);
        }
        return res.status(httpStatus).json(body);
      }

      const reservation = await reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl });
      if (!reservation.ok) {
        return finish(reservation.httpStatus, reservation.body, "FAILED");
      }

      const { orderId, orderNumber, cartId } = reservation;
      await writeAuditLog(db, { actorUserId: userId, action: "ORDER_CREATED", entityType: "order", entityId: orderId, metadata: { orderNumber, method: paymentMethod } });

      const settled = await settleOfflineOrder({ orderId, orderNumber, cartId, paymentMethod });
      if (!settled.ok) {
        await writeAuditLog(db, { actorUserId: userId, action: `${auditPrefix}_INELIGIBLE`, entityType: "order", entityId: orderId, metadata: { orderNumber } });
        if (settled.httpStatus === 500) {
          return finish(500, { success: false, code: "SETTLE_FAILED", message: "Checkout failed. This order needs manual review.", orderNumber }, "FAILED");
        }
        return finish(
          409,
          {
            success: false,
            code: settled.code,
            message: `One or more merchants in your cart no longer support ${paymentMethod === "PAY_ON_DELIVERY" ? "Pay on Delivery" : "Pay on Pickup"}. Your order was cancelled — please review your cart.`,
            orderNumber,
          },
          "FAILED"
        );
      }

      await writeAuditLog(db, { actorUserId: userId, action: `${auditPrefix}_AWAITING_PAYMENT`, entityType: "order", entityId: orderId, metadata: { orderNumber } });

      // After commit only — a WhatsApp failure must never affect this
      // already-successful order. notifyNewOrderForOrder() never throws.
      await notifyNewOrderForOrder(db, orderId);

      return finish(
        201,
        { success: true, data: { orderId, orderNumber, paymentStatus: "PENDING", status: "PENDING_PAYMENT", paymentMethod } },
        "COMPLETED"
      );
    });
  }

  createOfflineFulfilmentGatedRoute("/pay-on-delivery", "PAY_ON_DELIVERY", "DELIVERY", "PAY_ON_DELIVERY");
  createOfflineFulfilmentGatedRoute("/pay-on-pickup", "PAY_ON_PICKUP", "PICKUP", "PAY_ON_PICKUP");

  router.post("/", requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const { shippingAddressId, billingAddressId, shippingMethodId, couponCode, paymentToken, billTo = {}, deliveryInstructions, deliveryReferenceImageUrl } = req.body || {};

    const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return res.status(400).json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", message: "An Idempotency-Key header (or idempotencyKey field) is required for checkout." });
    }
    if (!shippingMethodId) {
      return res.status(400).json({ success: false, message: "shippingMethodId is required." });
    }
    if (!paymentToken || typeof paymentToken !== "string") {
      return res.status(400).json({ success: false, message: "paymentToken is required." });
    }

    const requestHash = hashRequest({ shippingAddressId, billingAddressId, shippingMethodId, couponCode, paymentToken, deliveryInstructions, deliveryReferenceImageUrl });

    let claimed = false;
    try {
      await db.execute(
        `INSERT INTO CHECKOUT_IDEMPOTENCY (user_id, idempotency_key, request_hash, status, expires_at)
         VALUES (?, ?, ?, 'PROCESSING', DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [userId, idempotencyKey, requestHash, IDEMPOTENCY_TTL_HOURS]
      );
      claimed = true;
    } catch (err) {
      if (err?.code !== "ER_DUP_ENTRY") {
        console.error("[checkout] idempotency claim error:", err);
        return res.status(500).json({ success: false, message: "Checkout failed to start." });
      }
    }

    if (!claimed) {
      const [rows] = await db.query(
        `SELECT id, user_id, idempotency_key, request_hash, status, order_id, response_json, created_at, expires_at
           FROM CHECKOUT_IDEMPOTENCY WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
        [userId, idempotencyKey]
      );
      const existing = rows[0];
      if (!existing) {
        // Lost a race with a concurrent claim that hasn't committed its row's
        // visibility yet — vanishingly rare; ask the client to retry.
        return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "Please retry shortly." });
      }
      if (existing.request_hash !== requestHash) {
        return res.status(409).json({ success: false, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different request." });
      }
      if (existing.status === "PROCESSING") {
        return res.status(409).json({ success: false, code: "CHECKOUT_IN_PROGRESS", message: "A checkout with this idempotency key is already being processed. Please retry shortly." });
      }
      // COMPLETED or FAILED — replay the exact stored outcome. No new
      // order, no new charge, no new inventory change happens here.
      // finish() below always stores { httpStatus, body }, so both fields
      // are guaranteed present for any row that reached this status.
      const replay = JSON.parse(existing.response_json || "{}");
      return res.status(replay.httpStatus || 500).json(replay.body || { success: false, message: "Stored checkout result was unreadable." });
    }

    async function finish(httpStatus, body, status) {
      try {
        await db.execute(
          `UPDATE CHECKOUT_IDEMPOTENCY SET status = ?, order_id = ?, response_json = ? WHERE user_id = ? AND idempotency_key = ?`,
          [status, body?.data?.orderId || null, JSON.stringify({ httpStatus, body }), userId, idempotencyKey]
        );
      } catch (err) {
        console.error("[checkout] failed to persist idempotency result:", err);
      }
      return res.status(httpStatus).json(body);
    }

    const reservation = await reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode, deliveryInstructions, deliveryReferenceImageUrl });
    if (!reservation.ok) {
      return finish(reservation.httpStatus, reservation.body, "FAILED");
    }

    const { orderId, orderNumber, grandTotal, cartId } = reservation;
    await writeAuditLog(db, { actorUserId: userId, action: "ORDER_CREATED", entityType: "order", entityId: orderId, metadata: { orderNumber, grandTotal } });

    const onlineEligible = await verifyOnlinePaymentEligible({ orderId });
    if (!onlineEligible.ok) {
      await writeAuditLog(db, { actorUserId: userId, action: "ONLINE_PAYMENT_INELIGIBLE", entityType: "order", entityId: orderId, metadata: { orderNumber } });
      if (onlineEligible.httpStatus === 500) {
        return finish(500, { success: false, code: "SETTLE_FAILED", message: "Checkout failed. This order needs manual review.", orderNumber }, "FAILED");
      }
      return finish(
        409,
        {
          success: false,
          code: onlineEligible.code,
          message: "One or more merchants in your cart no longer accept online payment. Your order was cancelled — please review your cart.",
          orderNumber,
        },
        "FAILED"
      );
    }

    let paymentResult;
    try {
      await writeAuditLog(db, { actorUserId: userId, action: "PAYMENT_ATTEMPTED", entityType: "order", entityId: orderId, metadata: { orderNumber, amount: grandTotal } });
      paymentResult = await paymentService.charge({ amount: grandTotal, currency: "BND", orderNumber, paymentToken, billTo });
    } catch (err) {
      console.error("[checkout] payment provider threw:", err);
      paymentResult = { success: false, provider: "unknown", status: "FAILED", message: "Payment provider error." };
    }
    await writeAuditLog(db, {
      actorUserId: userId,
      action: paymentResult.success ? "PAYMENT_SUCCEEDED" : "PAYMENT_FAILED",
      entityType: "order",
      entityId: orderId,
      metadata: { orderNumber, provider: paymentResult.provider, status: paymentResult.status },
    });

    const settled = await settleOrder({ orderId, orderNumber, cartId, grandTotal, paymentResult });
    if (!settled.ok) {
      return finish(settled.httpStatus, settled.body, "FAILED");
    }

    if (!paymentResult.success) {
      return finish(402, { success: false, code: "PAYMENT_FAILED", message: paymentResult.message || "Payment was declined.", orderNumber }, "FAILED");
    }

    // After commit only, and only once payment has actually succeeded — a
    // WhatsApp failure must never affect this already-successful order.
    // notifyNewOrderForOrder() never throws.
    await notifyNewOrderForOrder(db, orderId);

    return finish(
      201,
      { success: true, data: { orderId, orderNumber, grandTotal, paymentStatus: "PAID", status: "PROCESSING" } },
      "COMPLETED"
    );
  });

  return router;
}
