import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { getProductById } from "./merchantProductSocketService.js";

// Single-product read for the detail/edit screens — see the Phase 2A note in
// Backend/controllers/product.controller.js (product:list gained an `id` filter
// rather than a new duplicate endpoint).
//
// Mirrors features/tournament/useTournaments.js's load/refresh split exactly: `load`
// never calls setState synchronously (only inside the promise callbacks), so it's
// safe to call directly from the effect below; `refresh` resets to "loading"
// synchronously and is only ever called from a user action (a "Try again" button),
// never from an effect.
export function useMerchantProduct(id) {
  const { socket, status: socketStatus } = useSocket();
  const [status, setStatus] = useState("loading"); // loading | success | error | not_found
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!socket || socketStatus !== "connected" || !id) return undefined;
    return getProductById(socket, id)
      .then((found) => {
        if (!found) {
          setStatus("not_found");
          return;
        }
        setProduct(found);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [socket, socketStatus, id]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setStatus("loading");
    setError(null);
    return load();
  }, [load]);

  return { status, product, error, refresh };
}
