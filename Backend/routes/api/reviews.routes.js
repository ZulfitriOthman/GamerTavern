// Backend/routes/api/reviews.routes.js
// Public read, authenticated write. A review is marked verified_purchase
// when the reviewer has a PAID/PROCESSING/READY/SHIPPED/DELIVERED order_item
// for the product — reviews are never blocked for non-purchasers, per spec
// ("prefer verified-purchase logic", not "require"), but the flag is only
// ever set from real order history, never accepted from the client.
// Merchants are never given a review-edit endpoint — this file exposes
// none, by design.
import { Router } from "express";
import { requireAuth, optionalAuth } from "../../modules/restAuth.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";

export default function createReviewsRoutes({ db }) {
  const router = Router();

  router.get("/", optionalAuth, async (req, res) => {
    try {
      const productId = Number(req.query.productId);
      if (!productId) return res.status(400).json({ success: false, message: "productId query param is required." });

      const { page, limit, offset } = parsePagination(req);

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM REVIEWS WHERE product_id = ? AND status = 'published'`, [productId]);
      const [rows] = await db.query(
        `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS reviewer_name,
                (r.order_item_id IS NOT NULL) AS verified_purchase
           FROM REVIEWS r
           JOIN USERS u ON u.id = r.user_id
          WHERE r.product_id = ? AND r.status = 'published'
          ORDER BY r.created_at DESC
          LIMIT ? OFFSET ?`,
        [productId, limit, offset]
      );
      const [[summary]] = await db.query(
        `SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average
           FROM REVIEWS WHERE product_id = ? AND status = 'published'`,
        [productId]
      );

      return res.json({
        success: true,
        data: { items: rows, pagination: paginationMeta({ page, limit, total }) },
        summary: { count: Number(summary.count), average: Number(summary.average) },
      });
    } catch (err) {
      console.error("[reviews GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load reviews." });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const { productId, rating, title, body } = req.body || {};
      const ratingNum = Number(rating);

      if (!productId || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: "productId and an integer rating from 1 to 5 are required." });
      }

      const [productRows] = await db.query(`SELECT id FROM PRODUCTS WHERE id = ? LIMIT 1`, [productId]);
      if (!productRows[0]) return res.status(404).json({ success: false, message: "Product not found." });

      const [purchaseRows] = await db.query(
        `SELECT oi.id FROM ORDER_ITEMS oi
           JOIN ORDERS o ON o.id = oi.order_id
          WHERE oi.product_id = ? AND o.user_id = ? AND o.payment_status = 'PAID'
          LIMIT 1`,
        [productId, req.user.sub]
      );
      const orderItemId = purchaseRows[0]?.id || null;

      await db.execute(
        `INSERT INTO REVIEWS (product_id, user_id, order_item_id, rating, title, body)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), title = VALUES(title), body = VALUES(body),
           order_item_id = VALUES(order_item_id), updated_at = NOW()`,
        [productId, req.user.sub, orderItemId, ratingNum, title || null, body || null]
      );

      return res.status(201).json({ success: true, message: "Review saved.", verifiedPurchase: Boolean(orderItemId) });
    } catch (err) {
      console.error("[reviews POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to save review." });
    }
  });

  return router;
}
