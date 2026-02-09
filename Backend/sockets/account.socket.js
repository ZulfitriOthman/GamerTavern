// Backend/sockets/account.socket.js
import bcrypt from "bcryptjs";
import crypto from "crypto";

const toStr = (v) => (v == null ? "" : String(v)).trim();

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
  db, // ✅ MUST come from server.js initDB()
  pushActivity = () => {},
}) {
  if (!db) {
    console.error("[account.socket] ❌ db is missing (not passed in)");
  }

  /* =========================================================
     CREATE ACCOUNT (REGISTER)
     ========================================================= */
  socket.on("account:create", async (payload = {}, cb = () => {}) => {
    console.log("[account:create] HIT", { hasCb: typeof cb === "function" });
    const t0 = Date.now();

    // safety: ensure cb is callable
    const ack = typeof cb === "function" ? cb : () => {};

    const name = toStr(payload.name);
    const email = toStr(payload.email).toLowerCase();
    const phone = toStr(payload.phone) || "+673";
    const password = toStr(payload.password);

    if (!name || !email || !password) {
      return ack({
        success: false,
        message: "name, email, password are required.",
      });
    }

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

    // Keep UPDATED_AT current
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
     LOGIN
     ========================================================= */
  socket.on("account:login", async (payload = {}, cb = () => {}) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const t0 = Date.now();

    const email = toStr(payload.email).toLowerCase();
    const password = toStr(payload.password);

    if (!email || !password) {
      return ack({
        success: false,
        message: "email and password are required.",
      });
    }

    try {
      const [rows] = await db.execute(
        `SELECT ID, NAME, EMAIL, PHONE, PROFILE_ICON, PASSWORD, CREATED_AT, UPDATED_AT
         FROM PERSONAL_USER
         WHERE EMAIL = ?
         LIMIT 1`,
        [email],
      );

      const row = rows?.[0];
      if (!row) return ack({ success: false, message: "Invalid credentials." });

      const ok = await bcrypt.compare(password, row.PASSWORD);
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
        `SELECT ID, EMAIL FROM PERSONAL_USER WHERE EMAIL = ? LIMIT 1`,
        [email],
      );

      // Security: don't reveal if email exists
      const user = uRows?.[0];
      if (!user) {
        return ack({
          success: true,
          message: "If the account exists, a reset will be issued.",
        });
      }

      const ttlMin = Number(process.env.RESET_TOKEN_TTL_MIN || 15);

      // raw token (send via email in real app)
      const rawToken = crypto.randomBytes(32).toString("hex");

      // store hash
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

      console.log(
        `[socket][account:requestReset] ✅ ok in ${Date.now() - t0}ms`,
      );

      // Dev: return token
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
    const newPassword = toStr(payload.newPassword);
    const confirmPassword = toStr(payload.confirmPassword);

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
      if (rp.USED)
        return ack({ success: false, message: "Token already used." });

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

      console.log(
        `[socket][account:resetPassword] ✅ ok in ${Date.now() - t0}ms`,
      );

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
