// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signToken as signJwt, verifyToken } from "../../modules/jwt.module.js";
import { sendMail } from "../../modules/mailer.module.js";
import { checkRateLimit } from "../../modules/rateLimiter.module.js";

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
  const RESET_PASSWORD_ALLOWED_FIELDS = new Set(["token", "password", "confirmPassword"]);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^[0-9+()\- ]{8,20}$/;
  // Same message for "no such account" and "email sent" — and for every flavor of
  // bad reset token (invalid / expired / already used) — so neither response can be
  // used to enumerate registered emails or probe token state.
  const GENERIC_RESET_MESSAGE = "If an account exists for that email, a password reset link has been sent.";
  const GENERIC_RESET_TOKEN_ERROR = "This password reset link is invalid or has expired.";

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
        `INSERT INTO USERS (name, email, phone, password_hash)
         VALUES (?, ?, ?, ?)`,
        [normalizedName, normalizedEmail, normalizedPhone, hashed]
      );

      const [rows] = await db.query(
        `SELECT id, role, name, email, phone, status, created_at
         FROM USERS
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
         FROM USERS
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
        await db.query(`UPDATE USERS SET last_login_at = NOW() WHERE id = ?`, [userRow.id]);
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
  // canonical REST auth surface and the password_reset_tokens table. Only the
  // token hash is ever stored — never the raw token; the raw token is emailed via
  // Backend/modules/mailer.module.js using CLIENT_URL as the reset-link base.
  //
  // Account-enumeration protection: the response is identical in shape and message
  // whether or not the email exists (never carries a token/user-specific field), and
  // the email send is fire-and-forget (not awaited) so a slow/failing SMTP provider
  // can't create a response-timing side-channel between "exists" and "doesn't".
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

      // Rate-limited per email and per IP so an attacker can't spam reset emails at
      // one address, or fan a script out across many addresses from one source. Both
      // checks fail "closed" on the work but "open" toward the response — a throttled
      // request still gets the same 200/generic message, never revealing it was throttled.
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      const emailAllowed = checkRateLimit(`forgot-password:email:${normalizedEmail}`, {
        max: 3,
        windowMs: 15 * 60 * 1000,
      }).allowed;
      const ipAllowed = checkRateLimit(`forgot-password:ip:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 }).allowed;

      if (emailAllowed && ipAllowed) {
        const [rows] = await db.query(`SELECT id, name, email FROM USERS WHERE email = ? LIMIT 1`, [normalizedEmail]);
        const user = rows?.[0];

        if (user) {
          const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 15);
          const rawToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

          await db.query(
            `INSERT INTO PASSWORD_RESET_TOKENS (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [user.id, tokenHash, ttlMin]
          );

          const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
          const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;

          sendMail({
            to: user.email,
            subject: "NanashiCollectibles — Password Reset Request",
            text:
              `We received a request to reset the password for your NanashiCollectibles account.\n\n` +
              `Reset your password: ${resetUrl}\n\n` +
              `This link expires in ${ttlMin} minutes.\n\n` +
              `If you did not request this, you can ignore this email.`,
            html:
              `<p>We received a request to reset the password for your NanashiCollectibles account.</p>` +
              `<p><a href="${resetUrl}">Reset Password</a></p>` +
              `<p>This link expires in ${ttlMin} minutes.</p>` +
              `<p>If you did not request this, you can ignore this email.</p>`,
          })
            .then((result) => {
              // Never log the token or the reset link itself — only whether delivery
              // happened and, if not, the provider's non-sensitive failure reason.
              if (!result.sent) {
                console.error(`[auth/forgot-password] email not sent (${result.reason || "unknown reason"})`);
              }
            })
            .catch((err) => console.error("[auth/forgot-password] unexpected mailer error:", err.message));
        }
      }

      return res.json({ ok: true, message: GENERIC_RESET_MESSAGE });
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

      const { token, password, confirmPassword } = req.body || {};
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: "token, password and confirmPassword are required" });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match." });
      }
      // Same 8-character minimum as registration — no second password policy here.
      if (String(password).length < 8) {
        return res.status(400).json({ message: "password must be at least 8 characters" });
      }

      const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

      const [rows] = await db.query(
        `SELECT id, user_id, expires_at, used_at
         FROM PASSWORD_RESET_TOKENS
         WHERE token_hash = ?
         LIMIT 1`,
        [tokenHash]
      );

      const resetRow = rows?.[0];
      // Invalid, already-used, and expired all collapse to the same generic message
      // and status — never reveal which of the three it was.
      const invalid = !resetRow || resetRow.used_at || new Date() > new Date(resetRow.expires_at);
      if (invalid) {
        return res.status(400).json({ message: GENERIC_RESET_TOKEN_ERROR });
      }

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hashed = await bcrypt.hash(String(password), rounds);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(`UPDATE USERS SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [
          hashed,
          resetRow.user_id,
        ]);
        await conn.query(`UPDATE PASSWORD_RESET_TOKENS SET used_at = NOW() WHERE id = ?`, [resetRow.id]);
        // A newer reset shouldn't leave an older, still-unused link for the same
        // user usable afterward.
        await conn.query(
          `UPDATE PASSWORD_RESET_TOKENS SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL AND id != ?`,
          [resetRow.user_id, resetRow.id]
        );
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
