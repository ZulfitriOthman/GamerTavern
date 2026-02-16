// Backend/sockets/product.socket.js
import fs from "fs";
import path from "path";

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

/* ============================================================================
   Local image helpers
   - We store DB IMAGE_URL like: "/public/uploads/products/<filename>"
   - Actual file on disk: "<project>/public/uploads/products/<filename>"
   ============================================================================ */
const publicPath = path.join(process.cwd(), "public");

function isLocalProductImage(url) {
  return typeof url === "string" && url.startsWith("/public/uploads/products/");
}

function localImageDiskPath(url) {
  const rel = url.replace(/^\/public\//, "");
  return path.join(publicPath, rel);
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("[product.image] unlink failed:", e?.message || e);
  }
}

function safePublicProductRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    vendor_id: row.VENDOR_ID,
    name: row.NAME,
    code: row.CODE,
    description: row.DESCRIPTION,
    conditional: row.CONDITIONAL,
    price: row.PRICE,
    stock_quantity: row.STOCK_QUANTITY,
    image_url: row.IMAGE_URL,
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

      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
  }

  console.error(`[executeWithRetry] failed label=${label}`, lastErr);
  throw lastErr;
}

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

    const vendorId = payload.vendorId != null ? toInt(payload.vendorId) : null;
    const search = toStr(payload.search);

    const category = toStr(payload.category);
    const tcg = toStr(payload.tcg);

    const dateFrom = toStr(payload.dateFrom);
    const dateTo = toStr(payload.dateTo);

    const sort = toStr(payload.sort || "newest").toLowerCase();

    try {
      const where = [];
      const params = [];

      if (vendorId) {
        where.push("VENDOR_ID = ?");
        params.push(vendorId);
      }

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

      // SAFE search (no CATEGORY dependency)
      if (search) {
        where.push("(NAME LIKE ? OR CODE LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      // ORDER BY whitelist
      let orderBy = "ID DESC";
      if (sort === "oldest") orderBy = "ID ASC";
      if (sort === "az") orderBy = "NAME ASC";
      if (sort === "za") orderBy = "NAME DESC";
      if (sort === "price_asc") orderBy = "PRICE ASC, ID DESC";
      if (sort === "price_desc") orderBy = "PRICE DESC, ID DESC";

      // OPTIONAL (only if CATEGORY exists)
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
      console.error(`[socket][product:list] ❌ error in ${Date.now() - t0}ms`, err);
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
      return ack({ success: false, message: "Only vendors/admin can create products." });
    }

    const name = toStr(payload.name);
    const code = toStr(payload.code);
    const description = payload.description ?? null;
    const conditional = toStr(payload.conditional);
    const price = toInt(payload.price);
    const stockQty = toInt(payload.stock_quantity ?? payload.stockQty ?? 0);
    const imageUrl = payload.image_url ?? payload.imageUrl ?? null;

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
      console.error(`[socket][product:create] ❌ error in ${Date.now() - t0}ms`, err);
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
        `SELECT ID, VENDOR_ID, IMAGE_URL FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
        "product:update.ownercheck",
      );
      const p = pRows?.[0];
      if (!p) return ack({ success: false, message: "Product not found." });

      const oldImageUrl = p?.IMAGE_URL || null;

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

      const incomingImageUrl =
        payload.image_url != null || payload.imageUrl != null
          ? toStr(payload.image_url ?? payload.imageUrl)
          : null;

      const imageWasIncluded = incomingImageUrl != null;
      const imageChanged = imageWasIncluded && toStr(incomingImageUrl) !== toStr(oldImageUrl);

      if (payload.image_url != null || payload.imageUrl != null) {
        fields.push("IMAGE_URL = ?");
        params.push(payload.image_url ?? payload.imageUrl);
      }

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

      // Delete old local image if replaced by a new one
      if (imageChanged && isLocalProductImage(oldImageUrl)) {
        safeUnlink(localImageDiskPath(oldImageUrl));
      }

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
      console.error(`[socket][inventory:adjust] ❌ error in ${Date.now() - t0}ms`, err);
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
        `SELECT ID, VENDOR_ID, NAME, IMAGE_URL FROM PRODUCTS WHERE ID = ? LIMIT 1`,
        [productId],
        "product:delete.select",
      );
      const p = pRows?.[0];
      if (!p) {
        await conn.rollback();
        return ack({ success: false, message: "Product not found." });
      }

      const oldImageUrl = p?.IMAGE_URL || null;

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

      // Delete local image file after DB commit
      if (isLocalProductImage(oldImageUrl)) {
        safeUnlink(localImageDiskPath(oldImageUrl));
      }

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
      console.error(`[socket][product:delete] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to delete product." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });
}
