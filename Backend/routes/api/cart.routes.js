// Backend/routes/api/cart.routes.js
//
// Cart storage only ever records product/variant + quantity — pricing is
// NEVER trusted from this table. Every price/subtotal shown here is
// recomputed live from `products`/`product_variants` on every read, and
// checkout.routes.js recomputes everything again from scratch at
// checkout time regardless of what this endpoint last returned.
//
// Guest carts are supported via an opaque `x-guest-cart-token` header
// (a UUID the frontend generates once and stores in localStorage) —
// never a client-supplied numeric id.
import { Router } from "express";
import crypto from "crypto";
import { optionalAuth, requireAuth } from "../../modules/restAuth.module.js";

function getGuestToken(req) {
  const header = req.headers["x-guest-cart-token"];
  return typeof header === "string" && header.length > 0 ? header : null;
}

const CART_COLUMNS = "id, user_id, guest_token, status, created_at, updated_at";

async function resolveCart(db, { userId, guestToken }) {
  if (userId) {
    const [rows] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]);
    if (rows[0]) return { cart: rows[0], newGuestToken: null };

    // UQ_CARTS_USER allows at most one CARTS row per registered user, ever
    // (not just one active one) — after checkout converts their cart
    // (settleOrder in checkout.routes.js), that row still exists with
    // status='converted'. Reuse/reactivate it instead of inserting a
    // second row, which would violate the unique constraint.
    const [existingRows] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE user_id = ? LIMIT 1`, [userId]);
    if (existingRows[0]) {
      await db.execute(`UPDATE CARTS SET status = 'active', updated_at = NOW() WHERE id = ?`, [existingRows[0].id]);
      const [reactivated] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE id = ?`, [existingRows[0].id]);
      return { cart: reactivated[0], newGuestToken: null };
    }

    const [result] = await db.execute(`INSERT INTO CARTS (user_id, status) VALUES (?, 'active')`, [userId]);
    const [created] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE id = ?`, [result.insertId]);
    return { cart: created[0], newGuestToken: null };
  }

  if (guestToken) {
    const [rows] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE guest_token = ? AND status = 'active' LIMIT 1`, [guestToken]);
    if (rows[0]) return { cart: rows[0], newGuestToken: null };
  }

  const token = guestToken || crypto.randomUUID();
  const [result] = await db.execute(`INSERT INTO CARTS (guest_token, status) VALUES (?, 'active')`, [token]);
  const [created] = await db.query(`SELECT ${CART_COLUMNS} FROM CARTS WHERE id = ?`, [result.insertId]);
  return { cart: created[0], newGuestToken: guestToken ? null : token };
}

async function loadCartWithItems(db, cartId) {
  const [items] = await db.query(
    `SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity,
            p.name, p.slug, p.status AS product_status, p.stock_quantity AS product_stock,
            p.vendor_id, p.merchant_id, u.name AS seller_name, m.display_name AS merchant_name,
            COALESCE(v.price_override, p.price) AS unit_price,
            COALESCE(v.stock_quantity, p.stock_quantity) AS available_stock,
            (SELECT image_url FROM PRODUCT_IMAGES WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image_url
       FROM CART_ITEMS ci
       JOIN PRODUCTS p ON p.id = ci.product_id
       LEFT JOIN PRODUCT_VARIANTS v ON v.id = ci.variant_id
       LEFT JOIN USERS u ON u.id = p.vendor_id
       LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC`,
    [cartId]
  );

  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  return { items, subtotal: Math.round(subtotal * 100) / 100 };
}

