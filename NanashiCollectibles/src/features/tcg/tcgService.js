// src/features/tcg/tcgService.js
//
// tcgcategories:list — public, no auth required (Backend/controllers/
// tcgcategories.controller.js). Despite the "categories" file name it's the
// canonical TCG_GAMES list (id, name, slug, status) — the file's own header
// comment explains the legacy naming. Not previously consumed by any
// frontend; the homepage used a static config array instead.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

export function listTcgGames(socket) {
  return emitWithAck(socket, "tcgcategories:list", {});
}
