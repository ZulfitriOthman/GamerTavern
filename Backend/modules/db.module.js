// Backend/modules/db.module.js
import mysql from "mysql2/promise";

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

    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 15000),

    enableKeepAlive: true,
    keepAliveInitialDelay: Number(process.env.MYSQL_KEEPALIVE_DELAY || 10000), 

    timezone: "Z",
  });

  pool.on?.("error", (err) => {
    console.error("[DB] pool error:", err?.code || err?.message || err);
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

export function startDbKeepAlive() {
  const intervalMs = Number(process.env.MYSQL_KEEPALIVE_INTERVAL || 30000);

  setInterval(async () => {
    try {
      await initDB().query("SELECT 1");
    } catch (err) {
      console.error("[DB] keepalive failed:", err?.code || err?.message || err);
    }
  }, intervalMs).unref?.();
}
