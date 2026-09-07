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
import PaymentService from "../../services/payment/PaymentService.js";

const IDEMPOTENCY_TTL_HOURS = 24;

async function getPlatformCommissionPercent(db) {
  const [rows] = await db.query(`SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_commission_percent' LIMIT 1`);
  return Number(rows?.[0]?.setting_value ?? 10);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function hashRequest(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export default function createCheckoutRoutes({ db }) {
  const router = Router();
  const paymentService = new PaymentService();

  // Runs the reserve phase only. Returns either a successful reservation
  // or a terminal { httpStatus, body } to persist and return as-is —
  // never calls res.* directly, so the outer handler can record the
  // outcome against the idempotency key regardless of which path is hit.
  async function reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode }) {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [cartRows] = await conn.execute(`SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]);
      const cart = cartRows[0];
      if (!cart) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, code: "CART_EMPTY", message: "Your cart is empty." } };
      }

      const [cartItems] = await conn.execute(`SELECT id, product_id, variant_id, quantity FROM cart_items WHERE cart_id = ?`, [cart.id]);
      if (!cartItems.length) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, code: "CART_EMPTY", message: "Your cart is empty." } };
      }

      if (shippingAddressId) {
        const [addrRows] = await conn.execute(`SELECT id FROM customer_addresses WHERE id = ? AND user_id = ? LIMIT 1`, [shippingAddressId, userId]);
        if (!addrRows[0]) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, message: "shippingAddressId does not belong to this account." } };
        }
      }
      if (billingAddressId) {
        const [addrRows] = await conn.execute(`SELECT id FROM customer_addresses WHERE id = ? AND user_id = ? LIMIT 1`, [billingAddressId, userId]);
        if (!addrRows[0]) {
          await conn.rollback();
          return { ok: false, httpStatus: 400, body: { success: false, message: "billingAddressId does not belong to this account." } };
        }
      }

      const [methodRows] = await conn.execute(`SELECT id, base_fee FROM shipping_methods WHERE id = ? AND status = 'active' LIMIT 1`, [shippingMethodId]);
      const shippingMethod = methodRows[0];
      if (!shippingMethod) {
        await conn.rollback();
        return { ok: false, httpStatus: 400, body: { success: false, message: "Invalid shipping method." } };
      }

      // Lock every referenced product/variant row and recompute everything
      // from current database state — stock is rechecked here, inside the
      // lock, regardless of what the cart said a moment ago.
      const lines = [];
      let subtotal = 0;

      for (const item of cartItems) {
        const [productRows] = await conn.execute(
          `SELECT id, name, code, price, stock_quantity, status, merchant_id FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
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

        let variant = null;
        if (item.variant_id) {
          const [variantRows] = await conn.execute(
            `SELECT id, sku, price_override, stock_quantity, status FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE`,
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
          `SELECT * FROM coupons WHERE code = ? AND status = 'active'
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
          const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM coupon_usage WHERE coupon_id = ?`, [coupon.id]);
          if (count >= coupon.max_uses) {
            await conn.rollback();
            return { ok: false, httpStatus: 400, body: { success: false, code: "COUPON_EXHAUSTED", message: "This coupon has reached its usage limit." } };
          }
        }
        if (coupon.max_uses_per_user != null) {
          const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM coupon_usage WHERE coupon_id = ? AND user_id = ?`, [coupon.id, userId]);
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
        `INSERT INTO orders
           (order_number, user_id, shipping_address_id, billing_address_id, shipping_method_id, coupon_id,
            subtotal, discount_total, shipping_total, grand_total, currency, payment_status, status, placed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BND', 'PENDING', 'PENDING_PAYMENT', NOW())`,
        [tempOrderNumber, userId, shippingAddressId || null, billingAddressId || shippingAddressId || null, shippingMethodId, couponId, subtotal, discountTotal, shippingTotal, grand]
      );
      const orderId = orderResult.insertId;
      const orderNumber = `NC${String(orderId).padStart(5, "0")}`;
      await conn.execute(`UPDATE orders SET order_number = ? WHERE id = ?`, [orderNumber, orderId]);

      const platformCommissionPercent = await getPlatformCommissionPercent(db);
      const byMerchant = new Map();
      for (const line of lines) {
        if (!byMerchant.has(line.merchantId)) byMerchant.set(line.merchantId, []);
        byMerchant.get(line.merchantId).push(line);
      }

      for (const [merchantId, merchantLines] of byMerchant.entries()) {
        const [[merchantRow]] = await conn.query(`SELECT commission_percent FROM merchants WHERE id = ? FOR UPDATE`, [merchantId]);
        const commissionPercent = Number(merchantRow?.commission_percent ?? platformCommissionPercent);
        const merchantSubtotal = round2(merchantLines.reduce((sum, l) => sum + l.lineTotal, 0));
        const commissionAmount = round2(merchantSubtotal * (commissionPercent / 100));
        const merchantNetAmount = round2(merchantSubtotal - commissionAmount);

        const tempMerchantOrderNumber = `TMP-${crypto.randomUUID()}`;
        const [moResult] = await conn.execute(
          `INSERT INTO merchant_orders
             (merchant_order_number, order_id, merchant_id, subtotal, commission_percent, commission_amount, merchant_net_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PROCESSING')`,
          [tempMerchantOrderNumber, orderId, merchantId, merchantSubtotal, commissionPercent, commissionAmount, merchantNetAmount]
        );
        const merchantOrderId = moResult.insertId;
        const merchantOrderNumber = `MO${String(merchantOrderId).padStart(6, "0")}`;
        await conn.execute(`UPDATE merchant_orders SET merchant_order_number = ? WHERE id = ?`, [merchantOrderNumber, merchantOrderId]);

        for (const line of merchantLines) {
          await conn.execute(
            `INSERT INTO order_items
               (order_id, merchant_order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, merchantOrderId, line.productId, line.variantId, line.nameSnapshot, line.skuSnapshot, line.unitPrice, line.quantity, line.lineTotal]
          );

          if (line.variantId) {
            await conn.execute(`UPDATE product_variants SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?`, [line.quantity, line.variantId]);
            await conn.execute(`INSERT INTO inventory_movements (product_id, variant_id, delta, reason) VALUES (?, ?, ?, 'sale')`, [line.productId, line.variantId, -line.quantity]);
          } else {
            await conn.execute(`UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?`, [line.quantity, line.productId]);
            await conn.execute(`INSERT INTO inventory_movements (product_id, delta, reason) VALUES (?, ?, 'sale')`, [line.productId, -line.quantity]);
          }
        }
      }

      if (couponId) {
        await conn.execute(`INSERT INTO coupon_usage (coupon_id, user_id, order_id) VALUES (?, ?, ?)`, [couponId, userId, orderId]);
      }

      await conn.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_type, note)
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
        `INSERT INTO payment_transactions (order_id, provider, provider_transaction_id, amount, currency, status, raw_response)
         VALUES (?, ?, ?, ?, 'BND', ?, ?)`,
        [orderId, paymentResult.provider, paymentResult.transactionId || null, grandTotal, paymentResult.status || "FAILED", JSON.stringify(paymentResult.rawResponse || {})]
      );

      if (paymentResult.success) {
        assertOrderTransition("PENDING_PAYMENT", "PAID");
        await conn.execute(`UPDATE orders SET payment_status = 'PAID', status = 'PROCESSING', updated_at = NOW() WHERE id = ?`, [orderId]);
        await conn.execute(`UPDATE carts SET status = 'converted', updated_at = NOW() WHERE id = ?`, [cartId]);
        await conn.execute(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_type, note)
           VALUES (?, 'PENDING_PAYMENT', 'PROCESSING', 'system', 'Payment captured.')`,
          [orderId]
        );
      } else {
        assertOrderTransition("PENDING_PAYMENT", "CANCELLED");
        await conn.execute(`UPDATE orders SET payment_status = 'FAILED', status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [orderId]);
        await conn.execute(`UPDATE merchant_orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`, [orderId]);
        await conn.execute(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_type, note)
           VALUES (?, 'PENDING_PAYMENT', 'CANCELLED', 'system', ?)`,
          [orderId, `Payment failed: ${paymentResult.message || paymentResult.status}. Inventory restored.`]
        );

        const [items] = await conn.execute(`SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?`, [orderId]);
        for (const item of items) {
          if (item.variant_id) {
            await conn.execute(`UPDATE product_variants SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.variant_id]);
            await conn.execute(`INSERT INTO inventory_movements (product_id, variant_id, delta, reason) VALUES (?, ?, ?, 'cancelled_order')`, [item.product_id, item.variant_id, item.quantity]);
          } else {
            await conn.execute(`UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?`, [item.quantity, item.product_id]);
            await conn.execute(`INSERT INTO inventory_movements (product_id, delta, reason) VALUES (?, ?, 'cancelled_order')`, [item.product_id, item.quantity]);
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

  router.post("/", requireAuth, async (req, res) => {
    const userId = req.user.sub;
    const { shippingAddressId, billingAddressId, shippingMethodId, couponCode, paymentToken, billTo = {} } = req.body || {};

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

    const requestHash = hashRequest({ shippingAddressId, billingAddressId, shippingMethodId, couponCode, paymentToken });

    let claimed = false;
    try {
      await db.execute(
        `INSERT INTO checkout_idempotency (user_id, idempotency_key, request_hash, status, expires_at)
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
      const [rows] = await db.query(`SELECT * FROM checkout_idempotency WHERE user_id = ? AND idempotency_key = ? LIMIT 1`, [userId, idempotencyKey]);
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
          `UPDATE checkout_idempotency SET status = ?, order_id = ?, response_json = ? WHERE user_id = ? AND idempotency_key = ?`,
          [status, body?.data?.orderId || null, JSON.stringify({ httpStatus, body }), userId, idempotencyKey]
        );
      } catch (err) {
        console.error("[checkout] failed to persist idempotency result:", err);
      }
      return res.status(httpStatus).json(body);
    }

    const reservation = await reserveOrder({ userId, shippingAddressId, billingAddressId, shippingMethodId, couponCode });
    if (!reservation.ok) {
      return finish(reservation.httpStatus, reservation.body, "FAILED");
    }

    const { orderId, orderNumber, grandTotal, cartId } = reservation;
    await writeAuditLog(db, { actorUserId: userId, action: "ORDER_CREATED", entityType: "order", entityId: orderId, metadata: { orderNumber, grandTotal } });

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

    return finish(
      201,
      { success: true, data: { orderId, orderNumber, grandTotal, paymentStatus: "PAID", status: "PROCESSING" } },
      "COMPLETED"
    );
  });

  return router;
}
