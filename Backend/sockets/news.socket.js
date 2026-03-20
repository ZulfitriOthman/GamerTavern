// Backend/sockets/news.socket.js

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function safeNewsRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    title: row.TITLE,
    content: row.CONTENT,
    date_posted: row.DATE_POSTED,
    author: row.AUTHOR,
    category: row.CATEGORY,
    image_url: row.IMAGE_URL,
    tags: row.TAGS,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

function safeTournamentRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    name: row.NAME,
    description: row.DESCRIPTION,
    start_date: row.START_DATE,
    end_date: row.END_DATE,
    location: row.LOCATION,
    entry_fee: row.ENTRY_FEE,
    game_title: row.GAME_TITLE,
    organizer: row.ORGANIZER,
    rules: row.RULES,
    registration_deadline: row.REGISTRATION_DEADLINE,
    max_teams: row.MAX_TEAMS,
    created_at: row.CREATED_AT,
    updated_at: row.UPDATED_AT,
  };
}

export default function newsSocketController({ socket, io, db }) {
  if (!db) console.error("[news.socket] ❌ db is missing");

  /* =========================================================
     LIST NEWS ARTICLES
     ========================================================= */
  socket.on("news:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const category = toStr(payload.category);
    const search = toStr(payload.search);
    const limit = toInt(payload.limit, 50);

    try {
      const where = [];
      const params = [];

      if (category && category !== "All") {
        where.push("CATEGORY = ?");
        params.push(category);
      }

      if (search) {
        where.push("(TITLE LIKE ? OR CONTENT LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const sql = `
        SELECT ID, TITLE, CONTENT, DATE_POSTED, AUTHOR, CATEGORY, IMAGE_URL, TAGS,
               CREATED_AT, UPDATED_AT
        FROM NEWS
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY DATE_POSTED DESC, CREATED_AT DESC
        LIMIT ?
      `;

      params.push(limit);

      const [rows] = await db.execute(sql, params);
      const news = (rows || []).map(safeNewsRow);

      return ack({ success: true, data: news });
    } catch (err) {
      console.error("[news:list] error", err);
      return ack({ success: false, message: "Failed to load news." });
    }
  });

  /* =========================================================
     LIST TOURNAMENTS
     ========================================================= */
  socket.on("tournament:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const game = toStr(payload.game);
    const monthKey = toStr(payload.month); // YYYY-MM

    try {
      const where = [];
      const params = [];

      if (game && game !== "All") {
        where.push("GAME_TITLE = ?");
        params.push(game);
      }

      if (monthKey) {
        // Filter by START_DATE within the given YYYY-MM
        where.push("DATE_FORMAT(START_DATE, '%Y-%m') = ?");
        params.push(monthKey);
      }

      const sql = `
        SELECT ID, NAME, DESCRIPTION, START_DATE, END_DATE, LOCATION, ENTRY_FEE,
               GAME_TITLE, ORGANIZER, RULES, REGISTRATION_DEADLINE, MAX_TEAMS,
               CREATED_AT, UPDATED_AT
        FROM TOURNAMENT
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY START_DATE ASC
      `;

      const [rows] = await db.execute(sql, params);
      const tournaments = (rows || []).map(safeTournamentRow);

      return ack({ success: true, data: tournaments });
    } catch (err) {
      console.error("[tournament:list] error", err);
      return ack({ success: false, message: "Failed to load tournaments." });
    }
  });
}
