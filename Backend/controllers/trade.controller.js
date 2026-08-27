// Backend/controllers/trade.controller.js
//
// Migrated to the NanashiCollectibles v2 schema: TRADE_LISTINGS -> trade_listings,
// free-text GAME -> tcg_game_id FK, TYPE -> listing_type.
const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function safeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    title: row.title,
    tcg_game_id: row.tcg_game_id,
    tcg_game_name: row.tcg_game_name ?? null,
    condition: row.condition_label,
    type: row.listing_type,
    want: row.want_text,
    notes: row.notes,
    status: row.status,
    created_at: row.created_at,
  };
}

const SELECT_LISTING_SQL = `
  SELECT l.id, l.user_id, l.product_id, l.title, l.tcg_game_id, g.name AS tcg_game_name,
         l.condition_label, l.listing_type, l.want_text, l.notes, l.status, l.created_at
  FROM trade_listings l
  LEFT JOIN tcg_games g ON g.id = l.tcg_game_id
`;

export default function tradeSocketController({ socket, io, db }) {
  console.log("✅ User connected to trade socket:", socket.id);

  /* =========================================================
     CREATE TRADE LISTING
     ========================================================= */
  socket.on("trade:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    // Identity from the verified handshake, never the client-supplied payload.
    const userId = socket.user ? toInt(socket.user.id) : 0;

    if (!userId) {
      return ack({ success: false, message: "Unauthorized." });
    }

    const title = toStr(payload.title);
    const tcgGameId = toInt(payload.tcgGameId ?? payload.tcg_game_id, 0);
    const condition = toStr(payload.condition);
    const type = payload.type === "sale" ? "sale" : "trade";
    const want = toStr(payload.want);
    const notes = toStr(payload.notes);

    if (!title || !tcgGameId) {
      return ack({ success: false, message: "Title and tcgGameId are required." });
    }

    try {
      const [res] = await db.execute(
        `INSERT INTO trade_listings
        (user_id, title, tcg_game_id, condition_label, listing_type, want_text, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, title, tcgGameId, condition || null, type, want || null, notes || null]
      );

      const listingId = res.insertId;

      const [rows] = await db.execute(`${SELECT_LISTING_SQL} WHERE l.id = ?`, [listingId]);

      const listing = safeRow(rows[0]);

      io.emit("trade:created", listing);

      return ack({ success: true, data: listing });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown tcgGameId." });
      }
      console.error("trade:create error", err);
      return ack({ success: false, message: "Failed to create listing." });
    }
  });

  /* =========================================================
     LIST TRADES
     ========================================================= */
  socket.on("trade:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const tcgGameId = payload.tcgGameId != null ? toInt(payload.tcgGameId) : null;
    const type = toStr(payload.type);
    const search = toStr(payload.search);

    try {
      const where = ["l.status = 'active'"];
      const params = [];

      if (tcgGameId) {
        where.push("l.tcg_game_id = ?");
        params.push(tcgGameId);
      }

      if (type && type !== "all") {
        where.push("l.listing_type = ?");
        params.push(type);
      }

      if (search) {
        where.push("(l.title LIKE ? OR l.want_text LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const sql = `
        ${SELECT_LISTING_SQL}
        WHERE ${where.join(" AND ")}
        ORDER BY l.id DESC
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

    // Identity from the verified handshake, never the client-supplied payload.
    const userId = socket.user ? toInt(socket.user.id) : 0;
    const listingId = toInt(payload.id);

    if (!userId) return ack({ success: false, message: "Unauthorized." });

    try {
      const [rows] = await db.execute(
        `SELECT user_id FROM trade_listings WHERE id = ?`,
        [listingId]
      );

      if (!rows.length) {
        return ack({ success: false, message: "Listing not found." });
      }

      if (toInt(rows[0].user_id) !== userId) {
        return ack({ success: false, message: "Forbidden." });
      }

      await db.execute(
        `UPDATE trade_listings SET status = 'cancelled' WHERE id = ?`,
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
