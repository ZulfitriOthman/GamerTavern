// Backend/controllers/product.controller.js
//
// Migrated to the NanashiCollectibles v2 schema: PRODUCTS -> products,
// MANAGE_INVENTORY -> inventory_movements (a real audit log, not a duplicate
// mirror of stock_quantity), free-text CATEGORY -> category_id/tcg_game_id FKs,
// single IMAGE_URL -> product_images (multiple images per product).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { requireAuthenticated } from "../modules/authz.module.js";

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
const toMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

function normalizeRole(role) {
  const r = String(role || ROLES.USER).toUpperCase();
  return Object.values(ROLES).includes(r) ? r : ROLES.USER;
}

function canSell(role) {
  return role === ROLES.VENDOR || role === ROLES.ADMIN;
}

async function resolveRoleFromDb(db, userId) {
  if (!userId) return ROLES.USER;

  try {
    const [rows] = await executeWithRetry(
      db,
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [userId],
      "auth:role.lookup"
    );

    return normalizeRole(rows?.[0]?.role);
  } catch (err) {
    console.error("[product.socket] role lookup failed:", err?.message || err);
    return ROLES.USER;
  }
}

function slugify(name) {
  return toStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function uniqueSlugSuffix() {
  return crypto.randomBytes(3).toString("hex");
}

const publicPath = path.join(process.cwd(), "public");

function isLocalProductImage(url) {
  return typeof url === "string" && url.startsWith("/public/uploads/products/");
}

function localImageDiskPath(url) {
  const rel = String(url || "").replace(/^\/public\//, ""); // => "uploads/products/<file>"
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
    id: row.id,
    vendor_id: row.vendor_id,
    seller_name: row.seller_name ?? null,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    tcg_game_id: row.tcg_game_id ?? null,
    tcg_game_name: row.tcg_game_name ?? null,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description,
    condition_label: row.condition_label,
    price: row.price,
    stock_quantity: row.stock_quantity,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function executeWithRetry(dbOrConn, sql, params = [], label = "db.execute") {
  const max = 2;
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

async function fetchImagesByProductIds(db, ids) {
  if (!ids || ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await db.execute(
    `SELECT id, product_id, image_url, sort_order, is_primary
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY is_primary DESC, sort_order ASC, id ASC`,
    ids
  );
  const map = new Map();
  for (const r of rows || []) {
    if (!map.has(r.product_id)) map.set(r.product_id, []);
    map.get(r.product_id).push({
      id: r.id,
      image_url: r.image_url,
      sort_order: r.sort_order,
      is_primary: Boolean(r.is_primary),
    });
  }
  return map;
}

// Replaces every product_images row for a product with the given ordered list.
// Simple "replace the whole set" strategy — avoids diffing individual images,
// which the current single-image frontend doesn't need anyway.
async function replaceProductImages(conn, productId, images) {
  await conn.execute(`DELETE FROM product_images WHERE product_id = ?`, [productId]);

  const list = Array.isArray(images) ? images.filter((img) => img && img.url) : [];
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    await conn.execute(
      `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
       VALUES (?, ?, ?, ?)`,
      [productId, toStr(img.url), toInt(img.sortOrder, i), img.isPrimary || i === 0 ? 1 : 0]
    );
  }
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
     LIST PRODUCT CATEGORIES (public) — commerce categories, not TCG games
     ========================================================= */
  socket.on("product_categories:list", async (_payload, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    try {
      const [rows] = await db.query(
        `SELECT id, name, slug, description FROM product_categories ORDER BY name`
      );
      return ack({ success: true, data: rows || [] });
    } catch (err) {
      console.error("[socket][product_categories:list] error", err);
      return ack({ success: false, message: "Failed to load product categories." });
    }
  });

  /* =========================================================
     LIST PRODUCTS (public)
     ========================================================= */
  socket.on("product:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const vendorId = payload.vendorId != null ? toInt(payload.vendorId) : null;
    const categoryId = payload.categoryId != null ? toInt(payload.categoryId) : null;
    const tcgGameId = payload.tcgGameId != null ? toInt(payload.tcgGameId) : null;
    const search = toStr(payload.search);
    const status = toStr(payload.status) || "active";
    const sort = toStr(payload.sort || "newest").toLowerCase();

    try {
      const where = [];
      const params = [];

      if (status !== "all") {
        where.push("p.status = ?");
        params.push(status);
      }
      if (vendorId) {
        where.push("p.vendor_id = ?");
        params.push(vendorId);
      }
      if (categoryId) {
        where.push("p.category_id = ?");
        params.push(categoryId);
      }
      if (tcgGameId) {
        where.push("p.tcg_game_id = ?");
        params.push(tcgGameId);
      }
      if (search) {
        where.push("(p.name LIKE ? OR p.code LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      let orderBy = "p.id DESC";
      if (sort === "oldest") orderBy = "p.id ASC";
      if (sort === "az") orderBy = "p.name ASC";
      if (sort === "za") orderBy = "p.name DESC";
      if (sort === "price_asc") orderBy = "p.price ASC, p.id DESC";
      if (sort === "price_desc") orderBy = "p.price DESC, p.id DESC";

      const sql = `
        SELECT
          p.id, p.vendor_id, p.category_id, p.tcg_game_id, p.name, p.slug, p.code,
          p.description, p.condition_label, p.price, p.stock_quantity, p.status,
          p.created_at, p.updated_at,
          u.name AS seller_name,
          c.name AS category_name,
          g.name AS tcg_game_name
        FROM products p
        LEFT JOIN users u ON u.id = p.vendor_id
        LEFT JOIN product_categories c ON c.id = p.category_id
        LEFT JOIN tcg_games g ON g.id = p.tcg_game_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY ${orderBy}
      `;

      const [rows] = await executeWithRetry(db, sql, params, "product:list");
      const products = (rows || []).map(safePublicProductRow);
      const imagesMap = await fetchImagesByProductIds(db, products.map((p) => p.id));
      for (const p of products) {
        p.images = imagesMap.get(p.id) || [];
      }

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

    // Identity from the verified handshake, never the client-supplied payload.
    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);

    if (!canSell(role)) {
      return ack({
        success: false,
        message: "Only vendors/admin can create products.",
      });
    }

    const name = toStr(payload.name);
    const code = toStr(payload.code);
    const categoryId = toInt(payload.categoryId ?? payload.category_id);
    const tcgGameId = payload.tcgGameId ?? payload.tcg_game_id;
    const description = payload.description ?? null;
    const conditionLabel = toStr(payload.conditionLabel ?? payload.condition_label);
    const price = toMoney(payload.price);
    const stockQty = toInt(payload.stockQuantity ?? payload.stock_quantity ?? 0);
    const images = payload.images;

    if (!name || !code) {
      return ack({ success: false, message: "name and code are required." });
    }
    if (!categoryId) {
      return ack({ success: false, message: "categoryId is required." });
    }
    if (price == null || price < 0) {
      return ack({ success: false, message: "A valid, non-negative price is required." });
    }
    if (stockQty < 0) {
      return ack({ success: false, message: "stockQuantity cannot be negative." });
    }

    const slugBase = slugify(payload.slug || name) || `product-${Date.now()}`;

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      let productId;
      let slug = slugBase;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [res] = await conn.execute(
            `INSERT INTO products
              (vendor_id, category_id, tcg_game_id, name, slug, code, description,
               condition_label, price, stock_quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, categoryId, tcgGameId || null, name, slug, code, description, conditionLabel || null, price, stockQty]
          );
          productId = res.insertId;
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 2) {
            slug = `${slugBase}-${uniqueSlugSuffix()}`;
            continue;
          }
          throw err;
        }
      }

      if (stockQty > 0) {
        await conn.execute(
          `INSERT INTO inventory_movements (product_id, delta, reason) VALUES (?, ?, ?)`,
          [productId, stockQty, "initial_stock"]
        );
      }

      await replaceProductImages(conn, productId, images);

      await conn.commit();

      const [rows] = await db.execute(
        `SELECT p.id, p.vendor_id, p.category_id, p.tcg_game_id, p.name, p.slug, p.code,
                p.description, p.condition_label, p.price, p.stock_quantity, p.status,
                p.created_at, p.updated_at,
                u.name AS seller_name, c.name AS category_name, g.name AS tcg_game_name
         FROM products p
         LEFT JOIN users u ON u.id = p.vendor_id
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN tcg_games g ON g.id = p.tcg_game_id
         WHERE p.id = ?`,
        [productId]
      );

      const product = safePublicProductRow(rows?.[0]);
      const imagesMap = await fetchImagesByProductIds(db, [productId]);
      product.images = imagesMap.get(productId) || [];

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
     UPDATE PRODUCT
     ========================================================= */
  socket.on("product:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);
    const productId = toInt(payload.id);

    if (!canSell(role)) {
      return ack({ success: false, message: "Only vendors/admin can update products." });
    }
    if (!productId) return ack({ success: false, message: "Product id is required." });

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [pRows] = await conn.execute(
        `SELECT id, vendor_id FROM products WHERE id = ? LIMIT 1`,
        [productId]
      );
      const p = pRows?.[0];
      if (!p) {
        await conn.rollback();
        return ack({ success: false, message: "Product not found." });
      }

      const isOwner = toInt(p.vendor_id) === userId;
      const isAdmin = role === ROLES.ADMIN;
      if (!isOwner && !isAdmin) {
        await conn.rollback();
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const fields = [];
      const params = [];

      if (payload.name != null) {
        fields.push("name = ?");
        params.push(toStr(payload.name));
      }
      if (payload.code != null) {
        fields.push("code = ?");
        params.push(toStr(payload.code));
      }
      if (payload.description != null) {
        fields.push("description = ?");
        params.push(payload.description);
      }
      if (payload.conditionLabel != null || payload.condition_label != null) {
        fields.push("condition_label = ?");
        params.push(toStr(payload.conditionLabel ?? payload.condition_label));
      }
      if (payload.price != null) {
        const price = toMoney(payload.price);
        if (price == null || price < 0) {
          await conn.rollback();
          return ack({ success: false, message: "Invalid price." });
        }
        fields.push("price = ?");
        params.push(price);
      }
      if (payload.categoryId != null || payload.category_id != null) {
        fields.push("category_id = ?");
        params.push(toInt(payload.categoryId ?? payload.category_id));
      }
      if (payload.tcgGameId !== undefined || payload.tcg_game_id !== undefined) {
        fields.push("tcg_game_id = ?");
        params.push(payload.tcgGameId ?? payload.tcg_game_id ?? null);
      }
      if (payload.status != null) {
        fields.push("status = ?");
        params.push(toStr(payload.status));
      }

      if (fields.length === 0 && payload.images === undefined) {
        await conn.rollback();
        return ack({ success: false, message: "No fields to update." });
      }

      if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        params.push(productId);
        await conn.execute(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, params);
      }

      let removedImageUrls = [];
      if (payload.images !== undefined) {
        const [oldImages] = await conn.execute(
          `SELECT image_url FROM product_images WHERE product_id = ?`,
          [productId]
        );
        removedImageUrls = (oldImages || []).map((r) => r.image_url);
        await replaceProductImages(conn, productId, payload.images);
      }

      await conn.commit();

      const [rows] = await db.execute(
        `SELECT p.id, p.vendor_id, p.category_id, p.tcg_game_id, p.name, p.slug, p.code,
                p.description, p.condition_label, p.price, p.stock_quantity, p.status,
                p.created_at, p.updated_at,
                u.name AS seller_name, c.name AS category_name, g.name AS tcg_game_name
         FROM products p
         LEFT JOIN users u ON u.id = p.vendor_id
         LEFT JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN tcg_games g ON g.id = p.tcg_game_id
         WHERE p.id = ?`,
        [productId]
      );

      const updated = safePublicProductRow(rows?.[0]);
      const imagesMap = await fetchImagesByProductIds(db, [productId]);
      updated.images = imagesMap.get(productId) || [];
      const newImageUrls = new Set(updated.images.map((i) => i.image_url));

      io.emit("product:updated", updated);

      for (const oldUrl of removedImageUrls) {
        if (!newImageUrls.has(oldUrl) && isLocalProductImage(oldUrl)) {
          safeUnlink(localImageDiskPath(oldUrl));
        }
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
      try {
        await conn?.rollback();
      } catch {}
      console.error(`[socket][product:update] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to update product." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  /* =========================================================
     INVENTORY ADJUST
     ========================================================= */
  socket.on("inventory:adjust", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);

    const productId = toInt(payload.product_id ?? payload.productId);
    const delta = toInt(payload.delta);
    const reason = toStr(payload.reason) || null;

    if (!canSell(role)) {
      return ack({ success: false, message: "Only vendors/admin can adjust inventory." });
    }
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
        `SELECT id, vendor_id, stock_quantity FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
        [productId],
        "inventory:adjust.select"
      );
      const p = pRows?.[0];
      if (!p) {
        await conn.rollback();
        return ack({ success: false, message: "Product not found." });
      }

      const isOwner = toInt(p.vendor_id) === userId;
      const isAdmin = role === ROLES.ADMIN;
      if (!isOwner && !isAdmin) {
        await conn.rollback();
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const newQty = toInt(p.stock_quantity) + delta;
      if (newQty < 0) {
        await conn.rollback();
        return ack({
          success: false,
          message: `That adjustment would make stock negative (current: ${p.stock_quantity}, requested change: ${delta}).`,
        });
      }

      await executeWithRetry(
        conn,
        `UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?`,
        [newQty, productId],
        "inventory:adjust.update"
      );

      await executeWithRetry(
        conn,
        `INSERT INTO inventory_movements (product_id, delta, reason) VALUES (?, ?, ?)`,
        [productId, delta, reason],
        "inventory:adjust.insert"
      );

      await conn.commit();

      io.emit("inventory:updated", {
        product_id: productId,
        stock_quantity: newQty,
      });

      pushActivity({
        id: Date.now(),
        type: "inventory",
        message: `Inventory updated for product ID ${productId} (new qty: ${newQty})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][inventory:adjust] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: { product_id: productId, stock_quantity: newQty } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error(
        `[socket][inventory:adjust] ❌ error in ${Date.now() - t0}ms`,
        err
      );
      return ack({ success: false, message: "Failed to adjust inventory." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  /* =========================================================
     DELETE PRODUCT
     ========================================================= */
  socket.on("product:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);

    const productId = toInt(payload.id);
    if (!canSell(role)) {
      return ack({ success: false, message: "Only vendors/admin can delete products." });
    }
    if (!productId) return ack({ success: false, message: "Product id is required." });

    try {
      const [pRows] = await executeWithRetry(
        db,
        `SELECT id, vendor_id, name FROM products WHERE id = ? LIMIT 1`,
        [productId],
        "product:delete.select"
      );
      const p = pRows?.[0];
      if (!p) {
        return ack({ success: false, message: "Product not found." });
      }

      const isOwner = toInt(p.vendor_id) === userId;
      const isAdmin = role === ROLES.ADMIN;
      if (!isOwner && !isAdmin) {
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const [imgRows] = await db.execute(
        `SELECT image_url FROM product_images WHERE product_id = ?`,
        [productId]
      );

      try {
        await executeWithRetry(db, `DELETE FROM products WHERE id = ?`, [productId], "product:delete.product");
      } catch (err) {
        // inventory_movements.product_id is ON DELETE RESTRICT by design — a product
        // with real stock history can't be hard-deleted. Archive it instead.
        if (err?.code === "ER_ROW_IS_REFERENCED_2" || err?.code === "ER_ROW_IS_REFERENCED") {
          return ack({
            success: false,
            message: "This product has inventory history and can't be deleted — archive it instead.",
          });
        }
        throw err;
      }

      io.emit("product:deleted", { id: productId });

      for (const row of imgRows || []) {
        if (isLocalProductImage(row.image_url)) {
          safeUnlink(localImageDiskPath(row.image_url));
        }
      }

      pushActivity({
        id: Date.now(),
        type: "product",
        message: `Product deleted: ${p?.name || "item"} (ID ${productId})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][product:delete] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true });
    } catch (err) {
      console.error(`[socket][product:delete] ❌ error in ${Date.now() - t0}ms`, err);
      return ack({ success: false, message: "Failed to delete product." });
    }
  });

  /* =========================================================
     ARCHIVE PRODUCT (soft delete — preferred over product:delete once a
     product has any inventory history)
     ========================================================= */
  socket.on("product:archive", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);
    const productId = toInt(payload.id);

    if (!canSell(role)) {
      return ack({ success: false, message: "Only vendors/admin can archive products." });
    }
    if (!productId) return ack({ success: false, message: "Product id is required." });

    try {
      const [pRows] = await db.execute(`SELECT id, vendor_id FROM products WHERE id = ? LIMIT 1`, [productId]);
      const p = pRows?.[0];
      if (!p) return ack({ success: false, message: "Product not found." });

      const isOwner = toInt(p.vendor_id) === userId;
      const isAdmin = role === ROLES.ADMIN;
      if (!isOwner && !isAdmin) {
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      await db.execute(`UPDATE products SET status = 'archived', updated_at = NOW() WHERE id = ?`, [productId]);
      io.emit("product:updated", { id: productId, status: "archived" });

      return ack({ success: true, data: { id: productId, status: "archived" } });
    } catch (err) {
      console.error("[socket][product:archive] error", err);
      return ack({ success: false, message: "Failed to archive product." });
    }
  });

  /* =========================================================
     UPLOAD IMAGE (unchanged — writes to disk, unrelated to schema)
     ========================================================= */
  socket.on("image:upload", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const identity = requireAuthenticated(socket);
    if (!identity.ok) return ack({ success: false, code: identity.code, message: identity.message });
    const userId = toInt(identity.user.id);
    const role = await resolveRoleFromDb(db, userId);

    if (!canSell(role)) {
      return ack({
        success: false,
        message: "Only vendors/admin can upload images.",
      });
    }

    try {
      const base64Data = payload.base64 || payload.data || "";
      const fileName = payload.fileName || "";

      if (!base64Data) {
        return ack({ success: false, message: "No image data provided." });
      }

      if (!fileName) {
        return ack({ success: false, message: "No file name provided." });
      }

      const validExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
      if (!validExtensions.test(fileName)) {
        return ack({
          success: false,
          message: "Only .jpg, .jpeg, .png, .gif, .webp allowed.",
        });
      }

      const uploadsDir = path.join(publicPath, "uploads", "products");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = path.extname(fileName).toLowerCase();
      const safe = Date.now() + "-" + Math.random().toString(16).slice(2);
      const finalFileName = safe + ext;
      const filePath = path.join(uploadsDir, finalFileName);
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        return ack({ success: false, message: "File exceeds 5MB limit." });
      }

      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/public/uploads/products/${finalFileName}`;

      console.log(`[socket][image:upload] ✅ ok in ${Date.now() - t0}ms`);
      console.log(`  File: ${finalFileName}`);
      console.log(`  Size: ${(buffer.length / 1024).toFixed(2)}KB`);
      console.log(`  URL: ${imageUrl}`);

      return ack({ success: true, imageUrl });
    } catch (err) {
      console.error(
        `[socket][image:upload] ❌ error in ${Date.now() - t0}ms`,
        err
      );
      return ack({
        success: false,
        message: "Failed to upload image: " + (err?.message || "Unknown error"),
      });
    }
  });
}
