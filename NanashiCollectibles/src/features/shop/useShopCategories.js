import { useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listShopCategories } from "./shopService.js";

// Live product_categories (id, name, slug, description) — not config/site.js's
// shopCategories, which is presentation copy for the homepage/footer only. The Shop
// page's category filter needs real category ids to send to product:list.
export function useShopCategories() {
  const { socket, status: socketStatus } = useSocket();
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    let cancelled = false;
    listShopCategories(socket)
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
