import SectionHeading from "../ui/SectionHeading.jsx";
import { Skeleton } from "../ui/Skeleton.jsx";
import ProductCard from "./ProductCard.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import { listShopProducts } from "../../features/shop/shopService.js";

// Deliberately simple: same category (falling back to same TCG game), same
// product:list read every other listing already uses, current product
// excluded client-side. No scoring/recommendation logic — the brief is
// explicit that a complex recommender isn't wanted here. `enabled` (via
// useApiResource, the same generic loading/success/error wrapper used
// elsewhere) covers the "no category or game on this product" case without
// needing a synchronous setState branch inside the effect body.
export default function RelatedProducts({ product }) {
  const { socket, status: socketStatus } = useSocket();
  const filterKey = product?.category_id ? "categoryId" : product?.tcg_game_id ? "tcgGameId" : null;
  const filterValue = filterKey === "categoryId" ? product?.category_id : product?.tcg_game_id;
  const enabled = Boolean(socket) && socketStatus === "connected" && Boolean(filterKey);

  const { status, data } = useApiResource(
    () => listShopProducts(socket, { [filterKey]: filterValue, limit: 5 }),
    [socket, filterKey, filterValue],
    { enabled }
  );

  const items = enabled ? (data?.items || []).filter((p) => p.id !== product.id).slice(0, 4) : [];

  if (!enabled || (status === "success" && items.length === 0)) return null;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading eyebrow="You might also like" title="Related products" size="section" />
      {status === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
