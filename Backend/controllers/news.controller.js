// Backend/controllers/news.controller.js
//
// Migrated to the NanashiCollectibles v2 schema: NEWS -> news, the hardcoded
// ["Magic","Yu-Gi-Oh","Pokemon","Vanguard","General"] category list retired in
// favor of the data-driven news_categories table (general, platform-wide
// categories — not TCG-specific), plus an optional tcg_game_id for
// game-specific articles. Publication now uses status/published_at — public
// reads only ever see status='published'.

import { sendBulkEmail } from "../modules/mailer.module.js";
import { requireAdmin } from "../modules/authz.module.js";

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function slugify(name) {
  return toStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 260);
}

function safeNewsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    tcg_game_id: row.tcg_game_id,
    tcg_game_name: row.tcg_game_name ?? null,
    title: row.title,
    slug: row.slug,
    content: row.content,
    date_posted: row.published_at, // deprecated alias
    published_at: row.published_at,
    author: row.author,
    category: row.category_name ?? null, // deprecated alias
    image_url: row.image_url,
    tags: row.tags,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_NEWS_SQL = `
  SELECT n.id, n.category_id, c.name AS category_name, n.tcg_game_id, g.name AS tcg_game_name,
         n.title, n.slug, n.content, n.image_url, n.author, n.tags, n.status,
         n.published_at, n.created_at, n.updated_at
  FROM NEWS n
  LEFT JOIN NEWS_CATEGORIES c ON c.id = n.category_id
  LEFT JOIN TCG_GAMES g ON g.id = n.tcg_game_id
`;

