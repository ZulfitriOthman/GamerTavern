// Backend/server.js
import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { Server } from "socket.io";
import multer from "multer";
import { initDB, dbPing } from "./modules/db.module.js";
import { verifyMailer } from "./modules/mailer.module.js";
import { verifyToken } from "./modules/jwt.module.js";
import { validateEncryptionKey } from "./modules/encryption.module.js";
import { getWhatsAppProviderId } from "./services/notifications/whatsapp/WhatsAppService.js";

// routes (optional)
import createHealthRoutes from "./routes/api/health.routes.js";
import createAuthRoutes from "./routes/api/auth.routes.js";
import createClientPortfolioRoutes from "./routes/api/clientPortfolio.routes.js";
import createPaymentRoutes from "./routes/api/payment.routes.js";
import createMerchantRoutes from "./routes/api/merchant.routes.js";
import createCartRoutes from "./routes/api/cart.routes.js";
import createCheckoutRoutes from "./routes/api/checkout.routes.js";
import createOrdersRoutes from "./routes/api/orders.routes.js";
import createAddressesRoutes from "./routes/api/addresses.routes.js";
import createWishlistRoutes from "./routes/api/wishlist.routes.js";
import createReviewsRoutes from "./routes/api/reviews.routes.js";
import createShippingRoutes from "./routes/api/shipping.routes.js";
import createAdminRoutes from "./routes/api/admin.routes.js";
import createTicketingRoutes from "./routes/api/ticketing.routes.js";
import { expireStaleHolds } from "./services/ticketing/ticketHoldService.js";
import { requireAuth } from "./modules/restAuth.module.js";

// sockets
import accountSocketController from "./controllers/account.controller.js";
import chatSocketController from "./controllers/chat.controller.js";
import productSocketController from "./controllers/product.controller.js";
import shopSocketController from "./controllers/shop.controller.js";
import tradeSocketController from "./controllers/trade.controller.js";
import newsSocketController from "./controllers/news.controller.js";
import tournamentSocketController from "./controllers/tournament.controller.js";
import decklistSocketController from "./controllers/decklist.controller.js";
import countrySocketController from "./controllers/country.controller.js";
import tcgCategoriesSocketController from "./controllers/tcgcategories.controller.js";
import servicesSocketController from "./controllers/services.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- env ----
// DOTENV_FILE lets an isolated environment file (e.g. .env.integration, gitignored,
// never committed) be loaded instead of the default .env.dev, without ever touching
// .env.dev itself. Unset by default -> unchanged behavior.
dotenv.config({
  path: path.join(__dirname, process.env.DOTENV_FILE || ".env.dev"),
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

// Store avatar images in: Backend/public/uploads/avatars
const avatarUploadsDir = path.join(publicPath, "uploads", "avatars");
fs.mkdirSync(avatarUploadsDir, { recursive: true });

// Store delivery reference photos in: Backend/public/uploads/delivery-references
// (customer checkout — "where to leave it", never a product photo)
const deliveryReferenceUploadsDir = path.join(publicPath, "uploads", "delivery-references");
fs.mkdirSync(deliveryReferenceUploadsDir, { recursive: true });

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
  
  const ok = mimeOk || extOk;
  
  console.log(`[multer] File validation:
    - Original filename: ${file.originalname}
    - MIME type: ${file.mimetype || "(empty)"}
    - MIME OK: ${mimeOk}
    - Extension OK: ${extOk}
    - Overall OK: ${ok}`);
  
  cb(ok ? null : new Error("Only image files are allowed."), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Avatar uploader (same fileFilter, separate destination)
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safe = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, safe + ext);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// Delivery reference photo uploader (same fileFilter — JPG/PNG/WebP/GIF by
// MIME-or-extension, never trusting either alone — separate destination).
// GIF is accepted by the shared fileFilter but not advertised to the
// customer-facing picker (image/jpeg, image/png, image/webp only per the
// product spec) — the filter is reused as-is rather than forked, so this is
// slightly more permissive than the UI's own <input accept> hints, exactly
// like the existing product/avatar uploaders already are.
const deliveryReferenceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, deliveryReferenceUploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safe = Date.now() + "-" + Math.random().toString(16).slice(2);
    cb(null, safe + ext);
  },
});
const deliveryReferenceUpload = multer({
  storage: deliveryReferenceStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* ------------------------------ App / Server ------------------------------ */
const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

/* ------------------------------ Environment ------------------------------ */
const PORT = process.env.PORT || 3002;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://nanashicollectibles.com",
  "https://www.nanashicollectibles.com",
  // Dev/staging frontend — same backend/DB as production, no separate dev API exists.
  "https://dev.nanashicollectibles.com",
];

const allowlist = Array.from(new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS]));

