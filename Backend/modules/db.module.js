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

    // ✅ Prevent "hang forever" behavior on bad routes / dead host
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 10000),

    // ✅ Keep connections healthy (helps some proxy/idle issues)
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    timezone: "Z",
  });

  // Optional: pool error logging
  pool.on?.("error", (err) => {
    console.error("[DB] pool error:", err);
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
