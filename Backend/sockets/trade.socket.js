// Backend/sockets/trade.socket.js
const ROLES = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function normalizeRole(role) {
  const r = String(role || ROLES.USER).toUpperCase();
  return Object.values(ROLES).includes(r) ? r : ROLES.USER;
}

function safeRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    user_id: row.USER_ID,
    product_id: row.PRODUCT_ID,
    title: row.TITLE,
    game: row.GAME,
    condition: row.CONDITION_LABEL,
    type: row.TYPE,
    want: row.WANT_TEXT,
    notes: row.NOTES,
    status: row.STATUS,
    created_at: row.CREATED_AT,
  };
}

export default function tradeSocketController({ socket, io, db }) {
  console.log("✅ User connected to trade socket:", socket.id);

  /* =========================================================
     CREATE TRADE LISTING
     ========================================================= */
  socket.on("trade:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);

    if (!userId) {
      return ack({ success: false, message: "Unauthorized." });
    }

    const title = toStr(payload.title);
    const game = toStr(payload.game);
    const condition = toStr(payload.condition);
    const type = payload.type === "sale" ? "sale" : "trade";
    const want = toStr(payload.want);
    const notes = toStr(payload.notes);

    if (!title || !game) {
      return ack({ success: false, message: "Title and game are required." });
    }

    try {
      const [res] = await db.execute(
        `INSERT INTO TRADE_LISTINGS
        (USER_ID, TITLE, GAME, CONDITION_LABEL, TYPE, WANT_TEXT, NOTES)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, game, condition, type, want, notes]
      );

      const listingId = res.insertId;

      const [rows] = await db.execute(
        `SELECT * FROM TRADE_LISTINGS WHERE ID = ?`,
        [listingId]
      );

      const listing = safeRow(rows[0]);

      io.emit("trade:created", listing);

      return ack({ success: true, data: listing });
    } catch (err) {
      console.error("trade:create error", err);
      return ack({ success: false, message: "Failed to create listing." });
    }
  });

  /* =========================================================
     LIST TRADES
     ========================================================= */
  socket.on("trade:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const game = toStr(payload.game);
    const type = toStr(payload.type);
    const search = toStr(payload.search);

    try {
      const where = ["STATUS = 'active'"];
      const params = [];

      if (game && game !== "all") {
        where.push("GAME = ?");
        params.push(game);
      }

      if (type && type !== "all") {
        where.push("TYPE = ?");
        params.push(type);
      }

      if (search) {
        where.push("(TITLE LIKE ? OR WANT_TEXT LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const sql = `
        SELECT * FROM TRADE_LISTINGS
        WHERE ${where.join(" AND ")}
        ORDER BY ID DESC
      `;

      const [rows] = await db.execute(sql, params);

      const listings = rows.map(safeRow);

      return ack({ success: true, data: listings });
    } catch (err) {
      console.error("trade:list error", err);
      return ack({ success: false, message: "Failed to load trades." });
    }
  });

  /* =========================================================
     DELETE TRADE (owner only)
     ========================================================= */
  socket.on("trade:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const currentUser = payload.currentUser || null;
    const userId = toInt(currentUser?.id);
    const listingId = toInt(payload.id);

    if (!userId) return ack({ success: false, message: "Unauthorized." });

    try {
      const [rows] = await db.execute(
        `SELECT USER_ID FROM TRADE_LISTINGS WHERE ID = ?`,
        [listingId]
      );

      if (!rows.length) {
        return ack({ success: false, message: "Listing not found." });
      }

      if (toInt(rows[0].USER_ID) !== userId) {
        return ack({ success: false, message: "Forbidden." });
      }

      await db.execute(
        `UPDATE TRADE_LISTINGS SET STATUS = 'cancelled' WHERE ID = ?`,
        [listingId]
      );

      io.emit("trade:deleted", { id: listingId });

      return ack({ success: true });
    } catch (err) {
      console.error("trade:delete error", err);
      return ack({ success: false, message: "Failed to delete." });
    }
  });
}
