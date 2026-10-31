import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../merchant/useApiResource.js";
import { getProductBySlug } from "./shopService.js";

// Single product by slug for the product-detail page — reuses the same
// public product:list contract (see useShopProducts.js), never a separate
// endpoint. `enabled` false while the socket isn't connected yet.
export function useProduct(slug) {
  const { socket, status: socketStatus } = useSocket();
  const enabled = Boolean(socket) && socketStatus === "connected" && Boolean(slug);

  const { status, data, error, refresh } = useApiResource(
    () => getProductBySlug(socket, slug),
    [socket, slug],
    { enabled }
  );

  return { status: enabled ? status : "loading", socketStatus, product: data || null, error, refresh };
}
