// Backend/routes/api/wishlist.routes.js — authenticated-only, one wishlist per user.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";

async function resolveWishlist(db, userId) {
  const [rows] = await db.query(`SELECT id FROM wishlists WHERE user_id = ? LIMIT 1`, [userId]);
  if (rows[0]) return rows[0].id;

  const [result] = await db.execute(`INSERT INTO wishlists (user_id) VALUES (?)`, [userId]);
  return result.insertId;
}

export default function createWishlistRoutes({ db }) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const wishlistId = await resolveWishlist(db, req.user.sub);
      const [items] = await db.query(
        `SELECT wi.id, wi.product_id, wi.created_at, p.name, p.slug, p.price, p.stock_quantity, p.status,
                (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image_url
           FROM wishlist_items wi
           JOIN products p ON p.id = wi.product_id
          WHERE wi.wishlist_id = ?
          ORDER BY wi.created_at DESC`,
        [wishlistId]
      );
      return res.json({ success: true, data: items });
    } catch (err) {
      console.error("[wishlist GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load wishlist." });
    }
  });

  router.post("/items", async (req, res) => {
    try {
      const { productId } = req.body || {};
      if (!productId) return res.status(400).json({ success: false, message: "productId is required." });

      const [productRows] = await db.query(`SELECT id FROM products WHERE id = ? LIMIT 1`, [productId]);
      if (!productRows[0]) return res.status(404).json({ success: false, message: "Product not found." });

      const wishlistId = await resolveWishlist(db, req.user.sub);
      await db.execute(
        `INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE wishlist_id = wishlist_id`,
        [wishlistId, productId]
      );
      return res.status(201).json({ success: true, message: "Added to wishlist." });
    } catch (err) {
      console.error("[wishlist POST items] error:", err);
      return res.status(500).json({ success: false, message: "Failed to add to wishlist." });
    }
  });

  router.delete("/items/:productId", async (req, res) => {
    try {
      const wishlistId = await resolveWishlist(db, req.user.sub);
      await db.execute(`DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?`, [wishlistId, req.params.productId]);
      return res.json({ success: true, message: "Removed from wishlist." });
    } catch (err) {
      console.error("[wishlist DELETE items/:productId] error:", err);
      return res.status(500).json({ success: false, message: "Failed to remove from wishlist." });
    }
  });

  return router;
}
