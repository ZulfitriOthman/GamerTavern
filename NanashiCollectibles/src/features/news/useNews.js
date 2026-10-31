import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../merchant/useApiResource.js";
import { listNews } from "./newsService.js";

export function useNews({ limit, tcgGameId, categoryId } = {}) {
  const { socket, status: socketStatus } = useSocket();
  const enabled = Boolean(socket) && socketStatus === "connected";

  const { status, data, error } = useApiResource(
    () => listNews(socket, { limit, tcgGameId, categoryId }),
    [socket, limit, tcgGameId, categoryId],
    { enabled }
  );

  return { status: enabled ? status : "loading", articles: data || [], error };
}
