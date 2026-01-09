// server.js - NanashiCollectibles (GamerTavern) Socket.IO Server (Cloudflare-ready)
// Full version: Express + CORS allowlist + Socket.IO + MySQL connection (pool) + basic schema bootstrap
// Note: This keeps your existing in-memory stores, but adds DB connectivity + optional DB-backed product endpoints.

import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { initDB, dbPing } from "./modules/db.module.js";

dotenv.config({ path: ".env.dev", override: true }); // change to ".env" in production if needed

/* ============================================================
   App / Server
   ============================================================ */

const app = express();
app.set("trust proxy", 1); // important behind Cloudflare / Nginx / Tunnel
const httpServer = createServer(app);

/* ============================================================
   Environment
   ============================================================ */

const PORT = process.env.PORT || 3001;

// Your frontend URL (production). Example: https://tcg.nanashicollectibles.com
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Optional: add more allowed origins via comma-separated env var
// Example: EXTRA_ORIGINS="https://tcg.nanashicollectibles.com,https://merchant.nanashicollectibles.com"
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowlist = Array.from(
  new Set([
    CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    ...EXTRA_ORIGINS,
  ])
);

/* ============================================================
   Middleware
   ============================================================ */

app.use(express.json({ limit: "2mb" }));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow non-browser
      if (allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Preflight (helps some proxies/CDNs)
app.options("*", cors());

/* ============================================================
   Socket.IO
   ============================================================ */

const io = new Server(httpServer, {
  cors: {
    origin: allowlist,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

/* ============================================================
   Database
   ============================================================ */

// Initialize pool once (mysql2/promise pool inside modules/db.module.js)
const db = initDB();

// Optional: create tables if not exist (safe on startup)
async function ensureSchema() {
  // Only run when you want to auto-bootstrap
  // Set DB_BOOTSTRAP=true in env to enable
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

/* ============================================================
   In-memory stores (kept for sockets + fallback)
   ============================================================ */

const onlineUsers = new Map(); // socketId -> { username, socketId }
const activeTrades = new Map(); // tradeId -> trade object
const recentActivities = []; // newest first

// In-memory merchant/product/order stores (fallback; DB recommended)
const merchants = new Map(); // email -> { id, email, password, name, role }
const products = new Map(); // productId -> product object
const orders = new Map(); // orderId -> order object

// Demo merchant account (DEV ONLY)
merchants.set("merchant@nanashi.com", {
  id: "merchant-1",
  email: "merchant@nanashi.com",
  password: "merchant123", // DEV ONLY (use bcrypt in production)
  name: "Nanashi Merchant",
  role: "merchant",
});

const pushActivity = (activity) => {
  recentActivities.unshift(activity);
  if (recentActivities.length > 20) recentActivities.pop();
  io.emit("activity:new", activity);
};

/* ============================================================
   Helpers
   ============================================================ */

const useDbForProducts = String(process.env.USE_DB_PRODUCTS || "false").toLowerCase() === "true";

async function getProductsForMerchant(merchantId) {
  if (!useDbForProducts) return Array.from(products.values()).filter((p) => p.merchantId === merchantId);

  const [rows] = await db.query(
    "SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category, created_at AS createdAt, updated_at AS updatedAt FROM products WHERE merchant_id = ? ORDER BY updated_at DESC",
    [merchantId]
  );
  return rows;
}

async function upsertProductDb(merchantId, payload) {
  const productId = payload.id || `prod-${Date.now()}`;

  await db.query(
    `INSERT INTO products (id, merchant_id, name, price, stock, image, description, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name),
       price=VALUES(price),
       stock=VALUES(stock),
       image=VALUES(image),
       description=VALUES(description),
       category=VALUES(category)`,
    [
      productId,
      merchantId,
      payload.name,
      Number(payload.price || 0),
      Number(payload.stock || 0),
      payload.image || null,
      payload.description || null,
      payload.category || null,
    ]
  );

  const [rows] = await db.query(
    "SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category, created_at AS createdAt, updated_at AS updatedAt FROM products WHERE id = ?",
    [productId]
  );

  return rows[0];
}

async function deleteProductDb(productId) {
  await db.query("DELETE FROM products WHERE id = ?", [productId]);
}

/* ============================================================
   Routes
   ============================================================ */

app.get("/", (req, res) => {
  res.status(200).send("✅ Nanashi Collectibles Socket.IO server is running.");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    onlineUsers: onlineUsers.size,
    activeTrades: activeTrades.size,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/stats", (req, res) => {
  res.json({
    onlineUsers: onlineUsers.size,
    users: Array.from(onlineUsers.values()),
    activeTrades: activeTrades.size,
    recentActivities: recentActivities.slice(0, 10),
  });
});

// DB test route
app.get("/api/db-test", async (req, res) => {
  try {
    const ok = await dbPing();
    res.json({ ok: Boolean(ok) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ============================================================
   Merchant API Routes
   ============================================================ */

// Simple auth middleware (DEV ONLY: token = email)
// Production: use JWT + bcrypt
const authMerchant = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const merchant = merchants.get(token);
  if (!merchant) return res.status(401).json({ message: "Invalid token" });

  req.merchant = merchant;
  next();
};

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  const merchant = merchants.get(email);
  if (!merchant || merchant.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({
    token: merchant.email,
    user: {
      id: merchant.id,
      email: merchant.email,
      name: merchant.name,
      role: merchant.role,
    },
  });
});

// List products (DB-backed if USE_DB_PRODUCTS=true)
app.get("/api/merchant/products", authMerchant, async (req, res) => {
  try {
    const list = await getProductsForMerchant(req.merchant.id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: "Failed to list products", error: e.message });
  }
});

// Create/Update product (DB-backed if USE_DB_PRODUCTS=true)
app.post("/api/merchant/products", authMerchant, async (req, res) => {
  try {
    const { id, name, price, stock, image, description, category } = req.body;

    if (!name) return res.status(400).json({ message: "name is required" });

    // DB mode
    if (useDbForProducts) {
      const saved = await upsertProductDb(req.merchant.id, {
        id,
        name,
        price,
        stock,
        image,
        description,
        category,
      });

      io.emit("product:added", saved);

      pushActivity({
        id: Date.now(),
        type: "product",
        message: `${saved.name} ${id ? "updated" : "added"} by merchant`,
        timestamp: new Date().toISOString(),
      });

      return res.json(saved);
    }

    // In-memory fallback
    const productId = id || `prod-${Date.now()}`;
    const product = {
      id: productId,
      name,
      price: Number(price),
      stock: Number(stock),
      image,
      description,
      category,
      merchantId: req.merchant.id,
      createdAt: products.get(productId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.set(productId, product);
    io.emit("product:added", product);

    pushActivity({
      id: Date.now(),
      type: "product",
      message: `${product.name} ${id ? "updated" : "added"} by merchant`,
      timestamp: new Date().toISOString(),
    });

    res.json(product);
  } catch (e) {
    res.status(500).json({ message: "Failed to save product", error: e.message });
  }
});

// Update product (PATCH)
app.patch("/api/merchant/products/:id", authMerchant, async (req, res) => {
  try {
    const { id } = req.params;

    if (useDbForProducts) {
      // Merge by reading existing
      const [rows] = await db.query(
        "SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category FROM products WHERE id = ? AND merchant_id = ?",
        [id, req.merchant.id]
      );
      const existing = rows[0];
      if (!existing) return res.status(404).json({ message: "Product not found" });

      const saved = await upsertProductDb(req.merchant.id, {
        id,
        name: req.body.name ?? existing.name,
        price: req.body.price ?? existing.price,
        stock: req.body.stock ?? existing.stock,
        image: req.body.image ?? existing.image,
        description: req.body.description ?? existing.description,
        category: req.body.category ?? existing.category,
      });

      if (req.body.price !== undefined) {
        io.emit("price:changed", { productId: id, productName: saved.name, newPrice: saved.price });
      }
      if (req.body.stock !== undefined) {
        io.emit("stock:changed", { productId: id, productName: saved.name, stock: saved.stock });
      }

      return res.json(saved);
    }

    // In-memory fallback
    const product = products.get(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const updated = { ...product, ...req.body, id, updatedAt: new Date().toISOString() };
    products.set(id, updated);

    if (req.body.price !== undefined) {
      io.emit("price:changed", { productId: id, productName: updated.name, newPrice: updated.price });
    }
    if (req.body.stock !== undefined) {
      io.emit("stock:changed", { productId: id, productName: updated.name, stock: updated.stock });
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Failed to update product", error: e.message });
  }
});

// Delete product
app.delete("/api/merchant/products/:id", authMerchant, async (req, res) => {
  try {
    const { id } = req.params;

    if (useDbForProducts) {
      // Ensure belongs to merchant
      const [rows] = await db.query("SELECT id FROM products WHERE id = ? AND merchant_id = ?", [
        id,
        req.merchant.id,
      ]);
      if (!rows[0]) return res.status(404).json({ message: "Product not found" });

      await deleteProductDb(id);
      io.emit("product:removed", { productId: id });
      return res.json({ message: "Product deleted" });
    }

    if (!products.has(id)) return res.status(404).json({ message: "Product not found" });

    products.delete(id);
    io.emit("product:removed", { productId: id });
    res.json({ message: "Product deleted" });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete product", error: e.message });
  }
});

// List orders (still in-memory here; you can add DB table usage same as products)
app.get("/api/merchant/orders", authMerchant, (req, res) => {
  res.json(Array.from(orders.values()));
});

// Update order status (in-memory)
app.patch("/api/merchant/orders/:id", authMerchant, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = orders.get(id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.status = status;
  order.updatedAt = new Date().toISOString();

  orders.set(id, order);
  io.emit("order:updated", order);

  res.json(order);
});

/* ============================================================
   Socket handlers
   ============================================================ */

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // JOIN
  socket.on("user:join", (username) => {
    const safeName = String(username || "").trim() || "Anonymous";
    onlineUsers.set(socket.id, { username: safeName, socketId: socket.id });

    io.emit("users:online", Array.from(onlineUsers.values()));
    socket.broadcast.emit("user:joined", { username: safeName });

    console.log(`👤 ${safeName} joined (${onlineUsers.size} users online)`);
  });

  // PRODUCT NEW (socket broadcast)
  socket.on("product:new", (product) => {
    io.emit("product:added", product);

    pushActivity({
      id: Date.now(),
      type: "product",
      message: `New ${product?.name || "item"} added to shop!`,
      timestamp: new Date().toISOString(),
    });

    console.log("📦 New product broadcasted:", product?.name);
  });

  // CART ADD
  socket.on("cart:add", (data) => {
    const user = onlineUsers.get(socket.id);

    pushActivity({
      id: Date.now(),
      type: "cart",
      message: `${user?.username || "Someone"} added ${data?.productName || "an item"} to cart`,
      timestamp: new Date().toISOString(),
    });
  });

  // TRADE CREATE
  socket.on("trade:create", (tradeData) => {
    const tradeId = `trade-${Date.now()}`;

    const trade = {
      id: tradeId,
      ...(tradeData || {}),
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    activeTrades.set(tradeId, trade);

    io.emit("trade:new", trade);

    const user = onlineUsers.get(socket.id);
    pushActivity({
      id: Date.now(),
      type: "trade",
      message: `${user?.username || "Someone"} created a new trade offer`,
      timestamp: new Date().toISOString(),
    });

    console.log("🔄 New trade created:", tradeId);
  });

  // TRADE ACCEPT
  socket.on("trade:accept", (tradeId) => {
    const trade = activeTrades.get(tradeId);
    if (!trade) return;

    trade.status = "accepted";
    trade.acceptedAt = new Date().toISOString();

    io.emit("trade:updated", trade);

    pushActivity({
      id: Date.now(),
      type: "trade",
      message: "Trade offer accepted!",
      timestamp: new Date().toISOString(),
    });
  });

  // CHAT MESSAGE
  socket.on("chat:message", (message) => {
    const user = onlineUsers.get(socket.id);

    const chatMessage = {
      id: Date.now(),
      username: user?.username || "Anonymous",
      message: String(message || ""),
      timestamp: new Date().toISOString(),
    };

    io.emit("chat:message", chatMessage);
    console.log(`💬 ${chatMessage.username}: ${chatMessage.message}`);
  });

  // STOCK UPDATE
  socket.on("stock:update", (stockData) => {
    io.emit("stock:changed", stockData);

    if (Number(stockData?.stock) === 0) {
      pushActivity({
        id: Date.now(),
        type: "stock",
        message: `${stockData?.productName || "A product"} is now OUT OF STOCK!`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // PRICE UPDATE
  socket.on("price:update", (priceData) => {
    io.emit("price:changed", priceData);

    pushActivity({
      id: Date.now(),
      type: "price",
      message: `Price updated: ${priceData?.productName || "Product"} now BND ${priceData?.newPrice ?? ""}`,
      timestamp: new Date().toISOString(),
    });
  });

  // SEND RECENT ACTIVITIES
  socket.on("activities:request", () => {
    socket.emit("activities:list", recentActivities);
  });

  // SEND ALL TRADES
  socket.on("trades:request", () => {
    socket.emit("trades:list", Array.from(activeTrades.values()));
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);

    io.emit("users:online", Array.from(onlineUsers.values()));

    if (user) {
      socket.broadcast.emit("user:left", { username: user.username });
      console.log(`👋 ${user.username} left (${onlineUsers.size} users online)`);
    }

    console.log("❌ User disconnected:", socket.id);
  });
});

/* ============================================================
   Error handling (CORS clarity)
   ============================================================ */

app.use((err, req, res, next) => {
  if (String(err?.message || "").startsWith("CORS blocked:")) {
    return res.status(403).json({ message: err.message });
  }
  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ message: "Internal Server Error" });
});

/* ============================================================
   Start
   ============================================================ */

async function start() {
  try {
    // optional schema bootstrap
    await ensureSchema();

    // optional DB ping on startup (so you know it’s connected)
    try {
      const ok = await dbPing();
      console.log(`[DB] connected: ${ok ? "YES" : "NO"}`);
    } catch (e) {
      console.warn("[DB] ping failed:", e.message);
    }

    httpServer.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🎮 Nanashi Collectibles Socket.IO Server Started!");
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
