// Backend/routes/api/merchant.routes.js
//
// REPLACES the previous file entirely. The old version was an unmounted
// prototype (see NanashiCollectibles/CLAUDE.md "Merchant routes currently
// remain intentionally unmounted") that authenticated with a bearer token
// equal to the merchant's plaintext email, compared plaintext passwords,
// stored merchants/products/orders in in-memory Maps that don't exist
// anywhere in server.js's real `stores` object, and queried a `products`
// schema (id, merchant_id, stock, image) that doesn't match the real
// NanashiCollectibles_v2 `products` table (vendor_id, stock_quantity, ...).
// It was never a working feature, so replacing it is additive in effect,
// not a removal of working behavior.
//
// Design decision (documented in the audit report / NanashiCollectibles
// CLAUDE.md update that accompanies this change): a merchant is a
// business profile (merchants/merchant_users), layered on top of the
// EXISTING users/JWT auth system — merchant staff are just `users` rows
// with a merchant_users membership, and they authenticate through the
// same credential system as everyone else. Product CREATE/UPDATE/DELETE/
// ARCHIVE/INVENTORY stays on the existing, already-secure Socket.IO
// implementation (Backend/controllers/product.controller.js, extended to
// resolve merchant_id server-side) rather than being duplicated here as a
// second CRUD stack. This file only adds a read-only product list
// convenience endpoint plus everything that has no existing
// implementation: registration, staff, dashboard, orders, payouts,
// settings.
import { Router } from "express";
import bcrypt from "bcrypt";
import { signToken } from "../../modules/jwt.module.js";
import { requireAuth, withMerchantMembershipsLookup, requireMerchant, getMerchantMemberships } from "../../modules/restAuth.module.js";
import { MERCHANT_ORDER_STATUSES, canTransitionMerchantOrder } from "../../modules/orderStateMachine.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";
import { encryptField, maskLast4, isEncryptionConfigured } from "../../modules/encryption.module.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toStr(v) {
  return v == null ? "" : String(v).trim();
}

