// Backend/sockets/product.socket.js

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function normalizeRole(role) {
  const r = String(role || ROLES.USER).toUpperCase();
  return Object.values(ROLES).includes(r) ? r : ROLES.USER;
}

function safePublicProductRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    vendor_id: row.VENDOR_ID,
    name: row.NAME,
    code: row.CODE,
    description: row.DESCRIPTION, // may come as Buffer depending on column type
    conditional: row.CONDITIONAL,
    price: row.PRICE,
    stock_quantity: row.STOCK_QUANTITY,
    image_url: row.IMAGE_URL, // may come as Buffer depending on column type
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

/**
 * Expecting client to pass:
 * - currentUser in payload OR you can attach from your auth middleware later
 *
 * payload.currentUser example:
 * { id: 10, role: "VENDOR" }
 */

export default function productSocketController({
  socket,
  io,
  db,
  pushActivity = () => {},
}) {
  if (!db) console.error("[product.socket] ❌ db is missing (not passed in)");

  console.log("✅ User connected to product socket:", socket.id);

  /* =========================================================
     LIST PRODUCTS (public)
     ========================================================= */
  socket.on("product:list", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const tcg = toStr(payload.tcg); // optional filter
    const vendorId = payload.vendorId != null ? toInt(payload.vendorId) : null;

    try {
      // NOTE: Your table doesn't have TCG column in schema.
      // If you want TCG filter, add a column (TCG VARCHAR(30)) in PRODUCTS.
      // For now, we only filter by vendorId (optional).
      const where = [];
      const params = [];

      if (vendorId) {
        where.push("VENDOR_ID = ?");
        params.push(vendorId);
      }

      const sql = `
        SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
        FROM PRODUCTS
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY ID DESC
      `;

      const [rows] = await db.execute(sql, params);

      const products = (rows || []).map(safePublicProductRow);

      console.log(`[socket][product:list] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: products });
    } catch (err) {
      console.error(`[socket][product:list] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to load products." });
    }
  });

  /* =========================================================
     CREATE PRODUCT (vendor/admin only)
     ========================================================= */
  socket.on("product:create", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!(role === ROLES.VENDOR || role === ROLES.ADMIN)) {
      return ack({ success: false, message: "Only vendors/admin can create products." });
    }

    const name = toStr(payload.name);
    const code = toStr(payload.code);
    const description = payload.description ?? null; // string or buffer
    const conditional = toStr(payload.conditional);
    const price = toInt(payload.price);
    const stockQty = toInt(payload.stock_quantity ?? payload.stockQty ?? 0);
    const imageUrl = payload.image_url ?? payload.imageUrl ?? null;

    if (!name || !code) {
      return ack({ success: false, message: "name and code are required." });
    }

    try {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [res] = await conn.execute(
          `INSERT INTO PRODUCTS
            (VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, name, code, description, conditional, price, stockQty, imageUrl],
        );

        const productId = res.insertId;

        // create inventory row (optional but aligns to your table)
        await conn.execute(
          `INSERT INTO MANAGE_INVENTORY (PRODUCT_ID, QUANTITY, LAST_UPDATED)
           VALUES (?, ?, NOW())`,
          [productId, stockQty],
        );

        const [rows] = await conn.execute(
          `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
           FROM PRODUCTS
           WHERE ID = ?`,
          [productId],
        );

        await conn.commit();

        const product = safePublicProductRow(rows?.[0]);

        io.emit("product:created", product);

        pushActivity({
          id: Date.now(),
          type: "product",
          message: `New product created: ${product?.name || "item"} (ID ${productId})`,
          timestamp: new Date().toISOString(),
        });

        console.log(`[socket][product:create] ✅ ok in ${Date.now() - t0}ms`);
        return ack({ success: true, data: product });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error(`[socket][product:create] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to create product." });
    }
  });

  /* =========================================================
     UPDATE PRODUCT (vendor owns product OR admin)
     ========================================================= */
  socket.on("product:update", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    const productId = toInt(payload.id);
    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!productId) return ack({ success: false, message: "Product id is required." });

    try {
      const [pRows] = await db.execute(
        `SELECT ID, VENDOR_ID FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
      );
      const p = pRows?.[0];
      if (!p) return ack({ success: false, message: "Product not found." });

      const isOwner = toInt(p.VENDOR_ID) === userId;
      const isAdmin = role === ROLES.ADMIN;
      if (!isOwner && !isAdmin) {
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const fields = [];
      const params = [];

      if (payload.name != null) {
        fields.push("NAME = ?");
        params.push(toStr(payload.name));
      }
      if (payload.code != null) {
        fields.push("CODE = ?");
        params.push(toStr(payload.code));
      }
      if (payload.description != null) {
        fields.push("DESCRIPTION = ?");
        params.push(payload.description);
      }
      if (payload.conditional != null) {
        fields.push("CONDITIONAL = ?");
        params.push(toStr(payload.conditional));
      }
      if (payload.price != null) {
        fields.push("PRICE = ?");
        params.push(toInt(payload.price));
      }
      if (payload.image_url != null || payload.imageUrl != null) {
        fields.push("IMAGE_URL = ?");
        params.push(payload.image_url ?? payload.imageUrl);
      }

      // If no fields
      if (fields.length === 0) {
        return ack({ success: false, message: "No fields to update." });
      }

      fields.push("UPDATED_AT = NOW()");

      params.push(productId);

      await db.execute(
        `UPDATE PRODUCTS SET ${fields.join(", ")} WHERE ID = ?`,
        params,
      );

      const [rows] = await db.execute(
        `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
         FROM PRODUCTS
         WHERE ID = ?`,
        [productId],
      );

      const updated = safePublicProductRow(rows?.[0]);

      io.emit("product:updated", updated);

      pushActivity({
        id: Date.now(),
        type: "product",
        message: `Product updated: ${updated?.name || "item"} (ID ${productId})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][product:update] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: updated });
    } catch (err) {
      console.error(`[socket][product:update] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to update product." });
    }
  });

  /* =========================================================
     INVENTORY ADJUST (vendor owns product OR admin)
     - delta can be + or -
     ========================================================= */
  socket.on("inventory:adjust", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    const productId = toInt(payload.product_id ?? payload.productId);
    const delta = toInt(payload.delta);

    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!productId) return ack({ success: false, message: "product_id is required." });
    if (!Number.isFinite(delta) || delta === 0) {
      return ack({ success: false, message: "delta must be a non-zero number." });
    }

    try {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [pRows] = await conn.execute(
          `SELECT ID, VENDOR_ID, STOCK_QUANTITY FROM PRODUCTS WHERE ID = ? LIMIT 1`,
          [productId],
        );
        const p = pRows?.[0];
        if (!p) {
          await conn.rollback();
          return ack({ success: false, message: "Product not found." });
        }

        const isOwner = toInt(p.VENDOR_ID) === userId;
        const isAdmin = role === ROLES.ADMIN;
        if (!isOwner && !isAdmin) {
          await conn.rollback();
          return ack({ success: false, message: "Forbidden (not owner)." });
        }

        const newQty = Math.max(0, toInt(p.STOCK_QUANTITY) + delta);

        await conn.execute(
          `UPDATE PRODUCTS SET STOCK_QUANTITY = ?, UPDATED_AT = NOW() WHERE ID = ?`,
          [newQty, productId],
        );

        // Keep manage_inventory in sync (upsert-like behavior)
        await conn.execute(
          `INSERT INTO MANAGE_INVENTORY (PRODUCT_ID, QUANTITY, LAST_UPDATED)
           VALUES (?, ?, NOW())
           ON DUPLICATE KEY UPDATE QUANTITY = VALUES(QUANTITY), LAST_UPDATED = NOW()`,
          [productId, newQty],
        );

        const [rows] = await conn.execute(
          `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
           FROM PRODUCTS
           WHERE ID = ?`,
          [productId],
        );

        await conn.commit();

        const updated = safePublicProductRow(rows?.[0]);
        io.emit("inventory:updated", { product_id: productId, stock_quantity: updated?.stock_quantity });

        pushActivity({
          id: Date.now(),
          type: "inventory",
          message: `Inventory updated for product ID ${productId} (new qty: ${updated?.stock_quantity})`,
          timestamp: new Date().toISOString(),
        });

        console.log(`[socket][inventory:adjust] ✅ ok in ${Date.now() - t0}ms`);
        return ack({ success: true, data: updated });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error(`[socket][inventory:adjust] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to adjust inventory." });
    }
  });

  /* =========================================================
     DELETE PRODUCT (vendor owns product OR admin)
     ========================================================= */
  socket.on("product:delete", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    const productId = toInt(payload.id);
    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!productId) return ack({ success: false, message: "Product id is required." });

    try {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [pRows] = await conn.execute(
          `SELECT ID, VENDOR_ID, NAME FROM PRODUCTS WHERE ID = ? LIMIT 1`,
          [productId],
        );
        const p = pRows?.[0];
        if (!p) {
          await conn.rollback();
          return ack({ success: false, message: "Product not found." });
        }

        const isOwner = toInt(p.VENDOR_ID) === userId;
        const isAdmin = role === ROLES.ADMIN;
        if (!isOwner && !isAdmin) {
          await conn.rollback();
          return ack({ success: false, message: "Forbidden (not owner)." });
        }

        // delete inventory first (FK)
        await conn.execute(`DELETE FROM MANAGE_INVENTORY WHERE PRODUCT_ID = ?`, [productId]);

        // delete product
        await conn.execute(`DELETE FROM PRODUCTS WHERE ID = ?`, [productId]);

        await conn.commit();

        io.emit("product:deleted", { id: productId });

        pushActivity({
          id: Date.now(),
          type: "product",
          message: `Product deleted: ${p?.NAME || "item"} (ID ${productId})`,
          timestamp: new Date().toISOString(),
        });

        console.log(`[socket][product:delete] ✅ ok in ${Date.now() - t0}ms`);
        return ack({ success: true });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error(`[socket][product:delete] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to delete product." });
    }
  });
}
