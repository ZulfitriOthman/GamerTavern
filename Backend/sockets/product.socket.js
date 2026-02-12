// Backend/sockets/product.socket.js
// ✅ Adds:
// - safer cb handling
// - robust MySQL retry on ECONNRESET / transient disconnects
// - optional filters: search, dateFrom/dateTo, vendorId, category, tcg (only if columns exist)
// - optional sorting: newest/oldest, name A-Z/Z-A, price, category A-Z/Z-A

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
    // may be Buffer depending on column type (frontend already handles Buffer)
    description: row.DESCRIPTION,
    conditional: row.CONDITIONAL,
    price: row.PRICE,
    stock_quantity: row.STOCK_QUANTITY,
    image_url: row.IMAGE_URL,
    // OPTIONAL columns (only if you added them to DB)
    // category: row.CATEGORY,
    // tcg: row.TCG,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

/** retry wrapper for transient DB resets */
async function executeWithRetry(dbOrConn, sql, params = [], label = "db.execute") {
  const max = 2; // 1 retry
  let lastErr = null;

  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      // mysql2 pool has execute; connection has execute too
      return await dbOrConn.execute(sql, params);
    } catch (err) {
      lastErr = err;

      const code = err?.code || "";
      const msg = String(err?.message || "");

      const transient =
        code === "ECONNRESET" ||
        code === "PROTOCOL_CONNECTION_LOST" ||
        code === "ETIMEDOUT" ||
        msg.includes("Connection lost") ||
        msg.includes("read ECONNRESET");

      if (!transient || attempt === max) break;

      // small backoff
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }

  throw lastErr;
}

