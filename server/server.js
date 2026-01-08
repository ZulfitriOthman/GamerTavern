// server.js - GamerTavern Socket.IO Server (Cloudflare-ready)

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

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

// Your frontend URL (production). Example: https://gamertavern.b-jaur.com
// Keep localhost for dev.
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Optional: add more allowed origins via comma-separated env var
// Example: EXTRA_ORIGINS="https://360geoinfo.com,https://b-jaur.com"
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowlist = Array.from(
  new Set([CLIENT_URL, "http://localhost:5173", ...EXTRA_ORIGINS])
);

/* ============================================================
   CORS
   ============================================================ */

app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server and non-browser requests
      if (!origin) return cb(null, true);

      if (allowlist.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

// If you expect JSON payloads for REST endpoints in the future
app.use(express.json({ limit: "2mb" }));

/* ============================================================
   Socket.IO
   ============================================================ */

const io = new Server(httpServer, {
  cors: {
    origin: allowlist,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Optional: improve proxy compatibility
  transports: ["websocket", "polling"],
});

/* ============================================================
   In-memory stores
   ============================================================ */

const onlineUsers = new Map(); // socketId -> { username, socketId }
const activeTrades = new Map(); // tradeId -> trade object
const recentActivities = []; // newest first

const pushActivity = (activity) => {
  recentActivities.unshift(activity);
  if (recentActivities.length > 20) recentActivities.pop();
  io.emit("activity:new", activity);
};

/* ============================================================
   Routes (so opening domain does not show "Cannot GET /")
   ============================================================ */

app.get("/", (req, res) => {
  res.status(200).send("✅ GamerTavern Socket.IO server is running.");
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

/* ============================================================
   Socket handlers
   ============================================================ */

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // JOIN
  socket.on("user:join", (username) => {
    const safeName = String(username || "").trim() || "Anonymous";

    onlineUsers.set(socket.id, { username: safeName, socketId: socket.id });

    // Broadcast updated user list to everyone
    io.emit("users:online", Array.from(onlineUsers.values()));

    // Notify others
    socket.broadcast.emit("user:joined", { username: safeName });

    console.log(`👤 ${safeName} joined (${onlineUsers.size} users online)`);
  });

  // PRODUCT NEW
  socket.on("product:new", (product) => {
    // Broadcast product to all clients
    io.emit("product:added", product);

    const activity = {
      id: Date.now(),
      type: "product",
      message: `New ${product?.name || "item"} added to shop!`,
      timestamp: new Date().toISOString(),
    };
    pushActivity(activity);

    console.log("📦 New product broadcasted:", product?.name);
  });

  // CART ADD
  socket.on("cart:add", (data) => {
    const user = onlineUsers.get(socket.id);

    const activity = {
      id: Date.now(),
      type: "cart",
      message: `${user?.username || "Someone"} added ${
        data?.productName || "an item"
      } to cart`,
      timestamp: new Date().toISOString(),
    };
    pushActivity(activity);
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

    // Broadcast new trade
    io.emit("trade:new", trade);

    const user = onlineUsers.get(socket.id);
    const activity = {
      id: Date.now(),
      type: "trade",
      message: `${user?.username || "Someone"} created a new trade offer`,
      timestamp: new Date().toISOString(),
    };
    pushActivity(activity);

    console.log("🔄 New trade created:", tradeId);
  });

  // TRADE ACCEPT
  socket.on("trade:accept", (tradeId) => {
    const trade = activeTrades.get(tradeId);
    if (!trade) return;

    trade.status = "accepted";
    trade.acceptedAt = new Date().toISOString();

    io.emit("trade:updated", trade);

    const activity = {
      id: Date.now(),
      type: "trade",
      message: "Trade offer accepted!",
      timestamp: new Date().toISOString(),
    };
    pushActivity(activity);
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
      const activity = {
        id: Date.now(),
        type: "stock",
        message: `${stockData?.productName || "A product"} is now OUT OF STOCK!`,
        timestamp: new Date().toISOString(),
      };
      pushActivity(activity);
    }
  });

  // PRICE UPDATE
  socket.on("price:update", (priceData) => {
    io.emit("price:changed", priceData);

    const activity = {
      id: Date.now(),
      type: "price",
      message: `Price updated: ${priceData?.productName || "Product"} now BND ${
        priceData?.newPrice ?? ""
      }`,
      timestamp: new Date().toISOString(),
    };
    pushActivity(activity);
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
   Start
   ============================================================ */

httpServer.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🎮 GamerTavern Socket.IO Server Started!");
  console.log("=".repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Allowed origins: ${allowlist.join(", ")}`);
  console.log("📡 WebSocket ready for connections");
  console.log("=".repeat(60) + "\n");
});
