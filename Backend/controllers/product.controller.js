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
import { writeAuditLog } from "../modules/auditLog.module.js";

const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

// App-validated (products.status is plain VARCHAR(20), no DB enum/CHECK — see
// Database/schema/003_catalog.sql header policy). 'active'/'archived' predate the
// marketplace; 'draft'/'out_of_stock' were added additively (now baked directly
// into Database/schema/003_catalog.sql's products definition).
const PRODUCT_STATUSES = ["draft", "active", "out_of_stock", "archived"];

// Only these two PRODUCT_CATEGORIES.slug values may ever carry a
// products.tcg_game_id — matched by SLUG (stable) rather than NAME (a
// merchant-facing label that could theoretically be renamed). A card in
// "Trading Card Games" belongs to exactly one game, so it's required; a
// "TCG Accessories" item (sleeves, deck boxes) may optionally be
// game-branded. Every other category must never carry one — see
// resolveTcgGameRequirement() below, the single place this is decided so
// create and update can never diverge.
const TCG_GAME_REQUIRED_SLUG = "trading-card-games";
const TCG_GAME_OPTIONAL_SLUG = "tcg-accessories";

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
      `SELECT role FROM USERS WHERE id = ? LIMIT 1`,
      [userId],
      "auth:role.lookup"
    );

    return normalizeRole(rows?.[0]?.role);
  } catch (err) {
    console.error("[product.socket] role lookup failed:", err?.message || err);
    return ROLES.USER;
  }
}

// Marketplace merchant scoping (additive — see Database/schema/004_merchants.sql).
// A vendor with no merchant_users row at all is a legacy/standalone
// vendor and keeps working exactly as before (merchant_id stays NULL on their
// products). A vendor who *does* belong to a merchant is gated by that
// merchant's status — PENDING/SUSPENDED/REJECTED merchants cannot list live
// products, per "Do NOT allow PENDING/SUSPENDED merchants unrestricted
// marketplace access." Never trust a client-supplied merchantId; this always
// resolves it server-side from the authenticated user's own membership.
async function resolveMerchantContextForVendor(db, userId) {
  try {
    const [rows] = await executeWithRetry(
      db,
      `SELECT mu.merchant_id, m.status AS merchant_status
         FROM MERCHANT_USERS mu
         JOIN MERCHANTS m ON m.id = mu.merchant_id
        WHERE mu.user_id = ? AND mu.status = 'active'
        LIMIT 1`,
      [userId],
      "merchant:context.lookup"
    );
    const row = rows?.[0];
    if (!row) return { merchantId: null, isMarketplaceMerchant: false, merchantStatus: null };
    return { merchantId: row.merchant_id, isMarketplaceMerchant: true, merchantStatus: row.merchant_status };
  } catch (err) {
    console.error("[product.socket] merchant context lookup failed:", err?.message || err);
    return { merchantId: null, isMarketplaceMerchant: false, merchantStatus: null };
  }
}