function slugify(name) {
  return toStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function toPublicUser(row) {
  if (!row) return null;
  return { sub: row.id, email: row.email, name: row.name, role: String(row.role || "").toUpperCase() };
}

async function computeDashboard(db, merchantId) {
  const [[todaySalesRow]] = await db.query(
    `SELECT COALESCE(SUM(merchant_net_amount), 0) AS total
       FROM merchant_orders
      WHERE merchant_id = ? AND status != 'CANCELLED' AND DATE(created_at) = CURDATE()`,
    [merchantId]
  );
  const [[totalSalesRow]] = await db.query(
    `SELECT COALESCE(SUM(merchant_net_amount), 0) AS total
       FROM merchant_orders
      WHERE merchant_id = ? AND status != 'CANCELLED'`,
    [merchantId]
  );
  const [[ordersTodayRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM merchant_orders WHERE merchant_id = ? AND DATE(created_at) = CURDATE()`,
    [merchantId]
  );
  const [[pendingOrdersRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM merchant_orders WHERE merchant_id = ? AND status = 'PROCESSING'`,
    [merchantId]
  );
  const [[productsRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM products WHERE merchant_id = ? AND status != 'archived'`,
    [merchantId]
  );
  const [[lowStockRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM products
      WHERE merchant_id = ? AND low_stock_threshold IS NOT NULL
        AND stock_quantity > 0 AND stock_quantity <= low_stock_threshold`,
    [merchantId]
  );
  const [[outOfStockRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM products WHERE merchant_id = ? AND stock_quantity = 0 AND status != 'archived'`,
    [merchantId]
  );

  const [recentOrders] = await db.query(
    `SELECT mo.id, mo.merchant_order_number, mo.status, mo.merchant_net_amount, mo.created_at,
            o.order_number
       FROM merchant_orders mo
       JOIN orders o ON o.id = mo.order_id
      WHERE mo.merchant_id = ?
      ORDER BY mo.created_at DESC
      LIMIT 10`,
    [merchantId]
  );

  const [topSelling] = await db.query(
    `SELECT oi.product_id, oi.product_name_snapshot AS name, SUM(oi.quantity) AS units_sold
       FROM order_items oi
       JOIN merchant_orders mo ON mo.id = oi.merchant_order_id
      WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED'
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY units_sold DESC
      LIMIT 5`,
    [merchantId]
  );

  const [revenueTrend] = await db.query(
    `SELECT DATE(created_at) AS day, COALESCE(SUM(merchant_net_amount), 0) AS total
       FROM merchant_orders
      WHERE merchant_id = ? AND status != 'CANCELLED' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC`,
    [merchantId]
  );

  return {
    todaySales: Number(todaySalesRow.total),
    totalSales: Number(totalSalesRow.total),
    ordersToday: Number(ordersTodayRow.count),
    pendingOrders: Number(pendingOrdersRow.count),
    products: Number(productsRow.count),
    lowStockProducts: Number(lowStockRow.count),
    outOfStockProducts: Number(outOfStockRow.count),
    recentOrders,
    topSellingProducts: topSelling,
    revenueTrend,
  };
}

// Recomputes the parent customer order's coarse status from the status of
// all of its merchant_orders. Deliberately simple, documented rollup —
// not itself the source of truth for any single merchant's fulfillment state.
async function recomputeOrderStatus(conn, orderId) {
  const [subOrders] = await conn.execute(`SELECT status FROM merchant_orders WHERE order_id = ?`, [orderId]);
  if (!subOrders.length) return;

  const statuses = subOrders.map((r) => r.status);
  let next;
  if (statuses.every((s) => s === "CANCELLED")) next = "CANCELLED";
  else if (statuses.every((s) => s === "DELIVERED" || s === "CANCELLED")) next = "DELIVERED";
  else if (statuses.some((s) => s === "SHIPPED" || s === "DELIVERED")) next = "SHIPPED";
  else if (statuses.some((s) => s === "READY")) next = "READY";
  else next = "PROCESSING";

  await conn.execute(`UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`, [next, orderId]);
}

export default function createMerchantRoutes({ db }) {
  const router = Router();
  router.use(withMerchantMembershipsLookup(db));

  // -------------------------
  // POST /api/merchant/register
  // -------------------------
  router.post("/register", async (req, res) => {
    const {
      businessName,
      displayName,
      contactPerson,
      email,
      phone,
      password,
      businessCategory,
      address,
    } = req.body || {};

    if (!businessName || !displayName || !contactPerson || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "businessName, displayName, contactPerson, email, phone, and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(String(password), rounds);

      const [userResult] = await conn.execute(
        `INSERT INTO users (role, name, email, phone, password_hash) VALUES ('VENDOR', ?, ?, ?, ?)`,
        [toStr(contactPerson), normalizedEmail, toStr(phone), passwordHash]
      );
      const userId = userResult.insertId;

      const slugBase = slugify(displayName) || `merchant-${Date.now()}`;
      let slug = slugBase;
      let merchantId;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [merchantResult] = await conn.execute(
            `INSERT INTO merchants (business_name, display_name, slug, contact_person, email, phone, business_category, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [toStr(businessName), toStr(displayName), slug, toStr(contactPerson), normalizedEmail, toStr(phone), businessCategory || null]
          );
          merchantId = merchantResult.insertId;
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 2) {
            slug = `${slugBase}-${Date.now().toString(36)}`;
            continue;
          }
          throw err;
        }
      }

      await conn.execute(
        `INSERT INTO merchant_users (merchant_id, user_id, role, status) VALUES (?, ?, 'MERCHANT_OWNER', 'active')`,
        [merchantId, userId]
      );

      if (address?.addressLine1) {
        await conn.execute(
          `INSERT INTO merchant_addresses (merchant_id, label, address_line1, district, mukim, village, postcode, is_default)
           VALUES (?, 'Primary', ?, ?, ?, ?, ?, 1)`,
          [merchantId, toStr(address.addressLine1), address.district || null, address.mukim || null, address.village || null, address.postcode || null]
        );
      }

      await conn.commit();

      const [userRows] = await db.execute(`SELECT id, role, name, email, phone FROM users WHERE id = ?`, [userId]);
      const user = toPublicUser(userRows[0]);
      const token = signToken(user);

      await writeAuditLog(db, { actorUserId: userId, actorMerchantId: merchantId, action: "MERCHANT_REGISTERED", entityType: "merchant", entityId: merchantId, metadata: { businessName, slug } });

      return res.status(201).json({
        success: true,
        user,
        token,
        merchant: { id: merchantId, businessName, displayName, slug, status: "PENDING" },
        message: "Merchant account created and is pending admin approval.",
      });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "An account or merchant with this email already exists." });
      }
      console.error("[merchant/register] error:", err);
      return res.status(500).json({ success: false, message: "Failed to register merchant." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  // -------------------------
  // POST /api/merchant/auth/login
  // -------------------------
  // Uses the same credential store as /api/auth/login (users table), and
  // additionally confirms a merchant_users membership exists. Merchant
  // staff can also use the plain /api/auth/login — this endpoint exists
  // only to fail fast with a clearer message for the merchant portal, and
  // to return merchant membership context in one round trip.
  router.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "email and password are required." });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const [rows] = await db.query(
        `SELECT id, role, name, email, phone, password_hash, status FROM users WHERE email = ? LIMIT 1`,
        [normalizedEmail]
      );
      const userRow = rows?.[0];
      if (!userRow) return res.status(401).json({ success: false, message: "Invalid credentials." });

      const ok = await bcrypt.compare(String(password), String(userRow.password_hash));
      if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials." });

      if (userRow.status !== "active") {
        return res.status(403).json({ success: false, message: "This account is not active." });
      }

      const memberships = await getMerchantMemberships(db, userRow.id);
      if (!memberships.length) {
        return res.status(403).json({ success: false, message: "This account has no merchant access." });
      }

      const user = toPublicUser(userRow);
      const token = signToken(user);

      await writeAuditLog(db, { actorUserId: userRow.id, action: "MERCHANT_LOGIN", entityType: "user", entityId: userRow.id, metadata: { merchantIds: memberships.map((m) => m.merchant_id) } });

      return res.json({ success: true, user, token, merchants: memberships });
    } catch (err) {
      console.error("[merchant/auth/login] error:", err);
      return res.status(500).json({ success: false, message: "Login failed." });
    }
  });

  // -------------------------
  // GET /api/merchant/auth/me
  // -------------------------
  router.get("/auth/me", requireAuth, async (req, res) => {
    const memberships = await getMerchantMemberships(db, req.user.sub);
    return res.json({ success: true, user: req.user, merchants: memberships });
  });

  // -------------------------
  // GET /api/merchant/dashboard
  // -------------------------
  router.get("/dashboard", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    try {
      const data = await computeDashboard(db, req.merchantContext.merchantId);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("[merchant/dashboard] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load dashboard." });
    }
  });

  // -------------------------
  // GET /api/merchant/products  (read-only — mutations stay on Socket.IO product:* events)
  // -------------------------
  router.get("/products", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);
      const merchantId = req.merchantContext.merchantId;
      const search = toStr(req.query.search);
      const status = toStr(req.query.status); // 'active' | 'archived' | 'draft' | 'out_of_stock' | '' (any)

      const where = ["merchant_id = ?"];
      const params = [merchantId];
      if (status) {
        where.push("status = ?");
        params.push(status);
      }
      if (search) {
        where.push("(name LIKE ? OR code LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
      const whereClause = where.join(" AND ");

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM products WHERE ${whereClause}`, params);
      const [rows] = await db.query(
        `SELECT id, name, slug, code, price, stock_quantity, low_stock_threshold, status, featured, created_at, updated_at
           FROM products
          WHERE ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      return res.json({ success: true, data: { items: rows, pagination: paginationMeta({ page, limit, total }) } });
    } catch (err) {
      console.error("[merchant/products] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list products." });
    }
  });

  // -------------------------
  // GET /api/merchant/orders
  // -------------------------
  router.get("/orders", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);
      const statusFilter = toStr(req.query.status);

      const where = ["mo.merchant_id = ?"];
      const params = [req.merchantContext.merchantId];
      if (statusFilter && MERCHANT_ORDER_STATUSES.includes(statusFilter)) {
        where.push("mo.status = ?");
        params.push(statusFilter);
      }

      const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total FROM merchant_orders mo WHERE ${where.join(" AND ")}`,
        params
      );
      const [rows] = await db.query(
        `SELECT mo.id, mo.merchant_order_number, mo.status, mo.subtotal, mo.commission_amount, mo.merchant_net_amount, mo.created_at,
                o.order_number, o.payment_status
           FROM merchant_orders mo
           JOIN orders o ON o.id = mo.order_id
          WHERE ${where.join(" AND ")}
          ORDER BY mo.created_at DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return res.json({ success: true, data: { items: rows, pagination: paginationMeta({ page, limit, total }) } });
    } catch (err) {
      console.error("[merchant/orders] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list orders." });
    }
  });

  // -------------------------
  // GET /api/merchant/orders/:id
  // -------------------------
  router.get("/orders/:id", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [rows] = await db.query(
        `SELECT mo.*, o.order_number, o.payment_status
           FROM merchant_orders mo
           JOIN orders o ON o.id = mo.order_id
          WHERE mo.id = ? AND mo.merchant_id = ?
          LIMIT 1`,
        [id, req.merchantContext.merchantId]
      );
      const merchantOrder = rows?.[0];
      if (!merchantOrder) return res.status(404).json({ success: false, message: "Order not found." });

      const [items] = await db.query(
        `SELECT id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total
           FROM order_items WHERE merchant_order_id = ?`,
        [id]
      );
      const [shipment] = await db.query(`SELECT * FROM shipments WHERE merchant_order_id = ? LIMIT 1`, [id]);
      const [history] = await db.query(
        `SELECT old_status, new_status, changed_by_type, note, created_at
           FROM order_status_history WHERE merchant_order_id = ? ORDER BY created_at ASC`,
        [id]
      );

      return res.json({ success: true, data: { ...merchantOrder, items, shipment: shipment[0] || null, history } });
    } catch (err) {
      console.error("[merchant/orders/:id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load order." });
    }
  });

  // -------------------------
  // PATCH /api/merchant/orders/:id/status
  // -------------------------
  router.patch("/orders/:id/status", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    const id = Number(req.params.id);
    const { status, trackingNumber, carrier } = req.body || {};

    if (!MERCHANT_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${MERCHANT_ORDER_STATUSES.join(", ")}` });
    }

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        `SELECT id, order_id, status FROM merchant_orders WHERE id = ? AND merchant_id = ? FOR UPDATE`,
        [id, req.merchantContext.merchantId]
      );
      const current = rows?.[0];
      if (!current) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Order not found." });
      }

      if (current.status !== status && !canTransitionMerchantOrder(current.status, status)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          code: "INVALID_TRANSITION",
          message: `Cannot move order from ${current.status} to ${status}.`,
        });
      }

      await conn.execute(`UPDATE merchant_orders SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);

      if (trackingNumber || carrier || status === "SHIPPED" || status === "DELIVERED") {
        await conn.execute(
          `INSERT INTO shipments (merchant_order_id, carrier, tracking_number, status, shipped_at, delivered_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             carrier = COALESCE(VALUES(carrier), carrier),
             tracking_number = COALESCE(VALUES(tracking_number), tracking_number),
             status = VALUES(status),
             shipped_at = COALESCE(shipped_at, VALUES(shipped_at)),
             delivered_at = VALUES(delivered_at),
             updated_at = NOW()`,
          [
            id,
            carrier || null,
            trackingNumber || null,
            status === "DELIVERED" ? "DELIVERED" : status === "SHIPPED" ? "SHIPPED" : "PENDING",
            status === "SHIPPED" || status === "DELIVERED" ? new Date() : null,
            status === "DELIVERED" ? new Date() : null,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO order_status_history (order_id, merchant_order_id, old_status, new_status, changed_by_type, changed_by_user_id, note)
         VALUES (?, ?, ?, ?, 'merchant', ?, ?)`,
        [current.order_id, id, current.status, status, req.user.sub, null]
      );

      await recomputeOrderStatus(conn, current.order_id);

      await conn.commit();
      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: req.merchantContext.merchantId,
        action: "ORDER_STATUS_CHANGED",
        entityType: "merchant_order",
        entityId: id,
        metadata: { from: current.status, to: status, trackingNumber: trackingNumber || undefined },
      });
      return res.json({ success: true, data: { id, status } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[merchant/orders/:id/status] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update order status." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  // -------------------------
  // GET /api/merchant/payouts  (read-only — payouts are recorded by admin, see Marketplace_Migration.sql SECTION 10)
  // -------------------------
  router.get("/payouts", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, period_start, period_end, gross_amount, commission_amount, net_amount, status, paid_at, created_at
           FROM merchant_payouts WHERE merchant_id = ? ORDER BY period_end DESC`,
        [req.merchantContext.merchantId]
      );
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("[merchant/payouts] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load payouts." });
    }
  });

  // -------------------------
  // GET/PATCH /api/merchant/settings
  // -------------------------
  router.get("/settings", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const [[merchant]] = await db.query(`SELECT * FROM merchants WHERE id = ?`, [merchantId]);
      const [addresses] = await db.query(`SELECT * FROM merchant_addresses WHERE merchant_id = ?`, [merchantId]);

      // Bank details are OWNER-only per the permission matrix (Phase 1.5) — an
      // ADMIN/EMPLOYEE calling this endpoint for the store-profile fields
      // shouldn't learn whether payout bank details exist at all, masked or not.
      let bankDetails = [];
      if (req.merchantContext.role === "MERCHANT_OWNER") {
        const [rows] = await db.query(
          `SELECT id, bank_name, account_name, account_number_last4, swift_code, currency, is_default, created_at
             FROM merchant_bank_details WHERE merchant_id = ?`,
          [merchantId]
        );
        bankDetails = rows.map((b) => ({ ...b, accountNumberMasked: b.account_number_last4 ? `****${b.account_number_last4}` : null }));
      }

      return res.json({ success: true, data: { merchant, addresses, bankDetails } });
    } catch (err) {
      console.error("[merchant/settings GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load settings." });
    }
  });

  router.patch("/settings", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const { displayName, contactPerson, phone, businessCategory, socialLinks } = req.body || {};

      const fields = [];
      const params = [];
      if (displayName != null) { fields.push("display_name = ?"); params.push(toStr(displayName)); }
      if (contactPerson != null) { fields.push("contact_person = ?"); params.push(toStr(contactPerson)); }
      if (phone != null) { fields.push("phone = ?"); params.push(toStr(phone)); }
      if (businessCategory != null) { fields.push("business_category = ?"); params.push(toStr(businessCategory)); }
      if (socialLinks != null) { fields.push("social_links = ?"); params.push(JSON.stringify(socialLinks)); }

      if (!fields.length) return res.status(400).json({ success: false, message: "No fields to update." });

      fields.push("updated_at = NOW()");
      params.push(merchantId);
      await db.execute(`UPDATE merchants SET ${fields.join(", ")} WHERE id = ?`, params);

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant",
        entityId: merchantId,
        metadata: { fieldsChanged: Object.keys(req.body || {}) },
      });

      return res.json({ success: true, message: "Settings updated." });
    } catch (err) {
      console.error("[merchant/settings PATCH] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update settings." });
    }
  });

  // -------------------------
  // POST /api/merchant/settings/bank-details
  // -------------------------
  // OWNER-only, matching the permission matrix (payout/bank settings are
  // explicitly excluded from ADMIN/EMPLOYEE). Encrypts the account number
  // at rest (AES-256-GCM, see modules/encryption.module.js) — the
  // plaintext is never written to the database and never appears in any
  // response, including this one's.
  router.post("/settings/bank-details", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    if (!isEncryptionConfigured()) {
      return res.status(503).json({
        success: false,
        code: "ENCRYPTION_NOT_CONFIGURED",
        message: "Bank detail storage is not available on this server yet (MARKETPLACE_DATA_ENCRYPTION_KEY is not set).",
      });
    }

    try {
      const { bankName, accountName, accountNumber, swiftCode, currency, isDefault } = req.body || {};
      if (!bankName || !accountName || !accountNumber) {
        return res.status(400).json({ success: false, message: "bankName, accountName, and accountNumber are required." });
      }

      const merchantId = req.merchantContext.merchantId;
      const { ciphertext, iv, authTag } = encryptField(String(accountNumber));
      const last4 = maskLast4(accountNumber).slice(-4);

      await db.execute(
        `INSERT INTO merchant_bank_details
           (merchant_id, bank_name, account_name, account_number_ciphertext, account_number_iv, account_number_auth_tag, account_number_last4, swift_code, currency, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [merchantId, toStr(bankName), toStr(accountName), ciphertext, iv, authTag, last4, swiftCode || null, currency || "BND", isDefault ? 1 : 0]
      );

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_bank_details",
        entityId: merchantId,
        metadata: { bankName, last4 },
      });

      return res.status(201).json({ success: true, message: "Bank details saved.", data: { accountNumberMasked: `****${last4}` } });
    } catch (err) {
      console.error("[merchant/settings/bank-details POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to save bank details." });
    }
  });

  // -------------------------
  // GET/POST /api/merchant/staff
  // -------------------------
  router.get("/staff", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT mu.id, mu.role, mu.status, mu.created_at, u.id AS user_id, u.name, u.email
           FROM merchant_users mu JOIN users u ON u.id = mu.user_id
          WHERE mu.merchant_id = ?`,
        [req.merchantContext.merchantId]
      );
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("[merchant/staff GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list staff." });
    }
  });

  router.post("/staff", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const { email, role } = req.body || {};
      const allowedRoles = ["MERCHANT_ADMIN", "MERCHANT_EMPLOYEE"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: `role must be one of: ${allowedRoles.join(", ")}` });
      }

      const [userRows] = await db.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [String(email).trim().toLowerCase()]);
      const targetUser = userRows?.[0];
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "No registered user with that email. They must register an account first." });
      }

      await db.execute(
        `INSERT INTO merchant_users (merchant_id, user_id, role, status) VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE role = VALUES(role), status = 'active'`,
        [req.merchantContext.merchantId, targetUser.id, role]
      );

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: req.merchantContext.merchantId,
        action: "MERCHANT_STAFF_ADDED",
        entityType: "merchant_users",
        entityId: targetUser.id,
        metadata: { role, email: String(email).trim().toLowerCase() },
      });

      return res.status(201).json({ success: true, message: "Staff member added." });
    } catch (err) {
      console.error("[merchant/staff POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to add staff member." });
    }
  });

  return router;
}
