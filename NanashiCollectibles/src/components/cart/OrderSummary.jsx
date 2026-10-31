import { resolveProductImageUrl } from "../../features/shop/productImage.js";
import { formatMoney } from "../../features/shop/format.js";

function ProductsSlot({ items }) {
  return (
    <ul className="flex flex-col gap-3 border-b border-white/10 pb-5">
      {items.map((item) => {
        const imageUrl = resolveProductImageUrl(item.image_url);
        return (
          <li key={item.id} className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-900">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : null}
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-ink-700 px-1 text-[10px] font-semibold text-amber-50/80">
                {item.quantity}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-amber-50/85">{item.name}</p>
            </div>
            <p className="shrink-0 text-sm text-amber-50/60">{formatMoney(Number(item.unit_price) * item.quantity)}</p>
          </li>
        );
      })}
    </ul>
  );
}

// Shared between CartPage and CheckoutPage. Only ever renders totals the
// caller actually has real backend data for — `shippingFee`/`shippingLabel`
// are omitted entirely (not shown as "—" or 0 by default) until checkout
// resolves a real shipping method, and there is deliberately no
// discount/tax line since nothing in this project computes one yet. See
// checkout.routes.js for what the backend actually returns.
export default function OrderSummary({ itemCount, items, subtotal, shippingFee, shippingLabel, total, sticky = false, children }) {
  return (
    <div
      className={[
        "flex flex-col gap-5 rounded-xl border border-white/10 bg-ink-800/60 p-6",
        sticky ? "lg:sticky lg:top-24" : "",
      ].join(" ")}
    >
      <h2 className="font-display text-lg font-semibold text-amber-50">Order summary</h2>

      {items?.length ? <ProductsSlot items={items} /> : null}

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-amber-50/60">Subtotal {itemCount != null ? `(${itemCount} item${itemCount === 1 ? "" : "s"})` : ""}</dt>
          <dd className="text-amber-50/90">{formatMoney(subtotal)}</dd>
        </div>
        {shippingFee != null ? (
          <div className="flex justify-between">
            <dt className="text-amber-50/60">{shippingLabel || "Shipping"}</dt>
            <dd className="text-amber-50/90">{Number(shippingFee) === 0 ? "Free" : formatMoney(shippingFee)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <span className="font-medium text-amber-50">Total</span>
        <span className="font-display text-xl font-semibold text-amber-50">{formatMoney(total ?? subtotal)}</span>
      </div>

      {children}
    </div>
  );
}
