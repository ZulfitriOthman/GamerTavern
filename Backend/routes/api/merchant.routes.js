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
import {
  MERCHANT_ORDER_STATUSES,
  canTransitionMerchantOrder,
  canTransitionMerchantOrderPayment,
  assertOrderTransition,
  assertMerchantOrderPaymentTransition,
} from "../../modules/orderStateMachine.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";
import { encryptField, maskLast4, isEncryptionConfigured } from "../../modules/encryption.module.js";
import {
  SUPPORTED_BANKS,
  isSupportedBank,
  PAYMENT_METHODS,
  isSupportedPaymentMethod,
  WRITABLE_PAYMENT_ACCOUNT_STATUSES,
  isValidProviderSlug,
} from "../../modules/merchantPayments.module.js";
import { FULFILMENT_METHODS, isSupportedFulfilmentMethod, fulfilmentTypeForShippingCode } from "../../modules/fulfilment.module.js";
import { isValidE164 } from "../../modules/notifications.module.js";

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
       FROM MERCHANT_ORDERS
      WHERE merchant_id = ? AND status != 'CANCELLED' AND DATE(created_at) = CURDATE()`,
    [merchantId]
  );
  const [[totalSalesRow]] = await db.query(
    `SELECT COALESCE(SUM(merchant_net_amount), 0) AS total
       FROM MERCHANT_ORDERS
      WHERE merchant_id = ? AND status != 'CANCELLED'`,
    [merchantId]
  );
  const [[ordersTodayRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM MERCHANT_ORDERS WHERE merchant_id = ? AND DATE(created_at) = CURDATE()`,
    [merchantId]
  );
  const [[pendingOrdersRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM MERCHANT_ORDERS WHERE merchant_id = ? AND status = 'PROCESSING'`,
    [merchantId]
  );
  const [[productsRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM PRODUCTS WHERE merchant_id = ? AND status != 'archived'`,
    [merchantId]
  );
  const [[lowStockRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM PRODUCTS
      WHERE merchant_id = ? AND low_stock_threshold IS NOT NULL
        AND stock_quantity > 0 AND stock_quantity <= low_stock_threshold`,
    [merchantId]
  );
  const [[outOfStockRow]] = await db.query(
    `SELECT COUNT(*) AS count FROM PRODUCTS WHERE merchant_id = ? AND stock_quantity = 0 AND status != 'archived'`,
    [merchantId]
  );

  const [recentOrders] = await db.query(
    `SELECT mo.id, mo.merchant_order_number, mo.status, mo.merchant_net_amount, mo.created_at,
            o.order_number
       FROM MERCHANT_ORDERS mo
       JOIN ORDERS o ON o.id = mo.order_id
      WHERE mo.merchant_id = ?
      ORDER BY mo.created_at DESC
      LIMIT 10`,
    [merchantId]
  );

  const [topSelling] = await db.query(
    `SELECT oi.product_id, oi.product_name_snapshot AS name, SUM(oi.quantity) AS units_sold
       FROM ORDER_ITEMS oi
       JOIN MERCHANT_ORDERS mo ON mo.id = oi.merchant_order_id
      WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED'
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY units_sold DESC
      LIMIT 5`,
    [merchantId]
  );

  const [revenueTrend] = await db.query(
    `SELECT DATE(created_at) AS day, COALESCE(SUM(merchant_net_amount), 0) AS total
       FROM MERCHANT_ORDERS
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
  // Merchant Payments Stage 2 guard: this rollup only ever moves ORDERS
  // among PROCESSING/READY/SHIPPED/DELIVERED/CANCELLED — it must never fire
  // while the order is still PENDING_PAYMENT (a bank-transfer order awaiting
  // confirmation). Without this, a merchant calling PATCH .../status on
  // their own already-PROCESSING merchant_order (even a no-op) would
  // silently overwrite ORDERS.status, bypassing the state machine and
  // skipping PENDING_PAYMENT -> PAID entirely. See the Stage 2 report.
  const [[order]] = await conn.query(`SELECT status FROM ORDERS WHERE id = ?`, [orderId]);
  if (!order || order.status === "PENDING_PAYMENT") return;

  const [subOrders] = await conn.execute(`SELECT status FROM MERCHANT_ORDERS WHERE order_id = ?`, [orderId]);
  if (!subOrders.length) return;

  const statuses = subOrders.map((r) => r.status);
  let next;
  if (statuses.every((s) => s === "CANCELLED")) next = "CANCELLED";
  else if (statuses.every((s) => s === "DELIVERED" || s === "CANCELLED")) next = "DELIVERED";
  else if (statuses.some((s) => s === "SHIPPED" || s === "DELIVERED")) next = "SHIPPED";
  else if (statuses.some((s) => s === "READY")) next = "READY";
  else next = "PROCESSING";

  await conn.execute(`UPDATE ORDERS SET status = ?, updated_at = NOW() WHERE id = ?`, [next, orderId]);
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
        `INSERT INTO USERS (role, name, email, phone, password_hash) VALUES ('VENDOR', ?, ?, ?, ?)`,
        [toStr(contactPerson), normalizedEmail, toStr(phone), passwordHash]
      );
      const userId = userResult.insertId;

      const slugBase = slugify(displayName) || `merchant-${Date.now()}`;
      let slug = slugBase;
      let merchantId;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [merchantResult] = await conn.execute(
            `INSERT INTO MERCHANTS (business_name, display_name, slug, contact_person, email, phone, business_category, status)
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
        `INSERT INTO MERCHANT_USERS (merchant_id, user_id, role, status) VALUES (?, ?, 'MERCHANT_OWNER', 'active')`,
        [merchantId, userId]
      );

      if (address?.addressLine1) {
        await conn.execute(
          `INSERT INTO MERCHANT_ADDRESSES (merchant_id, label, address_line1, district, mukim, village, postcode, is_default)
           VALUES (?, 'Primary', ?, ?, ?, ?, ?, 1)`,
          [merchantId, toStr(address.addressLine1), address.district || null, address.mukim || null, address.village || null, address.postcode || null]
        );
      }

      await conn.commit();

      const [userRows] = await db.execute(`SELECT id, role, name, email, phone FROM USERS WHERE id = ?`, [userId]);
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
        `SELECT id, role, name, email, phone, password_hash, status FROM USERS WHERE email = ? LIMIT 1`,
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
  router.get("/dashboard", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
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
  router.get("/products", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
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

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM PRODUCTS WHERE ${whereClause}`, params);
      const [rows] = await db.query(
        `SELECT id, name, slug, code, price, stock_quantity, low_stock_threshold, status, featured, created_at, updated_at
           FROM PRODUCTS
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
  router.get("/orders", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
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
        `SELECT COUNT(*) AS total FROM MERCHANT_ORDERS mo WHERE ${where.join(" AND ")}`,
        params
      );
      const [rows] = await db.query(
        `SELECT mo.id, mo.merchant_order_number, mo.status, mo.subtotal, mo.commission_amount, mo.merchant_net_amount, mo.created_at,
                o.order_number, o.payment_status
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
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
  router.get("/orders/:id", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [rows] = await db.query(
        `SELECT mo.id, mo.merchant_order_number, mo.order_id, mo.merchant_id, mo.subtotal, mo.commission_percent,
                mo.commission_amount, mo.merchant_net_amount, mo.status, mo.created_at, mo.updated_at,
                o.order_number, o.payment_status, o.delivery_instructions,
                sm.code AS shipping_method_code,
                ca.recipient_name AS address_recipient_name, ca.phone AS address_phone,
                ca.address_line1 AS address_line1, ca.address_line2 AS address_line2, ca.district AS address_district,
                ca.mukim AS address_mukim, ca.village AS address_village, ca.postcode AS address_postcode
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
           LEFT JOIN SHIPPING_METHODS sm ON sm.id = o.shipping_method_id
           LEFT JOIN CUSTOMER_ADDRESSES ca ON ca.id = o.shipping_address_id
          WHERE mo.id = ? AND mo.merchant_id = ?
          LIMIT 1`,
        [id, req.merchantContext.merchantId]
      );
      const merchantOrder = rows?.[0];
      if (!merchantOrder) return res.status(404).json({ success: false, message: "Order not found." });

      // Fulfilment (point 13) — this merchant order's OWN parent order's
      // delivery details, already ownership-scoped by the WHERE above
      // (mo.merchant_id = req.merchantContext.merchantId, never a
      // client-supplied merchant id). Only meaningful for Delivery — a
      // Pickup order's fulfilment info is "this merchant's own address",
      // which the merchant already knows without needing it echoed back.
      const fulfilmentType = fulfilmentTypeForShippingCode(merchantOrder.shipping_method_code);
      const deliveryAddress =
        fulfilmentType === "DELIVERY" && merchantOrder.address_line1
          ? {
              recipientName: merchantOrder.address_recipient_name,
              phone: merchantOrder.address_phone,
              addressLine1: merchantOrder.address_line1,
              addressLine2: merchantOrder.address_line2,
              district: merchantOrder.address_district,
              mukim: merchantOrder.address_mukim,
              village: merchantOrder.address_village,
              postcode: merchantOrder.address_postcode,
            }
          : null;

      let deliveryReferencePhoto = null;
      if (fulfilmentType === "DELIVERY") {
        const [attachmentRows] = await db.query(`SELECT file_url, file_type FROM ORDER_DELIVERY_ATTACHMENTS WHERE order_id = ? LIMIT 1`, [merchantOrder.order_id]);
        deliveryReferencePhoto = attachmentRows[0] ? { fileUrl: attachmentRows[0].file_url, fileType: attachmentRows[0].file_type } : null;
      }

      const [items] = await db.query(
        `SELECT id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price_snapshot, quantity, line_total
           FROM ORDER_ITEMS WHERE merchant_order_id = ?`,
        [id]
      );
      const [shipment] = await db.query(
        `SELECT id, merchant_order_id, shipping_method_id, carrier, tracking_number, status, shipped_at, delivered_at, created_at, updated_at
           FROM SHIPMENTS WHERE merchant_order_id = ? LIMIT 1`,
        [id]
      );
      const [history] = await db.query(
        `SELECT old_status, new_status, changed_by_type, note, created_at
           FROM ORDER_STATUS_HISTORY WHERE merchant_order_id = ? ORDER BY created_at ASC`,
        [id]
      );
      // Generic across every offline payment method (BANK_TRANSFER,
      // PAY_ON_DELIVERY, PAY_ON_PICKUP) — a merchant order has at most one
      // MERCHANT_ORDER_PAYMENTS row (UQ_MERCHANT_ORDER_PAYMENTS_MERCHANT_ORDER).
      const [paymentRows] = await db.query(
        `SELECT id, payment_method, status, amount, currency, reference, confirmed_at
           FROM MERCHANT_ORDER_PAYMENTS WHERE merchant_order_id = ? LIMIT 1`,
        [id]
      );

      return res.json({
        success: true,
        data: { ...merchantOrder, items, shipment: shipment[0] || null, history, payment: paymentRows[0] || null, fulfilmentType, deliveryAddress, deliveryReferencePhoto },
      });
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
        `SELECT id, order_id, status FROM MERCHANT_ORDERS WHERE id = ? AND merchant_id = ? FOR UPDATE`,
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

      // Merchant Payments Stage 2: a bank-transfer merchant_order must have
      // its payment confirmed (see POST /orders/:id/payment/confirm) before
      // fulfilment can advance — cancellation is always allowed. Online
      // orders never have a MERCHANT_ORDER_PAYMENTS row, so this never
      // affects existing online-checkout behavior.
      //
      // BANK_TRANSFER-only: the customer is expected to pay before the
      // merchant ships. PAY_ON_DELIVERY/PAY_ON_PICKUP are the opposite —
      // payment happens AT delivery/pickup, so fulfilment must be free to
      // advance (PROCESSING -> READY -> SHIPPED -> DELIVERED) while payment
      // is still PENDING; gating on those would make it impossible to ever
      // reach the point where payment is collected.
      const [[payment]] = await conn.query(`SELECT payment_method, status FROM MERCHANT_ORDER_PAYMENTS WHERE merchant_order_id = ?`, [id]);
      if (payment && payment.payment_method === "BANK_TRANSFER" && payment.status !== "PAID" && status !== "CANCELLED") {
        await conn.rollback();
        return res.status(409).json({
          success: false,
          code: "PAYMENT_NOT_CONFIRMED",
          message: "This order's bank transfer payment must be confirmed before fulfilment status can be updated.",
        });
      }

      await conn.execute(`UPDATE MERCHANT_ORDERS SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);

      if (trackingNumber || carrier || status === "SHIPPED" || status === "DELIVERED") {
        await conn.execute(
          `INSERT INTO SHIPMENTS (merchant_order_id, carrier, tracking_number, status, shipped_at, delivered_at)
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
        `INSERT INTO ORDER_STATUS_HISTORY (order_id, merchant_order_id, old_status, new_status, changed_by_type, changed_by_user_id, note)
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
  // POST /api/merchant/orders/:id/payment/confirm  (Merchant Payments Stage 2)
  // -------------------------
  // Only the merchant that owns this MERCHANT_ORDER (any active staff, same
  // as the fulfilment-status endpoint) may confirm — never a client-supplied
  // merchant/order id, always resolved from req.merchantContext. When every
  // MERCHANT_ORDER_PAYMENTS row for the parent ORDERS row is now PAID, the
  // order moves PENDING_PAYMENT -> PAID through orderStateMachine.module.js
  // — never written directly.
  router.post("/orders/:id/payment/confirm", requireAuth, requireMerchant("MERCHANT_EMPLOYEE"), async (req, res) => {
    const id = Number(req.params.id);
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [[mo]] = await conn.query(`SELECT id, order_id FROM MERCHANT_ORDERS WHERE id = ? AND merchant_id = ? FOR UPDATE`, [
        id,
        req.merchantContext.merchantId,
      ]);
      if (!mo) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Order not found." });
      }

      const [[payment]] = await conn.query(`SELECT id, status FROM MERCHANT_ORDER_PAYMENTS WHERE merchant_order_id = ? FOR UPDATE`, [id]);
      if (!payment) {
        await conn.rollback();
        return res.status(400).json({ success: false, code: "NO_PAYMENT_RECORD", message: "This order has no payment to confirm." });
      }
      if (payment.status === "PAID") {
        await conn.rollback();
        return res.json({ success: true, message: "Already confirmed.", data: { status: "PAID" } });
      }
      // Generic across every offline payment method — BANK_TRANSFER confirms
      // from AWAITING_TRANSFER, PAY_ON_DELIVERY/PAY_ON_PICKUP confirm
      // directly from PENDING (see MERCHANT_ORDER_PAYMENT_TRANSITIONS). The
      // transition table itself decides which "from" statuses are valid, so
      // this route never hardcodes one method's status name.
      if (!canTransitionMerchantOrderPayment(payment.status, "PAID")) {
        await conn.rollback();
        return res.status(400).json({ success: false, code: "INVALID_TRANSITION", message: `Cannot confirm payment from status ${payment.status}.` });
      }
      assertMerchantOrderPaymentTransition(payment.status, "PAID");

      await conn.execute(
        `UPDATE MERCHANT_ORDER_PAYMENTS SET status = 'PAID', confirmed_at = NOW(), confirmed_by_user_id = ?, updated_at = NOW() WHERE id = ?`,
        [req.user.sub, payment.id]
      );

      const [[orderRow]] = await conn.query(`SELECT status FROM ORDERS WHERE id = ? FOR UPDATE`, [mo.order_id]);
      const [siblingPayments] = await conn.query(
        `SELECT mop.status
           FROM MERCHANT_ORDER_PAYMENTS mop
           JOIN MERCHANT_ORDERS smo ON smo.id = mop.merchant_order_id
          WHERE smo.order_id = ?`,
        [mo.order_id]
      );
      const orderFullyPaid = siblingPayments.length > 0 && siblingPayments.every((p) => p.status === "PAID");

      if (orderFullyPaid && orderRow.status === "PENDING_PAYMENT") {
        assertOrderTransition("PENDING_PAYMENT", "PAID");
        await conn.execute(`UPDATE ORDERS SET status = 'PAID', payment_status = 'PAID', updated_at = NOW() WHERE id = ?`, [mo.order_id]);
        await conn.execute(
          `INSERT INTO ORDER_STATUS_HISTORY (order_id, old_status, new_status, changed_by_type, changed_by_user_id, note)
           VALUES (?, 'PENDING_PAYMENT', 'PAID', 'merchant', ?, 'All merchant payments confirmed.')`,
          [mo.order_id, req.user.sub]
        );
      }

      await conn.commit();
      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: req.merchantContext.merchantId,
        action: "MERCHANT_ORDER_PAYMENT_CONFIRMED",
        entityType: "merchant_order_payment",
        entityId: payment.id,
        metadata: { merchantOrderId: id, orderFullyPaid },
      });
      return res.json({ success: true, data: { status: "PAID", orderFullyPaid } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[merchant/orders/:id/payment/confirm] error:", err);
      return res.status(500).json({ success: false, message: "Failed to confirm payment." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  // -------------------------
  // GET /api/merchant/payouts  (read-only — payouts are recorded by admin, see Database/schema/008_platform_ops.sql)
  // -------------------------
  router.get("/payouts", requireAuth, requireMerchant("MERCHANT_ADMIN", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, period_start, period_end, gross_amount, commission_amount, net_amount, status, paid_at, created_at
           FROM MERCHANT_PAYOUTS WHERE merchant_id = ? ORDER BY period_end DESC`,
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
  router.get("/settings", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const [[merchant]] = await db.query(
        `SELECT id, business_name, display_name, slug, contact_person, email, phone, business_category,
                status, commission_percent, social_links, whatsapp_phone, whatsapp_notifications_enabled, created_at, updated_at
           FROM MERCHANTS WHERE id = ?`,
        [merchantId]
      );
      const [addresses] = await db.query(
        `SELECT id, merchant_id, label, address_line1, district, mukim, village, postcode, country_code, is_default, created_at, updated_at
           FROM MERCHANT_ADDRESSES WHERE merchant_id = ?`,
        [merchantId]
      );

      // Payment methods are safe to show any active staff member — no
      // secrets, just operational on/off state. A missing row means "not
      // enabled", never "enabled by default".
      const [methodRows] = await db.query(`SELECT method, enabled FROM MERCHANT_PAYMENT_METHODS WHERE merchant_id = ?`, [merchantId]);
      const enabledByMethod = new Map(methodRows.map((r) => [r.method, Boolean(r.enabled)]));
      const paymentMethods = PAYMENT_METHODS.map((method) => ({ method, enabled: enabledByMethod.get(method) || false }));

      const [fulfilmentRows] = await db.query(`SELECT method, enabled FROM MERCHANT_FULFILMENT_METHODS WHERE merchant_id = ?`, [merchantId]);
      const enabledByFulfilmentMethod = new Map(fulfilmentRows.map((r) => [r.method, Boolean(r.enabled)]));
      const fulfilmentMethods = FULFILMENT_METHODS.map((method) => ({ method, enabled: enabledByFulfilmentMethod.get(method) || false }));

      // Bank details and payment-account configuration are OWNER-only per
      // the permission matrix (Phase 1.5) — an ADMIN/EMPLOYEE calling this
      // endpoint for the store-profile fields shouldn't learn whether
      // payout/payment configuration exists at all, masked or not.
      let bankDetails = [];
      let paymentAccounts = [];
      if (req.merchantContext.role === "MERCHANT_OWNER") {
        const [rows] = await db.query(
          `SELECT id, bank_name, bank_other_label, display_name, account_name, account_number_last4, swift_code, currency, notes, is_default, created_at
             FROM MERCHANT_BANK_DETAILS WHERE merchant_id = ? ORDER BY is_default DESC, created_at ASC`,
          [merchantId]
        );
        bankDetails = rows.map((b) => ({
          id: b.id,
          bank: b.bank_name,
          bankOtherLabel: b.bank_other_label,
          displayName: b.display_name || b.account_name,
          accountName: b.account_name,
          accountNumberLast4: b.account_number_last4,
          accountNumberMasked: b.account_number_last4 ? `****${b.account_number_last4}` : null,
          swiftCode: b.swift_code,
          currency: b.currency,
          notes: b.notes,
          isDefault: Boolean(b.is_default),
          createdAt: b.created_at,
        }));

        const [accountRows] = await db.query(
          `SELECT id, provider, provider_merchant_id, status, created_at, updated_at
             FROM MERCHANT_PAYMENT_ACCOUNTS WHERE merchant_id = ?`,
          [merchantId]
        );
        paymentAccounts = accountRows; // no credential columns selected — never returned to any API response
      }

      return res.json({ success: true, data: { merchant, addresses, bankDetails, paymentMethods, paymentAccounts, fulfilmentMethods } });
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
      await db.execute(`UPDATE MERCHANTS SET ${fields.join(", ")} WHERE id = ?`, params);

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
  // Notifications settings (WhatsApp order notifications)
  // -------------------------
  // Not sensitive (no secrets, no financial data) — same permission tier
  // as payment-methods: any active staff member can read, ADMIN+ can write.
  router.get("/settings/notifications", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const [[row]] = await db.query(
        `SELECT whatsapp_phone, whatsapp_notifications_enabled FROM MERCHANTS WHERE id = ?`,
        [req.merchantContext.merchantId]
      );
      return res.json({
        success: true,
        data: {
          whatsappEnabled: Boolean(row?.whatsapp_notifications_enabled),
          whatsappPhone: row?.whatsapp_phone || null,
        },
      });
    } catch (err) {
      console.error("[merchant/settings/notifications GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load notification settings." });
    }
  });

  router.patch("/settings/notifications", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const { whatsappEnabled, whatsappPhone } = req.body || {};
      const merchantId = req.merchantContext.merchantId;

      const fields = [];
      const params = [];

      if (whatsappPhone != null) {
        const trimmed = toStr(whatsappPhone);
        if (trimmed && !isValidE164(trimmed)) {
          return res.status(400).json({
            success: false,
            message: "whatsappPhone must be in E.164 format (e.g. +6738888888).",
          });
        }
        fields.push("whatsapp_phone = ?");
        params.push(trimmed || null);
      }
      if (whatsappEnabled != null) {
        fields.push("whatsapp_notifications_enabled = ?");
        params.push(whatsappEnabled ? 1 : 0);
      }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: "No fields to update." });
      }

      // Enabling notifications without ever having configured a number is a
      // client-side mistake worth catching here rather than silently
      // accepting a config that can never actually send anything.
      if (whatsappEnabled) {
        const [[current]] = await db.query(`SELECT whatsapp_phone FROM MERCHANTS WHERE id = ?`, [merchantId]);
        const effectivePhone = whatsappPhone != null ? toStr(whatsappPhone) : current?.whatsapp_phone;
        if (!isValidE164(effectivePhone || "")) {
          return res.status(400).json({
            success: false,
            message: "A valid WhatsApp number (E.164 format) is required to enable notifications.",
          });
        }
      }

      fields.push("updated_at = NOW()");
      params.push(merchantId);
      await db.execute(`UPDATE MERCHANTS SET ${fields.join(", ")} WHERE id = ?`, params);

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant",
        entityId: merchantId,
        metadata: { fieldsChanged: Object.keys(req.body || {}), notifications: true },
      });

      return res.json({ success: true, message: "Notification settings updated." });
    } catch (err) {
      console.error("[merchant/settings/notifications PATCH] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update notification settings." });
    }
  });

  // -------------------------
  // Bank details — CRUD + set-default (Merchant Payments Stage 1)
  // -------------------------
  // OWNER-only throughout, matching the existing permission matrix
  // (payout/bank settings are explicitly excluded from ADMIN/EMPLOYEE).
  // Encrypts the account number at rest (AES-256-GCM, see
  // modules/encryption.module.js) — the plaintext is never written to the
  // database and never appears in any response.

  // `requireAccountName` is false on PATCH, where bankName/accountName can
  // each be updated independently — accountName's own presence is checked
  // separately by the PATCH handler.
  function validateBankFields({ bankName, bankOtherLabel, accountName }, { requireAccountName = true } = {}) {
    if (!isSupportedBank(bankName)) {
      return `bankName must be one of: ${SUPPORTED_BANKS.join(", ")}.`;
    }
    if (String(bankName).toUpperCase() === "OTHER" && !toStr(bankOtherLabel)) {
      return "bankOtherLabel is required when bankName is OTHER.";
    }
    if (requireAccountName && !toStr(accountName)) {
      return "accountName is required.";
    }
    return null;
  }

  // Unsets any existing default for this merchant, then sets the given row
  // as default — inside one transaction, so at most one row is ever
  // default at a time. Maximum-one-default is an application-enforced
  // invariant (see schema/010_merchant_payments.sql comment), not a DB
  // constraint.
  async function setDefaultBankDetail(merchantId, bankDetailId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`UPDATE MERCHANT_BANK_DETAILS SET is_default = 0, updated_at = NOW() WHERE merchant_id = ? AND id != ?`, [merchantId, bankDetailId]);
      await conn.execute(`UPDATE MERCHANT_BANK_DETAILS SET is_default = 1, updated_at = NOW() WHERE merchant_id = ? AND id = ?`, [merchantId, bankDetailId]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  router.post("/settings/bank-details", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    if (!isEncryptionConfigured()) {
      return res.status(503).json({
        success: false,
        code: "ENCRYPTION_NOT_CONFIGURED",
        message: "Bank detail storage is not available on this server yet (MARKETPLACE_DATA_ENCRYPTION_KEY is not set).",
      });
    }

    try {
      const { bankName, bankOtherLabel, displayName, accountName, accountNumber, swiftCode, currency, notes, isDefault } = req.body || {};
      if (!accountNumber) {
        return res.status(400).json({ success: false, message: "accountNumber is required." });
      }
      const validationError = validateBankFields({ bankName, bankOtherLabel, accountName });
      if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
      }

      const merchantId = req.merchantContext.merchantId;
      const { ciphertext, iv, authTag } = encryptField(String(accountNumber));
      const last4 = maskLast4(accountNumber).slice(-4);
      const bankNameUpper = String(bankName).toUpperCase();

      const [[{ count: existingCount }]] = await db.query(`SELECT COUNT(*) AS count FROM MERCHANT_BANK_DETAILS WHERE merchant_id = ?`, [merchantId]);
      // The first bank account a merchant adds automatically becomes their
      // default — there is no meaningful "no default yet" state once at
      // least one account exists.
      const makeDefault = existingCount === 0 || Boolean(isDefault);

      const [result] = await db.execute(
        `INSERT INTO MERCHANT_BANK_DETAILS
           (merchant_id, bank_name, bank_other_label, display_name, account_name, account_number_ciphertext, account_number_iv, account_number_auth_tag, account_number_last4, swift_code, currency, notes, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          merchantId,
          bankNameUpper,
          bankNameUpper === "OTHER" ? toStr(bankOtherLabel) : null,
          displayName != null ? toStr(displayName) || null : null,
          toStr(accountName),
          ciphertext,
          iv,
          authTag,
          last4,
          swiftCode || null,
          currency || "BND",
          notes != null ? toStr(notes) || null : null,
          makeDefault ? 1 : 0,
        ]
      );
      const bankDetailId = result.insertId;
      if (makeDefault && existingCount > 0) {
        // Already inserted as default above; still need to unset any prior
        // default row now that a new one exists.
        await db.execute(`UPDATE MERCHANT_BANK_DETAILS SET is_default = 0, updated_at = NOW() WHERE merchant_id = ? AND id != ?`, [merchantId, bankDetailId]);
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_bank_details",
        entityId: bankDetailId,
        metadata: { bankName: bankNameUpper, last4 },
      });

      return res.status(201).json({ success: true, message: "Bank details saved.", data: { id: bankDetailId, accountNumberMasked: `****${last4}`, isDefault: makeDefault } });
    } catch (err) {
      console.error("[merchant/settings/bank-details POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to save bank details." });
    }
  });

  // PATCH updates the non-sensitive fields, and — only when `accountNumber`
  // is explicitly present in the body — replaces the encrypted account
  // number. Omitting it entirely (the "keep existing account number" path)
  // never touches the encrypted columns, and this endpoint never decrypts
  // or returns the existing value just to support editing.
  router.patch("/settings/bank-details/:id", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const bankDetailId = Number(req.params.id);

      const [[existing]] = await db.query(`SELECT id FROM MERCHANT_BANK_DETAILS WHERE id = ? AND merchant_id = ? LIMIT 1`, [bankDetailId, merchantId]);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Bank account not found." });
      }

      const { bankName, bankOtherLabel, displayName, accountName, accountNumber, swiftCode, currency, notes, isDefault } = req.body || {};

      const fields = [];
      const params = [];

      if (bankName != null) {
        const validationError = validateBankFields({ bankName, bankOtherLabel }, { requireAccountName: false });
        if (validationError) {
          return res.status(400).json({ success: false, message: validationError });
        }
        const bankNameUpper = String(bankName).toUpperCase();
        fields.push("bank_name = ?");
        params.push(bankNameUpper);
        fields.push("bank_other_label = ?");
        params.push(bankNameUpper === "OTHER" ? toStr(bankOtherLabel) || null : null);
      }
      if (displayName != null) { fields.push("display_name = ?"); params.push(toStr(displayName) || null); }
      if (accountName != null) { fields.push("account_name = ?"); params.push(toStr(accountName)); }
      if (swiftCode != null) { fields.push("swift_code = ?"); params.push(toStr(swiftCode) || null); }
      if (currency != null) { fields.push("currency = ?"); params.push(toStr(currency)); }
      if (notes != null) { fields.push("notes = ?"); params.push(toStr(notes) || null); }

      let newLast4 = null;
      if (accountNumber != null) {
        if (!isEncryptionConfigured()) {
          return res.status(503).json({
            success: false,
            code: "ENCRYPTION_NOT_CONFIGURED",
            message: "Bank detail storage is not available on this server yet (MARKETPLACE_DATA_ENCRYPTION_KEY is not set).",
          });
        }
        const { ciphertext, iv, authTag } = encryptField(String(accountNumber));
        newLast4 = maskLast4(accountNumber).slice(-4);
        fields.push("account_number_ciphertext = ?", "account_number_iv = ?", "account_number_auth_tag = ?", "account_number_last4 = ?");
        params.push(ciphertext, iv, authTag, newLast4);
      }

      if (!fields.length && isDefault == null) {
        return res.status(400).json({ success: false, message: "No fields to update." });
      }

      if (fields.length) {
        fields.push("updated_at = NOW()");
        params.push(bankDetailId, merchantId);
        await db.execute(`UPDATE MERCHANT_BANK_DETAILS SET ${fields.join(", ")} WHERE id = ? AND merchant_id = ?`, params);
      }
      if (isDefault) {
        await setDefaultBankDetail(merchantId, bankDetailId);
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_bank_details",
        entityId: bankDetailId,
        metadata: { fieldsChanged: Object.keys(req.body || {}), accountNumberReplaced: accountNumber != null },
      });

      return res.json({ success: true, message: "Bank details updated.", data: newLast4 ? { accountNumberMasked: `****${newLast4}` } : {} });
    } catch (err) {
      console.error("[merchant/settings/bank-details PATCH] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update bank details." });
    }
  });

  router.delete("/settings/bank-details/:id", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const bankDetailId = Number(req.params.id);

      const [[existing]] = await db.query(`SELECT id, is_default FROM MERCHANT_BANK_DETAILS WHERE id = ? AND merchant_id = ? LIMIT 1`, [bankDetailId, merchantId]);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Bank account not found." });
      }

      await db.execute(`DELETE FROM MERCHANT_BANK_DETAILS WHERE id = ? AND merchant_id = ?`, [bankDetailId, merchantId]);

      if (existing.is_default) {
        // Promote the oldest remaining account so the merchant is never left
        // with payout/transfer accounts on file but none marked default.
        const [[nextDefault]] = await db.query(
          `SELECT id FROM MERCHANT_BANK_DETAILS WHERE merchant_id = ? ORDER BY created_at ASC LIMIT 1`,
          [merchantId]
        );
        if (nextDefault) {
          await db.execute(`UPDATE MERCHANT_BANK_DETAILS SET is_default = 1, updated_at = NOW() WHERE id = ?`, [nextDefault.id]);
        }
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_bank_details",
        entityId: bankDetailId,
        metadata: { deleted: true },
      });

      return res.json({ success: true, message: "Bank account removed." });
    } catch (err) {
      console.error("[merchant/settings/bank-details DELETE] error:", err);
      return res.status(500).json({ success: false, message: "Failed to remove bank account." });
    }
  });

  router.post("/settings/bank-details/:id/default", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const bankDetailId = Number(req.params.id);

      const [[existing]] = await db.query(`SELECT id FROM MERCHANT_BANK_DETAILS WHERE id = ? AND merchant_id = ? LIMIT 1`, [bankDetailId, merchantId]);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Bank account not found." });
      }

      await setDefaultBankDetail(merchantId, bankDetailId);

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_bank_details",
        entityId: bankDetailId,
        metadata: { setDefault: true },
      });

      return res.json({ success: true, message: "Default bank account updated." });
    } catch (err) {
      console.error("[merchant/settings/bank-details/:id/default POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to set default bank account." });
    }
  });

  // -------------------------
  // Payment methods (Merchant Payments Stage 1)
  // -------------------------
  // Read is available to any active staff member (no secrets); write
  // requires ADMIN+, matching the general /settings PATCH permission —
  // less sensitive than bank-account ownership, which stays OWNER-only.
  router.get("/settings/payment-methods", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const [rows] = await db.query(`SELECT method, enabled FROM MERCHANT_PAYMENT_METHODS WHERE merchant_id = ?`, [merchantId]);
      const enabledByMethod = new Map(rows.map((r) => [r.method, Boolean(r.enabled)]));
      return res.json({ success: true, data: PAYMENT_METHODS.map((method) => ({ method, enabled: enabledByMethod.get(method) || false })) });
    } catch (err) {
      console.error("[merchant/settings/payment-methods GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load payment methods." });
    }
  });

  router.patch("/settings/payment-methods", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const { bankTransferEnabled, onlinePaymentEnabled, payOnDeliveryEnabled, payOnPickupEnabled } = req.body || {};

      const updates = [];
      if (bankTransferEnabled != null) updates.push(["BANK_TRANSFER", Boolean(bankTransferEnabled)]);
      if (onlinePaymentEnabled != null) updates.push(["ONLINE_PAYMENT", Boolean(onlinePaymentEnabled)]);
      if (payOnDeliveryEnabled != null) updates.push(["PAY_ON_DELIVERY", Boolean(payOnDeliveryEnabled)]);
      if (payOnPickupEnabled != null) updates.push(["PAY_ON_PICKUP", Boolean(payOnPickupEnabled)]);
      if (!updates.length) {
        return res.status(400).json({ success: false, message: "No payment methods to update." });
      }

      for (const [method, enabled] of updates) {
        if (!isSupportedPaymentMethod(method)) continue; // defensive — the four literals above are always valid
        await db.execute(
          `INSERT INTO MERCHANT_PAYMENT_METHODS (merchant_id, method, enabled) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW()`,
          [merchantId, method, enabled ? 1 : 0]
        );
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_payment_methods",
        entityId: merchantId,
        metadata: { updates: Object.fromEntries(updates) },
      });

      return res.json({ success: true, message: "Payment methods updated." });
    } catch (err) {
      console.error("[merchant/settings/payment-methods PATCH] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update payment methods." });
    }
  });

  // -------------------------
  // Fulfilment methods (Delivery / Pickup) — mirrors payment-methods above
  // exactly, including the "no row = disabled" convention. A separate
  // concept from payment methods (see Backend/modules/fulfilment.module.js):
  // this is how the order reaches the customer, not how they pay for it.
  // -------------------------
  router.get("/settings/fulfilment-methods", requireAuth, requireMerchant("MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const [rows] = await db.query(`SELECT method, enabled FROM MERCHANT_FULFILMENT_METHODS WHERE merchant_id = ?`, [merchantId]);
      const enabledByMethod = new Map(rows.map((r) => [r.method, Boolean(r.enabled)]));
      return res.json({ success: true, data: FULFILMENT_METHODS.map((method) => ({ method, enabled: enabledByMethod.get(method) || false })) });
    } catch (err) {
      console.error("[merchant/settings/fulfilment-methods GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load fulfilment methods." });
    }
  });

  router.patch("/settings/fulfilment-methods", requireAuth, requireMerchant("MERCHANT_ADMIN"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const { deliveryEnabled, pickupEnabled } = req.body || {};

      const updates = [];
      if (deliveryEnabled != null) updates.push(["DELIVERY", Boolean(deliveryEnabled)]);
      if (pickupEnabled != null) updates.push(["PICKUP", Boolean(pickupEnabled)]);
      if (!updates.length) {
        return res.status(400).json({ success: false, message: "No fulfilment methods to update." });
      }

      for (const [method, enabled] of updates) {
        if (!isSupportedFulfilmentMethod(method)) continue; // defensive — the two literals above are always valid
        await db.execute(
          `INSERT INTO MERCHANT_FULFILMENT_METHODS (merchant_id, method, enabled) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW()`,
          [merchantId, method, enabled ? 1 : 0]
        );
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_fulfilment_methods",
        entityId: merchantId,
        metadata: { updates: Object.fromEntries(updates) },
      });

      return res.json({ success: true, message: "Fulfilment methods updated." });
    } catch (err) {
      console.error("[merchant/settings/fulfilment-methods PATCH] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update fulfilment methods." });
    }
  });

  // -------------------------
  // Payment accounts — online payment gateway configuration
  // (Merchant Payments Stage 1: configuration infrastructure only — see
  // CLAUDE.md §62 "Merchant Payments". Saving a row here does NOT make
  // online payment actually route to this merchant; STATUS can only ever
  // become PENDING through this endpoint, never ACTIVE.)
  // -------------------------
  router.get("/settings/payment-accounts", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const merchantId = req.merchantContext.merchantId;
      const [rows] = await db.query(
        `SELECT id, provider, provider_merchant_id, status, created_at, updated_at
           FROM MERCHANT_PAYMENT_ACCOUNTS WHERE merchant_id = ?`,
        [merchantId]
      );
      return res.json({ success: true, data: rows }); // credential columns are never selected here
    } catch (err) {
      console.error("[merchant/settings/payment-accounts GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load payment account configuration." });
    }
  });

  router.post("/settings/payment-accounts", requireAuth, requireMerchant("MERCHANT_OWNER"), async (req, res) => {
    try {
      const { provider, providerMerchantId } = req.body || {};
      if (!isValidProviderSlug(provider)) {
        return res.status(400).json({ success: false, message: "provider must be a short uppercase identifier (letters, digits, underscores)." });
      }

      const merchantId = req.merchantContext.merchantId;
      const providerUpper = String(provider).toUpperCase();
      // Always PENDING — never accept a client-supplied status, and never
      // write ACTIVE from this endpoint. See file header note above.
      const status = WRITABLE_PAYMENT_ACCOUNT_STATUSES.includes("PENDING") ? "PENDING" : "NOT_CONFIGURED";

      await db.execute(
        `INSERT INTO MERCHANT_PAYMENT_ACCOUNTS (merchant_id, provider, provider_merchant_id, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE provider_merchant_id = VALUES(provider_merchant_id), status = VALUES(status), updated_at = NOW()`,
        [merchantId, providerUpper, providerMerchantId != null ? toStr(providerMerchantId) || null : null, status]
      );

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: merchantId,
        action: "MERCHANT_SETTINGS_CHANGED",
        entityType: "merchant_payment_accounts",
        entityId: merchantId,
        metadata: { provider: providerUpper, status },
      });

      return res.status(201).json({
        success: true,
        message: "Online payment configuration saved. This does not yet enable real online payment routing for this merchant.",
        data: { provider: providerUpper, status },
      });
    } catch (err) {
      console.error("[merchant/settings/payment-accounts POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to save payment account configuration." });
    }
  });

  // -------------------------
  // GET/POST /api/merchant/staff
  // -------------------------
  router.get("/staff", requireAuth, requireMerchant("MERCHANT_ADMIN", { allowReadOnlyWhenSuspended: true }), async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT mu.id, mu.role, mu.status, mu.created_at, u.id AS user_id, u.name, u.email
           FROM MERCHANT_USERS mu JOIN USERS u ON u.id = mu.user_id
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

      const [userRows] = await db.query(`SELECT id FROM USERS WHERE email = ? LIMIT 1`, [String(email).trim().toLowerCase()]);
      const targetUser = userRows?.[0];
      if (!targetUser) {
        return res.status(404).json({ success: false, message: "No registered user with that email. They must register an account first." });
      }

      await db.execute(
        `INSERT INTO MERCHANT_USERS (merchant_id, user_id, role, status) VALUES (?, ?, ?, 'active')
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