// Product ownership (Phase 1.5 fix): the original check only allowed the
// exact vendor_id that created a product to update/delete/archive/adjust
// it, which silently locked out any MERCHANT_ADMIN/MERCHANT_EMPLOYEE
// staff added later via POST /api/merchant/staff — they could see the
// product (merchant-scoped reads) but never manage it. This lets any
// ACTIVE staff member of the SAME merchant that owns the product manage
// it too, matching the merchant permission matrix (item 13): staff
// manage products/inventory, only settings/bank-details are OWNER-only.
async function isActiveStaffOfMerchant(db, userId, merchantId) {
  if (!merchantId) return false;
  try {
    const [rows] = await executeWithRetry(
      db,
      `SELECT 1 FROM MERCHANT_USERS WHERE user_id = ? AND merchant_id = ? AND status = 'active' LIMIT 1`,
      [userId, merchantId],
      "merchant:staff.check"
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[product.socket] staff check failed:", err?.message || err);
    return false;
  }
}

// Resolves whether a category requires, optionally allows, or must never
// carry a tcg_game_id — by SLUG, not a hardcoded category ID (seed data
// order/IDs aren't guaranteed across environments). Returns "none" for an
// unknown/deleted categoryId so a bad ID fails closed (no game) rather than
// throwing.
async function resolveTcgGameRequirement(db, categoryId) {
  const [rows] = await executeWithRetry(db, `SELECT slug FROM PRODUCT_CATEGORIES WHERE id = ? LIMIT 1`, [categoryId], "product:tcgRequirement");
  const slug = rows?.[0]?.slug;
  if (slug === TCG_GAME_REQUIRED_SLUG) return "required";
  if (slug === TCG_GAME_OPTIONAL_SLUG) return "optional";
  return "none";
}

// Product Type (Single Card, Booster Box, ...) requirement, generalized
// rather than hardcoded to one category slug: a category requires one iff
// PRODUCT_TYPES actually has active rows configured for it. Today only
// Trading Card Games has any seeded — Gunpla/Computer Parts automatically
// start requiring one the moment rows exist for them, with zero code
// change. Mirrors resolveTcgGameRequirement()'s "single source of truth"
// role but reads the requirement from data, not a literal.
async function resolveProductTypeRequirement(db, categoryId) {
  try {
    const [rows] = await executeWithRetry(
      db,
      `SELECT id FROM PRODUCT_TYPES WHERE category_id = ? AND status = 'active' LIMIT 1`,
      [categoryId],
      "product:productTypeRequirement"
    );
    return rows?.length ? "required" : "none";
  } catch (err) {
    // Fails open to "none" (never required, never blocks create/update) if
    // PRODUCT_TYPES doesn't exist yet on this database — migrations/0008
    // may not have been applied yet wherever this code is deployed. Once
    // applied, this starts requiring/gating normally with no code change.
    console.error("[product.socket] resolveProductTypeRequirement failed (PRODUCT_TYPES may not exist yet):", err?.message || err);
    return "none";
  }
}

// Merchant-status gate (closes a bypass): previously a merchant-linked
// product's own creating vendor could still update/archive/adjust it purely
// via `vendorId === userId`, without ever checking merchant status — so a
// SUSPENDED/BANNED merchant's owner account kept editing rights the create
// path already denies. Legacy standalone vendors (merchantId null) are
// unaffected — there's no merchant status to gate on for them.
async function canManageProduct(db, { role, userId, vendorId, merchantId }) {
  if (role === ROLES.ADMIN) return true;
  if (!merchantId) return toInt(vendorId) === userId;

  const [rows] = await executeWithRetry(
    db,
    `SELECT status FROM MERCHANTS WHERE id = ? LIMIT 1`,
    [merchantId],
    "merchant:status.check"
  );
  if (rows?.[0]?.status !== "ACTIVE") return false;

  if (toInt(vendorId) === userId) return true;
  return isActiveStaffOfMerchant(db, userId, merchantId);
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
    merchant_id: row.merchant_id ?? null,
    seller_name: row.seller_name ?? null,
    // The merchant's storefront name (merchants.display_name) — falls back to null for
    // legacy standalone vendors with no merchant_id; the frontend falls back to
    // seller_name in that case rather than the backend duplicating that choice.
    merchant_name: row.merchant_name ?? null,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    // category_slug/product_type_slug: the stable identifiers the storefront
    // matches on (e.g. "trading-card-games", "single-card") — display NAMEs
    // are presentation text a merchant/admin could rename; never match UI
    // behavior against them (see ProductCard.jsx).
    category_slug: row.category_slug ?? null,
    tcg_game_id: row.tcg_game_id ?? null,
    tcg_game_name: row.tcg_game_name ?? null,
    product_type_id: row.product_type_id ?? null,
    product_type_name: row.product_type_name ?? null,
    product_type_slug: row.product_type_slug ?? null,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description,
    short_description: row.short_description ?? null,
    brand: row.brand ?? null,
    condition_label: row.condition_label,
    price: row.price,
    stock_quantity: row.stock_quantity,
    low_stock_threshold: row.low_stock_threshold ?? null,
    featured: Boolean(row.featured),
    weight_grams: row.weight_grams ?? null,
    tags: row.tags ?? null,
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
     FROM PRODUCT_IMAGES
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
  await conn.execute(`DELETE FROM PRODUCT_IMAGES WHERE product_id = ?`, [productId]);

  const list = Array.isArray(images) ? images.filter((img) => img && img.url) : [];
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    await conn.execute(
      `INSERT INTO PRODUCT_IMAGES (product_id, image_url, sort_order, is_primary)
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
        `SELECT id, name, slug, description FROM PRODUCT_CATEGORIES ORDER BY name`
      );
      return ack({ success: true, data: rows || [] });
    } catch (err) {
      console.error("[socket][product_categories:list] error", err);
      return ack({ success: false, message: "Failed to load product categories." });
    }
  });

  /* =========================================================
     LIST PRODUCT TYPES (public) — e.g. Single Card, Booster Box under
     Trading Card Games. Scoped per category (PRODUCT_TYPES.category_id) so
     this naturally extends to future categories (Gunpla grades, Computer
     Parts component types, ...) without any schema change — just seed
     rows. Fetches the full active list, same pattern as
     product_categories:list / tcgcategories:list; callers filter by
     category_id client-side.
     ========================================================= */
  socket.on("product_types:list", async (_payload, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    try {
      const [rows] = await db.query(
        `SELECT id, category_id, name, slug, sort_order FROM PRODUCT_TYPES WHERE status = 'active' ORDER BY category_id, sort_order, name`
      );
      return ack({ success: true, data: rows || [] });
    } catch (err) {
      console.error("[socket][product_types:list] error", err);
      return ack({ success: false, message: "Failed to load product types." });
    }
  });

  /* =========================================================
     LIST PRODUCTS (public)
     ========================================================= */
  socket.on("product:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const vendorId = payload.vendorId != null ? toInt(payload.vendorId) : null;
    const merchantId = payload.merchantId != null ? toInt(payload.merchantId) : null;
    // id/ids: added for the merchant "edit product" screen, which has no other way
    // to fetch a single known product (there was never a product:get event or REST
    // equivalent — this is the smallest correct addition rather than a new duplicate
    // endpoint, consistent with product reads staying on Socket.IO).
    const singleId = payload.id != null ? toInt(payload.id) : null;
    const ids = Array.isArray(payload.ids) ? payload.ids.map((v) => toInt(v)).filter(Boolean) : null;
    // slug: added for the public product-detail page (Shop revamp) — same
    // rationale as id/ids above, the smallest correct addition to this one
    // existing public read rather than a new endpoint.
    const slug = toStr(payload.slug);
    const categoryId = payload.categoryId != null ? toInt(payload.categoryId) : null;
    const tcgGameId = payload.tcgGameId != null ? toInt(payload.tcgGameId) : null;
    const productTypeId = payload.productTypeId != null ? toInt(payload.productTypeId) : null;
    const search = toStr(payload.search);
    const status = toStr(payload.status) || "active";
    const sort = toStr(payload.sort || "newest").toLowerCase();
    const page = Math.max(1, Math.trunc(Number(payload.page)) || 1);
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(payload.limit)) || 20));
    const offset = (page - 1) * limit;
    // Added for the public marketplace grid (Shop page) — all four read from
    // columns that already existed (price, stock_quantity, featured), no schema change.
    const minPrice = payload.minPrice != null && payload.minPrice !== "" ? toMoney(payload.minPrice) : null;
    const maxPrice = payload.maxPrice != null && payload.maxPrice !== "" ? toMoney(payload.maxPrice) : null;
    const inStock = payload.inStock === true || payload.inStock === "true";
    const featuredOnly = payload.featured === true || payload.featured === "true";

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
      if (merchantId) {
        where.push("p.merchant_id = ?");
        params.push(merchantId);
      } else {
        // No explicit merchant scope requested — this is the public marketplace
        // browse path (Shop page, homepage, etc.), so hide any product belonging
        // to a merchant that isn't ACTIVE (SUSPENDED/BANNED/PENDING/REJECTED).
        // A request that DOES pass merchantId is assumed to be that merchant's
        // own dashboard viewing its own catalog (see requireMerchant's
        // allowReadOnlyWhenSuspended) and is deliberately exempt — read-only
        // self-access to a suspended merchant's own products should still work.
        where.push("(p.merchant_id IS NULL OR m.status = 'ACTIVE')");
      }
      if (singleId) {
        where.push("p.id = ?");
        params.push(singleId);
      }
      if (ids && ids.length) {
        where.push(`p.id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
      if (slug) {
        where.push("p.slug = ?");
        params.push(slug);
      }
      if (categoryId) {
        where.push("p.category_id = ?");
        params.push(categoryId);
      }
      if (tcgGameId) {
        where.push("p.tcg_game_id = ?");
        params.push(tcgGameId);
      }
      if (productTypeId) {
        where.push("p.product_type_id = ?");
        params.push(productTypeId);
      }
      if (search) {
        // Tags/brand/short_description are free-text discovery aids (point 7 of
        // the TCG-game fix) — search may still match them; only the structured
        // tcgGameId filter above determines which game a product belongs to.
        where.push("(p.name LIKE ? OR p.code LIKE ? OR p.tags LIKE ? OR p.brand LIKE ? OR p.short_description LIKE ?)");
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (minPrice != null) {
        where.push("p.price >= ?");
        params.push(minPrice);
      }
      if (maxPrice != null) {
        where.push("p.price <= ?");
        params.push(maxPrice);
      }
      if (inStock) {
        where.push("p.stock_quantity > 0");
      }
      if (featuredOnly) {
        where.push("p.featured = 1");
      }

      let orderBy = "p.id DESC";
      if (sort === "oldest") orderBy = "p.id ASC";
      if (sort === "az") orderBy = "p.name ASC";
      if (sort === "za") orderBy = "p.name DESC";
      if (sort === "price_asc") orderBy = "p.price ASC, p.id DESC";
      if (sort === "price_desc") orderBy = "p.price DESC, p.id DESC";
      // "featured" sort is used by the public Shop grid's default view — falls back to
      // newest-first for everything else, same as p.id DESC already does above.
      if (sort === "featured") orderBy = "p.featured DESC, p.id DESC";

      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [[{ total }]] = await executeWithRetry(
        db,
        `SELECT COUNT(*) AS total FROM PRODUCTS p LEFT JOIN MERCHANTS m ON m.id = p.merchant_id ${whereClause}`,
        params,
        "product:list.count"
      );

      const sql = `
        SELECT
          p.id, p.vendor_id, p.merchant_id, p.category_id, p.tcg_game_id, p.product_type_id, p.name, p.slug, p.code,
          p.description, p.short_description, p.brand, p.condition_label, p.price,
          p.stock_quantity, p.low_stock_threshold, p.featured, p.weight_grams, p.tags, p.status,
          p.created_at, p.updated_at,
          u.name AS seller_name,
          m.display_name AS merchant_name,
          c.name AS category_name,
          c.slug AS category_slug,
          g.name AS tcg_game_name,
          pt.name AS product_type_name,
          pt.slug AS product_type_slug
        FROM PRODUCTS p
        LEFT JOIN USERS u ON u.id = p.vendor_id
        LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
        LEFT JOIN PRODUCT_CATEGORIES c ON c.id = p.category_id
        LEFT JOIN TCG_GAMES g ON g.id = p.tcg_game_id
        LEFT JOIN PRODUCT_TYPES pt ON pt.id = p.product_type_id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

      const [rows] = await executeWithRetry(db, sql, [...params, limit, offset], "product:list");
      const products = (rows || []).map(safePublicProductRow);
      const imagesMap = await fetchImagesByProductIds(db, products.map((p) => p.id));
      for (const p of products) {
        p.images = imagesMap.get(p.id) || [];
      }

      console.log(`[socket][product:list] ✅ ok in ${Date.now() - t0}ms`);
      return ack({
        success: true,
        data: { items: products, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } },
      });
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

    const merchantContext = await resolveMerchantContextForVendor(db, userId);
    if (merchantContext.isMarketplaceMerchant && merchantContext.merchantStatus !== "ACTIVE") {
      return ack({
        success: false,
        code: "MERCHANT_NOT_ACTIVE",
        message: `Your merchant account is ${merchantContext.merchantStatus} and cannot list products yet.`,
      });
    }

    const name = toStr(payload.name);
    const code = toStr(payload.code);
    const categoryId = toInt(payload.categoryId ?? payload.category_id);
    const tcgGameId = payload.tcgGameId ?? payload.tcg_game_id;
    const productTypeId = payload.productTypeId ?? payload.product_type_id;
    const description = payload.description ?? null;
    const shortDescription = payload.shortDescription ?? payload.short_description ?? null;
    const brand = toStr(payload.brand) || null;
    const conditionLabel = toStr(payload.conditionLabel ?? payload.condition_label);
    const price = toMoney(payload.price);
    const stockQty = toInt(payload.stockQuantity ?? payload.stock_quantity ?? 0);
    const lowStockThreshold =
      payload.lowStockThreshold ?? payload.low_stock_threshold ? toInt(payload.lowStockThreshold ?? payload.low_stock_threshold) : null;
    const featured = Boolean(payload.featured);
    const weightGrams = payload.weightGrams ?? payload.weight_grams ? toInt(payload.weightGrams ?? payload.weight_grams) : null;
    const tags = toStr(payload.tags) || null;
    const status = toStr(payload.status) || "active";
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
    if (!PRODUCT_STATUSES.includes(status)) {
      return ack({ success: false, message: `status must be one of: ${PRODUCT_STATUSES.join(", ")}` });
    }

    // TCG Game gating (never trust the frontend alone): required for
    // Trading Card Games, optional for TCG Accessories, forced to null for
    // every other category regardless of what was submitted.
    const tcgRequirement = await resolveTcgGameRequirement(db, categoryId);
    if (tcgRequirement === "required" && !tcgGameId) {
      return ack({ success: false, code: "TCG_GAME_REQUIRED", message: "TCG Game is required for products in the Trading Card Games category." });
    }
    let effectiveTcgGameId = tcgRequirement === "none" ? null : tcgGameId || null;
    if (effectiveTcgGameId) {
      const [gameRows] = await executeWithRetry(db, `SELECT id FROM TCG_GAMES WHERE id = ? LIMIT 1`, [effectiveTcgGameId], "product:tcgGame.lookup");
      if (!gameRows?.[0]) {
        return ack({ success: false, message: "Selected TCG Game does not exist." });
      }
    }

    // Product Type gating — same "required only if the category has any
    // configured, forced null otherwise" rule as TCG Game above, plus a
    // scoping check: a selected type must actually belong to the category
    // being saved (never trust the client to only ever send a matching one).
    const productTypeRequirement = await resolveProductTypeRequirement(db, categoryId);
    if (productTypeRequirement === "required" && !productTypeId) {
      return ack({ success: false, code: "PRODUCT_TYPE_REQUIRED", message: "Product Type is required for products in this category." });
    }
    let effectiveProductTypeId = productTypeRequirement === "none" ? null : productTypeId || null;
    if (effectiveProductTypeId) {
      const [typeRows] = await executeWithRetry(db, `SELECT id FROM PRODUCT_TYPES WHERE id = ? AND category_id = ? LIMIT 1`, [effectiveProductTypeId, categoryId], "product:productType.lookup");
      if (!typeRows?.[0]) {
        return ack({ success: false, message: "Selected Product Type does not belong to this category." });
      }
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
            `INSERT INTO PRODUCTS
              (vendor_id, merchant_id, category_id, tcg_game_id, product_type_id, name, slug, code, description,
               short_description, brand, condition_label, price, stock_quantity, low_stock_threshold,
               featured, weight_grams, tags, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId, merchantContext.merchantId, categoryId, effectiveTcgGameId, effectiveProductTypeId, name, slug, code, description,
              shortDescription, brand, conditionLabel || null, price, stockQty, lowStockThreshold,
              featured ? 1 : 0, weightGrams, tags, status,
            ]
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
          `INSERT INTO INVENTORY_MOVEMENTS (product_id, delta, reason) VALUES (?, ?, ?)`,
          [productId, stockQty, "initial_stock"]
        );
      }

      await replaceProductImages(conn, productId, images);

      await conn.commit();

      const [rows] = await db.execute(
        `SELECT p.id, p.vendor_id, p.merchant_id, p.category_id, p.tcg_game_id, p.product_type_id, p.name, p.slug, p.code,
                p.description, p.short_description, p.brand, p.condition_label, p.price,
          p.stock_quantity, p.low_stock_threshold, p.featured, p.weight_grams, p.tags, p.status,
                p.created_at, p.updated_at,
                u.name AS seller_name, m.display_name AS merchant_name, c.name AS category_name, c.slug AS category_slug, g.name AS tcg_game_name, pt.name AS product_type_name, pt.slug AS product_type_slug
         FROM PRODUCTS p
         LEFT JOIN USERS u ON u.id = p.vendor_id
         LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
         LEFT JOIN PRODUCT_CATEGORIES c ON c.id = p.category_id
         LEFT JOIN TCG_GAMES g ON g.id = p.tcg_game_id
         LEFT JOIN PRODUCT_TYPES pt ON pt.id = p.product_type_id
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

      await writeAuditLog(db, {
        actorUserId: userId,
        actorMerchantId: merchantContext.merchantId,
        action: "PRODUCT_CREATED",
        entityType: "product",
        entityId: productId,
        metadata: { name: product?.name, price, stockQty },
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
      return ack({ success: false, message: "Only vendors/admin can update PRODUCTS." });
    }
    if (!productId) return ack({ success: false, message: "Product id is required." });

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [pRows] = await conn.execute(
        `SELECT id, vendor_id, merchant_id, category_id, tcg_game_id, product_type_id FROM PRODUCTS WHERE id = ? LIMIT 1`,
        [productId]
      );
      const p = pRows?.[0];
      if (!p) {
        await conn.rollback();
        return ack({ success: false, message: "Product not found." });
      }

      const allowed = await canManageProduct(db, { role, userId, vendorId: p.vendor_id, merchantId: p.merchant_id });
      if (!allowed) {
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
      const categoryChanged = payload.categoryId != null || payload.category_id != null;
      const effectiveCategoryId = categoryChanged ? toInt(payload.categoryId ?? payload.category_id) : p.category_id;
      if (categoryChanged) {
        fields.push("category_id = ?");
        params.push(effectiveCategoryId);
      }

      // TCG Game gating (same rule as create, never trust the frontend
      // alone): required for Trading Card Games, optional for TCG
      // Accessories, forced to null for every other category — so a
      // category changed AWAY from a TCG-related one can never leave a
      // stale tcg_game_id behind, even if the client didn't send one.
      const tcgGameIdSubmitted = payload.tcgGameId !== undefined || payload.tcg_game_id !== undefined;
      const submittedTcgGameId = payload.tcgGameId ?? payload.tcg_game_id ?? null;
      const tcgRequirement = await resolveTcgGameRequirement(db, effectiveCategoryId);

      if (tcgRequirement === "required") {
        const finalTcgGameId = tcgGameIdSubmitted ? submittedTcgGameId : p.tcg_game_id;
        if (!finalTcgGameId) {
          await conn.rollback();
          return ack({ success: false, code: "TCG_GAME_REQUIRED", message: "TCG Game is required for products in the Trading Card Games category." });
        }
      }

      if (tcgRequirement === "none") {
        if (p.tcg_game_id != null) {
          fields.push("tcg_game_id = ?");
          params.push(null);
        }
      } else if (tcgGameIdSubmitted) {
        if (submittedTcgGameId) {
          const [gameRows] = await conn.query(`SELECT id FROM TCG_GAMES WHERE id = ? LIMIT 1`, [submittedTcgGameId]);
          if (!gameRows?.[0]) {
            await conn.rollback();
            return ack({ success: false, message: "Selected TCG Game does not exist." });
          }
        }
        fields.push("tcg_game_id = ?");
        params.push(submittedTcgGameId);
      }

      // Product Type gating — same rule as TCG Game above, generalized: a
      // category requires one iff PRODUCT_TYPES has active rows for it
      // (see resolveProductTypeRequirement), and a category changed away
      // from a configured one never leaves a stale product_type_id behind.
      const productTypeIdSubmitted = payload.productTypeId !== undefined || payload.product_type_id !== undefined;
      const submittedProductTypeId = payload.productTypeId ?? payload.product_type_id ?? null;
      const productTypeRequirement = await resolveProductTypeRequirement(db, effectiveCategoryId);

      if (productTypeRequirement === "required") {
        const finalProductTypeId = productTypeIdSubmitted ? submittedProductTypeId : p.product_type_id;
        if (!finalProductTypeId) {
          await conn.rollback();
          return ack({ success: false, code: "PRODUCT_TYPE_REQUIRED", message: "Product Type is required for products in this category." });
        }
      }

      if (productTypeRequirement === "none") {
        if (p.product_type_id != null) {
          fields.push("product_type_id = ?");
          params.push(null);
        }
      } else if (productTypeIdSubmitted) {
        if (submittedProductTypeId) {
          const [typeRows] = await conn.query(`SELECT id FROM PRODUCT_TYPES WHERE id = ? AND category_id = ? LIMIT 1`, [submittedProductTypeId, effectiveCategoryId]);
          if (!typeRows?.[0]) {
            await conn.rollback();
            return ack({ success: false, message: "Selected Product Type does not belong to this category." });
          }
        }
        fields.push("product_type_id = ?");
        params.push(submittedProductTypeId);
      }

      if (payload.status != null) {
        const status = toStr(payload.status);
        if (!PRODUCT_STATUSES.includes(status)) {
          await conn.rollback();
          return ack({ success: false, message: `status must be one of: ${PRODUCT_STATUSES.join(", ")}` });
        }
        fields.push("status = ?");
        params.push(status);
      }
      if (payload.shortDescription != null || payload.short_description != null) {
        fields.push("short_description = ?");
        params.push(payload.shortDescription ?? payload.short_description);
      }
      if (payload.brand != null) {
        fields.push("brand = ?");
        params.push(toStr(payload.brand) || null);
      }
      if (payload.lowStockThreshold !== undefined || payload.low_stock_threshold !== undefined) {
        const raw = payload.lowStockThreshold ?? payload.low_stock_threshold;
        fields.push("low_stock_threshold = ?");
        params.push(raw == null ? null : toInt(raw));
      }
      if (payload.featured != null) {
        fields.push("featured = ?");
        params.push(payload.featured ? 1 : 0);
      }
      if (payload.weightGrams !== undefined || payload.weight_grams !== undefined) {
        const raw = payload.weightGrams ?? payload.weight_grams;
        fields.push("weight_grams = ?");
        params.push(raw == null ? null : toInt(raw));
      }
      if (payload.tags != null) {
        fields.push("tags = ?");
        params.push(toStr(payload.tags) || null);
      }

      if (fields.length === 0 && payload.images === undefined) {
        await conn.rollback();
        return ack({ success: false, message: "No fields to update." });
      }

      if (fields.length > 0) {
        fields.push("updated_at = NOW()");
        params.push(productId);
        await conn.execute(`UPDATE PRODUCTS SET ${fields.join(", ")} WHERE id = ?`, params);
      }

      let removedImageUrls = [];
      if (payload.images !== undefined) {
        const [oldImages] = await conn.execute(
          `SELECT image_url FROM PRODUCT_IMAGES WHERE product_id = ?`,
          [productId]
        );
        removedImageUrls = (oldImages || []).map((r) => r.image_url);
        await replaceProductImages(conn, productId, payload.images);
      }

      await conn.commit();

      const [rows] = await db.execute(
        `SELECT p.id, p.vendor_id, p.merchant_id, p.category_id, p.tcg_game_id, p.product_type_id, p.name, p.slug, p.code,
                p.description, p.short_description, p.brand, p.condition_label, p.price,
          p.stock_quantity, p.low_stock_threshold, p.featured, p.weight_grams, p.tags, p.status,
                p.created_at, p.updated_at,
                u.name AS seller_name, m.display_name AS merchant_name, c.name AS category_name, c.slug AS category_slug, g.name AS tcg_game_name, pt.name AS product_type_name, pt.slug AS product_type_slug
         FROM PRODUCTS p
         LEFT JOIN USERS u ON u.id = p.vendor_id
         LEFT JOIN MERCHANTS m ON m.id = p.merchant_id
         LEFT JOIN PRODUCT_CATEGORIES c ON c.id = p.category_id
         LEFT JOIN TCG_GAMES g ON g.id = p.tcg_game_id
         LEFT JOIN PRODUCT_TYPES pt ON pt.id = p.product_type_id
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

      await writeAuditLog(db, {
        actorUserId: userId,
        actorMerchantId: p.merchant_id,
        action: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: productId,
        metadata: { fieldsChanged: Object.keys(payload) },
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
    const type = toStr(payload.type).toLowerCase();
    const rawQuantity = payload.quantity;
    const reason = toStr(payload.reason) || null;

    if (!canSell(role)) {
      return ack({ success: false, message: "Only vendors/admin can adjust inventory." });
    }
    if (!productId) return ack({ success: false, message: "product_id is required." });

    // The client is trusted for DIRECTION + MAGNITUDE only, never for a
    // pre-signed delta — this endpoint is the single source of truth for
    // turning ("stock_in"|"stock_out", quantity) into the signed delta
    // actually applied. Reject bad input outright rather than coercing it
    // (e.g. a negative quantity is a user mistake, not silently `Math.abs`'d
    // away) so the merchant sees a real validation error instead of a
    // silently "fixed" — and possibly wrong-direction — adjustment.
    if (type !== "stock_in" && type !== "stock_out") {
      return ack({ success: false, message: 'type must be "stock_in" or "stock_out".' });
    }
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity)) {
      return ack({ success: false, message: "quantity must be a number." });
    }
    if (quantity <= 0) {
      return ack({ success: false, message: "quantity must be greater than zero." });
    }
    if (!Number.isInteger(quantity)) {
      return ack({ success: false, message: "quantity must be a whole number (stock is tracked as whole units)." });
    }
    if (quantity > 1_000_000) {
      return ack({ success: false, message: "quantity is too large for a single adjustment." });
    }

    const delta = type === "stock_in" ? quantity : -quantity;

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [pRows] = await executeWithRetry(
        conn,
        `SELECT id, vendor_id, merchant_id, stock_quantity FROM PRODUCTS WHERE id = ? LIMIT 1 FOR UPDATE`,
        [productId],
        "inventory:adjust.select"
      );
      const p = pRows?.[0];
      if (!p) {
        await conn.rollback();
        return ack({ success: false, message: "Product not found." });
      }

      const allowed = await canManageProduct(db, { role, userId, vendorId: p.vendor_id, merchantId: p.merchant_id });
      if (!allowed) {
        await conn.rollback();
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const newQty = toInt(p.stock_quantity) + delta;
      if (newQty < 0) {
        await conn.rollback();
        return ack({
          success: false,
          message: `Cannot remove ${quantity} unit${quantity === 1 ? "" : "s"}. Only ${p.stock_quantity} unit${p.stock_quantity === 1 ? "" : "s"} currently available.`,
        });
      }

      await executeWithRetry(
        conn,
        `UPDATE PRODUCTS SET stock_quantity = ?, updated_at = NOW() WHERE id = ?`,
        [newQty, productId],
        "inventory:adjust.update"
      );

      await executeWithRetry(
        conn,
        `INSERT INTO INVENTORY_MOVEMENTS (product_id, delta, reason) VALUES (?, ?, ?)`,
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

      await writeAuditLog(db, {
        actorUserId: userId,
        actorMerchantId: p.merchant_id,
        action: "STOCK_ADJUSTED",
        entityType: "product",
        entityId: productId,
        metadata: { delta, newQty, reason },
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
        `SELECT id, vendor_id, merchant_id, name FROM PRODUCTS WHERE id = ? LIMIT 1`,
        [productId],
        "product:delete.select"
      );
      const p = pRows?.[0];
      if (!p) {
        return ack({ success: false, message: "Product not found." });
      }

      const allowed = await canManageProduct(db, { role, userId, vendorId: p.vendor_id, merchantId: p.merchant_id });
      if (!allowed) {
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      const [imgRows] = await db.execute(
        `SELECT image_url FROM PRODUCT_IMAGES WHERE product_id = ?`,
        [productId]
      );

      try {
        await executeWithRetry(db, `DELETE FROM PRODUCTS WHERE id = ?`, [productId], "product:delete.product");
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
      const [pRows] = await db.execute(`SELECT id, vendor_id, merchant_id FROM PRODUCTS WHERE id = ? LIMIT 1`, [productId]);
      const p = pRows?.[0];
      if (!p) return ack({ success: false, message: "Product not found." });

      const allowed = await canManageProduct(db, { role, userId, vendorId: p.vendor_id, merchantId: p.merchant_id });
      if (!allowed) {
        return ack({ success: false, message: "Forbidden (not owner)." });
      }

      await db.execute(`UPDATE PRODUCTS SET status = 'archived', updated_at = NOW() WHERE id = ?`, [productId]);
      io.emit("product:updated", { id: productId, status: "archived" });

      await writeAuditLog(db, { actorUserId: userId, actorMerchantId: p.merchant_id, action: "PRODUCT_ARCHIVED", entityType: "product", entityId: productId, metadata: null });

      return ack({ success: true, data: { id: productId, status: "archived" } });
    } catch (err) {
      console.error("[socket][product:archive] error", err);
      return ack({ success: false, message: "Failed to archive product." });
    }
  });

  /* =========================================================
     UPLOAD IMAGE (writes to disk, unrelated to schema)
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

      // Every other ack in this file replies { success, data } — emitWithAck.js
      // (the shared frontend helper) always resolves with response.data, never
      // top-level fields. This handler used to reply { success, imageUrl }
      // (flat), which meant emitWithAck() resolved to undefined on every
      // successful upload — the frontend consumer's `const { imageUrl } =
      // await uploadProductImage(...)` was crashing on the SUCCESS path.
      return ack({ success: true, data: { imageUrl } });
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