export default function createCartRoutes({ db }) {
  const router = Router();
  router.use(optionalAuth);

  router.get("/", async (req, res) => {
    try {
      const { cart, newGuestToken } = await resolveCart(db, { userId: req.user?.sub, guestToken: getGuestToken(req) });
      const { items, subtotal } = await loadCartWithItems(db, cart.id);
      return res.json({ success: true, data: { cartId: cart.id, items, subtotal, guestToken: newGuestToken || undefined } });
    } catch (err) {
      console.error("[cart GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load cart." });
    }
  });

  router.post("/items", async (req, res) => {
    try {
      const { productId, variantId, quantity } = req.body || {};
      const qty = Number(quantity);
      if (!productId || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: "productId and a positive quantity are required." });
      }

      const [productRows] = await db.query(
        `SELECT p.id, p.status, p.merchant_id, m.status AS merchant_status
           FROM PRODUCTS p LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
          WHERE p.id = ? LIMIT 1`,
        [productId]
      );
      const productRow = productRows[0];
      if (!productRow || productRow.status === "archived") {
        return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found." });
      }
      // A suspended/banned merchant's products shouldn't be addable to a new
      // cart — checkout.routes.js re-checks this again regardless, since a
      // merchant can change status after something is already in the cart.
      if (productRow.merchant_id && productRow.merchant_status !== "ACTIVE") {
        return res.status(409).json({ success: false, code: "MERCHANT_NOT_ACTIVE", message: "This product is not currently available for purchase." });
      }

      if (variantId) {
        const [variantRows] = await db.query(
          `SELECT id FROM PRODUCT_VARIANTS WHERE id = ? AND product_id = ? LIMIT 1`,
          [variantId, productId]
        );
        if (!variantRows[0]) {
          return res.status(400).json({ success: false, message: "variantId does not belong to productId." });
        }
      }

      const { cart, newGuestToken } = await resolveCart(db, { userId: req.user?.sub, guestToken: getGuestToken(req) });

      await db.execute(
        `INSERT INTO CART_ITEMS (cart_id, product_id, variant_id, quantity)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
        [cart.id, productId, variantId || null, qty]
      );

      const { items, subtotal } = await loadCartWithItems(db, cart.id);
      return res.status(201).json({ success: true, data: { cartId: cart.id, items, subtotal, guestToken: newGuestToken || undefined } });
    } catch (err) {
      console.error("[cart POST items] error:", err);
      return res.status(500).json({ success: false, message: "Failed to add item to cart." });
    }
  });

  router.patch("/items/:id", async (req, res) => {
    try {
      const { cart } = await resolveCart(db, { userId: req.user?.sub, guestToken: getGuestToken(req) });
      const itemId = Number(req.params.id);
      const qty = Number(req.body?.quantity);

      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({ success: false, message: "quantity must be zero or a positive number." });
      }

      const [rows] = await db.query(`SELECT id FROM CART_ITEMS WHERE id = ? AND cart_id = ? LIMIT 1`, [itemId, cart.id]);
      if (!rows[0]) return res.status(404).json({ success: false, message: "Cart item not found." });

      if (qty === 0) {
        await db.execute(`DELETE FROM CART_ITEMS WHERE id = ?`, [itemId]);
      } else {
        await db.execute(`UPDATE CART_ITEMS SET quantity = ?, updated_at = NOW() WHERE id = ?`, [qty, itemId]);
      }

      const { items, subtotal } = await loadCartWithItems(db, cart.id);
      return res.json({ success: true, data: { cartId: cart.id, items, subtotal } });
    } catch (err) {
      console.error("[cart PATCH items/:id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update cart item." });
    }
  });

  router.delete("/items/:id", async (req, res) => {
    try {
      const { cart } = await resolveCart(db, { userId: req.user?.sub, guestToken: getGuestToken(req) });
      const itemId = Number(req.params.id);

      const [result] = await db.execute(`DELETE FROM CART_ITEMS WHERE id = ? AND cart_id = ?`, [itemId, cart.id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Cart item not found." });

      const { items, subtotal } = await loadCartWithItems(db, cart.id);
      return res.json({ success: true, data: { cartId: cart.id, items, subtotal } });
    } catch (err) {
      console.error("[cart DELETE items/:id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to remove cart item." });
    }
  });

  router.delete("/", async (req, res) => {
    try {
      const { cart } = await resolveCart(db, { userId: req.user?.sub, guestToken: getGuestToken(req) });
      await db.execute(`DELETE FROM CART_ITEMS WHERE cart_id = ?`, [cart.id]);
      return res.json({ success: true, data: { cartId: cart.id, items: [], subtotal: 0 } });
    } catch (err) {
      console.error("[cart DELETE] error:", err);
      return res.status(500).json({ success: false, message: "Failed to clear cart." });
    }
  });

  // Merges a guest cart's items into the authenticated user's cart —
  // call right after login when a guest cart token exists client-side.
  router.post("/merge", requireAuth, async (req, res) => {
    const guestToken = getGuestToken(req);
    if (!guestToken) return res.json({ success: true, message: "No guest cart to merge." });

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [guestCarts] = await conn.execute(`SELECT id FROM CARTS WHERE guest_token = ? AND status = 'active' LIMIT 1`, [guestToken]);
      const guestCart = guestCarts[0];
      if (!guestCart) {
        await conn.rollback();
        return res.json({ success: true, message: "No guest cart to merge." });
      }

      const { cart: userCart } = await resolveCart(db, { userId: req.user.sub });

      const [guestItems] = await conn.execute(`SELECT product_id, variant_id, quantity FROM CART_ITEMS WHERE cart_id = ?`, [guestCart.id]);
      for (const item of guestItems) {
        await conn.execute(
          `INSERT INTO CART_ITEMS (cart_id, product_id, variant_id, quantity)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()`,
          [userCart.id, item.product_id, item.variant_id, item.quantity]
        );
      }

      await conn.execute(`UPDATE CARTS SET status = 'converted', updated_at = NOW() WHERE id = ?`, [guestCart.id]);
      await conn.commit();

      const { items, subtotal } = await loadCartWithItems(db, userCart.id);
      return res.json({ success: true, data: { cartId: userCart.id, items, subtotal } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[cart POST merge] error:", err);
      return res.status(500).json({ success: false, message: "Failed to merge cart." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  return router;
}
