// Backend/scripts/create-admin.mjs
//
// One-time / repeatable bootstrap for platform administrator accounts.
// Credentials come from environment variables only — never hardcode a
// real email or password here, and never commit either to source control.
//
// Usage:
//   ADMIN_EMAIL=someone@example.com ADMIN_PASSWORD='...' node scripts/create-admin.mjs
//
// Reuses the same bcrypt hashing as normal registration
// (routes/api/auth.routes.js) — same BCRYPT_ROUNDS env var, same default
// (10). Never prints the password. If the email already exists, promotes
// the existing row to ROLE='admin' instead of creating a duplicate
// account, and leaves PASSWORD_HASH/NAME/other profile fields untouched
// unless --reset-password is passed.
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";

dotenv.config({ path: path.join(process.cwd(), ".env.dev") });

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Nanashi Administrator";
const resetPassword = process.argv.includes("--reset-password");

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
  process.exit(1);
}
if (String(password).length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const normalizedEmail = String(email).trim().toLowerCase();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

try {
  const [existingRows] = await pool.query(`SELECT ID, ROLE FROM USERS WHERE EMAIL = ? LIMIT 1`, [normalizedEmail]);
  const existing = existingRows[0];
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

  if (existing) {
    if (resetPassword) {
      const hashed = await bcrypt.hash(String(password), rounds);
      await pool.query(`UPDATE USERS SET role = 'admin', password_hash = ?, updated_at = NOW() WHERE id = ?`, [
        hashed,
        existing.ID,
      ]);
      console.log(`Promoted existing user id=${existing.ID} to admin and reset password.`);
    } else {
      await pool.query(`UPDATE USERS SET role = 'admin', updated_at = NOW() WHERE id = ?`, [existing.ID]);
      console.log(`Promoted existing user id=${existing.ID} (was role='${existing.ROLE}') to admin. Password unchanged.`);
    }
  } else {
    const hashed = await bcrypt.hash(String(password), rounds);
    await pool.query(`INSERT INTO USERS (role, name, email, password_hash) VALUES ('admin', ?, ?, ?)`, [
      name,
      normalizedEmail,
      hashed,
    ]);
    console.log(`Created new admin user for ${normalizedEmail}.`);
  }
} finally {
  await pool.end();
}
