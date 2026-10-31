// Backend/routes/api/admin.routes.js
//
// Platform-admin-only endpoints. Currently just the reconciliation
// service's callable surface — a real cron/queue can hit
// POST /api/admin/reconciliation/run on a schedule once that
// infrastructure exists; for now it's a manually/Postman-callable,
// fully auditable function.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";
import { writeAuditLog } from "../../modules/auditLog.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";
import { MERCHANT_STATUSES, canTransitionMerchant } from "../../modules/orderStateMachine.module.js";
import { getCommissionDueDays } from "../../modules/merchantFinance.module.js";
import PaymentReconciliationService from "../../services/payment/PaymentReconciliationService.js";

function requireAdmin(req, res, next) {
  if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, code: "ADMIN_REQUIRED", message: "Admin privileges required." });
  }
  next();
}

export default function createAdminRoutes({ db }) {
  const router = Router();
  const reconciliationService = new PaymentReconciliationService(db);

  router.use(requireAuth, requireAdmin);

  router.get("/reconciliation/stale", async (req, res) => {
    try {
      const olderThanMinutes = Math.max(1, Number(req.query.olderThanMinutes) || 15);
      const orders = await reconciliationService.findStalePendingOrders({ olderThanMinutes });
      return res.json({ success: true, data: orders });
    } catch (err) {
      console.error("[admin/reconciliation/stale] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list stale orders." });
    }
  });

  // dryRun=true reports what WOULD happen without changing anything —
  // safe to call at any time, including against a real database, to
  // sanity-check the reconciliation logic before actually running it.
  router.post("/reconciliation/run", async (req, res) => {
    try {
      const olderThanMinutes = Math.max(1, Number(req.body?.olderThanMinutes) || 15);
      const dryRun = Boolean(req.body?.dryRun);
      const result = await reconciliationService.reconcileAll({ olderThanMinutes, actorUserId: req.user.sub, dryRun });
      return res.json({ success: true, data: result });
    } catch (err) {
      console.error("[admin/reconciliation/run] error:", err);
      return res.status(500).json({ success: false, message: "Reconciliation run failed." });
    }
  });

  router.post("/reconciliation/orders/:id", async (req, res) => {
    try {
      const dryRun = Boolean(req.body?.dryRun);
      const result = await reconciliationService.reconcileOrder(Number(req.params.id), { actorUserId: req.user.sub, dryRun });
      return res.json({ success: true, data: result });
    } catch (err) {
      console.error("[admin/reconciliation/orders/:id] error:", err);
      return res.status(500).json({ success: false, message: "Reconciliation failed for this order." });
    }
  });

  // -------------------------
  // GET /api/admin/merchants/stats — counts for the dashboard KPI tiles
  // -------------------------
  // Registered before /merchants/:id so "stats" is never captured as an :id param.
  router.get("/merchants/stats", async (req, res) => {
    try {
      const [rows] = await db.query(`SELECT status, COUNT(*) AS count FROM MERCHANTS GROUP BY status`);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
      return res.json({
        success: true,
        data: {
          total,
          pending: byStatus.PENDING || 0,
          active: byStatus.ACTIVE || 0,
          rejected: byStatus.REJECTED || 0,
          suspended: byStatus.SUSPENDED || 0,
          banned: byStatus.BANNED || 0,
        },
      });
    } catch (err) {
      console.error("[admin/merchants/stats] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load merchant stats." });
    }
  });

  // -------------------------
  // GET /api/admin/dashboard-stats — everything the /admin/dashboard KPI row
  // needs in one call: merchant counts by status, orders placed today, and
  // total registered users. All real aggregate queries — nothing hardcoded.
  // -------------------------
  router.get("/dashboard-stats", async (req, res) => {
    try {
      const [merchantRows] = await db.query(`SELECT status, COUNT(*) AS count FROM MERCHANTS GROUP BY status`);
      const byStatus = Object.fromEntries(merchantRows.map((r) => [r.status, Number(r.count)]));

      const [[{ ordersToday }]] = await db.query(
        `SELECT COUNT(*) AS ordersToday FROM ORDERS WHERE DATE(created_at) = CURDATE()`
      );
      const [[{ registeredUsers }]] = await db.query(`SELECT COUNT(*) AS registeredUsers FROM USERS`);

      return res.json({
        success: true,
        data: {
          merchants: {
            pending: byStatus.PENDING || 0,
            active: byStatus.ACTIVE || 0,
            suspended: byStatus.SUSPENDED || 0,
            banned: byStatus.BANNED || 0,
          },
          ordersToday: Number(ordersToday),
          registeredUsers: Number(registeredUsers),
        },
      });
    } catch (err) {
      console.error("[admin/dashboard-stats] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load dashboard stats." });
    }
  });

  // -------------------------
  // GET /api/admin/merchants — paginated list, filterable by status, searchable
  // -------------------------
  // Discovered missing during Phase 2A frontend testing: merchants could
  // register (defaulting to PENDING) but nothing could ever move them to
  // ACTIVE except a manual SQL UPDATE — there was no admin surface at all.
  // Search/pagination added alongside the admin frontend that now consumes
  // this, matching the {items, pagination} shape every other list endpoint
  // in the marketplace already returns (see modules/pagination.module.js).
  router.get("/merchants", async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);
      const status = String(req.query.status || "").toUpperCase();
      const search = String(req.query.search || "").trim();

      const where = [];
      const params = [];
      if (MERCHANT_STATUSES.includes(status)) {
        where.push("status = ?");
        params.push(status);
      }
      if (search) {
        const searchConditions = ["business_name LIKE ?", "display_name LIKE ?", "email LIKE ?", "contact_person LIKE ?"];
        const searchParams = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        // A purely-numeric search term also matches by merchant id exactly.
        if (/^\d+$/.test(search)) {
          searchConditions.push("id = ?");
          searchParams.push(Number(search));
        }
        where.push(`(${searchConditions.join(" OR ")})`);
        params.push(...searchParams);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM MERCHANTS ${whereClause}`, params);
      const [rows] = await db.query(
        `SELECT id, business_name, display_name, slug, contact_person, email, phone, business_category, status, created_at
           FROM MERCHANTS
           ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      return res.json({ success: true, data: { items: rows, pagination: paginationMeta({ page, limit, total }) } });
    } catch (err) {
      console.error("[admin/merchants] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list merchants." });
    }
  });

  // -------------------------
  // GET /api/admin/merchants/:id — full detail: merchant row + addresses +
  // recent audit history (reuses the existing audit_logs table — no new
  // logging subsystem; see modules/auditLog.module.js).
  // -------------------------
  router.get("/merchants/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [[merchant]] = await db.query(
        `SELECT id, business_name, display_name, slug, contact_person, email, phone, business_category,
                status, commission_percent, social_links, created_at, updated_at
           FROM MERCHANTS WHERE id = ?`,
        [id]
      );
      if (!merchant) return res.status(404).json({ success: false, message: "Merchant not found." });

      const [addresses] = await db.query(
        `SELECT id, merchant_id, label, address_line1, district, mukim, village, postcode, country_code, is_default, created_at, updated_at
           FROM MERCHANT_ADDRESSES WHERE merchant_id = ? ORDER BY is_default DESC, id ASC`,
        [id]
      );
      const [history] = await db.query(
        `SELECT al.id, al.action, al.metadata, al.created_at, al.actor_user_id, u.name AS actor_name, u.email AS actor_email
           FROM AUDIT_LOGS al
           LEFT JOIN USERS u ON u.id = al.actor_user_id
          WHERE al.entity_type = 'merchant' AND al.entity_id = ?
          ORDER BY al.created_at DESC
          LIMIT 20`,
        [String(id)]
      );

      const [merchantUsers] = await db.query(
        `SELECT mu.id, mu.role, mu.status, mu.created_at, u.id AS user_id, u.name, u.email
           FROM MERCHANT_USERS mu JOIN USERS u ON u.id = mu.user_id
          WHERE mu.merchant_id = ?
          ORDER BY FIELD(mu.role, 'MERCHANT_OWNER', 'MERCHANT_ADMIN', 'MERCHANT_EMPLOYEE'), mu.created_at ASC`,
        [id]
      );

      const [[productStats]] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(status = 'active') AS active,
                SUM(status = 'draft') AS draft,
                SUM(status = 'archived') AS archived,
                SUM(status = 'active' AND stock_quantity <= 0) AS outOfStock,
                SUM(status = 'active' AND stock_quantity > 0 AND low_stock_threshold IS NOT NULL AND stock_quantity <= low_stock_threshold) AS lowStock
           FROM PRODUCTS WHERE merchant_id = ?`,
        [id]
      );

      const [[orderStats]] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(status = 'DELIVERED') AS completed,
                SUM(status = 'CANCELLED') AS cancelled
           FROM MERCHANT_ORDERS WHERE merchant_id = ?`,
        [id]
      );

      const [[reviewStats]] = await db.query(
        `SELECT COUNT(*) AS total, AVG(r.rating) AS averageRating
           FROM REVIEWS r JOIN PRODUCTS p ON p.id = r.product_id
          WHERE p.merchant_id = ? AND r.status = 'published'`,
        [id]
      );

      const [[payoutStats]] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(status = 'PAID') AS paidCount,
                SUM(CASE WHEN status = 'PAID' THEN net_amount ELSE 0 END) AS paidTotal,
                SUM(CASE WHEN status IN ('PENDING', 'ELIGIBLE', 'PROCESSING') THEN net_amount ELSE 0 END) AS pendingTotal
           FROM MERCHANT_PAYOUTS WHERE merchant_id = ?`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          merchant,
          addresses,
          history: history.map((h) => ({ ...h, metadata: h.metadata ? JSON.parse(h.metadata) : null })),
          merchantUsers,
          productStats: {
            total: Number(productStats.total) || 0,
            active: Number(productStats.active) || 0,
            draft: Number(productStats.draft) || 0,
            archived: Number(productStats.archived) || 0,
            outOfStock: Number(productStats.outOfStock) || 0,
            lowStock: Number(productStats.lowStock) || 0,
          },
          orderStats: {
            total: Number(orderStats.total) || 0,
            completed: Number(orderStats.completed) || 0,
            cancelled: Number(orderStats.cancelled) || 0,
          },
          reviewStats: {
            total: Number(reviewStats.total) || 0,
            averageRating: reviewStats.averageRating != null ? Number(reviewStats.averageRating) : null,
          },
          payoutStats: {
            total: Number(payoutStats.total) || 0,
            paidCount: Number(payoutStats.paidCount) || 0,
            paidTotal: Number(payoutStats.paidTotal) || 0,
            pendingTotal: Number(payoutStats.pendingTotal) || 0,
          },
        },
      });
    } catch (err) {
      console.error("[admin/merchants/:id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load merchant." });
    }
  });

  // -------------------------
  // GET /api/admin/merchants/:id/analytics — Merchant 360 financial dashboard
  // -------------------------
  // A merchant's financial figures are computed exclusively from ITS OWN
  // MERCHANT_ORDERS rows (subtotal/commission_amount/merchant_net_amount —
  // historical snapshots taken at checkout time, see
  // Database/schema/005_orders_checkout.sql) — never from the parent
  // ORDERS.grand_total, which can span multiple merchants in one cart.
  //
  // "Paid" is deliberately stricter than merely "not cancelled": a
  // MERCHANT_ORDERS row is created immediately at checkout for every
  // payment method, including Bank Transfer / Pay on Delivery / Pay on
  // Pickup, well before the customer has actually paid — those are only
  // confirmed later via MERCHANT_ORDER_PAYMENTS.status = 'PAID' (set by a
  // merchant/admin action). Online-payment orders never get a
  // MERCHANT_ORDER_PAYMENTS row at all (checkout.routes.js) — their
  // confirmation lives on ORDERS.payment_status = 'PAID' instead. Counting
  // every un-cancelled order as a "sale" would inflate Gross Sales with
  // orders nobody has paid for yet. This intentionally diverges from the
  // merchant's own GET /api/merchant/dashboard (which only excludes
  // CANCELLED) — that page is being kept as-is per its own scope; this is
  // the stricter, payment-confirmed definition for admin financial
  // reporting specifically.
  const MERCHANT_ORDER_PAID_SQL = `(
    EXISTS (SELECT 1 FROM MERCHANT_ORDER_PAYMENTS mop WHERE mop.merchant_order_id = mo.id AND mop.status = 'PAID')
    OR (
      NOT EXISTS (SELECT 1 FROM MERCHANT_ORDER_PAYMENTS mop WHERE mop.merchant_order_id = mo.id)
      AND o.payment_status = 'PAID'
    )
  )`;

  // 7 / 30 / 90 days or the whole history — applied to mo.created_at.
  // Recent Orders and the Payout snapshot deliberately ignore this: recent
  // orders are "what just happened" regardless of the reporting window,
  // and payout figures are a current running balance, not a period flow.
  const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, all: null };

  router.get("/merchants/:id/analytics", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const range = RANGE_DAYS[req.query.range] !== undefined ? req.query.range : "30d";
      const days = RANGE_DAYS[range];
      const rangeSql = days ? `AND mo.created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)` : "";

      const [[merchantRow]] = await db.query(`SELECT id FROM MERCHANTS WHERE id = ?`, [id]);
      if (!merchantRow) return res.status(404).json({ success: false, message: "Merchant not found." });

      const [[kpis]] = await db.query(
        `SELECT COUNT(*) AS orderCount,
                COALESCE(SUM(mo.subtotal), 0) AS grossSales,
                COALESCE(SUM(mo.commission_amount), 0) AS platformCommission,
                COALESCE(SUM(mo.merchant_net_amount), 0) AS merchantEarnings
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND ${MERCHANT_ORDER_PAID_SQL} ${rangeSql}`,
        [id]
      );

      const [[orderBreakdown]] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(${MERCHANT_ORDER_PAID_SQL}) AS paid,
                SUM(NOT ${MERCHANT_ORDER_PAID_SQL} AND mo.status != 'CANCELLED') AS awaitingPayment,
                SUM(mo.status = 'PROCESSING') AS processing,
                SUM(mo.status = 'READY') AS ready,
                SUM(mo.status = 'SHIPPED') AS shipped,
                SUM(mo.status = 'DELIVERED') AS completed,
                SUM(mo.status = 'CANCELLED') AS cancelled,
                SUM(o.payment_status = 'REFUNDED' OR EXISTS (
                  SELECT 1 FROM MERCHANT_ORDER_PAYMENTS mop WHERE mop.merchant_order_id = mo.id AND mop.status = 'REFUNDED'
                )) AS refunded
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
          WHERE mo.merchant_id = ? ${rangeSql}`,
        [id]
      );

      const [salesTrend] = await db.query(
        `SELECT DATE(mo.created_at) AS day, COALESCE(SUM(mo.subtotal), 0) AS total, COUNT(*) AS orders
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND ${MERCHANT_ORDER_PAID_SQL} ${rangeSql}
          GROUP BY DATE(mo.created_at)
          ORDER BY day ASC`,
        [id]
      );

      const [topProducts] = await db.query(
        `SELECT oi.product_id AS productId, oi.product_name_snapshot AS name,
                SUM(oi.quantity) AS unitsSold, COALESCE(SUM(oi.line_total), 0) AS sales,
                p.stock_quantity AS stockQuantity
           FROM ORDER_ITEMS oi
           JOIN MERCHANT_ORDERS mo ON mo.id = oi.merchant_order_id
           JOIN ORDERS o ON o.id = mo.order_id
           LEFT JOIN PRODUCTS p ON p.id = oi.product_id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND ${MERCHANT_ORDER_PAID_SQL} ${rangeSql}
          GROUP BY oi.product_id, oi.product_name_snapshot, p.stock_quantity
          ORDER BY sales DESC
          LIMIT 10`,
        [id]
      );

      const [recentOrders] = await db.query(
        `SELECT mo.merchant_order_number AS orderNumber, mo.created_at AS createdAt, u.name AS customerName,
                mo.subtotal AS amount, COALESCE(mop.payment_method, 'ONLINE_PAYMENT') AS paymentMethod, mo.status
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
           JOIN USERS u ON u.id = o.user_id
           LEFT JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
          WHERE mo.merchant_id = ?
          ORDER BY mo.created_at DESC
          LIMIT 10`,
        [id]
      );

      // Payout is a current running balance, not a period metric — always
      // lifetime, regardless of `range`. MERCHANT_PAYOUTS is a manually
      // admin-curated ledger (no automated writer exists yet — see
      // Database/schema/008_platform_ops.sql) — this reports what's been
      // recorded in it, not a derived "amount Nanashi still owes," since
      // Bank Transfer / Pay on Delivery / Pay on Pickup earnings are never
      // held by the platform and don't belong in a payout liability figure.
      const [[payoutTotals]] = await db.query(
        `SELECT COALESCE(SUM(CASE WHEN status = 'PAID' THEN net_amount ELSE 0 END), 0) AS paidOut,
                COALESCE(SUM(CASE WHEN status IN ('PENDING', 'ELIGIBLE', 'PROCESSING') THEN net_amount ELSE 0 END), 0) AS pendingPayout
           FROM MERCHANT_PAYOUTS WHERE merchant_id = ?`,
        [id]
      );
      const [[lastPayout]] = await db.query(
        `SELECT net_amount AS amount, paid_at AS paidAt FROM MERCHANT_PAYOUTS WHERE merchant_id = ? AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          range,
          kpis: {
            orderCount: Number(kpis.orderCount) || 0,
            grossSales: Number(kpis.grossSales) || 0,
            platformCommission: Number(kpis.platformCommission) || 0,
            merchantEarnings: Number(kpis.merchantEarnings) || 0,
            averageOrderValue: kpis.orderCount > 0 ? Number(kpis.grossSales) / Number(kpis.orderCount) : 0,
          },
          orderBreakdown: {
            total: Number(orderBreakdown.total) || 0,
            paid: Number(orderBreakdown.paid) || 0,
            awaitingPayment: Number(orderBreakdown.awaitingPayment) || 0,
            processing: Number(orderBreakdown.processing) || 0,
            ready: Number(orderBreakdown.ready) || 0,
            shipped: Number(orderBreakdown.shipped) || 0,
            completed: Number(orderBreakdown.completed) || 0,
            cancelled: Number(orderBreakdown.cancelled) || 0,
            refunded: Number(orderBreakdown.refunded) || 0,
          },
          salesTrend: salesTrend.map((r) => ({ day: r.day, total: Number(r.total) || 0, orders: Number(r.orders) || 0 })),
          topProducts: topProducts.map((r) => ({
            productId: r.productId,
            name: r.name,
            unitsSold: Number(r.unitsSold) || 0,
            sales: Number(r.sales) || 0,
            stockQuantity: r.stockQuantity != null ? Number(r.stockQuantity) : null,
          })),
          recentOrders: recentOrders.map((r) => ({
            orderNumber: r.orderNumber,
            createdAt: r.createdAt,
            customerName: r.customerName,
            amount: Number(r.amount) || 0,
            paymentMethod: r.paymentMethod,
            status: r.status,
          })),
          payout: {
            paidOut: Number(payoutTotals.paidOut) || 0,
            pendingPayout: Number(payoutTotals.pendingPayout) || 0,
            lastPayoutAmount: lastPayout?.amount != null ? Number(lastPayout.amount) : null,
            lastPayoutAt: lastPayout?.paidAt || null,
          },
          // Dollar-amount refund tracking doesn't exist anywhere in the
          // current schema (REFUNDS is a dormant table with zero writers —
          // see Database/schema/006_payments.sql) — reported honestly as
          // unavailable rather than fabricated as 0.00, distinct from
          // orderBreakdown.refunded above (a real, currently-zero COUNT
          // derived from status columns that do exist and are queried).
          refundsAvailable: false,
        },
      });
    } catch (err) {
      console.error("[admin/merchants/:id/analytics] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load merchant analytics." });
    }
  });

  // -------------------------
  // GET /api/admin/merchants/:id/finance — Commission Receivable
  // (MERCHANT owes NANASHI — the opposite direction from Payouts above).
  // -------------------------
  // Two sources combine into "outstanding": commission from paid,
  // direct-payment merchant orders not yet attached to any statement
  // ("unbilled" — aged from when the merchant's payment was confirmed),
  // and the unpaid balance of already-issued statements ("billed" —
  // aged from days past DUE_DATE). Both share one bucket scheme (0-30 /
  // 31-60 / 61-90 / 90+), each measured from its own reference point —
  // see merchantFinance.module.js for the payment-routing rule and
  // Database/schema/008_platform_ops.sql for the table rationale.
  router.get("/merchants/:id/finance", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [[merchantRow]] = await db.query(`SELECT id FROM MERCHANTS WHERE id = ?`, [id]);
      if (!merchantRow) return res.status(404).json({ success: false, message: "Merchant not found." });

      const BUCKET_CASE = (daysExpr) => `
        SUM(CASE WHEN ${daysExpr} <= 30 THEN amt ELSE 0 END) AS current_bucket,
        SUM(CASE WHEN ${daysExpr} BETWEEN 31 AND 60 THEN amt ELSE 0 END) AS days31to60,
        SUM(CASE WHEN ${daysExpr} BETWEEN 61 AND 90 THEN amt ELSE 0 END) AS days61to90,
        SUM(CASE WHEN ${daysExpr} > 90 THEN amt ELSE 0 END) AS days90plus
      `;

      const [[unbilled]] = await db.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(amt), 0) AS total, ${BUCKET_CASE("DATEDIFF(CURDATE(), age_from)")}
           FROM (
             SELECT mo.commission_amount AS amt,
                    COALESCE(mop.confirmed_at, mop.updated_at, mo.created_at) AS age_from
               FROM MERCHANT_ORDERS mo
               JOIN ORDERS o ON o.id = mo.order_id
               JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
               LEFT JOIN MERCHANT_COMMISSION_STATEMENT_ITEMS mcsi ON mcsi.merchant_order_id = mo.id
              WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND mop.status = 'PAID' AND mcsi.id IS NULL
           ) x`,
        [id]
      );

      const [[billed]] = await db.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(amt), 0) AS total, ${BUCKET_CASE("GREATEST(DATEDIFF(CURDATE(), age_from), 0)")}
           FROM (
             SELECT balance_due AS amt, due_date AS age_from
               FROM MERCHANT_COMMISSION_STATEMENTS
              WHERE merchant_id = ? AND balance_due > 0 AND status != 'VOID'
           ) x`,
        [id]
      );

      const [[dueThisMonthRow]] = await db.query(
        `SELECT COALESCE(SUM(balance_due), 0) AS total
           FROM MERCHANT_COMMISSION_STATEMENTS
          WHERE merchant_id = ? AND balance_due > 0 AND status != 'VOID'
            AND due_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            AND due_date < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)`,
        [id]
      );

      const [[overdueRow]] = await db.query(
        `SELECT COALESCE(SUM(balance_due), 0) AS total
           FROM MERCHANT_COMMISSION_STATEMENTS
          WHERE merchant_id = ? AND balance_due > 0 AND status != 'VOID' AND due_date < CURDATE()`,
        [id]
      );

      const [[lifetimeRow]] = await db.query(
        `SELECT COALESCE(SUM(mo.commission_amount), 0) AS total
           FROM MERCHANT_ORDERS mo
           JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND mop.status = 'PAID'`,
        [id]
      );

      const [[paidRow]] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM MERCHANT_COMMISSION_PAYMENTS WHERE merchant_id = ?`,
        [id]
      );

      const [unbilledOrders] = await db.query(
        `SELECT mo.id AS merchantOrderId, mo.merchant_order_number AS orderNumber, mop.payment_method AS paymentMethod,
                mo.subtotal, mo.commission_amount AS commissionAmount,
                COALESCE(mop.confirmed_at, mop.updated_at, mo.created_at) AS confirmedAt
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
           JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
           LEFT JOIN MERCHANT_COMMISSION_STATEMENT_ITEMS mcsi ON mcsi.merchant_order_id = mo.id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND mop.status = 'PAID' AND mcsi.id IS NULL
          ORDER BY confirmedAt DESC
          LIMIT 20`,
        [id]
      );

      const [statements] = await db.query(
        `SELECT id, period_start AS periodStart, period_end AS periodEnd, issue_date AS issueDate, due_date AS dueDate,
                gross_sales AS grossSales, commission_amount AS commissionAmount, amount_paid AS amountPaid,
                balance_due AS balanceDue, status
           FROM MERCHANT_COMMISSION_STATEMENTS
          WHERE merchant_id = ?
          ORDER BY period_start DESC
          LIMIT 12`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          commissionReceivable: {
            outstanding: Number(unbilled.total) + Number(billed.total),
            dueThisMonth: Number(dueThisMonthRow.total) || 0,
            overdue: Number(overdueRow.total) || 0,
            lifetimeCommission: Number(lifetimeRow.total) || 0,
            paidToNanashi: Number(paidRow.total) || 0,
            aging: {
              current: Number(unbilled.current_bucket || 0) + Number(billed.current_bucket || 0),
              days31to60: Number(unbilled.days31to60 || 0) + Number(billed.days31to60 || 0),
              days61to90: Number(unbilled.days61to90 || 0) + Number(billed.days61to90 || 0),
              days90plus: Number(unbilled.days90plus || 0) + Number(billed.days90plus || 0),
            },
          },
          unbilledOrders: unbilledOrders.map((r) => ({
            merchantOrderId: r.merchantOrderId,
            orderNumber: r.orderNumber,
            paymentMethod: r.paymentMethod,
            subtotal: Number(r.subtotal) || 0,
            commissionAmount: Number(r.commissionAmount) || 0,
            confirmedAt: r.confirmedAt,
          })),
          statements: statements.map((s) => ({
            ...s,
            grossSales: Number(s.grossSales) || 0,
            commissionAmount: Number(s.commissionAmount) || 0,
            amountPaid: Number(s.amountPaid) || 0,
            balanceDue: Number(s.balanceDue) || 0,
            isOverdue: Number(s.balanceDue) > 0 && s.status !== "VOID" && new Date(s.dueDate) < new Date(new Date().toDateString()),
          })),
        },
      });
    } catch (err) {
      console.error("[admin/merchants/:id/finance] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load merchant finance." });
    }
  });

  // -------------------------
  // POST /api/admin/merchants/:id/commission-statements — issue a
  // statement for a period, snapshotting every currently-unbilled,
  // paid, direct-payment merchant order whose payment was confirmed
  // within that period. Never automatic — an explicit admin action.
  // -------------------------
  router.post("/merchants/:id/commission-statements", async (req, res) => {
    const id = Number(req.params.id);
    const periodStart = String(req.body?.periodStart || "").slice(0, 10);
    const periodEnd = String(req.body?.periodEnd || "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd) {
      return res.status(400).json({ success: false, message: "A valid periodStart and periodEnd (periodStart <= periodEnd) are required." });
    }

    let conn;
    try {
      const [[merchantRow]] = await db.query(`SELECT id FROM MERCHANTS WHERE id = ?`, [id]);
      if (!merchantRow) return res.status(404).json({ success: false, message: "Merchant not found." });

      conn = await db.getConnection();
      await conn.beginTransaction();

      const [candidates] = await conn.query(
        `SELECT mo.id, mo.subtotal, mo.commission_amount
           FROM MERCHANT_ORDERS mo
           JOIN ORDERS o ON o.id = mo.order_id
           JOIN MERCHANT_ORDER_PAYMENTS mop ON mop.merchant_order_id = mo.id
           LEFT JOIN MERCHANT_COMMISSION_STATEMENT_ITEMS mcsi ON mcsi.merchant_order_id = mo.id
          WHERE mo.merchant_id = ? AND mo.status != 'CANCELLED' AND mop.status = 'PAID' AND mcsi.id IS NULL
            AND COALESCE(mop.confirmed_at, mop.updated_at, mo.created_at) >= ?
            AND COALESCE(mop.confirmed_at, mop.updated_at, mo.created_at) < DATE_ADD(?, INTERVAL 1 DAY)
          FOR UPDATE`,
        [id, periodStart, periodEnd]
      );

      if (candidates.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "No unbilled commission found for this period." });
      }

      const grossSales = candidates.reduce((sum, c) => sum + Number(c.subtotal), 0);
      const commissionAmount = candidates.reduce((sum, c) => sum + Number(c.commission_amount), 0);
      const dueDays = await getCommissionDueDays(db);
      const issueDate = new Date().toISOString().slice(0, 10);
      const [dueDateRow] = await conn.query(`SELECT DATE_ADD(?, INTERVAL ? DAY) AS dueDate`, [issueDate, dueDays]);
      const dueDate = dueDateRow[0].dueDate;

      const [result] = await conn.execute(
        `INSERT INTO MERCHANT_COMMISSION_STATEMENTS
           (merchant_id, period_start, period_end, issue_date, due_date, gross_sales, commission_amount, amount_paid, balance_due, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'OPEN')`,
        [id, periodStart, periodEnd, issueDate, dueDate, grossSales, commissionAmount, commissionAmount]
      );
      const statementId = result.insertId;

      for (const c of candidates) {
        await conn.execute(
          `INSERT INTO MERCHANT_COMMISSION_STATEMENT_ITEMS (statement_id, merchant_order_id, gross_amount, commission_amount) VALUES (?, ?, ?, ?)`,
          [statementId, c.id, c.subtotal, c.commission_amount]
        );
      }

      await conn.commit();

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        action: "COMMISSION_STATEMENT_ISSUED",
        entityType: "merchant_commission_statement",
        entityId: statementId,
        metadata: { merchantId: id, periodStart, periodEnd, dueDate, commissionAmount, orderCount: candidates.length },
      });

      return res.status(201).json({ success: true, data: { id: statementId, commissionAmount, orderCount: candidates.length, dueDate } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "One or more of these orders were already billed on another statement." });
      }
      console.error("[admin/merchants/:id/commission-statements POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to issue statement." });
    } finally {
      conn?.release();
    }
  });

  // -------------------------
  // POST /api/admin/merchants/:id/commission-statements/:statementId/payments
  // — records "merchant paid Nanashi" against one statement. Supports
  // partial payment; never auto-marks a statement paid on its own.
  // -------------------------
  router.post("/merchants/:id/commission-statements/:statementId/payments", async (req, res) => {
    const id = Number(req.params.id);
    const statementId = Number(req.params.statementId);
    const amount = Number(req.body?.amount);
    const paymentMethod = req.body?.paymentMethod ? String(req.body.paymentMethod).trim().slice(0, 30) : null;
    const reference = req.body?.reference ? String(req.body.reference).trim().slice(0, 100) : null;
    const notes = req.body?.notes ? String(req.body.notes).trim().slice(0, 500) : null;
    const paidAt = req.body?.paidAt ? String(req.body.paidAt).slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "A valid, positive amount is required." });
    }

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute(
        `SELECT id, merchant_id, balance_due, amount_paid, commission_amount, status FROM MERCHANT_COMMISSION_STATEMENTS WHERE id = ? AND merchant_id = ? FOR UPDATE`,
        [statementId, id]
      );
      const statement = rows?.[0];
      if (!statement) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Statement not found." });
      }
      if (statement.status === "VOID") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "This statement has been voided." });
      }
      if (Number(statement.balance_due) <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "This statement has no outstanding balance." });
      }
      if (amount > Number(statement.balance_due) + 0.005) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Payment amount exceeds the outstanding balance (${Number(statement.balance_due).toFixed(2)}).` });
      }

      const [payRes] = await conn.execute(
        `INSERT INTO MERCHANT_COMMISSION_PAYMENTS (merchant_id, statement_id, amount, payment_method, reference, paid_at, recorded_by_user_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, statementId, amount, paymentMethod, reference, paidAt, req.user.sub, notes]
      );

      const newAmountPaid = Number(statement.amount_paid) + amount;
      const newBalanceDue = Math.max(0, Number(statement.commission_amount) - newAmountPaid);
      const newStatus = newBalanceDue <= 0.005 ? "PAID" : "PARTIALLY_PAID";

      await conn.execute(
        `UPDATE MERCHANT_COMMISSION_STATEMENTS SET amount_paid = ?, balance_due = ?, status = ?, updated_at = NOW() WHERE id = ?`,
        [newAmountPaid, newBalanceDue, newStatus, statementId]
      );

      await conn.commit();

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        action: "COMMISSION_PAYMENT_RECORDED",
        entityType: "merchant_commission_statement",
        entityId: statementId,
        metadata: { merchantId: id, paymentId: payRes.insertId, amount, paymentMethod, reference, newStatus, balanceDue: newBalanceDue },
      });

      return res.status(201).json({ success: true, data: { statementId, amountPaid: newAmountPaid, balanceDue: newBalanceDue, status: newStatus } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[admin/merchants/:id/commission-statements/:statementId/payments] error:", err);
      return res.status(500).json({ success: false, message: "Failed to record payment." });
    } finally {
      conn?.release();
    }
  });

  // -------------------------
  // PATCH /api/admin/merchants/:id/status
  // -------------------------
  // Only the transitions in MERCHANT_TRANSITIONS (orderStateMachine.module.js)
  // are allowed — PENDING->ACTIVE, PENDING->REJECTED, REJECTED->ACTIVE.
  // Row-locked read-then-write so two concurrent admin actions on the same
  // merchant can't race past each other's validation.
  // A reason is mandatory for the two moderation actions (suspend/ban) — not for
  // approving, rejecting, or reactivating, where it's useful context but not the
  // whole point of the action. Both reason and notes land in AUDIT_LOGS.metadata;
  // neither is written anywhere else on the merchant row itself (see comment on
  // GET /merchants/:id — "current reason" is read back from this history, not a
  // dedicated column, so no schema migration was needed for this feature).
  const REASON_REQUIRED_FOR = ["SUSPENDED", "BANNED"];

  router.patch("/merchants/:id/status", async (req, res) => {
    const id = Number(req.params.id);
    const nextStatus = String(req.body?.status || "").toUpperCase();
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : null;
    const notes = req.body?.notes ? String(req.body.notes).trim().slice(0, 2000) : null;

    if (!MERCHANT_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${MERCHANT_STATUSES.join(", ")}` });
    }
    if (REASON_REQUIRED_FOR.includes(nextStatus) && !reason) {
      return res.status(400).json({ success: false, message: `A reason is required to move a merchant to ${nextStatus}.` });
    }

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [rows] = await conn.execute(`SELECT id, status FROM MERCHANTS WHERE id = ? FOR UPDATE`, [id]);
      const current = rows?.[0];
      if (!current) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Merchant not found." });
      }

      if (current.status !== nextStatus && !canTransitionMerchant(current.status, nextStatus)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          code: "INVALID_TRANSITION",
          message: `Cannot move merchant from ${current.status} to ${nextStatus}.`,
        });
      }

      await conn.execute(`UPDATE MERCHANTS SET status = ?, updated_at = NOW() WHERE id = ?`, [nextStatus, id]);
      await conn.commit();

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: id,
        action: "MERCHANT_STATUS_CHANGED",
        entityType: "merchant",
        entityId: id,
        metadata: { previousStatus: current.status, newStatus: nextStatus, reason: reason || undefined, notes: notes || undefined },
      });

      return res.json({ success: true, data: { id, status: nextStatus, previousStatus: current.status } });
    } catch (err) {
      try {
        await conn?.rollback();
      } catch {}
      console.error("[admin/merchants/:id/status] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update merchant status." });
    } finally {
      try {
        conn?.release();
      } catch {}
    }
  });

  // -------------------------
  // GET /api/admin/audit-log — platform-wide, paginated, filterable by action.
  // Reuses AUDIT_LOGS (see writeAuditLog everywhere else in the codebase) —
  // no dedicated audit-log feature/table was needed for this.
  // -------------------------
  router.get("/audit-log", async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);
      const action = String(req.query.action || "").trim();

      const where = [];
      const params = [];
      if (action) {
        where.push("al.action = ?");
        params.push(action);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM AUDIT_LOGS al ${whereClause}`, params);
      const [rows] = await db.query(
        `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata, al.created_at,
                al.actor_user_id, u.name AS actor_name, u.email AS actor_email,
                al.actor_merchant_id, m.business_name AS actor_merchant_name
           FROM AUDIT_LOGS al
           LEFT JOIN USERS u ON u.id = al.actor_user_id
           LEFT JOIN MERCHANTS m ON m.id = al.actor_merchant_id
           ${whereClause}
          ORDER BY al.created_at DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        data: {
          items: rows.map((r) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null })),
          pagination: paginationMeta({ page, limit, total }),
        },
      });
    } catch (err) {
      console.error("[admin/audit-log] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load audit log." });
    }
  });

  return router;
}
