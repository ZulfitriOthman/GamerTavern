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
import PaymentReconciliationService from "../../services/payment/PaymentReconciliationService.js";

const MERCHANT_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];

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
  // GET /api/admin/merchants — list, optionally filtered by status
  // -------------------------
  // Discovered missing during Phase 2A frontend testing: merchants could
  // register (defaulting to PENDING) but nothing could ever move them to
  // ACTIVE except a manual SQL UPDATE — there was no admin surface at all.
  // This is the smallest correct fix: a plain list + a status-transition
  // endpoint, admin-only, reusing the same audit log every other
  // state-changing action already goes through.
  router.get("/merchants", async (req, res) => {
    try {
      const status = String(req.query.status || "").toUpperCase();
      const where = [];
      const params = [];
      if (MERCHANT_STATUSES.includes(status)) {
        where.push("status = ?");
        params.push(status);
      }
      const [rows] = await db.query(
        `SELECT id, business_name, display_name, slug, email, phone, business_category, status, created_at
           FROM merchants
           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY created_at DESC`,
        params
      );
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("[admin/merchants] error:", err);
      return res.status(500).json({ success: false, message: "Failed to list merchants." });
    }
  });

  // -------------------------
  // PATCH /api/admin/merchants/:id/status
  // -------------------------
  router.patch("/merchants/:id/status", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const status = String(req.body?.status || "").toUpperCase();
      if (!MERCHANT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: `status must be one of: ${MERCHANT_STATUSES.join(", ")}` });
      }

      const [result] = await db.execute(`UPDATE merchants SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Merchant not found." });
      }

      await writeAuditLog(db, {
        actorUserId: req.user.sub,
        actorMerchantId: id,
        action: "MERCHANT_STATUS_CHANGED",
        entityType: "merchant",
        entityId: id,
        metadata: { status },
      });

      return res.json({ success: true, data: { id, status } });
    } catch (err) {
      console.error("[admin/merchants/:id/status] error:", err);
      return res.status(500).json({ success: false, message: "Failed to update merchant status." });
    }
  });

  return router;
}
