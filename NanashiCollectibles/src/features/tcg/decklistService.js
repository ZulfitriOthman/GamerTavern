// decklist:list — public, no auth required (Backend/controllers/decklist.controller.js).
// Not previously consumed by any frontend; the TCG page only ever showed a
// static "Decklists" preview card describing the idea, never real data.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

export function listDecklists(socket, { tcgGameId } = {}) {
  return emitWithAck(socket, "decklist:list", { tcgGameId: tcgGameId || null });
}
