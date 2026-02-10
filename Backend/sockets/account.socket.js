// Backend/sockets/account.socket.js
import bcrypt from "bcryptjs";
import crypto from "crypto";

const toStr = (v) => (v == null ? "" : String(v)).trim();

// ❗ Never trim passwords
const toPassword = (v) => (v == null ? "" : String(v));

function safePublicUserRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
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
    const phone = toStr(payload.phone) || "+673";

    const password = toPassword(payload.password);
    const confirmPassword = toPassword(payload.confirmPassword);

    if (!name || !email || !password || !confirmPassword) {
      return ack({
        success: false,
        message: "name, email, password, confirmPassword are required.",
      });
    }

    if (password !== confirmPassword) {
      return ack({ success: false, message: "Passwords do not match." });
    }

    // ✅ TEMP debug (remove later)
    console.log("[account:create] pw debug", {
      name,
      email,
      passwordLen: password.length,
      confirmLen: confirmPassword.length,
      pwEqConfirm: password === confirmPassword,
    });

    try {
      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(password, rounds);

      const [result] = await db.execute(
        `INSERT INTO PERSONAL_USER (NAME, EMAIL, PHONE, PASSWORD, PROFILE_ICON)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone, passwordHash, payload.profileIcon || null],
      );

      const userId = result.insertId;

      const [rows] = await db.execute(
        `SELECT ID, NAME, EMAIL, PHONE, PROFILE_ICON, CREATED_AT, UPDATED_AT
         FROM PERSONAL_USER
         WHERE ID = ?`,
        [userId],
      );

      const account = safePublicUserRow(rows?.[0]);

      io.emit("account:created", account);

      pushActivity({
        id: Date.now(),
        type: "account",
        message: `New account created (ID ${userId})`,
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
    const phone = payload.phone != null ? toStr(payload.phone) : null;
    const profileIcon =
      payload.profileIcon != null ? toStr(payload.profileIcon) : null;

    const fields = [];
    const params = [];

    if (name !== null) {
      fields.push("NAME = ?");
      params.push(name);
    }
    if (phone !== null) {
      fields.push("PHONE = ?");
      params.push(phone);
    }
    if (profileIcon !== null) {
      fields.push("PROFILE_ICON = ?");
      params.push(profileIcon);
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
        `SELECT ID, NAME, EMAIL, PHONE, PROFILE_ICON, CREATED_AT, UPDATED_AT
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
        return ack({ success: false, message: "Phone already exists." });
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

    const identifierRaw = payload.identifier ?? payload.name ?? payload.email ?? "";
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
        ? `SELECT ID, NAME, EMAIL, PHONE, PROFILE_ICON, PASSWORD, CREATED_AT, UPDATED_AT
           FROM PERSONAL_USER
           WHERE LOWER(EMAIL) = LOWER(?)
           ORDER BY ID DESC
           LIMIT 1`
        : `SELECT ID, NAME, EMAIL, PHONE, PROFILE_ICON, PASSWORD, CREATED_AT, UPDATED_AT
           FROM PERSONAL_USER
           WHERE LOWER(TRIM(NAME)) = LOWER(TRIM(?))
           ORDER BY ID DESC
           LIMIT 1`;

      const [rows] = await db.execute(sql, [identifier]);
      const row = rows?.[0];

      console.log("[account:login] lookup", {
        identifier,
        isEmail,
        found: !!row,
        id: row?.ID,
        dbName: row?.NAME,
        dbEmail: row?.EMAIL,
        incomingPasswordLen: password.length, // ✅ TEMP debug
      });

      if (!row) return ack({ success: false, message: "Invalid credentials." });

      const ok = await bcrypt.compare(password, row.PASSWORD);
      console.log("[account:login] passwordCheck", { ok, id: row.ID });

      if (!ok) return ack({ success: false, message: "Invalid credentials." });

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
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

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

    try {
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

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