// Microsoft Dev Tunnel hostnames (e.g. https://82nd8339-5173.asse.devtunnels.ms) are
// per-session and can never live in a static allowlist. This backend has no separate
// "dev" deployment to gate a broader rule behind — dev.nanashicollectibles.com, this
// tunnel, and production all hit this same process — so instead of a NODE_ENV check
// (which would be true here regardless), the pattern itself is the scope: it can only
// ever match Microsoft's own devtunnels.ms infrastructure forwarding an individual
// developer's local dev server, never a spoofable production-looking domain. Never
// widen this to match arbitrary hosts.
const DEV_TUNNEL_ORIGIN_PATTERN = /^https:\/\/[a-z0-9.-]+\.devtunnels\.ms$/i;

function isAllowedOrigin(origin) {
  if (allowlist.includes(origin)) return true;
  if (DEV_TUNNEL_ORIGIN_PATTERN.test(origin)) {
    console.warn(`[cors] allowing Dev Tunnel origin: ${origin}`);
    return true;
  }
  return false;
}

/* ------------------------------ Socket.IO ------------------------------ */
const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS (socket.io): ${origin}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 1e8,
});

// ---- Socket.IO authentication (handshake) ----
// Identity, not authorization: this only decides who the caller is, never what they can
// do. No token → guest (socket.user = null); public/guest features must keep working.
// Invalid/expired/malformed token → also guest, never authenticated — a bad token must
// never grant privileges. See CLAUDE.md "Socket.IO authentication" for the full model.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.user = null;
    return next();
  }

  try {
    const decoded = verifyToken(token);
    socket.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch (err) {
    console.warn("[socket-auth] rejected token:", err?.message || err);
    socket.user = null;
  }

  next();
});

const stores = {
  onlineUsers: new Map(),
  activeTrades: new Map(),
  recentActivities: [],
  recentChatMessages: [],
};

function pushActivity(activity) {
  if (!activity) return;

  stores.recentActivities = [activity, ...(stores.recentActivities || [])].slice(0, 50);
  io.emit("activity:new", activity);
}

io.engine.on("initial_headers", (_headers, req) => {
  console.log("[engine.io] origin:", req.headers.origin);
});

/* ------------------------------ Middleware ------------------------------ */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/postman or same-origin
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  // X-CSRF-Token: required by the wedding admin API (/api/wedding/admin/*).
  allowedHeaders: ["Content-Type", "Authorization", "x-guest-cart-token", "Idempotency-Key", "X-CSRF-Token"],
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

// Verify SMTP transporter (non-fatal)
verifyMailer().catch(() => {});

// Marketplace data encryption (merchant bank details / payment-account
// credentials — see modules/encryption.module.js). Never logs the key
// itself, only whether it is configured and valid. Mirrors jwt.module.js's
// existing production-vs-dev posture: a missing/malformed security secret
// fails startup in production (so it's caught at deploy time, not the
// first time a merchant tries to save bank details) but only warns in
// development, where working on unrelated features shouldn't require it.
{
  const encryptionCheck = validateEncryptionKey();
  if (encryptionCheck.valid) {
    console.log("[security] Marketplace data encryption: configured");
  } else {
    console.warn(`[security] Marketplace data encryption: NOT configured (${encryptionCheck.error})`);
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[security] Refusing to start in production without a valid MARKETPLACE_DATA_ENCRYPTION_KEY. " +
          "Set it (see Backend/env.example) and restart."
      );
      process.exit(1);
    }
  }
}

// WhatsApp merchant notifications (see services/notifications/) — never a
// startup-fatal concern (unlike the encryption key above): the default
// "mock" provider is always safe, and a misconfigured "cloud" provider
// only ever means notifications fail individually per order, never that
// checkout itself fails. Informational only.
console.log(`[whatsapp] provider: ${getWhatsAppProviderId()}`);

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
  console.log(`[upload] Request received:
    - File received: ${req.file ? "YES" : "NO"}
    - Field name: ${req.file?.fieldname}
    - Filename: ${req.file?.filename}
    - Original: ${req.file?.originalname}
    - MIME: ${req.file?.mimetype}
    - Size: ${req.file?.size} bytes`);

  if (!req.file) {
    console.log("[upload] ❌ No file attached");
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const imageUrl = `/public/uploads/products/${req.file.filename}`;
  console.log("[upload] ✅ Upload successful:", imageUrl);
  return res.json({ success: true, imageUrl });
});

app.post("/api/upload/avatar", avatarUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  const imageUrl = `/public/uploads/avatars/${req.file.filename}`;
  console.log("[upload][avatar] ✅", imageUrl);
  return res.json({ success: true, imageUrl });
});

