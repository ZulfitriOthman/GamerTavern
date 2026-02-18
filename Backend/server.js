// Backend/server.js
import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import multer from "multer";
import { initDB, dbPing } from "./modules/db.module.js";

// routes (optional)
import createHealthRoutes from "./routes/api/health.routes.js";
import createAuthRoutes from "./routes/api/auth.routes.js";

// sockets
import accountSocketController from "./sockets/account.socket.js";
import productSocketController from "./sockets/product.socket.js";
import tradeSocketController from "./sockets/trade.socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- env ----
dotenv.config({
  path: path.join(__dirname, ".env.dev"),
  override: true,
});

/* ------------------------------ Paths & Folders ------------------------------ */
const publicPath = path.join(process.cwd(), "public");
const tmpDir = path.join(process.cwd(), "tmp");
const uploadsDir = path.join(tmpDir, "uploads");

// Ensure folders exist
fs.mkdirSync(publicPath, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

// Store product images in: Backend/public/uploads/products
const productUploadsDir = path.join(publicPath, "uploads", "products");
fs.mkdirSync(productUploadsDir, { recursive: true });

/* ------------------------------ Multer config ------------------------------ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safe = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, safe + ext);
  },
});

// Optional: only allow images
// ✅ Mobile fix: Check both MIME type AND file extension (MIME type may be empty on mobile)
const fileFilter = (_req, file, cb) => {
  const mimeOk = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimetype || "");
  const fileName = (file.originalname || "").toLowerCase();
  const extOk = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  
  const ok = mimeOk || extOk; // Accept if either MIME type OR extension is valid
  cb(ok ? null : new Error("Only image files are allowed."), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* ------------------------------ App / Server ------------------------------ */
const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

/* ------------------------------ Environment ------------------------------ */
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://nanashicollectibles.com",
  "https://www.nanashicollectibles.com",
];

const allowlist = Array.from(new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS]));

/* ------------------------------ Socket.IO ------------------------------ */
const io = new Server(httpServer, {
  cors: {
    origin: allowlist,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8,
});

io.engine.on("initial_headers", (_headers, req) => {
  console.log("[engine.io] origin:", req.headers.origin);
});

/* ------------------------------ Middleware ------------------------------ */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/postman or same-origin
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ✅ static files: anything under Backend/public is served at /public/...
app.use("/public", express.static(publicPath));

/* ------------------------------ Health/Home ------------------------------ */
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

/* ------------------------------ Upload Route ------------------------------ */
app.post("/api/upload/product-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const imageUrl = `/public/uploads/products/${req.file.filename}`;
  return res.json({ success: true, imageUrl });
});

/* ------------------------------ Routes ------------------------------ */
app.use(
  "/api",
  createHealthRoutes({
    dbPing,
    stores: {},
  })
);

app.use("/api/auth", createAuthRoutes({ db, io }));

/* ------------------------------ Socket Wiring ------------------------------ */
io.on("connection", (socket) => {
  socket.onAny((event, ...args) => {
    const first = args?.[0];
    const summary =
      typeof first === "object" && first !== null
        ? Object.keys(first).slice(0, 8).join(",")
        : typeof first;
    console.log(`[socket] ${event} payloadKeys=${summary}`);
  });

  accountSocketController({ socket, io, db, pushActivity: () => {} });
  productSocketController({ socket, io, db, pushActivity: () => {} });
  tradeSocketController({ socket, io, db });
});

/* ------------------------------ Error handler ------------------------------ */
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || "");

  if (msg.startsWith("CORS blocked:")) {
    return res.status(403).json({ message: err.message });
  }
  if (msg.startsWith("Not allowed by CORS (socket.io):")) {
    return res.status(403).json({ message: err.message });
  }
  if (msg.includes("Only image files are allowed")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ message: "Internal Server Error" });
});

/* ------------------------------ Start ------------------------------ */
async function start() {
  try {
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
      console.log("📡 WebSocket ready for connections (account + product)");
      console.log("🖼️  Product uploads:", productUploadsDir);
      console.log("=".repeat(60) + "\n");
    });
  } catch (e) {
    console.error("Failed to start server:", e);
    process.exit(1);
  }
}

start();
