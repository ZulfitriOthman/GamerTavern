// Backend/sockets/account.socket.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../modules/mysql.module.js";

const toStr = (v) => (v == null ? "" : String(v)).trim();

function safePublicPersonaRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
  };
}

export default function accountSocketController({
  socket,
  io,
  pushActivity = () => {},
}) {
  /* =========================================================
     CREATE ACCOUNT (REGISTER)
     ========================================================= */
  socket.on("account:create", async (payload = {}, cb = () => {}) => {
    const name = toStr(payload.name);
    const email = toStr(payload.email).toLowerCase();
    const phone = toStr(payload.phone) || "+673";
    const password = toStr(payload.password);

    if (!name || !email || !password) {
      return cb({ success: false, message: "name, email, password are required." });
    }

    try {
      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(password, rounds);

      const [result] = await db.execute(
        `INSERT INTO persona (name, email, phone, password)
         VALUES (?, ?, ?, ?)`,
        [name, email, phone, passwordHash]
      );

      const personaId = result.insertId;

      const [rows] = await db.execute(
        `SELECT id, name, email, phone, created_at
         FROM persona
         WHERE id = ?`,
        [personaId]
      );

      const account = safePublicPersonaRow(rows?.[0]);

      io.emit("account:created", account);
      pushActivity({
        id: Date.now(),
        type: "account",
        message: `New account created (ID ${personaId})`,
        timestamp: new Date().toISOString(),
      });

      return cb({ success: true, data: account });
    } catch (err) {
      // Handle duplicate email/phone
      if (err?.code === "ER_DUP_ENTRY") {
        return cb({ success: false, message: "Email or phone already exists." });
      }
      console.error("[socket][account:create] error:", err);
      return cb({ success: false, message: "Failed to create account." });
    }
  });

  /* =========================================================
     UPDATE ACCOUNT (PROFILE)
     ========================================================= */
  socket.on("account:update", async (payload = {}, cb = () => {}) => {
    const id = Number(payload.id);
    if (!id) return cb({ success: false, message: "id is required." });

    // Allow updating only safe fields
    const name = payload.name != null ? toStr(payload.name) : null;
    const phone = payload.phone != null ? toStr(payload.phone) : null;

    const fields = [];
    const params = [];

    if (name !== null) {
      fields.push("name = ?");
      params.push(name);
    }
    if (phone !== null) {
      fields.push("phone = ?");
      params.push(phone);
    }

    if (fields.length === 0) {
      return cb({ success: false, message: "No fields to update." });
    }

    try {
      params.push(id);

      const [result] = await db.execute(
        `UPDATE persona SET ${fields.join(", ")}
         WHERE id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        return cb({ success: false, message: "Account not found." });
      }

      const [rows] = await db.execute(
        `SELECT id, name, email, phone, created_at
         FROM persona
         WHERE id = ?`,
        [id]
      );

      const account = safePublicPersonaRow(rows?.[0]);

      io.emit("account:updated", account);
      pushActivity({
        id: Date.now(),
        type: "account",
        message: `Account updated (ID ${id})`,
        timestamp: new Date().toISOString(),
      });

      return cb({ success: true, data: account });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        return cb({ success: false, message: "Phone already exists." });
      }
      console.error("[socket][account:update] error:", err);
      return cb({ success: false, message: "Failed to update account." });
    }
  });

  /* =========================================================
     LOGIN (OPTIONAL BUT COMMON)
     ========================================================= */
  socket.on("account:login", async (payload = {}, cb = () => {}) => {
    const email = toStr(payload.email).toLowerCase();
    const password = toStr(payload.password);

    if (!email || !password) {
      return cb({ success: false, message: "email and password are required." });
    }

    try {
      const [rows] = await db.execute(
        `SELECT id, name, email, phone, password, created_at
         FROM persona
         WHERE email = ?
         LIMIT 1`,
        [email]
      );

      const row = rows?.[0];
      if (!row) return cb({ success: false, message: "Invalid credentials." });

      const ok = await bcrypt.compare(password, row.password);
      if (!ok) return cb({ success: false, message: "Invalid credentials." });

      const account = safePublicPersonaRow(row);

      // You can emit a user-specific event if you want:
      // socket.emit("account:loggedIn", account);

      return cb({ success: true, data: account });
    } catch (err) {
      console.error("[socket][account:login] error:", err);
      return cb({ success: false, message: "Login failed." });
    }
  });

  /* =========================================================
     REQUEST RESET (GENERATE TOKEN)
     ========================================================= */
  socket.on("account:requestReset", async (payload = {}, cb = () => {}) => {
    const email = toStr(payload.email).toLowerCase();
    if (!email) return cb({ success: false, message: "email is required." });

    try {
      const [pRows] = await db.execute(
        `SELECT id, email FROM persona WHERE email = ? LIMIT 1`,
        [email]
      );

      // Do not reveal whether email exists (security)
      const persona = pRows?.[0];
      if (!persona) {
        return cb({ success: true, message: "If the account exists, a reset will be issued." });
      }

      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 15);

      // raw token for URL
      const rawToken = crypto.randomBytes(32).toString("hex");

      // store hash of token (recommended)
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await db.execute(
        `INSERT INTO reset_password (persona_id, token, expires_at, used)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)`,
        [persona.id, tokenHash, ttlMin]
      );

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `Password reset requested (persona_id ${persona.id})`,
        timestamp: new Date().toISOString(),
      });

      // Return raw token to client (in real app you email it)
      return cb({
        success: true,
        message: "Reset token generated.",
        data: { token: rawToken, expiresInMinutes: ttlMin },
      });
    } catch (err) {
      console.error("[socket][account:requestReset] error:", err);
      return cb({ success: false, message: "Failed to request reset." });
    }
  });

  /* =========================================================
     RESET PASSWORD (CONSUME TOKEN)
     ========================================================= */
  socket.on("account:resetPassword", async (payload = {}, cb = () => {}) => {
    const rawToken = toStr(payload.token);
    const newPassword = toStr(payload.newPassword);

    if (!rawToken || !newPassword) {
      return cb({ success: false, message: "token and newPassword are required." });
    }

    try {
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // Find valid token
      const [rows] = await db.execute(
        `SELECT id, persona_id, expires_at, used
         FROM reset_password
         WHERE token = ?
         LIMIT 1`,
        [tokenHash]
      );

      const rp = rows?.[0];
      if (!rp) return cb({ success: false, message: "Invalid token." });
      if (rp.used) return cb({ success: false, message: "Token already used." });

      // expires_at is a Date object or string depending on mysql2 config
      const now = new Date();
      const exp = new Date(rp.expires_at);
      if (now > exp) return cb({ success: false, message: "Token expired." });

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(newPassword, rounds);

      // Use transaction for correctness
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        await conn.execute(
          `UPDATE persona SET password = ? WHERE id = ?`,
          [passwordHash, rp.persona_id]
        );

        await conn.execute(
          `UPDATE reset_password SET used = 1 WHERE id = ?`,
          [rp.id]
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `Password reset completed (persona_id ${rp.persona_id})`,
        timestamp: new Date().toISOString(),
      });

      return cb({ success: true, message: "Password updated successfully." });
    } catch (err) {
      console.error("[socket][account:resetPassword] error:", err);
      return cb({ success: false, message: "Failed to reset password." });
    }
  });
}
