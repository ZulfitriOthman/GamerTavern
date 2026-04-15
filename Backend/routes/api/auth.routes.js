// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/**
 * Factory route
 * Mounted at /api/auth, so endpoints become:
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 */
export default function createAuthRoutes({ db, io } = {}) {
  const router = express.Router();
  const AUTH_TABLE = "PERSONAL_USER";
  const PORTFOLIO_ROLE = "PORTFOLIO";
  const REGISTER_ALLOWED_FIELDS = new Set(["name", "email", "phone", "password"]);
  const LOGIN_ALLOWED_FIELDS = new Set(["email", "password"]);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^[0-9+()\- ]{8,20}$/;
  let cachedDevJwtSecret = null;

  // -------------------------
  // Helpers
  // -------------------------
  function signToken(user) {
    const jwtSecret = getJwtSecret();
    return jwt.sign(
      { sub: user.ID, email: user.EMAIL, name: user.NAME, role: user.ROLE },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function isPortfolioRole(role) {
    return normalizeRole(role) === PORTFOLIO_ROLE;
  }

  function getJwtSecret() {
    if (process.env.JWT_SECRET) {
      return process.env.JWT_SECRET;
    }

    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new Error("JWT_SECRET is not set in environment variables");
    }

    if (!cachedDevJwtSecret) {
      cachedDevJwtSecret = crypto.randomBytes(48).toString("hex");
      console.warn("[auth] JWT_SECRET is missing. Using temporary in-memory dev secret. Tokens will reset when server restarts.");
    }

    return cachedDevJwtSecret;
  }

  function requireAuth(req, res, next) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "missing token" });

    try {
      req.user = jwt.verify(token, getJwtSecret());
      return next();
    } catch {
      return res.status(401).json({ message: "invalid token" });
    }
  }

  function hasOnlyAllowedFields(payload, allowedFields) {
    const keys = Object.keys(payload || {});
    return keys.every((field) => allowedFields.has(field));
  }

  // -------------------------
  // POST /api/auth/register
  // -------------------------
  router.post("/register", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ message: "DB is not configured" });

      if (!hasOnlyAllowedFields(req.body, REGISTER_ALLOWED_FIELDS)) {
        return res.status(400).json({ message: "Unexpected fields in request" });
      }

      const { name, email, phone, password } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ message: "name, email, password are required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedPhone = phone ? String(phone).trim() : null;
      const normalizedName = String(name).trim();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "invalid email format" });
      }

      if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
        return res.status(400).json({ message: "invalid phone format" });
      }

      if (normalizedName.length < 2 || normalizedName.length > 80) {
        return res.status(400).json({ message: "name must be 2 to 80 characters" });
      }

      if (String(password).length < 8) {
        return res.status(400).json({ message: "password must be at least 8 characters" });
      }

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hashed = await bcrypt.hash(String(password), rounds);

      await db.query(
        `INSERT INTO ${AUTH_TABLE} (NAME, EMAIL, PHONE, PASSWORD)
         VALUES (?, ?, ?, ?)`,
        [normalizedName, normalizedEmail, normalizedPhone, hashed]
      );

      const [rows] = await db.query(
        `SELECT ID, ROLE, NAME, EMAIL, PHONE, CREATED_AT
         FROM ${AUTH_TABLE}
         WHERE EMAIL = ?
         LIMIT 1`,
        [normalizedEmail]
      );

      const user = rows?.[0];
      if (user) {
        user.ROLE = normalizeRole(user.ROLE);
      }
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

      if (!hasOnlyAllowedFields(req.body, LOGIN_ALLOWED_FIELDS)) {
        return res.status(400).json({ message: "Unexpected fields in request" });
      }

      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: "email and password are required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "invalid email format" });
      }

      const [rows] = await db.query(
        `SELECT ID, ROLE, NAME, EMAIL, PHONE, PASSWORD, CREATED_AT
         FROM ${AUTH_TABLE}
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
        ROLE: normalizeRole(userRow.ROLE),
        NAME: userRow.NAME,
        EMAIL: userRow.EMAIL,
        PHONE: userRow.PHONE,
        CREATED_AT: userRow.CREATED_AT,
      };

      const token = signToken(user);

      // optional socket event
      io?.emit?.("auth:login", {
        userId: user?.ID,
        email: user?.EMAIL,
        role: user?.ROLE,
        isPortfolio: isPortfolioRole(user?.ROLE),
      });

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
