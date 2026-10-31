// trade:list — public read (Backend/controllers/trade.controller.js), only
// returns status='active' listings. trade:create/trade:delete require auth
// and are not wired into any page yet — this pass only surfaces the public
// browse view as the TCG hub's "community activity" feed.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

export function listTrades(socket, { tcgGameId, type } = {}) {
  return emitWithAck(socket, "trade:list", { tcgGameId: tcgGameId || null, type: type || "all" });
}
