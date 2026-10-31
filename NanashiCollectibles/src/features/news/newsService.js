// news:list — public read (Backend/controllers/news.controller.js), always
// status='published' for an unauthenticated/non-admin caller. Not previously
// consumed by any frontend page.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

export function listNews(socket, { limit, tcgGameId, categoryId } = {}) {
  return emitWithAck(socket, "news:list", {
    limit: limit || 20,
    tcgGameId: tcgGameId || null,
    categoryId: categoryId || null,
  });
}