// Requires auth (unlike the two uploaders above) — this attaches to a
// specific customer's own order at checkout, not a merchant's public
// product listing or a user's own public-ish avatar.
app.post("/api/upload/delivery-reference", requireAuth, deliveryReferenceUpload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  const imageUrl = `/public/uploads/delivery-references/${req.file.filename}`;
  console.log("[upload][delivery-reference] ✅", imageUrl);
  return res.json({ success: true, imageUrl, fileType: req.file.mimetype });
});

/* ------------------------------ Routes ------------------------------ */
app.use(
  "/api",
  createHealthRoutes({
    dbPing,
    stores,
  })
);

app.use("/api/auth", createAuthRoutes({ db, io }));
app.use("/api/client-portfolio", createClientPortfolioRoutes());
app.use("/api/payments", createPaymentRoutes()); // legacy direct-CyberSource endpoint — superseded by /api/checkout + PaymentService, see Backend/services/payment/

// Marketplace (see Database/README.md + Database/schema/004_merchants.sql through 008_platform_ops.sql + NanashiCollectibles/CLAUDE.md)
app.use("/api/merchant", createMerchantRoutes({ db }));
app.use("/api/cart", createCartRoutes({ db }));
app.use("/api/checkout", createCheckoutRoutes({ db }));
app.use("/api/orders", createOrdersRoutes({ db }));
app.use("/api/addresses", createAddressesRoutes({ db }));
app.use("/api/wishlist", createWishlistRoutes({ db }));
app.use("/api/reviews", createReviewsRoutes({ db }));
app.use("/api/shipping", createShippingRoutes({ db }));
app.use("/api/admin", createAdminRoutes({ db }));

// Ticketing (see Database/schema/009_ticketing.sql + Database/README.md "Ticketing")
app.use("/api/ticketing", createTicketingRoutes({ db, io }));

// Wedding website API (Wedding/server, see Wedding/README.md) → /api/wedding/*
// Self-contained: its own config (Wedding/server/.env), MySQL pool, cookies,
// uploads and error handling. Loading is guarded so a problem there can never
// stop the marketplace backend. Disable with WEDDING_MODULE=off.
if (process.env.WEDDING_MODULE !== "off") {
  try {
    const weddingModulePath = process.env.WEDDING_MODULE_PATH
      ? path.resolve(process.env.WEDDING_MODULE_PATH)
      : fileURLToPath(new URL("../Wedding/server/src/embed.js", import.meta.url));
    const { createWeddingModule } = await import(pathToFileURL(weddingModulePath).href);
    const wedding = await createWeddingModule();
    app.use(wedding.prefix, wedding.router);
  } catch (error) {
    console.error("[wedding] module not loaded — /api/wedding disabled:", error.message);
  }
}

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

  shopSocketController({ socket, io, stores, pushActivity });
  chatSocketController({ socket, io, stores, pushActivity });
  accountSocketController({ socket, io, db, pushActivity });
  productSocketController({ socket, io, db, pushActivity });
  tradeSocketController({ socket, io, db });
  newsSocketController({ socket, io, db });
  tournamentSocketController({ socket, io, db });
  decklistSocketController({ socket, io, db });
  countrySocketController({ socket, db });
  tcgCategoriesSocketController({ socket, io, db });
  servicesSocketController({ socket, db });
});

/* ------------------------------ Error handler ------------------------------ */
// Standardized failure envelope ({ success: false, code, message }) —
// never forwards err.stack, SQL error text, or any internal detail for an
// error that wasn't already given a safe, specific message above.
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || "");

  if (msg.startsWith("CORS blocked:")) {
    return res.status(403).json({ success: false, code: "CORS_BLOCKED", message: err.message });
  }
  if (msg.startsWith("Not allowed by CORS (socket.io):")) {
    return res.status(403).json({ success: false, code: "CORS_BLOCKED", message: err.message });
  }
  if (msg.includes("Only image files are allowed")) {
    return res.status(400).json({ success: false, code: "INVALID_FILE_TYPE", message: err.message });
  }

  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: "Internal Server Error" });
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

    // Best-effort periodic sweep for TICKET_HOLD_SESSIONS past EXPIRES_AT —
    // the DB is authoritative for expiry, this just converts stale rows to
    // EXPIRED and releases their seats/GA counters promptly. A missed tick
    // (e.g. restart) never corrupts inventory: the next tick, or any read
    // path, still sees an ACTIVE-but-expired session as unavailable to hold
    // again until it's actually released. See services/ticketing/ticketHoldService.js.
    setInterval(async () => {
      try {
        const result = await expireStaleHolds(db, io, { batchSize: 50 });
        if (result.expiredCount > 0) {
          console.log(`[ticketing] expiry sweep: released ${result.expiredCount}/${result.checked} stale hold session(s)`);
        }
      } catch (err) {
        console.error("[ticketing] expiry sweep failed:", err.message);
      }
    }, 30_000);
  } catch (e) {
    console.error("Failed to start server:", e);
    process.exit(1);
  }
}

start();
