// Backend/controllers/account.controller.js
import bcrypt from "bcryptjs";
import crypto from "crypto";

const toStr = (v) => (v == null ? "" : String(v)).trim();

// ❗ Never trim passwords
const toPassword = (v) => (v == null ? "" : String(v));

/** ✅ Roles (string-based because your DB uses VARCHAR(50)) */
const ROLES = Object.freeze({
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
});

const normalizeRole = (v) => toStr(v).toUpperCase();
const isValidRole = (v) => Object.values(ROLES).includes(v);

// ✅ Password rule (mirrors frontend): 8+ chars, lowercase, uppercase, number, special
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";

// ✅ Per-country phone rules (mirrors frontend PHONE_RULES)
const PHONE_RULES = {
  "+673": { min: 7,  max: 7  }, // Brunei
  "+60":  { min: 9,  max: 10 }, // Malaysia
  "+65":  { min: 8,  max: 8  }, // Singapore
  "+62":  { min: 9,  max: 12 }, // Indonesia
  "+63":  { min: 10, max: 10 }, // Philippines
  "+66":  { min: 9,  max: 9  }, // Thailand
  "+84":  { min: 9,  max: 10 }, // Vietnam
  "+91":  { min: 10, max: 10 }, // India
  "+86":  { min: 11, max: 11 }, // China
  "+81":  { min: 10, max: 10 }, // Japan
  "+82":  { min: 9,  max: 10 }, // South Korea
  "+61":  { min: 9,  max: 9  }, // Australia
  "+44":  { min: 10, max: 10 }, // United Kingdom
  "+1":   { min: 10, max: 10 }, // United States
};

/**
 * Validates a phone in international format and enforces per-country length when known.
 * Returns null if valid, or an error message string.
 */
function validatePhone(phone) {
  if (!phone) return null; // optional
  if (!/^\+\d{6,15}$/.test(phone)) {
    return "Phone must be in international format e.g. +673xxxxxxx.";
  }
  // Find longest matching dial code (e.g. "+673" before "+6")
  const dial = Object.keys(PHONE_RULES)
    .sort((a, b) => b.length - a.length)
    .find((d) => phone.startsWith(d));
  if (!dial) return null; // unknown country, length already 6–15
  const localDigits = phone.slice(dial.length);
  if (!/^\d+$/.test(localDigits)) return "Phone contains invalid characters.";
  if (/^0+$/.test(localDigits)) return "Phone number cannot be all zeros.";
  const { min, max } = PHONE_RULES[dial];
  if (localDigits.length < min || localDigits.length > max) {
    return min === max
      ? `Phone for ${dial} must be exactly ${min} digits.`
      : `Phone for ${dial} must be ${min}–${max} digits.`;
  }
  return null;
}

/**
 * ✅ SECURITY POLICY:
 * - account:create: allow USER / VENDOR only (NO ADMIN self-register)
 * - account:update: does NOT update role
 * - account:login: returns role
 */
function resolveCreateRole(payload) {
  const requested = normalizeRole(payload?.role);
  if (requested === ROLES.VENDOR) return ROLES.VENDOR; // allow vendor if requested
  return ROLES.USER; // default
}

function safePublicUserRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    role: row.ROLE, // ✅ include role in public user
    name: row.NAME,
    email: row.EMAIL,
    phone: row.PHONE,
    profile_icon: row.PROFILE_ICON,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

