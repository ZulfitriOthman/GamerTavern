// Backend/controllers/news.controller.js

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const NEWS_CATEGORIES = ["Magic", "Yu-Gi-Oh", "Pokemon", "Vanguard", "General"];

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
    console.error("[news] requireAdmin error", err);
    return { ok: false, message: "Authorization check failed." };
  }
}

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
     CREATE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("news:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const title = toStr(payload.title);
    const content = toStr(payload.content);
    const author = toStr(payload.author) || auth.user.NAME || "Admin";
    const category = toStr(payload.category) || "General";
    const imageUrl = toStr(payload.imageUrl ?? payload.image_url);
    const tags = toStr(payload.tags);
    const datePostedRaw = toStr(payload.datePosted ?? payload.date_posted);

    if (!title) return ack({ success: false, message: "Title is required." });
    if (!content) return ack({ success: false, message: "Content is required." });
    if (category && !NEWS_CATEGORIES.includes(category)) {
      return ack({ success: false, message: "Invalid category." });
    }

    try {
      const datePosted = datePostedRaw
        ? new Date(datePostedRaw)
        : new Date();
      if (Number.isNaN(datePosted.getTime())) {
        return ack({ success: false, message: "Invalid date." });
      }

      const sql = `
        INSERT INTO NEWS (TITLE, CONTENT, DATE_POSTED, AUTHOR, CATEGORY, IMAGE_URL, TAGS)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await db.execute(sql, [
        title,
        content,
        datePosted,
        author,
        category,
        imageUrl || null,
        tags || null,
      ]);

      const [rows] = await db.execute(
        `SELECT ID, TITLE, CONTENT, DATE_POSTED, AUTHOR, CATEGORY, IMAGE_URL, TAGS,
                CREATED_AT, UPDATED_AT
         FROM NEWS WHERE ID = ? LIMIT 1`,
        [result.insertId],
      );

      const created = safeNewsRow(rows?.[0]);
      io?.emit?.("news:created", created);
      return ack({ success: true, data: created });
    } catch (err) {
      console.error("[news:create] error", err);
      return ack({ success: false, message: "Failed to create news." });
    }
  });

  /* =========================================================
     UPDATE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("news:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "News id is required." });

    const sets = [];
    const params = [];

    if (payload.title !== undefined) {
      const v = toStr(payload.title);
      if (!v) return ack({ success: false, message: "Title cannot be empty." });
      sets.push("TITLE = ?");
      params.push(v);
    }
    if (payload.content !== undefined) {
      const v = toStr(payload.content);
      if (!v) return ack({ success: false, message: "Content cannot be empty." });
      sets.push("CONTENT = ?");
      params.push(v);
    }
    if (payload.category !== undefined) {
      const v = toStr(payload.category);
      if (v && !NEWS_CATEGORIES.includes(v)) {
        return ack({ success: false, message: "Invalid category." });
      }
      sets.push("CATEGORY = ?");
      params.push(v || "General");
    }
    if (payload.author !== undefined) {
      sets.push("AUTHOR = ?");
      params.push(toStr(payload.author) || null);
    }
    if (payload.imageUrl !== undefined || payload.image_url !== undefined) {
      sets.push("IMAGE_URL = ?");
      params.push(toStr(payload.imageUrl ?? payload.image_url) || null);
    }
    if (payload.tags !== undefined) {
      sets.push("TAGS = ?");
      params.push(toStr(payload.tags) || null);
    }
    if (payload.datePosted !== undefined || payload.date_posted !== undefined) {
      const raw = toStr(payload.datePosted ?? payload.date_posted);
      const dt = raw ? new Date(raw) : null;
      if (!dt || Number.isNaN(dt.getTime())) {
        return ack({ success: false, message: "Invalid date." });
      }
      sets.push("DATE_POSTED = ?");
      params.push(dt);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("UPDATED_AT = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(
        `UPDATE NEWS SET ${sets.join(", ")} WHERE ID = ?`,
        params,
      );
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "News not found." });
      }

      const [rows] = await db.execute(
        `SELECT ID, TITLE, CONTENT, DATE_POSTED, AUTHOR, CATEGORY, IMAGE_URL, TAGS,
                CREATED_AT, UPDATED_AT
         FROM NEWS WHERE ID = ? LIMIT 1`,
        [id],
      );

      const updated = safeNewsRow(rows?.[0]);
      io?.emit?.("news:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      console.error("[news:update] error", err);
      return ack({ success: false, message: "Failed to update news." });
    }
  });

  /* =========================================================
     DELETE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("news:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = await requireAdmin(db, payload.userId);
    if (!auth.ok) return ack({ success: false, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "News id is required." });

    try {
      const [result] = await db.execute("DELETE FROM NEWS WHERE ID = ?", [id]);
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "News not found." });
      }
      io?.emit?.("news:deleted", { id });
      return ack({ success: true, data: { id } });
    } catch (err) {
      console.error("[news:delete] error", err);
      return ack({ success: false, message: "Failed to delete news." });
    }
  });




}
