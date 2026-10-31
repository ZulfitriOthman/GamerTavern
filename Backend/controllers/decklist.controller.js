// Backend/controllers/decklist.controller.js
//
// Migrated to the NanashiCollectibles v2 schema: DECKLIST -> deck_lists, and the
// free-text GAME column -> tcg_game_id FK against the canonical tcg_games list.
import { requireAdmin } from "../modules/authz.module.js";

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function safeDecklistRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tcg_game_id: row.tcg_game_id,
    tcg_game_name: row.tcg_game_name ?? null,
    archetype: row.archetype,
    format: row.format,
    pilot: row.pilot,
    description: row.description,
    key_cards: row.key_cards,
    win_rate: row.win_rate != null ? Number(row.win_rate) : null,
    popularity: row.popularity,
    avg_cost: row.avg_cost != null ? Number(row.avg_cost) : null,
    featured: row.featured ? 1 : 0,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_DECKLIST_SQL = `
  SELECT d.id, d.name, d.tcg_game_id, g.name AS tcg_game_name, d.archetype, d.format,
         d.pilot, d.description, d.key_cards, d.win_rate, d.popularity, d.avg_cost,
         d.featured, d.created_by, d.created_at, d.updated_at
  FROM DECK_LISTS d
  LEFT JOIN TCG_GAMES g ON g.id = d.tcg_game_id
`;

export default function decklistSocketController({ socket, io, db }) {
  /* =========================================================
     LIST DECKLISTS  (PUBLIC)
     ========================================================= */
  socket.on("decklist:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    const tcgGameId = payload.tcgGameId != null ? toInt(payload.tcgGameId) : null;

    try {
      const where = [];
      const params = [];
      if (tcgGameId) {
        where.push("d.tcg_game_id = ?");
        params.push(tcgGameId);
      }
      const sql = `
        ${SELECT_DECKLIST_SQL}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY d.featured DESC, d.popularity DESC, d.id DESC
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

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const name = toStr(payload.name);
    const tcgGameId = toInt(payload.tcgGameId ?? payload.tcg_game_id, 0);
    if (!name) return ack({ success: false, message: "Name is required." });
    if (!tcgGameId) return ack({ success: false, message: "tcgGameId is required." });

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
        INSERT INTO DECK_LISTS
          (name, tcg_game_id, archetype, format, pilot, description, key_cards,
           win_rate, popularity, avg_cost, featured, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await db.execute(sql, [
        name,
        tcgGameId,
        archetype || null,
        format || null,
        pilot || null,
        description || null,
        keyCards || null,
        wr.value,
        pop.value,
        cost.value,
        featured,
        auth.user.id,
      ]);

      const [rows] = await db.execute(`${SELECT_DECKLIST_SQL} WHERE d.id = ? LIMIT 1`, [result.insertId]);
      const created = safeDecklistRow(rows?.[0]);
      io?.emit?.("decklist:created", created);
      return ack({ success: true, data: created });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown tcgGameId." });
      }
      console.error("[decklist:create] error", err);
      return ack({ success: false, message: "Failed to create decklist." });
    }
  });

  /* =========================================================
     UPDATE DECKLIST  (ADMIN ONLY)
     ========================================================= */
  socket.on("decklist:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

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
      sets.push("name = ?");
      params.push(v);
    }
    if (payload.tcgGameId !== undefined || payload.tcg_game_id !== undefined) {
      const v = toInt(payload.tcgGameId ?? payload.tcg_game_id, 0);
      if (!v) return ack({ success: false, message: "tcgGameId cannot be empty." });
      sets.push("tcg_game_id = ?");
      params.push(v);
    }
    if (payload.archetype !== undefined) setStr("archetype", payload.archetype);
    if (payload.format !== undefined) setStr("format", payload.format);
    if (payload.pilot !== undefined) setStr("pilot", payload.pilot);
    if (payload.description !== undefined) setStr("description", payload.description);
    if (payload.keyCards !== undefined || payload.key_cards !== undefined)
      setStr("key_cards", payload.keyCards ?? payload.key_cards);

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
      const r = numField("win_rate", payload.winRate ?? payload.win_rate, "win rate", { min: 0, max: 100 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.popularity !== undefined) {
      const r = numField("popularity", payload.popularity, "popularity", { int: true, min: 0 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.avgCost !== undefined || payload.avg_cost !== undefined) {
      const r = numField("avg_cost", payload.avgCost ?? payload.avg_cost, "avg cost", { min: 0 });
      if (!r.ok) return ack({ success: false, message: r.message });
    }
    if (payload.featured !== undefined) {
      sets.push("featured = ?");
      params.push(payload.featured ? 1 : 0);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(
        `UPDATE DECK_LISTS SET ${sets.join(", ")} WHERE id = ?`,
        params,
      );
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "Decklist not found." });
      }
      const [rows] = await db.execute(`${SELECT_DECKLIST_SQL} WHERE d.id = ? LIMIT 1`, [id]);
      const updated = safeDecklistRow(rows?.[0]);
      io?.emit?.("decklist:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown tcgGameId." });
      }
      console.error("[decklist:update] error", err);
      return ack({ success: false, message: "Failed to update decklist." });
    }
  });

  /* =========================================================
     DELETE DECKLIST  (ADMIN ONLY)
     ========================================================= */
  socket.on("decklist:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "Decklist id is required." });

    try {
      const [result] = await db.execute("DELETE FROM DECK_LISTS WHERE id = ?", [id]);
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
