import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import Badge from "../ui/Badge.jsx";
import QuantityStepper from "../shop/QuantityStepper.jsx";
import { formatMoney } from "../../features/shop/format.js";
import { resolveProductImageUrl } from "../../features/shop/productImage.js";

// One CART_ITEMS row, already priced/stock-joined server-side (see
// cart.routes.js's loadCartWithItems — pricing here is always live, never
// cached from when the item was added). `busy` disables the stepper/remove
// control while a request for THIS item is in flight; the parent
// (CartPage) tracks which item id is busy so unrelated rows stay usable.
export default function CartItemRow({ item, busy, onQuantityChange, onRemove }) {
  const imageUrl = resolveProductImageUrl(item.image_url);
  const unavailable = item.product_status !== "active";
  const overStock = !unavailable && item.available_stock > 0 && item.quantity > item.available_stock;
  const outOfStock = !unavailable && item.available_stock <= 0;
  const lineTotal = Number(item.unit_price) * item.quantity;

  return (
    <li className="flex gap-4 py-5">
      <Link
        to={`/shop/${item.slug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-900 focus-ring sm:h-24 sm:w-24"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-amber-50/15">
            <Icon name="package" className="h-8 w-8" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/shop/${item.slug}`} className="min-w-0 truncate font-medium text-amber-50 hover:text-brand-300 focus-ring">
            {item.name}
          </Link>
          <p className="shrink-0 font-display font-semibold text-amber-50">{formatMoney(lineTotal)}</p>
        </div>

        <p className="text-sm text-amber-50/50">{formatMoney(item.unit_price)} each</p>

        {unavailable ? (
          <Badge tone="danger" className="w-fit">
            No longer available
          </Badge>
        ) : outOfStock ? (
          <Badge tone="danger" className="w-fit">
            Out of stock
          </Badge>
        ) : overStock ? (
          <Badge tone="danger" className="w-fit">
            Only {item.available_stock} left — update quantity
          </Badge>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <QuantityStepper
            value={item.quantity}
            min={1}
            max={item.available_stock > 0 ? item.available_stock : undefined}
            disabled={busy || unavailable || outOfStock}
            size="sm"
            onChange={(qty) => onQuantityChange(item.id, qty)}
          />
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded text-xs font-medium text-amber-50/50 transition-colors duration-150 hover:text-danger-400 focus-ring disabled:opacity-50"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
