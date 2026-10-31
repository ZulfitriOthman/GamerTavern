import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../merchant/useApiResource.js";
import { listDecklists } from "./decklistService.js";

export function useDecklists({ tcgGameId } = {}) {
  const { socket, status: socketStatus } = useSocket();
  const enabled = Boolean(socket) && socketStatus === "connected";

  const { status, data, error } = useApiResource(
    () => listDecklists(socket, { tcgGameId }),
    [socket, tcgGameId],
    { enabled }
  );

  return { status: enabled ? status : "loading", decklists: data || [], error };
}
