// Backend/routes/api/orders.routes.js — customer-facing order history/detail.
// Ownership is always checked against the authenticated user's id, never
// against an id supplied by the client.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";

export default function createOrdersRoutes({ db }) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM orders WHERE user_id = ?`, [req.user.sub]);
      const [rows] = await db.query(
        `SELECT id, order_number, subtotal, discount_total, shipping_total, grand_total, currency,
                payment_status, status, placed_at, created_at
           FROM orders
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [req.user.sub, limit, offset]
      );
      return res.json({ success: true, data: { items: rows, pagination: paginationMeta({ page, limit, total }) } });
    } catch (err) {
      console.error("[orders GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load orders." });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const [orderRows] = await db.query(`SELECT * FROM orders WHERE id = ? AND user_id = ? LIMIT 1`, [req.params.id, req.user.sub]);
      const order = orderRows[0];
      if (!order) return res.status(404).json({ success: false, message: "Order not found." });

      const [items] = await db.query(
        `SELECT oi.id, oi.product_id, oi.variant_id, oi.product_name_snapshot, oi.sku_snapshot,
                oi.unit_price_snapshot, oi.quantity, oi.line_total,
                mo.merchant_order_number, mo.status AS merchant_order_status, m.display_name AS merchant_name
           FROM order_items oi
           JOIN merchant_orders mo ON mo.id = oi.merchant_order_id
           JOIN merchants m ON m.id = mo.merchant_id
          WHERE oi.order_id = ?`,
        [order.id]
      );

      const [history] = await db.query(
        `SELECT old_status, new_status, changed_by_type, note, created_at
           FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`,
        [order.id]
      );

      const [shipments] = await db.query(
        `SELECT s.tracking_number, s.carrier, s.status, s.shipped_at, s.delivered_at, mo.merchant_order_number
           FROM shipments s JOIN merchant_orders mo ON mo.id = s.merchant_order_id
          WHERE mo.order_id = ?`,
        [order.id]
      );

      return res.json({ success: true, data: { ...order, items, history, shipments } });
    } catch (err) {
      console.error("[orders GET :id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load order." });
    }
  });

  return router;
}
