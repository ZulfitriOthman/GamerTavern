import { useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listProductCategories } from "./merchantProductSocketService.js";

export function useProductCategories() {
  const { socket, status: socketStatus } = useSocket();
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    let cancelled = false;
    listProductCategories(socket)
      .then((data) => {
        if (cancelled) return;
        setCategories(data || []);
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

  return { categories, status };
}
