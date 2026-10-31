import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../merchant/useApiResource.js";
import { listShopProducts } from "./shopService.js";

const PAGE_SIZE = 20;

// Paginated, filtered, sorted read of the public marketplace catalogue
// (product:list, status defaults to "active" server-side — draft/archived products
// never reach this page). Reuses features/merchant/useApiResource.js: it's a generic
// loading/success/error wrapper around any Promise-returning fetcher, not actually
// REST-specific, so this avoids re-implementing the same bookkeeping a third time
// (features/tournament/useTournaments.js has the Socket.IO original).
export function useShopProducts(filters) {
  const { socket, status: socketStatus } = useSocket();
  const enabled = Boolean(socket) && socketStatus === "connected";

  const { status, data, error, refresh } = useApiResource(
    () => listShopProducts(socket, { ...filters, limit: PAGE_SIZE }),
    [
      socket,
      filters.categoryId,
      filters.tcgGameId,
      filters.productTypeId,
      filters.search,
      filters.sort,
      filters.page,
      filters.minPrice,
      filters.maxPrice,
      filters.inStock,
    ],
    { enabled }
  );

  return {
    status,
    socketStatus,
    items: data?.items || [],
    pagination: data?.pagination || null,
    error,
    refresh,
  };
}

// Small rail of featured products (products.featured — a real, vendor-set flag, see
// components/merchant/ProductForm.jsx's "Feature this product" checkbox) for the
// unfiltered "All Products" view only. `enabled` lets the page skip this fetch
// entirely once the shopper has searched/filtered.
export function useFeaturedProducts(enabled) {
  const { socket, status: socketStatus } = useSocket();
  const canFetch = enabled && Boolean(socket) && socketStatus === "connected";

  const { status, data } = useApiResource(
    () => listShopProducts(socket, { featured: true, sort: "newest", limit: 8 }),
    [socket, enabled],
    { enabled: canFetch }
  );

  return { status, items: canFetch ? data?.items || [] : [] };
}
