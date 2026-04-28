// Backend/controllers/decklist.controller.js

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Verify caller is ADMIN by looking up PERSONAL_USER.ROLE.
 * Returns { ok: true, user } or { ok: false, message }.
 */
async function requireAdmin(db, userId) {
  const id = toInt(userId, 0);
  if (!id) return { ok: false, message: "Authentication required." };
  try {
    const [rows] = await db.execute(
      "SELECT ID, ROLE, NAME FROM PERSONAL_USER WHERE ID = ? LIMIT 1",
      [id],
    );
    const row = rows?.[0];
    if (!row) return { ok: false, message: "Account not found." };
    if (String(row.ROLE || "").toUpperCase() !== "ADMIN") {
      return { ok: false, message: "Admin privileges required." };
    }
    return { ok: true, user: row };
  } catch (err) {
    console.error("[decklist] requireAdmin error", err);
    return { ok: false, message: "Authorization check failed." };
  }
}

function safeDecklistRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    name: row.NAME,
    game: row.GAME,
    archetype: row.ARCHETYPE,
    format: row.FORMAT,
    pilot: row.PILOT,
    description: row.DESCRIPTION,
    key_cards: row.KEY_CARDS,
    win_rate: row.WIN_RATE != null ? Number(row.WIN_RATE) : null,
    popularity: row.POPULARITY,
    avg_cost: row.AVG_COST != null ? Number(row.AVG_COST) : null,
    featured: row.FEATURED ? 1 : 0,
    created_by: row.CREATED_BY,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

const SELECT_DECKLIST_COLS = `
  ID, NAME, GAME, ARCHETYPE, FORMAT, PILOT, DESCRIPTION, KEY_CARDS,
  WIN_RATE, POPULARITY, AVG_COST, FEATURED, CREATED_BY,
  CREATED_AT, UPDATED_AT
`;

