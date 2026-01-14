import { Router } from "express";

export default function createHealthRoutes({ dbPing, stores }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      onlineUsers: stores.onlineUsers.size,
      activeTrades: stores.activeTrades.size,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/db-test", async (_req, res) => {
    try {
      const ok = await dbPing();
      res.json({ ok: Boolean(ok) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get("/stats", (_req, res) => {
    res.json({
      onlineUsers: stores.onlineUsers.size,
      users: Array.from(stores.onlineUsers.values()),
      activeTrades: stores.activeTrades.size,
      recentActivities: stores.recentActivities.slice(0, 10),
    });
  });

  return router;
}