export default function newsSocketController({ socket, io, db }) {
  if (!db) console.error("[news.socket] ❌ db is missing");

  /* =========================================================
     LIST NEWS ARTICLES
     Public callers always get status='published' only, regardless of what they
     ask for. Only a verified admin can request drafts/'all'.
     ========================================================= */
  socket.on("news:list", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const categoryId = payload.categoryId != null ? toInt(payload.categoryId) : null;
    const tcgGameId = payload.tcgGameId != null ? toInt(payload.tcgGameId) : null;
    const search = toStr(payload.search);
    const limit = toInt(payload.limit, 50);

    let statusFilter = "published";
    const requestedStatus = toStr(payload.status);
    if (requestedStatus && requestedStatus !== "published") {
      const auth = requireAdmin(socket);
      if (auth.ok) statusFilter = requestedStatus; // 'draft' | 'all' — admin only
    }

    try {
      const where = [];
      const params = [];

      if (statusFilter !== "all") {
        where.push("n.status = ?");
        params.push(statusFilter);
      }
      if (categoryId) {
        where.push("n.category_id = ?");
        params.push(categoryId);
      }
      if (tcgGameId) {
        where.push("n.tcg_game_id = ?");
        params.push(tcgGameId);
      }
      if (search) {
        where.push("(n.title LIKE ? OR n.content LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }

      const sql = `
        ${SELECT_NEWS_SQL}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY n.published_at DESC, n.created_at DESC
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
     LIST NEWS CATEGORIES (public)
     ========================================================= */
  socket.on("news_categories:list", async (_payload, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};
    try {
      const [rows] = await db.query(`SELECT id, name, slug FROM NEWS_CATEGORIES ORDER BY name`);
      return ack({ success: true, data: rows || [] });
    } catch (err) {
      console.error("[news_categories:list] error", err);
      return ack({ success: false, message: "Failed to load news categories." });
    }
  });

  /* =========================================================
     CREATE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("news:create", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const title = toStr(payload.title);
    const content = toStr(payload.content);
    const categoryId = toInt(payload.categoryId ?? payload.category_id, 0);
    const tcgGameId = payload.tcgGameId ?? payload.tcg_game_id ?? null;
    const author = toStr(payload.author) || auth.user.name || "Admin";
    const imageUrl = toStr(payload.imageUrl ?? payload.image_url);
    const tags = toStr(payload.tags);
    const status = toStr(payload.status) === "published" ? "published" : "draft";
    const publishedAtRaw = toStr(payload.publishedAt ?? payload.published_at ?? payload.datePosted);

    if (!title) return ack({ success: false, message: "Title is required." });
    if (!content) return ack({ success: false, message: "Content is required." });
    if (!categoryId) return ack({ success: false, message: "categoryId is required." });

    let publishedAt = null;
    if (status === "published") {
      publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
      if (Number.isNaN(publishedAt.getTime())) {
        return ack({ success: false, message: "Invalid publish date." });
      }
    }

    const slugBase = slugify(payload.slug || title) || `news-${Date.now()}`;

    try {
      let newsId;
      let slug = slugBase;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [result] = await db.execute(
            `INSERT INTO NEWS (category_id, tcg_game_id, title, slug, content, image_url, author, tags, status, published_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [categoryId, tcgGameId || null, title, slug, content, imageUrl || null, author, tags || null, status, publishedAt]
          );
          newsId = result.insertId;
          break;
        } catch (err) {
          if (err?.code === "ER_DUP_ENTRY" && attempt < 2) {
            slug = `${slugBase}-${Date.now().toString(36)}`;
            continue;
          }
          throw err;
        }
      }

      const [rows] = await db.execute(`${SELECT_NEWS_SQL} WHERE n.id = ? LIMIT 1`, [newsId]);
      const created = safeNewsRow(rows?.[0]);
      io?.emit?.("news:created", created);

      // 📧 Broadcast to all users (non-blocking) — only for content that's actually
      // published; a draft shouldn't email anyone.
      if (status === "published") {
        (async () => {
          try {
            const [userRows] = await db.execute(
              "SELECT email FROM USERS WHERE email IS NOT NULL AND email <> ''",
            );
            const recipients = userRows.map((r) => r.email);
            if (!recipients.length) return;

            const safeTitle = String(created.title || "New Update");
            const safeContent = String(created.content || "");
            const subject = `📰 ${safeTitle}`;
            const escapeHtml = (s) =>
              String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            const paragraphs = safeContent
              .split(/\r?\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p)}</p>`)
              .join("");

            const imgHtml = created.image_url
              ? `<img src="${escapeHtml(created.image_url)}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0;" />`
              : "";

            const html = `
              <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;background:#0f172a;color:#fde68a;border-radius:12px;">
                <p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#f59e0b;margin:0 0 8px;">
                  Gamer Tavern · ${escapeHtml(created.category_name || "General")}
                </p>
                <h1 style="font-size:24px;margin:0 0 16px;color:#fef3c7;">${escapeHtml(safeTitle)}</h1>
                ${imgHtml}
                <div style="font-size:14px;line-height:1.6;color:#fef3c7;">${paragraphs}</div>
                <hr style="border:none;border-top:1px solid #78350f;margin:24px 0;" />
                <p style="font-size:12px;color:#fbbf24;margin:0;">
                  Posted by ${escapeHtml(created.author || "Admin")}
                </p>
              </div>
            `;

            const text = `${safeTitle}\n\n${safeContent}\n\n— ${created.author || "Admin"}`;

            const result = await sendBulkEmail({ recipients, subject, html, text });
            console.log(`[news:create] 📧 broadcast email — sent: ${result.sent}/${result.total ?? 0}`);
          } catch (mailErr) {
            console.error("[news:create] email broadcast failed:", mailErr);
          }
        })();
      }

      return ack({ success: true, data: created });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown categoryId or tcgGameId." });
      }
      console.error("[news:create] error", err);
      return ack({ success: false, message: "Failed to create news." });
    }
  });

  /* =========================================================
     UPDATE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("NEWS:update", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "News id is required." });

    const sets = [];
    const params = [];

    if (payload.title !== undefined) {
      const v = toStr(payload.title);
      if (!v) return ack({ success: false, message: "Title cannot be empty." });
      sets.push("title = ?");
      params.push(v);
    }
    if (payload.content !== undefined) {
      const v = toStr(payload.content);
      if (!v) return ack({ success: false, message: "Content cannot be empty." });
      sets.push("content = ?");
      params.push(v);
    }
    if (payload.categoryId !== undefined || payload.category_id !== undefined) {
      const v = toInt(payload.categoryId ?? payload.category_id, 0);
      if (!v) return ack({ success: false, message: "categoryId cannot be empty." });
      sets.push("category_id = ?");
      params.push(v);
    }
    if (payload.tcgGameId !== undefined || payload.tcg_game_id !== undefined) {
      sets.push("tcg_game_id = ?");
      params.push(payload.tcgGameId ?? payload.tcg_game_id ?? null);
    }
    if (payload.author !== undefined) {
      sets.push("author = ?");
      params.push(toStr(payload.author) || null);
    }
    if (payload.imageUrl !== undefined || payload.image_url !== undefined) {
      sets.push("image_url = ?");
      params.push(toStr(payload.imageUrl ?? payload.image_url) || null);
    }
    if (payload.tags !== undefined) {
      sets.push("tags = ?");
      params.push(toStr(payload.tags) || null);
    }
    if (payload.status !== undefined) {
      const status = toStr(payload.status) === "published" ? "published" : "draft";
      sets.push("status = ?");
      params.push(status);
      if (status === "published") {
        sets.push("published_at = COALESCE(published_at, NOW())");
      }
    }
    if (payload.publishedAt !== undefined || payload.published_at !== undefined || payload.datePosted !== undefined) {
      const raw = toStr(payload.publishedAt ?? payload.published_at ?? payload.datePosted);
      const dt = raw ? new Date(raw) : null;
      if (raw && (!dt || Number.isNaN(dt.getTime()))) {
        return ack({ success: false, message: "Invalid date." });
      }
      sets.push("published_at = ?");
      params.push(dt);
    }

    if (sets.length === 0) {
      return ack({ success: false, message: "Nothing to update." });
    }

    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    try {
      const [result] = await db.execute(`UPDATE NEWS SET ${sets.join(", ")} WHERE id = ?`, params);
      if (result.affectedRows === 0) {
        return ack({ success: false, message: "News not found." });
      }

      const [rows] = await db.execute(`${SELECT_NEWS_SQL} WHERE n.id = ? LIMIT 1`, [id]);
      const updated = safeNewsRow(rows?.[0]);
      io?.emit?.("news:updated", updated);
      return ack({ success: true, data: updated });
    } catch (err) {
      if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
        return ack({ success: false, message: "Unknown categoryId or tcgGameId." });
      }
      console.error("[NEWS:update] error", err);
      return ack({ success: false, message: "Failed to update NEWS." });
    }
  });

  /* =========================================================
     DELETE NEWS  (ADMIN ONLY)
     ========================================================= */
  socket.on("news:delete", async (payload = {}, cb) => {
    const ack = typeof cb === "function" ? cb : () => {};

    const auth = requireAdmin(socket);
    if (!auth.ok) return ack({ success: false, code: auth.code, message: auth.message });

    const id = toInt(payload.id, 0);
    if (!id) return ack({ success: false, message: "News id is required." });

    try {
      const [result] = await db.execute("DELETE FROM NEWS WHERE id = ?", [id]);
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