/**
 * product socket controller
 * expects: { socket, io, db, pushActivity }
 * where `db` is mysql2 pool from initDB()
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
  socket.on("product:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    // optional filters
    const vendorId = payload.vendorId != null ? toInt(payload.vendorId) : null;
    const search = toStr(payload.search); // name/code/category search
    const category = toStr(payload.category); // requires PRODUCTS.CATEGORY (optional)
    const tcg = toStr(payload.tcg); // requires PRODUCTS.TCG (optional)

    // date filtering (CREATED_AT)
    // accept ISO or yyyy-mm-dd; MySQL will try to parse
    const dateFrom = toStr(payload.dateFrom);
    const dateTo = toStr(payload.dateTo);

    // sort preset
    // allowed values:
    // "newest" | "oldest" | "az" | "za" | "price_asc" | "price_desc" | "cat_az" | "cat_za"
    const sort = toStr(payload.sort || "newest").toLowerCase();

    try {
      const where = [];
      const params = [];

      if (vendorId) {
        where.push("VENDOR_ID = ?");
        params.push(vendorId);
      }

      // NOTE:
      // If your PRODUCTS table DOES NOT have CATEGORY / TCG, remove those filters
      // or add the columns:
      //   ALTER TABLE PRODUCTS ADD COLUMN CATEGORY VARCHAR(80) NULL;
      //   ALTER TABLE PRODUCTS ADD COLUMN TCG VARCHAR(30) NULL;
      if (category) {
        where.push("CATEGORY = ?");
        params.push(category);
      }
      if (tcg) {
        where.push("TCG = ?");
        params.push(tcg);
      }

      if (dateFrom) {
        where.push("CREATED_AT >= ?");
        params.push(dateFrom);
      }
      if (dateTo) {
        where.push("CREATED_AT <= ?");
        params.push(dateTo);
      }

      if (search) {
        where.push("(NAME LIKE ? OR CODE LIKE ? OR CATEGORY LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      // ORDER BY whitelist
      let orderBy = "ID DESC";
      if (sort === "oldest") orderBy = "ID ASC";
      if (sort === "az") orderBy = "NAME ASC";
      if (sort === "za") orderBy = "NAME DESC";
      if (sort === "price_asc") orderBy = "PRICE ASC, ID DESC";
      if (sort === "price_desc") orderBy = "PRICE DESC, ID DESC";
      if (sort === "cat_az") orderBy = "CATEGORY ASC, NAME ASC";
      if (sort === "cat_za") orderBy = "CATEGORY DESC, NAME ASC";

      const sql = `
        SELECT
          ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL,
          PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
          -- OPTIONAL (uncomment if you added these columns)
          -- , CATEGORY, TCG
        FROM PRODUCTS
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY ${orderBy}
      `;

      const [rows] = await executeWithRetry(db, sql, params, "product:list");
      const products = (rows || []).map(safePublicProductRow);

      console.log(`[socket][product:list] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: products });
    } catch (err) {
      console.error(
        `[socket][product:list] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to load products." });
    }
  });

  /* =========================================================
     CREATE PRODUCT (vendor/admin only)
     ========================================================= */
  socket.on("product:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!(role === ROLES.VENDOR || role === ROLES.ADMIN)) {
      return ack({
        success: false,
        message: "Only vendors/admin can create products.",
      });
    }

    const name = toStr(payload.name);
    const code = toStr(payload.code);
    const description = payload.description ?? null;
    const conditional = toStr(payload.conditional);
    const price = toInt(payload.price);
    const stockQty = toInt(payload.stock_quantity ?? payload.stockQty ?? 0);
    const imageUrl = payload.image_url ?? payload.imageUrl ?? null;

    // OPTIONAL:
    // const category = toStr(payload.category) || null; // requires PRODUCTS.CATEGORY
    // const tcg = toStr(payload.tcg) || null; // requires PRODUCTS.TCG

    if (!name || !code) {
      return ack({ success: false, message: "name and code are required." });
    }

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [res] = await executeWithRetry(
        conn,
        `INSERT INTO PRODUCTS
          (VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, code, description, conditional, price, stockQty, imageUrl],
        "product:create.insert",
      );

      const productId = res.insertId;

      await executeWithRetry(
        conn,
        `INSERT INTO MANAGE_INVENTORY (PRODUCT_ID, QUANTITY, LAST_UPDATED)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE QUANTITY = VALUES(QUANTITY), LAST_UPDATED = NOW()`,
        [productId, stockQty],
        "product:create.inventory",
      );

      const [rows] = await executeWithRetry(
        conn,
        `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
         FROM PRODUCTS
         WHERE ID = ?`,
        [productId],
        "product:create.select",
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
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error(
        `[socket][product:create] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to create product." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  /* =========================================================
     UPDATE PRODUCT (vendor owns product OR admin)
     ========================================================= */
  socket.on("product:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    const productId = toInt(payload.id);
    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!productId) return ack({ success: false, message: "Product id is required." });

    try {
      const [pRows] = await executeWithRetry(
        db,
        `SELECT ID, VENDOR_ID FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
        "product:update.ownercheck",
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

      // OPTIONAL:
      // if (payload.category != null) { fields.push("CATEGORY = ?"); params.push(toStr(payload.category)); }
      // if (payload.tcg != null) { fields.push("TCG = ?"); params.push(toStr(payload.tcg)); }

      if (fields.length === 0) {
        return ack({ success: false, message: "No fields to update." });
      }

      fields.push("UPDATED_AT = NOW()");
      params.push(productId);

      await executeWithRetry(
        db,
        `UPDATE PRODUCTS SET ${fields.join(", ")} WHERE ID = ?`,
        params,
        "product:update.update",
      );

      const [rows] = await executeWithRetry(
        db,
        `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
         FROM PRODUCTS
         WHERE ID = ?`,
        [productId],
        "product:update.select",
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
      console.error(
        `[socket][product:update] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to update product." });
    }
  });

  /* =========================================================
     INVENTORY ADJUST (vendor owns product OR admin)
     ========================================================= */
  socket.on("inventory:adjust", async (payload = {}, cb) => {
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

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [pRows] = await executeWithRetry(
        conn,
        `SELECT ID, VENDOR_ID, STOCK_QUANTITY FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
        "inventory:adjust.select",
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

      await executeWithRetry(
        conn,
        `UPDATE PRODUCTS SET STOCK_QUANTITY = ?, UPDATED_AT = NOW() WHERE ID = ?`,
        [newQty, productId],
        "inventory:adjust.update",
      );

      await executeWithRetry(
        conn,
        `INSERT INTO MANAGE_INVENTORY (PRODUCT_ID, QUANTITY, LAST_UPDATED)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE QUANTITY = VALUES(QUANTITY), LAST_UPDATED = NOW()`,
        [productId, newQty],
        "inventory:adjust.upsert",
      );

      const [rows] = await executeWithRetry(
        conn,
        `SELECT ID, VENDOR_ID, NAME, CODE, DESCRIPTION, CONDITIONAL, PRICE, STOCK_QUANTITY, IMAGE_URL, CREATED_AT, UPDATED_AT
         FROM PRODUCTS
         WHERE ID = ?`,
        [productId],
        "inventory:adjust.select2",
      );

      await conn.commit();

      const updated = safePublicProductRow(rows?.[0]);

      // send enough info for UI to refresh fast
      io.emit("inventory:updated", {
        product_id: productId,
        stock_quantity: updated?.stock_quantity,
      });

      pushActivity({
        id: Date.now(),
        type: "inventory",
        message: `Inventory updated for product ID ${productId} (new qty: ${updated?.stock_quantity})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][inventory:adjust] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: updated });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error(
        `[socket][inventory:adjust] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to adjust inventory." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  /* =========================================================
     DELETE PRODUCT (vendor owns product OR admin)
     ========================================================= */
  socket.on("product:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const role = normalizeRole(currentUser?.role);

    const productId = toInt(payload.id);
    if (!userId) return ack({ success: false, message: "Unauthorized." });
    if (!productId) return ack({ success: false, message: "Product id is required." });

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [pRows] = await executeWithRetry(
        conn,
        `SELECT ID, VENDOR_ID, NAME FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
        "product:delete.select",
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

      await executeWithRetry(
        conn,
        `DELETE FROM MANAGE_INVENTORY WHERE PRODUCT_ID = ?`,
        [productId],
        "product:delete.inventory",
      );

      await executeWithRetry(
        conn,
        `DELETE FROM PRODUCTS WHERE ID = ?`,
        [productId],
        "product:delete.product",
      );

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
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error(
        `[socket][product:delete] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to delete product." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });
}
