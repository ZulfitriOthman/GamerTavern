// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signToken as signJwt, verifyToken } from "../../modules/jwt.module.js";

/**
 * Factory route
 * Mounted at /api/auth, so endpoints become:
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 *
 * Migrated to the NanashiCollectibles v2 schema (users / password_reset_tokens).
 */
export default function createAuthRoutes({ db, io } = {}) {
  const router = express.Router();
  const PORTFOLIO_ROLE = "PORTFOLIO";
  const REGISTER_ALLOWED_FIELDS = new Set(["name", "email", "phone", "password"]);
  const LOGIN_ALLOWED_FIELDS = new Set(["email", "password"]);
  const FORGOT_PASSWORD_ALLOWED_FIELDS = new Set(["email"]);
  const RESET_PASSWORD_ALLOWED_FIELDS = new Set(["token", "newPassword"]);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^[0-9+()\- ]{8,20}$/;

  // -------------------------
  // Helpers
  // -------------------------
  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function isPortfolioRole(role) {
    return normalizeRole(role) === PORTFOLIO_ROLE;
  }

  // Shape matches the decoded JWT payload exactly (sub/email/name/role), so `user` is
  // identical whether it came from register/login or from GET /me. Previously
  // register/login returned the raw uppercase DB row while /me returned the lowercase
  // JWT claims — two different shapes for the same concept — which meant `user.name`
  // was undefined in the frontend immediately after login/register until the next
  // reload re-derived it from /me. Fixed here as part of this migration.
  function toPublicUser(row) {
    if (!row) return null;
    return {
      sub: row.id,
      email: row.email,
      name: row.name,
      role: normalizeRole(row.role),
    };
  }

  function signToken(row) {
    return signJwt({ sub: row.id, email: row.email, name: row.name, role: normalizeRole(row.role) });
  }

  function requireAuth(req, res, next) {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: "missing token" });

    try {
      req.user = verifyToken(token);
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
        `INSERT INTO users (name, email, phone, password_hash)
         VALUES (?, ?, ?, ?)`,
        [normalizedName, normalizedEmail, normalizedPhone, hashed]
      );

      const [rows] = await db.query(
        `SELECT id, role, name, email, phone, status, created_at
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [normalizedEmail]
      );

      const row = rows?.[0];
      const user = toPublicUser(row);
      const token = row ? signToken(row) : null;

      // optional socket event
      io?.emit?.("auth:registered", { userId: row?.id, email: row?.email });

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
        `SELECT id, role, name, email, phone, password_hash, status, created_at
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [normalizedEmail]
      );

      const userRow = rows?.[0];
      if (!userRow) return res.status(401).json({ message: "invalid credentials" });

      const ok = await bcrypt.compare(String(password), String(userRow.password_hash));
      if (!ok) return res.status(401).json({ message: "invalid credentials" });

      // Checked only after a successful password match, so an unauthenticated request
      // can't use this to probe whether an account is suspended/deleted.
      if (userRow.status && userRow.status !== "active") {
        return res.status(403).json({ message: "This account is not active." });
      }

      try {
        await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userRow.id]);
      } catch (err) {
        // Never fail login just because the last-login timestamp couldn't be written.
        console.error("[auth/login] failed to update last_login_at:", err);
      }

      const user = toPublicUser(userRow);
      const token = signToken(userRow);

      // optional socket event
      io?.emit?.("auth:login", {
        userId: user?.sub,
        email: user?.email,
        role: user?.role,
        isPortfolio: isPortfolioRole(user?.role),
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

  // -------------------------
  // POST /api/auth/forgot-password
  // -------------------------
  // Replaces the legacy Socket.IO `account:requestReset` event, ported onto the
  // canonical REST auth surface and the new password_reset_tokens table. Only the
  // token hash is ever stored — never the raw token. No email delivery is
  // implemented (see CLAUDE.md): the raw token is returned directly in the response,
  // matching the exact behavior of the handler this replaces.
  router.post("/forgot-password", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ message: "DB is not configured" });

      if (!hasOnlyAllowedFields(req.body, FORGOT_PASSWORD_ALLOWED_FIELDS)) {
        return res.status(400).json({ message: "Unexpected fields in request" });
      }

      const { email } = req.body || {};
      if (!email) return res.status(400).json({ message: "email is required" });

      const normalizedEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ message: "invalid email format" });
      }

      const [rows] = await db.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [normalizedEmail]);
      const user = rows?.[0];

      if (!user) {
        return res.json({ ok: true, message: "If the account exists, a reset token has been issued." });
      }

      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 15);
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [user.id, tokenHash, ttlMin]
      );

      return res.json({
        ok: true,
        message: "If the account exists, a reset token has been issued.",
        token: rawToken,
        expiresInMinutes: ttlMin,
      });
    } catch (err) {
      console.error("[auth/forgot-password] error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // -------------------------
  // POST /api/auth/reset-password
  // -------------------------
  router.post("/reset-password", async (req, res) => {
    try {
      if (!db) return res.status(500).json({ message: "DB is not configured" });

      if (!hasOnlyAllowedFields(req.body, RESET_PASSWORD_ALLOWED_FIELDS)) {
        return res.status(400).json({ message: "Unexpected fields in request" });
      }

      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return res.status(400).json({ message: "token and newPassword are required" });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ message: "password must be at least 8 characters" });
      }

      const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

      const [rows] = await db.query(
        `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = ?
         LIMIT 1`,
        [tokenHash]
      );

      const resetRow = rows?.[0];
      if (!resetRow) return res.status(400).json({ message: "invalid token" });
      if (resetRow.used_at) return res.status(400).json({ message: "token already used" });
      if (new Date() > new Date(resetRow.expires_at)) {
        return res.status(400).json({ message: "token expired" });
      }

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hashed = await bcrypt.hash(String(newPassword), rounds);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(`UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [
          hashed,
          resetRow.user_id,
        ]);
        await conn.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`, [resetRow.id]);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      return res.json({ ok: true, message: "Password updated successfully." });
    } catch (err) {
      console.error("[auth/reset-password] error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return router;
}
