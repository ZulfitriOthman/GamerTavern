// server.js - NanashiCollectibles (B-JAUR style structure)
// Express + CORS allowlist + Socket.IO + MySQL pool + modular routes + modular sockets

import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import { initDB, dbPing } from "./modules/db.module.js";

// modular routes (factories)
import createHealthRoutes from "./routes/api/health.routes.js";
import createMerchantRoutes from "./routes/api/merchant.routes.js";
import createAuthRoutes from "./routes/api/auth.routes.js";

// modular sockets (factories)
import shopSocketController from "./sockets/shop.socket.js";
import tradeSocketController from "./sockets/trade.socket.js";
import chatSocketController from "./sockets/chat.socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env.dev"),
  override: true,
});

const publicPath = path.join(process.cwd(), "public");
const tmpDir = path.join(process.cwd(), "tmp");
const uploadsDir = path.join(tmpDir, "uploads");
fs.mkdirSync(publicPath, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

/* ------------------------------ App / Server ------------------------------ */
const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

/* ------------------------------ Environment ------------------------------ */
const PORT = process.env.PORT || 3001;

// Your frontend URL (production). Example: https://tcg.nanashicollectibles.com
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Optional: add more allowed origins via comma-separated env var
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [CLIENT_URL, "http://localhost:5173", "http://localhost:5174"];
const allowlist = Array.from(new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS]));

/* ------------------------------ Middleware ------------------------------ */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ✅ Build corsOptions once so it is consistent everywhere (including preflight)
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman / server-to-server
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// ✅ Preflight
app.options(/.*/, cors(corsOptions));

// Static
app.use("/public", express.static(publicPath));

/* ------------------------------
   Health + home page (B-JAUR style)
-------------------------------- */
let isHealthy = true;

app.get("/", (_req, res) => {
  if (!isHealthy) {
    return res.status(503).send(`
      <html>
        <body style="background:#0f172a;color:white;text-align:center">
          <h1>NANASHI server is unavailable</h1>
          <img src="/public/images/this-is-not-fine.jpg" width="720" />
          <h2>Please try again later</h2>
        </body>
      </html>
    `);
  }

  return res.status(200).send(`
    <html>
      <body style="background:#0f172a;color:white;text-align:center">
        <h1>✅ Nanashi Collectibles server is running</h1>
        <img src="/public/images/this-is-fine.webp" width="720" />
        <h2>Socket.IO ready</h2>
      </body>
    </html>
  `);
});

/* ------------------------------ Socket.IO ------------------------------ */
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS (socket.io): ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8,
});

// attach io to req (useful for routes)
app.use((req, _res, next) => {
  req.io = io;
  next();
});

/* ------------------------------ DB ------------------------------ */
const db = initDB();

app.get("/api/db-test", async (_req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() AS now");
    res.json({ ok: true, now: rows?.[0]?.now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Feature flags
const useDbForProducts = String(process.env.USE_DB_PRODUCTS || "false").toLowerCase() === "true";

/* ------------------------------
   Optional schema bootstrap
-------------------------------- */
async function ensureSchema() {
  if (String(process.env.DB_BOOTSTRAP || "").toLowerCase() !== "true") return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(190) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'merchant',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      merchant_id VARCHAR(64) NOT NULL,
      name VARCHAR(190) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      stock INT NOT NULL DEFAULT 0,
      image TEXT NULL,
      description TEXT NULL,
      category VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (merchant_id),
      CONSTRAINT fk_products_merchant
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      merchant_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payload JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (merchant_id),
      CONSTRAINT fk_orders_merchant
        FOREIGN KEY (merchant_id) REFERENCES merchants(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
}

/* ------------------------------
   Shared stores
-------------------------------- */
const stores = {
  onlineUsers: new Map(),
  activeTrades: new Map(),
  recentActivities: [],
  merchants: new Map(),
  products: new Map(),
  orders: new Map(),
};

function pushActivity(activity) {
  stores.recentActivities.unshift(activity);
  if (stores.recentActivities.length > 20) stores.recentActivities.pop();
  io.emit("activity:new", activity);
}

/* ------------------------------
   Seed (DEV ONLY)
-------------------------------- */
stores.merchants.set("merchant@nanashi.com", {
  id: "merchant-1",
  email: "merchant@nanashi.com",
  password: "merchant123", // DEV ONLY
  name: "Nanashi Merchant",
  role: "merchant",
});

/* ------------------------------
   Routes Mounting (B-JAUR style: factories)
-------------------------------- */
app.use(
  "/api",
  createHealthRoutes({
    dbPing,
    stores,
  })
);

// ✅ Auth routes (fixed)
app.use("/api/auth", createAuthRoutes({ db, io }));

app.use(
  "/api",
  createMerchantRoutes({
    db,
    io,
    stores,
    pushActivity,
    useDbForProducts,
  })
);

/* ------------------------------
   Socket Wiring (B-JAUR style: controller factories)
-------------------------------- */
io.on("connection", (socket) => {
  socket.onAny((event, ...args) => {
    const first = args?.[0];
    const summary =
      typeof first === "object" && first !== null
        ? Object.keys(first).slice(0, 6).join(",")
        : typeof first;
    console.log(`[socket] ${event} payloadKeys=${summary}`);
  });

  // mount socket controllers
  shopSocketController({
    socket,
    io,
    stores,
    pushActivity,
    db,
    useDbForProducts,
  });
  tradeSocketController({ socket, io, stores, pushActivity });
  chatSocketController({ socket, io, stores, pushActivity });
});

/* ------------------------------ Error handler ------------------------------ */
app.use((err, _req, res, _next) => {
  if (String(err?.message || "").startsWith("CORS blocked:")) {
    return res.status(403).json({ message: err.message });
  }
  if (String(err?.message || "").startsWith("Not allowed by CORS (socket.io):")) {
    return res.status(403).json({ message: err.message });
  }
  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ message: "Internal Server Error" });
});

/* ------------------------------ Start ------------------------------ */
async function start() {
  try {
    await ensureSchema();

    try {
      const ok = await dbPing();
      console.log(`[DB] connected: ${ok ? "YES" : "NO"}`);
      isHealthy = Boolean(ok);
    } catch (e) {
      console.warn("[DB] ping failed:", e.message);
      isHealthy = false;
    }

    httpServer.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🎮 Nanashi Collectibles Server Started!");
      console.log("=".repeat(60));
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Allowed origins: ${allowlist.join(", ")}`);
      console.log(`🗄️  DB products mode: ${useDbForProducts ? "ON" : "OFF"} (USE_DB_PRODUCTS)`);
      console.log("📡 WebSocket ready for connections");
      console.log("=".repeat(60) + "\n");
    });
  } catch (e) {
    console.error("Failed to start server:", e);
    process.exit(1);
  }
}

start();
