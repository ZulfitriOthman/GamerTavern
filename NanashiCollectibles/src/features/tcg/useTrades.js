import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../merchant/useApiResource.js";
import { listTrades } from "./tradeService.js";

export function useTrades({ tcgGameId, limit } = {}) {
  const { socket, status: socketStatus } = useSocket();
  const enabled = Boolean(socket) && socketStatus === "connected";

  const { status, data, error } = useApiResource(
    () => listTrades(socket, { tcgGameId }),
    [socket, tcgGameId],
    { enabled }
  );

  const listings = limit ? (data || []).slice(0, limit) : data || [];
  return { status: enabled ? status : "loading", listings, error };
}