export default function decklistSocketController({ socket, io, db }) {
  /* =========================================================
     LIST DECKLISTS  (PUBLIC)
     ========================================================= */
  socket.on("decklist:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const game = toStr(payload.game);

    try {
      const where = [];
      const params = [];
      if (game && game !== "All") {
        where.push("GAME = ?");
        params.push(game);
      }
      const sql = `
        SELECT ${SELECT_DECKLIST_COLS}
        FROM DECKLIST
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY FEATURED DESC, POPULARITY DESC, ID DESC
      `;
      const [rows] = await db.execute(sql, params);
      return ack({
        success: true,
        data: (rows || []).map(safeDecklistRow),
      });
    } catch (err) {
      console.error("[decklist:list] error", err);
      return ack({ success: false, message: "Failed to load decklists." });
    }
  });

  /* =========================================================
     CREATE DECKLIST  (ADMIN ONLY)
     ========================================================= */
  socket.on("decklist:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const name = toStr(payload.name);
    const game = toStr(payload.game);
    if (!name) return ack({ success: false, message: "Name is required." });
    if (!game) return ack({ success: false, message: "Game is required." });

    const archetype = toStr(payload.archetype);
    const format = toStr(payload.format);
    const pilot = toStr(payload.pilot);
    const description = toStr(payload.description);
    const keyCards = toStr(payload.keyCards ?? payload.key_cards);

    const numOrNull = (raw, label, { int = false, min = null, max = null } = {}) => {
      if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, message: `Invalid ${label}.` };
      if (min != null && n < min) return { ok: false, message: `Invalid ${label}.` };
      if (max != null && n > max) return { ok: false, message: `Invalid ${label}.` };
      return { ok: true, value: int ? Math.trunc(n) : n };
    };

    const wr = numOrNull(payload.winRate ?? payload.win_rate, "win rate", { min: 0, max: 100 });
    if (!wr.ok) return ack({ success: false, message: wr.message });
    const pop = numOrNull(payload.popularity, "popularity", { int: true, min: 0 });
    if (!pop.ok) return ack({ success: false, message: pop.message });
    const cost = numOrNull(payload.avgCost ?? payload.avg_cost, "avg cost", { min: 0 });
    if (!cost.ok) return ack({ success: false, message: cost.message });

    const featured = payload.featured ? 1 : 0;

    try {
      const sql = `
        INSERT INTO DECKLIST
          (NAME, GAME, ARCHETYPE, FORMAT, PILOT, DESCRIPTION, KEY_CARDS,
           WIN_RATE, POPULARITY, AVG_COST, FEATURED, CREATED_BY)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await db.execute(sql, [
        name,
        game,
        archetype || null,
        format || null,
        pilot || null,
        description || null,
        keyCards || null,
        wr.value,
        pop.value,
        cost.value,
        featured,
        auth.user.ID,
      ]);

      const [rows] = await db.execute(
        `SELECT ${SELECT_DECKLIST_COLS} FROM DECKLIST WHERE ID = ? LIMIT 1`,
        [result.insertId],
      );
      const created = safeDecklistRow(rows?.[0]);
      io?.emit?.("decklist:created", created);
      return ack({ success: true, data: created });
    } catch (err) {
      console.error("[decklist:create] error", err);
      return ack({ success: false, message: "Failed to create decklist." });
    }
  });

  /* =========================================================
     UPDATE DECKLIST  (ADMIN ONLY)
     ========================================================= */
  socket.on("decklist:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Decklist id is required." });

    const sets = [];
    const params = [];

    const setStr = (col, val) => {
      const v = toStr(val);
      sets.push(`${col} = ?`);
      params.push(v || null);
    };

    if (payload.name !== undefined) {
      const v = toStr(payload.name);
      if (!v) return ack({ success: false, message: "Name cannot be empty." });
      sets.push("NAME = ?");
      params.push(v);
    }
    if (payload.game !== undefined) {
      const v = toStr(payload.game);
      if (!v) return ack({ success: false, message: "Game cannot be empty." });
      sets.push("GAME = ?");
      params.push(v);
    }
    if (payload.archetype !== undefined) setStr("ARCHETYPE", payload.archetype);
    if (payload.format !== undefined) setStr("FORMAT", payload.format);
    if (payload.pilot !== undefined) setStr("PILOT", payload.pilot);
    if (payload.description !== undefined) setStr("DESCRIPTION", payload.description);
    if (payload.keyCards !== undefined || payload.key_cards !== undefined)
      setStr("KEY_CARDS", payload.keyCards ?? payload.key_cards);

    const numField = (col, raw, label, opts = {}) => {
      let val = null;
      if (raw !== null && raw !== "") {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { ok: false, message: `Invalid ${label}.` };
        if (opts.min != null && n < opts.min) return { ok: false, message: `Invalid ${label}.` };
        if (opts.max != null && n > opts.max) return { ok: false, message: `Invalid ${label}.` };
        val = opts.int ? Math.trunc(n) : n;
      }
      sets.push(`${col} = ?`);
      params.push(val);
      return { ok: true };
    };

    if (payload.winRate !== undefined || payload.win_rate !== undefined) {
      const r = numField("WIN_RATE", payload.winRate ?? payload.win_rate, "win rate", { min: 0, max: 100 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.popularity !== undefined) {
      const r = numField("POPULARITY", payload.popularity, "popularity", { int: true, min: 0 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.avgCost !== undefined || payload.avg_cost !== undefined) {
      const r = numField("AVG_COST", payload.avgCost ?? payload.avg_cost, "avg cost", { min: 0 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.featured !== undefined) {
      sets.push("FEATURED = ?");
      params.push(payload.featured ? 1 : 0);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("UPDATED_AT = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(
        `UPDATE DECKLIST SET ${sets.join(", ")} WHERE ID = ?`,
        params,
      );
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Decklist not found." });
      }
      const [rows] = await db.execute(
        `SELECT ${SELECT_DECKLIST_COLS} FROM DECKLIST WHERE ID = ? LIMIT 1`,
        [id],
      );
      const updated = safeDecklistRow(rows?.[0]);
      io?.emit?.("decklist:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      console.error("[decklist:update] error", err);
      return ack({ success: false, message: "Failed to update decklist." });
    }
  });

  /* =========================================================
     DELETE DECKLIST  (ADMIN ONLY)
     ========================================================= */
  socket.on("decklist:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Decklist id is required." });

    try {
      const [result] = await db.execute("DELETE FROM DECKLIST WHERE ID = ?", [id]);
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Decklist not found." });
      }
      io?.emit?.("decklist:deleted", { id });
      return ack({ success: true, data: { id } });
    } catch (err) {
      console.error("[decklist:delete] error", err);
      return ack({ success: false, message: "Failed to delete decklist." });
    }
  });
}
