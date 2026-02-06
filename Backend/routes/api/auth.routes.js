// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

/**
 * Factory route
 * Mounted at /api/auth, so endpoints become:
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 */
export default function createAuthRoutes({ db, io } = {}) {
  const router = express.Router();

  // -------------------------
  // Helpers
  // -------------------------
  function signToken(user) {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not set in environment variables");
    }
    return jwt.sign(
      { sub: user.ID, email: user.EMAIL, name: user.NAME },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
  }

  function requireAuth(req, res, next) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "missing token" });

    try {
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "server misconfigured (JWT_SECRET missing)" });
      }
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ message: "invalid token" });
    }
  }

  // -------------------------
  // POST /api/auth/register
  // -------------------------
  router.post("/register", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ message: "DB is not configured" });

      const { name, email, phone, password } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "name, email, password are required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedPhone = phone ? String(phone).trim() : null;

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hashed = await bcrypt.hash(String(password), rounds);

      await db.query(
        `INSERT INTO persona (NAME, EMAIL, PHONE, PASSWORD)
         VALUES (?, ?, ?, ?)`,
        [String(name).trim(), normalizedEmail, normalizedPhone, hashed]
      );

      const [rows] = await db.query(
        `SELECT ID, NAME, EMAIL, PHONE, CREATED_AT
         FROM persona
         WHERE EMAIL = ?
         LIMIT 1`,
        [normalizedEmail]
      );

      const user = rows?.[0];
      const token = signToken(user);

      // optional socket event
      io?.emit?.("auth:registered", { userId: user?.ID, email: user?.EMAIL });

      return res.status(201).json({ ok: true, user, token });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "email or phone already exists" });
      }
      console.error("[auth/register] error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // -------------------------
  // POST /api/auth/login
  // -------------------------
  router.post("/login", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ message: "DB is not configured" });

      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: "email and password are required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const [rows] = await db.query(
        `SELECT ID, NAME, EMAIL, PHONE, PASSWORD, CREATED_AT
         FROM persona
         WHERE EMAIL = ?
         LIMIT 1`,
        [normalizedEmail]
      );

      const userRow = rows?.[0];
      if (!userRow) return res.status(401).json({ message: "invalid credentials" });

      const ok = await bcrypt.compare(String(password), String(userRow.PASSWORD));
      if (!ok) return res.status(401).json({ message: "invalid credentials" });

      const user = {
        ID: userRow.ID,
        NAME: userRow.NAME,
        EMAIL: userRow.EMAIL,
        PHONE: userRow.PHONE,
        CREATED_AT: userRow.CREATED_AT,
      };

      const token = signToken(user);

      // optional socket event
      io?.emit?.("auth:login", { userId: user?.ID, email: user?.EMAIL });

      return res.json({ ok: true, user, token });
    } catch (err) {
      console.error("[auth/login] error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // -------------------------
  // GET /api/auth/me (protected)
  // -------------------------
  router.get("/me", requireAuth, async (req, res) => {
    return res.json({ ok: true, user: req.user });
  });

  return router;
}