export default function accountSocketController({
  socket,
  io,
  db,
  pushActivity = () => {},
}) {
  if (!db) console.error("[account.socket] ❌ db is missing (not passed in)");

  /* =========================================================
     CREATE ACCOUNT (REGISTER)
     ========================================================= */
  socket.on("account:create", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const name = toStr(payload.name);
    const email = toStr(payload.email).toLowerCase();
    const phoneRaw = toStr(payload.phone);
    const phone = phoneRaw || null;

    const password = toPassword(payload.password);
    const confirmPassword = toPassword(payload.confirmPassword);

    // ✅ Role resolution (USER/VENDOR only)
    const role = resolveCreateRole(payload);

    if (!name || !email || !password || !confirmPassword) {
      return ack({
        success: false,
        message: "name, email, password, confirmPassword are required.",
      });
    }

    if (password !== confirmPassword) {
      return ack({ success: false, message: "Passwords do not match." });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return ack({ success: false, message: PASSWORD_MESSAGE });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return ack({ success: false, message: "Email is invalid." });
    }

    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      return ack({ success: false, message: phoneErr });
    }

    // Vendors must provide a phone number
    if (role === ROLES.VENDOR && !phone) {
      return ack({
        success: false,
        message: "Phone is required for merchant accounts.",
      });
    }

    try {
      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(password, rounds);

      const [result] = await db.execute(
        `INSERT INTO PERSONAL_USER (ROLE, NAME, EMAIL, PHONE, PASSWORD, PROFILE_ICON)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [role, name, email, phone, passwordHash, payload.profileIcon || null],
      );

      const userId = result.insertId;

      const [rows] = await db.execute(
        `SELECT ID, ROLE, NAME, EMAIL, PHONE, PROFILE_ICON, CREATED_AT, UPDATED_AT
         FROM PERSONAL_USER
         WHERE ID = ?`,
        [userId],
      );

      const account = safePublicUserRow(rows?.[0]);

      io.emit("account:created", account);

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `New account created (ID ${userId}, ROLE ${role})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][account:create] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: account });
    } catch (err) {
      console.error(
        `[socket][account:create] ❌ error in ${Date.now() - t0}ms`,
        err,
      );

      if (err?.code === "ER_DUP_ENTRY") {
        return ack({
          success: false,
          message: "Email or phone already exists.",
        });
      }

      return ack({ success: false, message: "Failed to create account." });
    }
  });

  /* =========================================================
     UPDATE ACCOUNT (PROFILE)
     ========================================================= */
  socket.on("account:update", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const id = Number(payload.id);
    if (!id) return ack({ success: false, message: "id is required." });

    const name = payload.name != null ? toStr(payload.name) : null;
    const email = payload.email != null ? toStr(payload.email).toLowerCase() : null;
    const phone = payload.phone != null ? toStr(payload.phone) : null;
    const profileIcon =
      payload.profileIcon != null ? toStr(payload.profileIcon) : null;

    // Optional password change: requires currentPassword + newPassword
    const currentPassword =
      payload.currentPassword != null ? toPassword(payload.currentPassword) : null;
    const newPassword =
      payload.newPassword != null ? toPassword(payload.newPassword) : null;

    // ✅ SECURITY: do NOT allow role update here
    const fields = [];
    const params = [];

    if (name !== null) {
      if (!name) {
        return ack({ success: false, message: "Name cannot be empty." });
      }
      fields.push("NAME = ?");
      params.push(name);
    }
    if (email !== null) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return ack({ success: false, message: "Email is invalid." });
      }
      fields.push("EMAIL = ?");
      params.push(email);
    }
    if (phone !== null) {
      const phoneErr = validatePhone(phone);
      if (phoneErr) {
        return ack({ success: false, message: phoneErr });
      }
      fields.push("PHONE = ?");
      params.push(phone || null);
    }
    if (profileIcon !== null) {
      fields.push("PROFILE_ICON = ?");
      params.push(profileIcon);
    }

    // Password change branch
    if (newPassword !== null || currentPassword !== null) {
      if (!currentPassword || !newPassword) {
        return ack({
          success: false,
          message: "Both current and new password are required to change password.",
        });
      }
      if (!PASSWORD_REGEX.test(newPassword)) {
        return ack({ success: false, message: PASSWORD_MESSAGE });
      }
      try {
        const [pwRows] = await db.execute(
          `SELECT PASSWORD FROM PERSONAL_USER WHERE ID = ?`,
          [id],
        );
        const currentHash = pwRows?.[0]?.PASSWORD;
        if (!currentHash) {
          return ack({ success: false, message: "Account not found." });
        }
        const ok = await bcrypt.compare(currentPassword, currentHash);
        if (!ok) {
          return ack({ success: false, message: "Current password is incorrect." });
        }
        const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
        const newHash = await bcrypt.hash(newPassword, rounds);
        fields.push("PASSWORD = ?");
        params.push(newHash);
      } catch (err) {
        console.error(`[socket][account:update] ❌ password verify failed`, err);
        return ack({ success: false, message: "Failed to update password." });
      }
    }

    if (fields.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    fields.push("UPDATED_AT = NOW()");

    try {
      params.push(id);

      const [result] = await db.execute(
        `UPDATE PERSONAL_USER SET ${fields.join(", ")}
         WHERE ID = ?`,
        params,
      );

      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Account not found." });
      }

      const [rows] = await db.execute(
        `SELECT ID, ROLE, NAME, EMAIL, PHONE, PROFILE_ICON, CREATED_AT, UPDATED_AT
         FROM PERSONAL_USER
         WHERE ID = ?`,
        [id],
      );

      const account = safePublicUserRow(rows?.[0]);

      io.emit("account:updated", account);

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `Account updated (ID ${id})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][account:update] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: account });
    } catch (err) {
      console.error(
        `[socket][account:update] ❌ error in ${Date.now() - t0}ms`,
        err,
      );

      if (err?.code === "ER_DUP_ENTRY") {
        const dupMsg = /email/i.test(err?.sqlMessage || "")
          ? "Email already in use."
          : /phone/i.test(err?.sqlMessage || "")
          ? "Phone already in use."
          : "Email or phone already in use.";
        return ack({ success: false, message: dupMsg });
      }
      return ack({ success: false, message: "Failed to update account." });
    }
  });

  /* =========================================================
     LOGIN (NAME / EMAIL / IDENTIFIER)
     ========================================================= */
  socket.on("account:login", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const identifierRaw =
      payload.identifier ?? payload.name ?? payload.email ?? "";
    const identifier = toStr(identifierRaw);
    const password = toPassword(payload.password);

    if (!identifier || !password) {
      return ack({
        success: false,
        message: "name/email and password are required.",
      });
    }

    const isEmail = identifier.includes("@");

    try {
      // ✅ IMPORTANT: when logging in by NAME, pick the most recent row (avoid duplicates)
      const sql = isEmail
        ? `SELECT ID, ROLE, NAME, EMAIL, PHONE, PROFILE_ICON, PASSWORD, CREATED_AT, UPDATED_AT
           FROM PERSONAL_USER
           WHERE LOWER(EMAIL) = LOWER(?)
           ORDER BY ID DESC
           LIMIT 1`
        : `SELECT ID, ROLE, NAME, EMAIL, PHONE, PROFILE_ICON, PASSWORD, CREATED_AT, UPDATED_AT
           FROM PERSONAL_USER
           WHERE LOWER(TRIM(NAME)) = LOWER(TRIM(?))
           ORDER BY ID DESC
           LIMIT 1`;

      const [rows] = await db.execute(sql, [identifier]);
      const row = rows?.[0];

      if (!row) return ack({ success: false, message: "Invalid credentials." });

      const ok = await bcrypt.compare(password, row.PASSWORD);

      if (!ok) return ack({ success: false, message: "Invalid credentials." });

      // ✅ Safety: invalid roles fallback to USER
      if (!isValidRole(row.ROLE)) row.ROLE = ROLES.USER;

      const account = safePublicUserRow(row);

      console.log(`[socket][account:login] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, data: account });
    } catch (err) {
      console.error(
        `[socket][account:login] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Login failed." });
    }
  });

  /* =========================================================
     REQUEST RESET
     ========================================================= */
  socket.on("account:requestReset", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const email = toStr(payload.email).toLowerCase();
    if (!email) return ack({ success: false, message: "email is required." });

    try {
      const [uRows] = await db.execute(
        `SELECT ID, EMAIL FROM PERSONAL_USER WHERE LOWER(EMAIL) = LOWER(?) ORDER BY ID DESC LIMIT 1`,
        [email],
      );

      const user = uRows?.[0];
      if (!user) {
        return ack({
          success: true,
          message: "If the account exists, a reset will be issued.",
        });
      }

      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 15);
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      await db.execute(
        `INSERT INTO RESET_PASSWORD (USER_ID, TOKEN_HASH, EXPIRES_AT, USED)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)`,
        [user.ID, tokenHash, ttlMin],
      );

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `Password reset requested (USER_ID ${user.ID})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][account:requestReset] ✅ ok in ${Date.now() - t0}ms`);

      return ack({
        success: true,
        message: "Reset token generated.",
        data: { token: rawToken, expiresInMinutes: ttlMin },
      });
    } catch (err) {
      console.error(
        `[socket][account:requestReset] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to request reset." });
    }
  });

  /* =========================================================
     RESET PASSWORD (BY TOKEN)
     ========================================================= */
  socket.on("account:resetPassword", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const rawToken = toStr(payload.token);
    const newPassword = toPassword(payload.newPassword);
    const confirmPassword = toPassword(payload.confirmPassword);

    if (!rawToken || !newPassword || !confirmPassword) {
      return ack({
        success: false,
        message: "token, newPassword, confirmPassword are required.",
      });
    }
    if (newPassword !== confirmPassword) {
      return ack({ success: false, message: "Passwords do not match." });
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      return ack({ success: false, message: PASSWORD_MESSAGE });
    }

    try {
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      const [rows] = await db.execute(
        `SELECT ID, USER_ID, EXPIRES_AT, USED
         FROM RESET_PASSWORD
         WHERE TOKEN_HASH = ?
         LIMIT 1`,
        [tokenHash],
      );

      const rp = rows?.[0];
      if (!rp) return ack({ success: false, message: "Invalid token." });
      if (rp.USED) return ack({ success: false, message: "Token already used." });

      const now = new Date();
      const exp = new Date(rp.EXPIRES_AT);
      if (now > exp) return ack({ success: false, message: "Token expired." });

      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(newPassword, rounds);

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [uRes] = await conn.execute(
          `UPDATE PERSONAL_USER
           SET PASSWORD = ?, UPDATED_AT = NOW()
           WHERE ID = ?`,
          [passwordHash, rp.USER_ID],
        );

        if (uRes.affectedRows === 0) {
          await conn.rollback();
          return ack({ success: false, message: "User not found." });
        }

        await conn.execute(
          `UPDATE RESET_PASSWORD
           SET USED = 1, UPDATED_AT = NOW()
           WHERE ID = ?`,
          [rp.ID],
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
        message: `Password reset completed (USER_ID ${rp.USER_ID})`,
        timestamp: new Date().toISOString(),
      });

      console.log(`[socket][account:resetPassword] ✅ ok in ${Date.now() - t0}ms`);
      return ack({ success: true, message: "Password updated successfully." });
    } catch (err) {
      console.error(
        `[socket][account:resetPassword] ❌ error in ${Date.now() - t0}ms`,
        err,
      );
      return ack({ success: false, message: "Failed to reset password." });
    }
  });
}
