// Backend/routes/api/shipping.routes.js — public read of active shipping methods.
import { Router } from "express";

export default function createShippingRoutes({ db }) {
  const router = Router();

  router.get("/methods", async (_req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, name, code, description, base_fee FROM SHIPPING_METHODS WHERE status = 'active' ORDER BY base_fee ASC`
      );
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("[shipping/methods] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load shipping methods." });
    }
  });

  return router;
}
