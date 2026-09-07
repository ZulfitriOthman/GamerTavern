// Backend/services/payment/PaymentReconciliationService.js
//
// Recovers orders left stranded when checkout's "reserve" transaction
// (Backend/routes/api/checkout.routes.js) committed — inventory already
// deducted, order created as PENDING_PAYMENT — but the process crashed or
// timed out before the payment call + "settle" transaction ever ran, so
// no payment_transactions row exists at all for that order.
//
// Not a scheduler itself — exposed as a plain callable class so it can be
// invoked from an admin endpoint now (Backend/routes/api/admin.routes.js)
// and wired into real cron/queue infrastructure later without changing
// this file.
//
// MOCK-mode note: since MockCyberSourceProvider never has a real external
// side effect to double-check, "no payment_transactions row" is treated
// as "payment was never attempted" and the order is safely cancelled +
// inventory restored. Under a REAL gateway, this would first need to call
// CyberSource's transaction-status API to rule out the far more dangerous
// case of "the charge actually succeeded at the gateway but our process
// crashed before recording it" before ever cancelling — that check is
// NOT implemented here (there is nothing to check against in mock mode)
// and must be added before this runs against PAYMENT_PROVIDER=cybersource.
import { writeAuditLog } from "../../modules/auditLog.module.js";

export default class PaymentReconciliationService {
  constructor(db) {
    this.db = db;
  }

  async findStalePendingOrders({ olderThanMinutes = 15 } = {}) {
    const [rows] = await this.db.query(
      `SELECT id, order_number, user_id, created_at
         FROM orders
        WHERE status = 'PENDING_PAYMENT' AND payment_status = 'PENDING'
          AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
        ORDER BY created_at ASC`,
      [olderThanMinutes]
    );
    return rows;
  }

  // Idempotent: safe to call repeatedly, including on orders that were
  // already reconciled or that settled normally in the meantime.
  async reconcileOrder(orderId, { actorUserId = null, dryRun = false } = {}) {
    let conn;
    try {
      conn = await this.db.getConnection();
      await conn.beginTransaction();

      const [orderRows] = await conn.execute(`SELECT * FROM orders WHERE id = ? FOR UPDATE`, [orderId]);
      const order = orderRows[0];
      if (!order) {
        await conn.rollback();
        return { orderId, action: "SKIPPED", reason: "Order not found." };
      }
      if (order.status !== "PENDING_PAYMENT" || order.payment_status !== "PENDING") {
        await conn.rollback();
        return { orderId, action: "SKIPPED", reason: `Order is already ${order.status}/${order.payment_status}.` };
      }

      const [txnRows] = await conn.execute(
        `SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );
      const latestTransaction = txnRows[0];

      if (latestTransaction?.status === "PAID") {
        // Defensive self-heal: a payment record exists and succeeded, but
        // the order was never updated to match (should not happen under
        // the current single-transaction settle design, but costs
        // nothing to guard against).
        if (dryRun) {
          await conn.rollback();
          return { orderId, action: "WOULD_MARK_PAID", reason: "A PAID payment_transactions row exists." };
        }
        await conn.execute(`UPDATE orders SET payment_status = 'PAID', status = 'PROCESSING', updated_at = NOW() WHERE id = ?`, [orderId]);
        await conn.execute(
          `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_type, changed_by_user_id, note)
           VALUES (?, 'PENDING_PAYMENT', 'PROCESSING', 'system', ?, 'Reconciliation: found a PAID payment record, self-healed order status.')`,
          [orderId, actorUserId]
        );
        await conn.commit();
        await writeAuditLog(this.db, { actorUserId, action: "ORDER_RECONCILED", entityType: "order", entityId: orderId, metadata: { outcome: "MARKED_PAID" } });
        return { orderId, action: "MARKED_PAID" };
      }

      // No successful payment on record — abandoned checkout. Cancel and
      // restore whatever inventory the reserve phase deducted.
      if (dryRun) {
        await conn.rollback();
        return { orderId, action: "WOULD_CANCEL", reason: "No successful payment on record past the stale threshold." };
      }

      await conn.execute(`UPDATE orders SET payment_status = 'FAILED', status = 'CANCELLED', updated_at = NOW() WHERE id = ?`, [orderId]);
      await conn.execute(`UPDATE merchant_orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = ?`, [orderId]);
      await conn.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_type, changed_by_user_id, note)
         VALUES (?, 'PENDING_PAYMENT', 'CANCELLED', 'system', ?, 'Reconciliation: no payment ever recorded past the stale threshold. Inventory restored.')`,
        [orderId, actorUserId]
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

      await conn.commit();
      await writeAuditLog(this.db, { actorUserId, action: "ORDER_RECONCILED", entityType: "order", entityId: orderId, metadata: { outcome: "CANCELLED", itemCount: items.length } });
      return { orderId, action: "CANCELLED", itemsRestored: items.length };
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error(`[PaymentReconciliationService] error reconciling order ${orderId}:`, err);
      return { orderId, action: "ERROR", reason: err?.message || "Unknown error." };
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  }

  async reconcileAll({ olderThanMinutes = 15, actorUserId = null, dryRun = false } = {}) {
    const stale = await this.findStalePendingOrders({ olderThanMinutes });
    const results = [];
    for (const order of stale) {
      results.push(await this.reconcileOrder(order.id, { actorUserId, dryRun }));
    }
    return { checked: stale.length, results };
  }
}
