// modules/db.module.js
// MySQL connection pool for cPanel / phpMyAdmin databases
// Requires: npm i mysql2

import mysql from "mysql2/promise";

let pool;

export function initDB() {
  if (pool) return pool;

  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASS;
  const database = process.env.DB_NAME;

  if (!user || !password || !database) {
    console.warn(
      "[DB] Missing env vars. Provide DB_USER, DB_PASS, DB_NAME (and optionally DB_HOST, DB_PORT)."
    );
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
    // enableKeepAlive: true, // optional
    // keepAliveInitialDelay: 10000, // optional
  });

  return pool;
}

export async function dbPing() {
  const p = initDB();
  const [rows] = await p.query("SELECT 1 AS ok");
  return rows?.[0]?.ok === 1;
}
