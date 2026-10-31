import { useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listTcgGames } from "./tcgService.js";

// Live tcg_games (id, name, slug, status) — mirrors features/shop/useShopCategories.js.
export function useTcgGames() {
  const { socket, status: socketStatus } = useSocket();
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    let cancelled = false;
    listTcgGames(socket)
      .then((data) => {
        if (cancelled) return;
        setGames(data || []);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [socket, socketStatus]);

  return { games, status };
}
