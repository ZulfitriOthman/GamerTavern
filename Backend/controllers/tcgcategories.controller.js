// Backend/controllers/tcgcategories.controller.js
//
// Migrated to the NanashiCollectibles v2 schema. This retires the old
// CATEGORIES_TCG / CATEGORIES fallback-query logic entirely — neither of those
// legacy tables was ever confirmed to exist (they weren't in Database/All.sql, and
// this file used to try three different query shapes and catch "table doesn't
// exist" errors to figure out which one was real). `tcg_games` is now the single
// canonical source; the file name is kept to avoid an unrelated server.js import
// change, but its responsibility is now specifically the TCG games list, not a
// generic "categories" concept — commerce categories are `product_categories`,
// handled in product.controller.js.
import { requireAdmin } from "../modules/authz.module.js";

const toStr = (v) => (v == null ? "" : String(v)).trim();

function slugify(name) {
  return toStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function tcgCategoriesSocketController({ socket, io, db }) {
  socket.on("tcgcategories:list", async (_payload, ack) => {
    try {
      const [rows] = await db.query(
        "SELECT id, name, slug, status FROM TCG_GAMES ORDER BY name"
      );
      if (typeof ack === "function") ack({ success: true, data: rows || [] });
      socket.emit("tcgcategories:list", rows || []);
    } catch (err) {
      console.error("[tcgcategories.controller] tcgcategories:list error:", err?.message || err);
      if (typeof ack === "function") {
        ack({ success: false, data: [], message: "Failed to load TCG games." });
      }
      socket.emit("tcgcategories:list", []);
    }
  });

  socket.on("tcgcategories:create", async (payload = {}, ack) => {
    const respond = typeof ack === "function" ? ack : () => {};

    // Identity from the verified handshake, never the client-supplied payload.
    const auth = requireAdmin(socket);
    if (!auth.ok) return respond({ success: false, code: auth.code, message: auth.message });

    const name = toStr(payload?.name);
    if (!name) return respond({ success: false, message: "name is required." });
    const slug = toStr(payload?.slug) || slugify(name);

    try {
      await db.execute("INSERT INTO TCG_GAMES (name, slug) VALUES (?, ?)", [name, slug]);

      const [rows] = await db.query(
        "SELECT id, name, slug, status FROM TCG_GAMES ORDER BY name"
      );

      respond({ success: true, data: rows || [], message: "TCG game created." });
      io.emit("tcgcategories:updated", rows || []);
    } catch (err) {
      const duplicate = err?.code === "ER_DUP_ENTRY";
      respond({
        success: false,
        message: duplicate ? "A TCG game with that slug already exists." : "Failed to create TCG game.",
      });
    }
  });
}
