import { useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { listProductTypes } from "./shopService.js";

// Live product_types (id, category_id, name, slug, sort_order) — scoped per
// category (Single Card / Booster Box / ... under Trading Card Games), not
// a global flat list. Fetches the full active set once, same pattern as
// useShopCategories/useTcgGames; callers filter by category_id. Shared by
// ShopPage's Product Type filter and the merchant ProductForm.
export function useProductTypes() {
  const { socket, status: socketStatus } = useSocket();
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!socket || socketStatus !== "connected") return undefined;
    let cancelled = false;
    listProductTypes(socket)
      .then((data) => {
        if (cancelled) return;
        setTypes(data || []);
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

  return { types, status };
}
