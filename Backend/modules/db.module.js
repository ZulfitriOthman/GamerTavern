// Backend/modules/db.module.js
import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "bjaur_accounts",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let pool;

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`[DB] Missing env var: ${name}`);
  return v;
}

export function initDB() {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = must("MYSQL_USER");
  const password = must("MYSQL_PASSWORD");
  const database = must("MYSQL_DATABASE");
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONN_LIMIT || 10),
    queueLimit: 0,
    timezone: "Z",
  });

  return pool;
}

export async function dbPing() {
  const p = initDB();
  const conn = await p.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}
